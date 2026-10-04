package com.example.research.disputes;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** The data API's Chargeback, as resources/graphql-documents/disputeCase.graphql asks for it (made up). */
public record ChargebackData(
    String id, String transactionId, String reasonCode, BigDecimal amount, String currencyCode, LocalDate respondBy,
    Instant openedAt, String stageCode, Merchant merchant, LocalDate settlementDate) {

  public record Merchant(String legalName) {}
}
