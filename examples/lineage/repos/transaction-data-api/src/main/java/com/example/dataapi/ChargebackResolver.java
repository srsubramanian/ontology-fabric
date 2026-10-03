package com.example.dataapi;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Controller;

/** Resolves a Chargeback on its own, for the dispute workbench, with its SQL (made up). */
@Controller
public class ChargebackResolver {

  private static final String CHARGEBACK = """
      SELECT 'cb:' || cb.CB_ID AS id,
             'auth:' || c.AUTH_ID AS transaction_id,
             cb.REASON_CD AS reason_code,
             cb.AMT_MINOR / 100 AS amount,
             cur.ALPHA_CODE AS currency_code,
             cb.RESPONSE_DUE_DT AS respond_by,
             cb.OPENED_TS AS opened_at,
             cb.STAGE_CD AS stage_code,
             m.LEGAL_NAME AS merchant_legal_name,
             s.SETTLED_DT AS settlement_date
        FROM CORE.FCT_CHARGEBACK cb
        JOIN CORE.FCT_CAPTURE c ON c.CAPTURE_ID = cb.CAPTURE_ID
        JOIN CORE.FCT_AUTHORIZATION a ON a.AUTH_ID = c.AUTH_ID
        JOIN REF.ISO_CURRENCY cur ON cur.NUMERIC_CODE = a.CURRENCY_NUM
        JOIN CORE.DIM_MERCHANT m ON m.MERCHANT_ID = a.MERCHANT_ID
        LEFT JOIN CORE.FCT_SETTLEMENT_ITEM s ON s.CAPTURE_ID = c.CAPTURE_ID
       WHERE cb.CB_ID = :cbId
      """;

  private final NamedParameterJdbcTemplate jdbc;

  public ChargebackResolver(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @QueryMapping
  public ChargebackCase chargeback(@Argument String id) {
    return jdbc.queryForObject(CHARGEBACK, Map.of("cbId", id.replaceFirst("^cb:", "")), ChargebackCase.ROW);
  }

  /** The schema's Chargeback, with the fields chargeback.graphqls adds (made up). */
  public record ChargebackCase(String id, String transactionId, String reasonCode, BigDecimal amount, String currencyCode,
      LocalDate respondBy, Instant openedAt, String stageCode, CaseMerchant merchant, LocalDate settlementDate) {
    static final RowMapper<ChargebackCase> ROW = (rs, n) -> new ChargebackCase(
        rs.getString("id"), rs.getString("transaction_id"), rs.getString("reason_code"), rs.getBigDecimal("amount"),
        rs.getString("currency_code"), rs.getObject("respond_by", LocalDate.class), rs.getTimestamp("opened_at").toInstant(),
        rs.getString("stage_code"), new CaseMerchant(rs.getString("merchant_legal_name")), rs.getObject("settlement_date", LocalDate.class));
  }

  /** The merchant as the dispute workbench needs it: its legal name. */
  public record CaseMerchant(String legalName) {}
}
