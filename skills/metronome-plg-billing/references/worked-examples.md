# Worked examples

## Contents

- Example 1: "Like OpenAI" — subscription + prepaid credits with per-model pricing
- Example 2: "Simple per-API-call" — pure usage with tiered pricing
- Example 3: "Enterprise annual deal" — prepaid commit with quarterly access schedule

---

## Example 1: "Like OpenAI"

### Founder says

"I want to charge a $20/month subscription that gives users a pool of credits, then they burn down on usage priced per model — like GPT-4 is more expensive than GPT-3.5."

### Matched patterns

Pattern 3 (subscription + overage) composed with Pattern 4 (prepaid credits) and dimensional pricing.

### Confirmed mock invoice

```
INVOICE — Acme Corp — January 2026
─────────────────────────────────────────────────────────────────
Line item                         Qty       Rate         Amount
─────────────────────────────────────────────────────────────────
Monthly Subscription                1       $20.00/mo     $20.00
Inference — gpt-4              50,000       $0.003/tok   $150.00
Inference — gpt-3.5          200,000       $0.001/tok   $200.00
Credits applied (from subscription)                     -$20.00
─────────────────────────────────────────────────────────────────
TOTAL DUE                                               $350.00
```

### Event schema spec

**Event type**: `inference`

| Property | Type | Purpose |
| --- | --- | --- |
| `model` | string | Pricing dimension (group key) — determines per-model rate |
| `tokens` | number | Aggregation key — total tokens consumed in this request |

**Transaction ID pattern**: `{service}_{request_id}_{timestamp}`

**Example event:**

```json
{
  "transaction_id": "inference-svc_req-7842_2026-01-15T10:30:00Z",
  "customer_id": "cust_01H1VECZV...",
  "event_type": "inference",
  "timestamp": "2026-01-15T10:30:00Z",
  "properties": {
    "model": "gpt-4",
    "tokens": 1500
  }
}
```

### Implementation

**Phase 5a — Shared infrastructure:**

1. Billable metric:

```json
POST /v1/billable-metrics/create
{
  "name": "Inference Tokens",
  "event_type_filter": { "in_values": ["inference"] },
  "aggregation_type": "SUM",
  "aggregation_key": "tokens",
  "group_keys": [["model"]]
}
```

2. Products:

```json
POST /v1/contract-pricing/products/create
{
  "name": "Monthly Subscription",
  "type": "SUBSCRIPTION"
}
```

```json
POST /v1/contract-pricing/products/create
{
  "name": "Inference",
  "type": "USAGE",
  "billable_metric_id": "<metric_id_from_step_1>"
}
```

3. Rate card with dimensional rates:

```json
POST /v1/contract-pricing/rate-cards/create
{
  "name": "AI Platform Standard",
  "aliases": [{ "name": "ai-platform-standard" }]
}
```

Add rates:

```json
POST /v1/contract-pricing/rate-cards/addRate
{
  "rate_card_id": "<rate_card_id>",
  "product_id": "<subscription_product_id>",
  "starting_at": "2026-01-01T00:00:00Z",
  "entitled": true,
  "rate_type": "SUBSCRIPTION",
  "subscription_rate": {
    "billing_frequency": "MONTHLY",
    "unit_price": 2000  // $20.00
  }
}
```

```json
POST /v1/contract-pricing/rate-cards/addRate
{
  "rate_card_id": "<rate_card_id>",
  "product_id": "<inference_product_id>",
  "starting_at": "2026-01-01T00:00:00Z",
  "entitled": true,
  "rate_type": "FLAT",
  "pricing_group_values": { "model": "gpt-4" },
  "price": 0.3  // $0.003/token (in cents: 0.3 cents per token)
}
```

```json
POST /v1/contract-pricing/rate-cards/addRate
{
  "rate_card_id": "<rate_card_id>",
  "product_id": "<inference_product_id>",
  "starting_at": "2026-01-01T00:00:00Z",
  "entitled": true,
  "rate_type": "FLAT",
  "pricing_group_values": { "model": "gpt-3.5" },
  "price": 0.1  // $0.001/token (in cents: 0.1 cents per token)
}
```

**Phase 5b — Customer-specific:**

4. Create customer:

```json
POST /v1/customers/create
{
  "name": "Acme Corp",
  "billing_config": {
    "billing_provider_type": "stripe",
    "stripe_customer_id": "cus_..."
  }
}
```

5. Create contract with monthly credit (representing the $20 subscription including credits):

```json
POST /v1/contracts/create
{
  "customer_id": "<customer_id>",
  "rate_card_id": "<rate_card_id>",
  "starting_at": "2026-01-01T00:00:00Z",
  "commits": [
    {
      "type": "PREPAID",
      "name": "Monthly Credit Allowance",
      "access_schedule": {
        "schedule_items": [
          {
            "amount": 2000,  // $20.00 in credits per month
            "starting_at": "2026-01-01T00:00:00Z",
            "ending_before": "2026-02-01T00:00:00Z"
          }
        ]
      },
      "invoice_schedule": {
        "schedule_items": [
          {
            "amount": 2000,  // $20.00
            "timestamp": "2026-01-01T00:00:00Z"
          }
        ]
      }
    }
  ]
}
```

### Verification

Ingest test events → pull draft invoice → compare against mock invoice. The subscription line + usage lines - credit application should match the mock total.

---

## Example 2: "Simple per-API-call with tiers"

### Founder says

"$0.01 per API call for the first 10,000, then $0.005 after that. No subscription fee."

### Matched pattern

Pattern 2 (tiered usage).

### Confirmed mock invoice

```
INVOICE — Beta Inc — January 2026
─────────────────────────────────────────────────────────────────
Line item                         Qty       Rate         Amount
─────────────────────────────────────────────────────────────────
API Calls (0–10,000)           10,000      $0.010/call   $100.00
API Calls (10,001+)            5,000       $0.005/call    $25.00
─────────────────────────────────────────────────────────────────
TOTAL DUE                                                $125.00
```

### Event schema spec

**Event type**: `api_call`

No properties needed (COUNT aggregation — each event = 1 call).

**Transaction ID pattern**: `{service}_{request_id}`

**Example event:**

```json
{
  "transaction_id": "api-gateway_req-abc123",
  "customer_id": "cust_02X...",
  "event_type": "api_call",
  "timestamp": "2026-01-15T14:22:00Z",
  "properties": {}
}
```

### Implementation

**Phase 5a — Shared infrastructure:**

1. Billable metric:

```json
POST /v1/billable-metrics/create
{
  "name": "API Calls",
  "event_type_filter": { "in_values": ["api_call"] },
  "aggregation_type": "COUNT"
}
```

2. Product:

```json
POST /v1/contract-pricing/products/create
{
  "name": "API Calls",
  "type": "USAGE",
  "billable_metric_id": "<metric_id>"
}
```

3. Rate card with tiered pricing:

```json
POST /v1/contract-pricing/rate-cards/create
{
  "name": "Pay-As-You-Go",
  "aliases": [{ "name": "payg" }]
}
```

```json
POST /v1/contract-pricing/rate-cards/addRate
{
  "rate_card_id": "<rate_card_id>",
  "product_id": "<product_id>",
  "starting_at": "2026-01-01T00:00:00Z",
  "entitled": true,
  "rate_type": "TIERED",
  "tiers": [
    { "size": 10000, "price": 1 },     // First 10,000: $0.01/call (1 cent)
    { "price": 0.5 }                    // After 10,000: $0.005/call (0.5 cents)
  ]
}
```

**Phase 5b — Customer-specific:**

4. Customer + contract (minimal):

```json
POST /v1/contracts/create
{
  "customer_id": "<customer_id>",
  "rate_card_id": "<rate_card_id>",
  "starting_at": "2026-01-01T00:00:00Z"
}
```

### Verification

Send 15,000 test events → draft invoice should show two tiered line items totaling $125.00.

---

## Example 3: "Enterprise annual deal"

### Founder says

"A customer commits $120K/year paid upfront, drawn down quarterly. They use compute and storage. If they exceed the commit, overage is billed at standard rates."

### Matched pattern

Pattern 5 (enterprise commit with quarterly access schedule).

### Confirmed mock invoice

**Commit purchase invoice (contract start):**
```
Annual Platform Commitment    1         $120,000.00   $120,000.00
─────────────────────────────────────────────────────────────────────
TOTAL DUE                                             $120,000.00
```

**Q1 usage invoice:**
```
Compute Hours              200,000      $0.10/hour     $20,000.00
Storage (GB-months)          5,000      $0.05/GB          $250.00
Credits applied (from commit)                         -$20,250.00
─────────────────────────────────────────────────────────────────────
TOTAL DUE                                                   $0.00
Remaining commit balance: $9,750.00 (of $30,000 Q1 tranche)
```

### Event schema spec

**Event type 1**: `compute`

| Property | Type | Purpose |
| --- | --- | --- |
| `hours` | number | Aggregation key — compute hours consumed |
| `instance_type` | string | Group key (if pricing varies by instance type) |

**Event type 2**: `storage`

| Property | Type | Purpose |
| --- | --- | --- |
| `gb_months` | number | Aggregation key — storage consumed |

**Transaction ID pattern**: `{service}_{resource_id}_{period_end}`

### Implementation

**Phase 5a — Shared infrastructure:**

1. Billable metrics:

```json
POST /v1/billable-metrics/create
{
  "name": "Compute Hours",
  "event_type_filter": { "in_values": ["compute"] },
  "aggregation_type": "SUM",
  "aggregation_key": "hours"
}
```

```json
POST /v1/billable-metrics/create
{
  "name": "Storage GB-Months",
  "event_type_filter": { "in_values": ["storage"] },
  "aggregation_type": "SUM",
  "aggregation_key": "gb_months"
}
```

2. Products:

```json
POST /v1/contract-pricing/products/create
{ "name": "Compute", "type": "USAGE", "billable_metric_id": "<compute_metric_id>" }
```

```json
POST /v1/contract-pricing/products/create
{ "name": "Storage", "type": "USAGE", "billable_metric_id": "<storage_metric_id>" }
```

3. Rate card:

```json
POST /v1/contract-pricing/rate-cards/create
{ "name": "Enterprise Standard", "aliases": [{ "name": "enterprise-std" }] }
```

Add rates:

```json
POST /v1/contract-pricing/rate-cards/addRate
{
  "rate_card_id": "<rate_card_id>",
  "product_id": "<compute_product_id>",
  "starting_at": "2026-01-01T00:00:00Z",
  "entitled": true,
  "rate_type": "FLAT",
  "price": 10  // $0.10/hour (10 cents)
}
```

```json
POST /v1/contract-pricing/rate-cards/addRate
{
  "rate_card_id": "<rate_card_id>",
  "product_id": "<storage_product_id>",
  "starting_at": "2026-01-01T00:00:00Z",
  "entitled": true,
  "rate_type": "FLAT",
  "price": 5  // $0.05/GB-month (5 cents)
}
```

**Phase 5b — Customer-specific:**

4. Contract with quarterly-access prepaid commit:

```json
POST /v1/contracts/create
{
  "customer_id": "<customer_id>",
  "rate_card_id": "<rate_card_id>",
  "starting_at": "2026-01-01T00:00:00Z",
  "ending_before": "2027-01-01T00:00:00Z",
  "commits": [
    {
      "type": "PREPAID",
      "name": "Annual Platform Commitment",
      "access_schedule": {
        "schedule_items": [
          { "amount": 3000000, "starting_at": "2026-01-01T00:00:00Z", "ending_before": "2026-04-01T00:00:00Z" },
          { "amount": 3000000, "starting_at": "2026-04-01T00:00:00Z", "ending_before": "2026-07-01T00:00:00Z" },
          { "amount": 3000000, "starting_at": "2026-07-01T00:00:00Z", "ending_before": "2026-10-01T00:00:00Z" },
          { "amount": 3000000, "starting_at": "2026-10-01T00:00:00Z", "ending_before": "2027-01-01T00:00:00Z" }
        ]
      },
      "invoice_schedule": {
        "schedule_items": [
          { "amount": 12000000, "timestamp": "2026-01-01T00:00:00Z" }
        ]
      }
    }
  ]
}
```

Note: `3000000` cents = $30,000 per quarter. `12000000` cents = $120,000 total invoiced upfront.

### Verification

Ingest compute and storage events for Q1 → draft invoice should show usage lines with credit applied from the $30,000 Q1 tranche. Remaining balance = $30,000 - actual usage cost.
