package com.example.research.disputes;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/** The data API's names to the dispute workbench's (made up). The stage is set in DisputeCaseService. */
@Mapper(componentModel = "spring")
public interface DisputeCaseMapper {

  @Mapping(target = "caseId", source = "id")
  @Mapping(target = "originalTxn", source = "transactionId")
  @Mapping(target = "reason", source = "reasonCode")
  @Mapping(target = "amount", source = "amount")
  @Mapping(target = "currency", source = "currencyCode")
  @Mapping(target = "respondBy", source = "respondBy")
  @Mapping(target = "openedAt", source = "openedAt")
  @Mapping(target = "merchantName", source = "merchant.legalName")
  @Mapping(target = "settledOn", source = "settlementDate")
  @Mapping(target = "stage", ignore = true)
  DisputeCaseDto toDto(ChargebackData cb);
}
