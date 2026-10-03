package com.example.research;

import org.springframework.stereotype.Service;

/** Builds the screen's view of a transaction from the data API (made up). */
@Service
public class TransactionLifecycleService {
  private final TransactionDataClient client;
  private final TransactionLifecycleMapper mapper;
  private final ResponseCodes responseCodes;

  public TransactionLifecycleService(TransactionDataClient client, TransactionLifecycleMapper mapper,
      ResponseCodes responseCodes) {
    this.client = client;
    this.mapper = mapper;
    this.responseCodes = responseCodes;
  }

  public TransactionLifecycleDto lifecycle(String transactionId) {
    TransactionData t = client.transaction(transactionId);
    TransactionLifecycleDto dto = mapper.toDto(t);
    dto.setStatus(LifecycleStatus.latest(t.lifecycle()));
    dto.setResponseText(responseCodes.describe(t.responseCode()));
    dto.setMaskedPan("•••• " + t.card().last4());
    return dto;
  }
}
