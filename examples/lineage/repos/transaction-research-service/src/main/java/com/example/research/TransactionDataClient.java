package com.example.research;

import org.springframework.graphql.client.HttpGraphQlClient;
import org.springframework.stereotype.Component;

/** Calls the transaction data API (made up). */
@Component
public class TransactionDataClient {
  private final HttpGraphQlClient graphQl;

  public TransactionDataClient(HttpGraphQlClient graphQl) {
    this.graphQl = graphQl;
  }

  public TransactionData transaction(String id) {
    return graphQl.documentName("transactionLifecycle").variable("id", id)
        .retrieveSync("transaction").toEntity(TransactionData.class);
  }
}
