package com.example.research;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Data;

/** What the screen gets, in the screen's own words (made up). */
@Data
public class TransactionLifecycleDto {
  private String txnId;
  private String status;
  private Instant authTime;
  private BigDecimal authAmt;
  private String currency;
  private String responseText;
  private String maskedPan;
  private String merchantName;
  private String mcc;
  private String riskTier;
  private String deviceId;
  private BigDecimal capturedAmt;
  private LocalDate settledDate;
  private BigDecimal refundedAmt;
  private String cbReason;
  private LocalDate respondBy;
}
