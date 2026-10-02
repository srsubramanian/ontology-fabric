// An illustrative worked example: a patch that answers CQ-116, written by hand to show the whole loop
// without asking Claude. A payment facilitator is a role a party plays (decision 7), and a sub-merchant points
// up to the facilitator it signed up through, in one direction.
export const EXAMPLE_QUESTION = 'CQ-116';

export const EXAMPLE_PATCH = `# Illustrative worked example for CQ-116.
schema:
  slots:
    sub_merchant_of:
      range: PaymentFacilitator
      description: The payment facilitator a sub-merchant signed up through.
  classes:
    PaymentFacilitator:
      is_a: PartyRole
      description: >-
        A merchant that signs up other merchants, its sub-merchants, under
        its own acquiring agreement.
      aliases: [PayFac, PF]
      annotations:
        owner: core
        lives_in: graph
        id_rule: "pf:{payfac_id}"
        no_standard: Not checked yet. Look for a FIBO or ISO 20022 concept before submitting.
    Merchant:
      slots: [sub_merchant_of]

question:
  answered_in: neptune
  walks: [Merchant.sub_merchant_of]
  query: |
    MATCH (sub:Merchant)-[:SUB_MERCHANT_OF]->(pf:PaymentFacilitator)
    RETURN pf.id AS facilitator, count(sub) AS sub_merchants, collect(sub.id)[..10] AS sample
    ORDER BY sub_merchants DESC
    LIMIT 50

# Under Acquirer, in the party roles' frame. The line runs down the gap right of the frame,
# clear of Acquirer.
layout:
  pos:
    PaymentFacilitator: [44, 498]
  ports:
    Merchant.sub_merchant_of: {from: [right, 0.9], via: [[208, 325.2], [208, 522]], to: [right, 0.5], label: {side: right}}
`;

/** Where a new draft starts: the parts, empty, with what each one is for. */
export const BLANK_PATCH = `# Merged into ontology/payments.yaml: maps merge, lists add to what's there.
schema:
  slots: {}
  classes: {}

# Replaces the question's gap: the relationships it walks and the query that answers it.
question:
  answered_in: neptune
  walks: []
  query: |

# Optional: where new classes sit and how new relationships run on the class map.
# The studio places and routes anything left out, and says so.
layout: {}
`;
