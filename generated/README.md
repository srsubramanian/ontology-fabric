# Generated from the ontology

Everything here is generated from `ontology/payments.yaml` (version 1.9.0) by
`tools/generate.py`. Don't edit these files: change the ontology, then run

```bash
python tools/generate.py
```

CI runs `python tools/generate.py --check` and fails when a file here no longer matches the ontology.

- `owl/`, `shacl/`, `jsonschema/`, `pydantic/`: LinkML's own generators. The RDF files are
  canonicalized, so the same schema always gives the same file.
- `neptune/`: openCypher load file headers. Node files carry every label in the class's chain
  (`:LABEL` values separated by `;`), and edge IDs follow `schema.json`'s `edge_id_rule`, so
  reloading the same data changes nothing.
- `opensearch/`: settings and mappings for the three indexes (decision 3), and the ontology
  index's documents. Vectors have 1024 dimensions; chunks use the S3 Vectors engine.

Files:

- `jsonschema/payments.schema.json`
- `neptune/edges/ACQUIRED_BY.csv`
- `neptune/edges/ACTS_AS.csv`
- `neptune/edges/ASSIGNED_TO.csv`
- `neptune/edges/AT_MERCHANT.csv`
- `neptune/edges/AUTHENTICATED_BY.csv`
- `neptune/edges/CAPTURES.csv`
- `neptune/edges/DISPUTES.csv`
- `neptune/edges/FROM_DEVICE.csv`
- `neptune/edges/HAS_EVIDENCE.csv`
- `neptune/edges/HAS_REASON.csv`
- `neptune/edges/HAS_RESPONSE.csv`
- `neptune/edges/HELD_BY.csv`
- `neptune/edges/IN_BIN_RANGE.csv`
- `neptune/edges/MENTIONS.csv`
- `neptune/edges/PART_OF.csv`
- `neptune/edges/REFUNDS.csv`
- `neptune/edges/REPORTS.csv`
- `neptune/edges/RESPONDS_TO.csv`
- `neptune/edges/REVERSES.csv`
- `neptune/edges/SEEN_AT.csv`
- `neptune/edges/SETTLES.csv`
- `neptune/edges/WITH_CARD.csv`
- `neptune/nodes/Acquirer.csv`
- `neptune/nodes/Arbitration.csv`
- `neptune/nodes/Authentication.csv`
- `neptune/nodes/Authorization.csv`
- `neptune/nodes/BinRange.csv`
- `neptune/nodes/Capture.csv`
- `neptune/nodes/Card.csv`
- `neptune/nodes/Cardholder.csv`
- `neptune/nodes/Chargeback.csv`
- `neptune/nodes/Chunk.csv`
- `neptune/nodes/Device.csv`
- `neptune/nodes/DisputeOutcome.csv`
- `neptune/nodes/Document.csv`
- `neptune/nodes/FraudReport.csv`
- `neptune/nodes/Issuer.csv`
- `neptune/nodes/Merchant.csv`
- `neptune/nodes/Organization.csv`
- `neptune/nodes/Person.csv`
- `neptune/nodes/PreArbitration.csv`
- `neptune/nodes/ReasonCode.csv`
- `neptune/nodes/Refund.csv`
- `neptune/nodes/Representment.csv`
- `neptune/nodes/ResponseCode.csv`
- `neptune/nodes/RetrievalRequest.csv`
- `neptune/nodes/Reversal.csv`
- `neptune/nodes/Settlement.csv`
- `neptune/schema.json`
- `opensearch/chunks.json`
- `opensearch/entities.json`
- `opensearch/ontology.json`
- `opensearch/ontology.ndjson`
- `owl/payments.ttl`
- `pydantic/payments.py`
- `shacl/payments.shacl.ttl`
