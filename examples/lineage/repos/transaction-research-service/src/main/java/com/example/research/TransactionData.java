package com.example.research;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** The data API's Transaction, as the GraphQL document in resources/graphql-documents asks for it (made up). */
public record TransactionData(
    String transactionId, Instant authorizedAt, BigDecimal amountAuthorized, String currencyCode, String responseCode,
    Card card, Merchant merchant, String deviceFingerprint, LocalDate settlementDate,
    List<LifecycleEvent> lifecycle, List<Capture> captures, List<Refund> refunds, List<Chargeback> chargebacks) {

  public record Card(String last4) {}
  public record Merchant(String name, String categoryCode, String riskTier) {}
  public record LifecycleEvent(String kind, String id, Instant at) {}
  public record Capture(String id, BigDecimal amount) {}
  public record Refund(String id, BigDecimal amount) {}
  public record Chargeback(String id, String reasonCode, LocalDate respondBy) {}
}
