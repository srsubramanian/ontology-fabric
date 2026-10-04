package com.example.research.disputes;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** The dispute workbench's one call: a chargeback case (made up). */
@RestController
public class DisputeCaseController {
  private final DisputeCaseService service;

  public DisputeCaseController(DisputeCaseService service) {
    this.service = service;
  }

  @GetMapping("/api/disputes/{id}")
  public DisputeCaseDto disputeCase(@PathVariable String id) {
    return service.disputeCase(id);
  }
}
