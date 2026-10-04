package com.example.research;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/** The data API's names to the screen's (made up). What isn't a rename is set in TransactionLifecycleService. */
@Mapper(componentModel = "spring")
public interface TransactionLifecycleMapper {

  @Mapping(target = "txnId", source = "transactionId")
  @Mapping(target = "authTime", source = "authorizedAt")
  @Mapping(target = "authAmt", source = "amountAuthorized")
  @Mapping(target = "currency", source = "currencyCode")
  @Mapping(target = "merchantName", source = "merchant.name")
  @Mapping(target = "mcc", source = "merchant.categoryCode")
  @Mapping(target = "riskTier", source = "merchant.riskTier")
  @Mapping(target = "deviceId", source = "deviceFingerprint")
  @Mapping(target = "settledDate", source = "settlementDate")
  @Mapping(target = "capturedAmt", source = "capturedAmount")
  @Mapping(target = "status", ignore = true)
  @Mapping(target = "responseText", ignore = true)
  @Mapping(target = "maskedPan", ignore = true)
  @Mapping(target = "refundedAmt", ignore = true)
  @Mapping(target = "cbReason", ignore = true)
  @Mapping(target = "respondBy", ignore = true)
  TransactionLifecycleDto toDto(TransactionData t);
}
