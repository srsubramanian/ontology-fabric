package com.example.research.disputes;

import org.springframework.graphql.client.HttpGraphQlClient;
import org.springframework.stereotype.Service;

/** Builds the dispute workbench's view of a chargeback from the data API (made up). */
@Service
public class DisputeCaseService {
  private final HttpGraphQlClient graphQl;
  private final DisputeCaseMapper mapper;
  private final DisputeStages stages;

  public DisputeCaseService(HttpGraphQlClient graphQl, DisputeCaseMapper mapper, DisputeStages stages) {
    this.graphQl = graphQl;
    this.mapper = mapper;
    this.stages = stages;
  }

  public DisputeCaseDto disputeCase(String id) {
    ChargebackData cb = graphQl.documentName("disputeCase").variable("id", id)
        .retrieveSync("chargeback").toEntity(ChargebackData.class);
    DisputeCaseDto dto = mapper.toDto(cb);
    dto.setStage(stages.describe(cb.stageCode()));
    return dto;
  }
}
