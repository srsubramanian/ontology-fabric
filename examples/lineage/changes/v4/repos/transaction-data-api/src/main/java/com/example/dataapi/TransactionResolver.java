package com.example.dataapi;

import java.util.List;
import java.util.Map;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.graphql.data.method.annotation.SchemaMapping;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Controller;

/** Resolves a Transaction from Snowflake, with the SQL kept here beside each field (made up). */
@Controller
public class TransactionResolver {

  private static final String TRANSACTION = """
      SELECT 'auth:' || a.AUTH_ID AS transaction_id,
             a.AUTH_TS AS authorized_at,
             a.AMT_MINOR / 100 AS amount_authorized,
             cur.ALPHA_CODE AS currency_code,
             a.RESP_CD AS response_code,
             k.PAN_LAST4 AS card_last4,
             k.NETWORK AS card_network,
             m.DBA_NAME AS merchant_name,
             m.MCC AS category_code,
             rs.TIER AS risk_tier,
             d.DEVICE_ID AS device_id,
             -- captured amounts come from CAPTURES below, one row per partial capture
             COALESCE(s.SETTLED_DT, NEXT_BUSINESS_DAY(c.CAPTURE_DT)) AS settlement_date
        FROM CORE.FCT_AUTHORIZATION a
        JOIN REF.ISO_CURRENCY cur ON cur.NUMERIC_CODE = a.CURRENCY_NUM
        JOIN CORE.DIM_CARD k ON k.CARD_TOKEN = a.CARD_TOKEN
        JOIN CORE.DIM_MERCHANT m ON m.MERCHANT_ID = a.MERCHANT_ID
        LEFT JOIN CORE.DIM_DEVICE d ON d.DEVICE_FP = a.DEVICE_FP
        LEFT JOIN RISK.MERCHANT_RISK_SCORES rs ON rs.MERCHANT_ID = m.MERCHANT_ID AND rs.IS_LATEST
        LEFT JOIN CORE.FCT_CAPTURE c ON c.AUTH_ID = a.AUTH_ID
        LEFT JOIN CORE.FCT_SETTLEMENT_ITEM s ON s.CAPTURE_ID = c.CAPTURE_ID
       WHERE a.AUTH_ID = :authId
      """;

  private static final String LIFECYCLE = """
      SELECT 'captured' AS kind, c.CAPTURE_ID AS id, c.CAPTURE_TS AS at FROM CORE.FCT_CAPTURE c WHERE c.AUTH_ID = :authId
      UNION ALL SELECT 'settled', s.SETTLEMENT_ID, s.SETTLED_DT FROM CORE.FCT_SETTLEMENT_ITEM s JOIN CORE.FCT_CAPTURE c USING (CAPTURE_ID) WHERE c.AUTH_ID = :authId
      UNION ALL SELECT 'disputed', cb.CB_ID, cb.OPENED_TS FROM CORE.FCT_CHARGEBACK cb JOIN CORE.FCT_CAPTURE c USING (CAPTURE_ID) WHERE c.AUTH_ID = :authId
      ORDER BY at
      """;

  private static final String REFUNDS = """
      SELECT r.REFUND_ID AS id,
             r.AMT_MINOR / 100 AS amount
        FROM CORE.FCT_REFUND r
        JOIN CORE.FCT_CAPTURE c USING (CAPTURE_ID)
       WHERE c.AUTH_ID = :authId
      """;

  private static final String CHARGEBACKS = """
      SELECT cb.CB_ID AS id,
             cb.REASON_CD AS reason_code,
             cb.RESPONSE_DUE_DT AS respond_by
        FROM CORE.FCT_CHARGEBACK cb
        JOIN CORE.FCT_CAPTURE c USING (CAPTURE_ID)
       WHERE c.AUTH_ID = :authId
       ORDER BY cb.OPENED_TS
      """;

  private static final String CAPTURES = """
      SELECT c.CAPTURE_ID AS id,
             c.AMT_MINOR / 100 AS amount
        FROM CORE.FCT_CAPTURE c
       WHERE c.AUTH_ID = :authId
      """;

  private final NamedParameterJdbcTemplate jdbc;

  public TransactionResolver(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @QueryMapping
  public Transaction transaction(@Argument String id) {
    return jdbc.queryForObject(TRANSACTION, Map.of("authId", authId(id)), Transaction.ROW);
  }

  @SchemaMapping(typeName = "Transaction", field = "lifecycle")
  public List<Transaction.LifecycleEvent> lifecycle(Transaction t) {
    return jdbc.query(LIFECYCLE, Map.of("authId", authId(t.transactionId())), Transaction.LifecycleEvent.ROW);
  }

  @SchemaMapping(typeName = "Transaction", field = "refunds")
  public List<Transaction.Refund> refunds(Transaction t) {
    return jdbc.query(REFUNDS, Map.of("authId", authId(t.transactionId())), Transaction.Refund.ROW);
  }

  @SchemaMapping(typeName = "Transaction", field = "chargebacks")
  public List<Transaction.Chargeback> chargebacks(Transaction t) {
    return jdbc.query(CHARGEBACKS, Map.of("authId", authId(t.transactionId())), Transaction.Chargeback.ROW);
  }

  @SchemaMapping(typeName = "Transaction", field = "captures")
  public List<Transaction.Capture> captures(Transaction t) {
    return jdbc.query(CAPTURES, Map.of("authId", authId(t.transactionId())), Transaction.Capture.ROW);
  }

  /** The ID rule's prefix off, for the warehouse key (decision 4): auth:5521 is AUTH_ID 5521. */
  private static String authId(String id) {
    return id.replaceFirst("^auth:", "");
  }
}
