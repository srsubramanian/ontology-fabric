package com.example.research.disputes;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Data;

/** What the dispute workbench gets, in the disputes team's words (made up). */
@Data
public class DisputeCaseDto {
  private String caseId;
  private String originalTxn;
  private String reason;
  private BigDecimal amount;
  private String currency;
  private LocalDate respondBy;
  private Instant openedAt;
  private String stage;
  private String merchantName;
  private LocalDate settledOn;
}
