package com.example.dataapi;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.springframework.jdbc.core.RowMapper;

/** The schema's Transaction and its parts, read from the resolver's rows (made up). */
public record Transaction(String transactionId, Instant authorizedAt, BigDecimal amountAuthorized, String currencyCode,
    String responseCode, String approvalCode, Card card, Merchant merchant, String deviceFingerprint, BigDecimal capturedAmount,
    LocalDate settlementDate) {

  static final RowMapper<Transaction> ROW = (rs, n) -> new Transaction(
      rs.getString("transaction_id"), rs.getTimestamp("authorized_at").toInstant(), rs.getBigDecimal("amount_authorized"),
      rs.getString("currency_code"), rs.getString("response_code"), rs.getString("approval_code"), new Card(rs.getString("card_last4")),
      new Merchant(rs.getString("merchant_name"), rs.getString("category_code"), rs.getString("risk_tier")),
      rs.getString("device_fingerprint"), rs.getBigDecimal("captured_amount"), rs.getObject("settlement_date", LocalDate.class));

  public record Card(String last4) {}

  public record Merchant(String name, String categoryCode, String riskTier) {}

  public record LifecycleEvent(String kind, String id, Instant at) {
    static final RowMapper<LifecycleEvent> ROW = (rs, n) ->
        new LifecycleEvent(rs.getString("kind"), rs.getString("id"), rs.getTimestamp("at").toInstant());
  }
}
