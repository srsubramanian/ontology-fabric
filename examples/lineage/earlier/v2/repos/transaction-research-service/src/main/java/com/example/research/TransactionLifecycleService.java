package com.example.research;

import static java.math.BigDecimal.ZERO;

import java.math.BigDecimal;
import org.springframework.stereotype.Service;

/** Builds the screen's view of a transaction from the data API (made up). */
@Service
public class TransactionLifecycleService {
  private final TransactionDataClient client;
  private final TransactionLifecycleMapper mapper;
  private final ResponseCodes responseCodes;
  private final ReasonCodes reasonCodes;

  public TransactionLifecycleService(TransactionDataClient client, TransactionLifecycleMapper mapper,
      ResponseCodes responseCodes, ReasonCodes reasonCodes) {
    this.client = client;
    this.mapper = mapper;
    this.responseCodes = responseCodes;
    this.reasonCodes = reasonCodes;
  }

  public TransactionLifecycleDto lifecycle(String transactionId) {
    TransactionData t = client.transaction(transactionId);
    TransactionLifecycleDto dto = mapper.toDto(t);
    dto.setStatus(LifecycleStatus.latest(t.lifecycle()));
    dto.setResponseText(responseCodes.describe(t.responseCode()));
    dto.setMaskedPan("•••• " + t.card().last4());
    dto.setRefundedAmt(t.refunds().stream().map(TransactionData.Refund::amount).reduce(ZERO, BigDecimal::add));
    dto.setCbReason(t.chargebacks().isEmpty() ? null : reasonCodes.describe(t.chargebacks().get(0).reasonCode()));
    dto.setRespondBy(t.chargebacks().isEmpty() ? null : t.chargebacks().get(0).respondBy());
    return dto;
  }
}
