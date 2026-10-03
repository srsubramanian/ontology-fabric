package com.example.research;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** The data API's Transaction, as the GraphQL document in resources/graphql-documents asks for it (made up). */
public record TransactionData(
    String transactionId, Instant authorizedAt, BigDecimal amountAuthorized, String currencyCode, String responseCode,
    String approvalCode,
    Card card, Merchant merchant, String deviceFingerprint, LocalDate settlementDate,
    List<LifecycleEvent> lifecycle, BigDecimal capturedAmount) {

  public record Card(String last4) {}
  public record Merchant(String name, String categoryCode, String riskTier) {}
  public record LifecycleEvent(String kind, String id, Instant at) {}
}
