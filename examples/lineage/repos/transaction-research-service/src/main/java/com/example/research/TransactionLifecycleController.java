package com.example.research;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** The transaction research screen's one call: a transaction's whole life (made up). */
@RestController
public class TransactionLifecycleController {
  private final TransactionLifecycleService service;

  public TransactionLifecycleController(TransactionLifecycleService service) {
    this.service = service;
  }

  @GetMapping("/api/transactions/{id}/lifecycle")
  public TransactionLifecycleDto lifecycle(@PathVariable String id) {
    return service.lifecycle(id);
  }
}
