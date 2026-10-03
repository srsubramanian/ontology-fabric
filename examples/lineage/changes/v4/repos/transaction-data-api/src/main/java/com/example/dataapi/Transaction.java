package com.example.dataapi;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.springframework.jdbc.core.RowMapper;

/** The schema's Transaction and its parts, read from the resolver's rows (made up). */
public record Transaction(String transactionId, Instant authorizedAt, BigDecimal amountAuthorized, String currencyCode,
    String responseCode, Card card, Merchant merchant, String deviceId, LocalDate settlementDate) {

  static final RowMapper<Transaction> ROW = (rs, n) -> new Transaction(
      rs.getString("transaction_id"), rs.getTimestamp("authorized_at").toInstant(), rs.getBigDecimal("amount_authorized"),
      rs.getString("currency_code"), rs.getString("response_code"), new Card(rs.getString("card_last4"), rs.getString("card_network")),
      new Merchant(rs.getString("merchant_name"), rs.getString("category_code"), rs.getString("risk_tier")),
      rs.getString("device_id"), rs.getObject("settlement_date", LocalDate.class));

  public record Card(String last4, String network) {}

  public record Merchant(String name, String categoryCode, String riskTier) {}

  public record LifecycleEvent(String kind, String id, Instant at) {
    static final RowMapper<LifecycleEvent> ROW = (rs, n) ->
        new LifecycleEvent(rs.getString("kind"), rs.getString("id"), rs.getTimestamp("at").toInstant());
  }

  public record Capture(String id, BigDecimal amount) {
    static final RowMapper<Capture> ROW = (rs, n) -> new Capture(rs.getString("id"), rs.getBigDecimal("amount"));
  }

  public record Refund(String id, BigDecimal amount) {
    static final RowMapper<Refund> ROW = (rs, n) -> new Refund(rs.getString("id"), rs.getBigDecimal("amount"));
  }

  public record Chargeback(String id, String reasonCode, LocalDate respondBy) {
    static final RowMapper<Chargeback> ROW = (rs, n) ->
        new Chargeback(rs.getString("id"), rs.getString("reason_code"), rs.getObject("respond_by", LocalDate.class));
  }
}
