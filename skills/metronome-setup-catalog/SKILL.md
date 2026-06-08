---
name: metronome-setup-catalog
description: >-
  End-to-end Metronome setup from pricing intent to a verified live contract —
  billable metrics, products, rate card, customer, and contract in order.
  Use when asked to set up Metronome from scratch, bill a first customer, build
  a pricing model, create a billable metric or product, configure a rate card,
  or complete any compound billing setup task end-to-end.
argument-hint: <pricing_description>
---

End-to-end setup from pricing intent to a verified live contract. The catalog (Steps 1–4) is shared infrastructure created once; customers and contracts (Steps 5–6) repeat per customer. Base URL: `https://api.metronome.com/v1` (prod) or `https://staging.api.metronome.com/v1` (sandbox). Authenticate with `Authorization: Bearer $METRONOME_API_TOKEN`.

**Scope:** First-time catalog setup only. Does not cover Stripe Connect, Revenue Recognition, tax orchestration, or billing provider-specific features. For topics not covered here, say so explicitly — do not infer from general knowledge.

## Routing

| Task                                            | Reference / step                              |
| ----------------------------------------------- | --------------------------------------------- |
| Define what to measure                          | <references/billable-metrics.md> — then Step 1 |
| Define invoice line items                       | <references/products.md> — then Step 2        |
| Set default pricing                             | <references/rate-cards.md> — then Steps 3–4   |
| Match pricing intent to Metronome architecture  | <references/pricing-patterns.md>              |
| Bill in credits, tokens, or named units         | <references/custom-pricing-units.md>          |
| Onboard a customer                              | Step 5 below                                  |
| Create a contract                               | Step 6 below                                  |
| Advanced contract options (commits, credits, overrides) | `metronome-create-contract` skill      |

Read the relevant reference file before making any API calls.

## Setup order

Hard dependencies — do not skip ahead. **Save every ID returned at each step.**

```
Step 1 → Billable Metric(s)      POST /v1/billable-metrics/create
Step 2 → Product(s)              POST /v1/contract-pricing/products/create
           ↑ needs BM IDs from Step 1
Step 3 → Rate Card               POST /v1/contract-pricing/rate-cards/create
Step 4 → Add rates               POST /v1/contract-pricing/rate-cards/addRates
           ↑ needs Product IDs from Step 2
Step 5 → Customer                POST /v1/customers
Step 6 → Contract                POST /v1/contracts/create
           ↑ needs customer_id from Step 5 + rate_card_id from Step 3
Step 7 → Verify                  GET /v1/customers/{id}/invoices (required)
```

---

## Step 1 — Billable Metric(s)

Read <references/billable-metrics.md> to choose aggregation type and plan group keys.

```http
POST /v1/billable-metrics/create
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "name": "<metric name>",
  "aggregation_type": "<SUM|COUNT|MAX|UNIQUE|LATEST>",
  "aggregation_key": "<property name>",
  "event_type_filter": { "in_values": ["<event_type>"] },
  "group_keys": [["<dimension>"]]
}
```

`aggregation_key` required for SUM, MAX, UNIQUE, LATEST. Not used for COUNT.
**Save: `id` → billable_metric_id**

---

## Step 2 — Product(s)

Read <references/products.md> to choose product type and configure group keys.

```http
POST /v1/contract-pricing/products/create
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "name": "<product name>",
  "type": "USAGE",
  "billable_metric_id": "<billable_metric_id from Step 1>"
}
```

**Save: `id` → product_id**

---

## Step 3 — Rate Card

```http
POST /v1/contract-pricing/rate-cards/create
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{ "name": "<rate card name>" }
```

**Save: `id` → rate_card_id** — needed for every contract you create.

---

## Step 4 — Add rates

Read <references/rate-cards.md> for rate types, subscription rates, and tiered examples.

```http
POST /v1/contract-pricing/rate-cards/addRates
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "rate_card_id": "<rate_card_id from Step 3>",
  "rates": [
    {
      "product_id": "<product_id from Step 2>",
      "rate_type": "FLAT",
      "price": <price in cents>,
      "starting_at": "<ISO8601>",
      "entitled": true
    }
  ]
}
```

`entitled: true` is required — omitting it leaves the product silent on contracts.
All prices in cents: $0.01 → `1`, $1.00 → `100`, $10.00 → `1000`.

---

## Step 5 — Customer

```http
POST /v1/customers
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "name": "<legal entity name>",
  "ingest_aliases": ["<your_system_customer_id>"]
}
```

`ingest_aliases` maps your internal customer ID to Metronome — use it as the `customer_id` field in usage events. **Save: `id` → customer_id**

> For advanced customer setup (Salesforce ID, Slack channel, duplicate checking), use the `metronome-create-customer` skill.

---

## Step 6 — Contract

```http
POST /v1/contracts/create
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "customer_id": "<customer_id from Step 5>",
  "rate_card_id": "<rate_card_id from Step 3>",
  "starting_at": "<ISO8601>",
  "ending_before": "<ISO8601>"
}
```

`ending_before` is exclusive — a contract ending Dec 31 2026 = `"2027-01-01T00:00:00Z"`.
Omit `ending_before` for an evergreen (month-to-month) contract.
**Save: contract `id`**

> For contracts with prepaid commits, credits, rate overrides, or multi-year ramps, use the `metronome-create-contract` skill.

---

## Step 7 — Verification (required)

Setup is not complete until the draft invoice is confirmed. Do not declare success without showing a line item.

**Ingest a test event** (bare JSON array — do not wrap in an object):
```http
POST /v1/ingest
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

[{
  "transaction_id": "test-setup-verify-001",
  "customer_id": "<ingest_alias or customer_id>",
  "event_type": "<event_type from Step 1>",
  "timestamp": "<ISO8601 within contract period>",
  "properties": { "<aggregation_key>": 1 }
}]
```

**Check the draft invoice:**
```http
GET /v1/customers/<customer_id>/invoices?type=USAGE&status=DRAFT
Authorization: Bearer $METRONOME_API_TOKEN
```

A line item with your product name and a non-zero quantity confirms the full chain is working. If no line item appears, check: event `event_type` matches the billable metric filter, `timestamp` falls within the contract period, and `entitled: true` was set on the rate.

> **Timing note:** If the contract `starting_at` is in the future (> 24 hours from now), events with timestamps in that period will be rejected. In this case, verify the rate card structure directly instead:
>
> ```http
> POST /v1/contract-pricing/rate-cards/getRates
> Authorization: Bearer $METRONOME_API_TOKEN
> Content-Type: application/json
>
> { "rate_card_id": "<id>", "at": "<contract start ISO8601>" }
> ```
>
> Confirm each product appears with a rate and `entitled: true`. Full invoice verification can be done once the contract period begins.

---

## Critical rules

- *Group keys are immutable after creation.* Plan all pricing dimensions upfront — unused group keys are free, missing ones cannot be added retroactively.
- *Rate cards are shared.* Changing a rate propagates to all contracts without overrides. Never modify the rate card for one customer — use a contract-level override.
- *All monetary amounts are in cents.* $1 → `100`, $0.01 → `1`.
- *`entitled: true` is required on each rate.* Omitting it silently disables the product.
- *Ingest body must be a bare JSON array.* `[{...}]` not `{"usage": [...]}`.
- *Confirm the environment before any write.* If staging is unreachable, ask the user which environment to use — do not silently switch to production.

## Key documentation

- [Metronome Documentation](https://docs.metronome.com/)
- [API Reference](https://docs.metronome.com/api-reference/)
- [Design Usage Events](https://docs.metronome.com/guides/events/design-usage-events)
- [Pricing and Packaging](https://docs.metronome.com/guides/pricing-packaging/)
