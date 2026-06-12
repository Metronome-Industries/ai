# Concept mapping: Stripe UBBv1 to Metronome

## Table of contents

- Object hierarchy
- Concept map
- Event format differences
- Aggregation mapping
- Credit grant mapping

## Object hierarchy

Metronome separates **metering** (what you measure) from **rating** (what you charge). You can change pricing without changing event instrumentation, and vice versa.

```
Usage Events → Billable Metrics → Products → Rate Cards → Contracts → Invoices
```

- **Usage Events** — Raw records of customer activity
- **Billable Metrics** — Rules that aggregate events into billable quantities; define group keys for dimensional pricing
- **Products** — Named line items on an invoice; 1:1 relationship with billable metrics for usage products
- **Rate Cards** — Centralized price book assigning a price to each product; single fiat currency per card
- **Contracts** — Customer-specific agreements referencing a rate card; include commits, credits, overrides, schedules
- **Packages** — Reusable templates encoding rate card and contract details for PLG/self-serve flows
- **Invoices** — Generated automatically each billing period based on usage rated against the contract

## Concept map

| Stripe UBBv1 concept | Metronome concept | Notes |
| --- | --- | --- |
| [Billing Meter](https://docs.stripe.com/api/billing/meter/object) | [Billable Metric](https://docs.metronome.com/guides/implement-metronome/core-concepts/create-billable-metrics) | Both define aggregation rules. Streaming metrics support SUM, COUNT, MAX, LATEST. SQL metrics additionally support UNIQUE (count distinct). Compound group keys enable dimensional pricing. Group keys, aggregation type, and event type filter are immutable after creation. |
| [Meter Event](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api) | [Usage Event (Ingest)](https://docs.metronome.com/api-reference/usage/ingest-events) | Both represent individual usage records. Metronome events include a `transaction_id` for deduplication and support rich typed property payloads. |
| [Price](https://docs.stripe.com/api/prices) (usage-based) | [Rate](https://docs.metronome.com/guides/implement-metronome/core-concepts/create-manage-rate-cards) on a Rate Card | A Stripe Price defines unit cost and meter linkage. In Metronome, a Rate defines pricing for a Product on a Rate Card. Supports tiered, dimensional, and commit-specific rates. |
| [Product](https://docs.stripe.com/api/products) | [Product](https://docs.metronome.com/guides/implement-metronome/core-concepts/create-products-contracts) | In Stripe, Products group Prices. In Metronome, Products have a 1:1 relationship with billable metrics. Types: Usage, Subscription, Composite, Fixed. |
| [Subscription](https://docs.stripe.com/api/subscriptions) | [Contract](https://docs.metronome.com/guides/implement-metronome/core-concepts/create-products-contracts) | A Metronome Contract includes rate card references, commits, credits, discounts, overrides, and schedules. |
| [Credit Grant](https://docs.stripe.com/api/billing/credit-grant/object) | [Prepaid Commit or Credit](https://docs.metronome.com/api-reference/contracts/create-a-contract) | Commits have an invoice schedule (customer pays); Credits are complimentary (no invoice schedule). Both support priority, expiration, and scoped applicability. |
| Meter Segments | [Dimensional Pricing (group keys)](https://docs.metronome.com/guides/implement-metronome/core-concepts/create-manage-rate-cards#dimensional-pricing) | Stripe supports up to 2 segment dimensions. Metronome supports flexible compound group keys with higher cardinality limits. |
| [Subscription Schedule](https://docs.stripe.com/api/subscription_schedules) | Contract amendments and scheduling | Metronome supports in-contract scheduling of pricing changes, renewals, and amendments natively. |
| Invoice | [Invoice](https://docs.metronome.com/guides/invoices/overview) | Metronome generates invoices and pushes them to Stripe for payment collection. Default 24-hour grace period before finalization. |
| — (no equivalent) | [Package](https://docs.metronome.com/guides/implement-metronome/core-concepts/create-products-contracts) | Reusable template for standardized contract creation across many customers. |

Reference: [How Metronome works with Stripe](https://docs.stripe.com/billing/how-metronome-works-with-stripe)

## Event format differences

| Attribute | Stripe | Metronome |
| --- | --- | --- |
| Deduplication | Auto-generated if not provided | **Required** `transaction_id` (must be unique per event) |
| Customer ID | `stripe_customer_id` in payload | Metronome UUID or **ingest alias** (your internal ID) |
| Timestamp | Unix timestamp (integer) | RFC 3339 (e.g., `2024-01-15T10:00:00Z`) |
| Properties | Values as strings | Typed (numbers as numbers, not strings) |
| Property limit | Limited | Rich property payloads supported |
| Event type field | `event_name` | `event_type` (must exactly match billable metric filter) |

**Stripe event:**
```json
{
  "event_name": "api_requests",
  "payload": {
    "stripe_customer_id": "cus_xxx",
    "value": "1",
    "region": "us-east-1"
  },
  "timestamp": 1700000000
}
```

**Metronome event:**
```json
{
  "transaction_id": "unique-event-id-123",
  "customer_id": "metronome-customer-id",
  "event_type": "api_requests",
  "timestamp": "2024-01-15T10:00:00Z",
  "properties": {
    "region": "us-east-1",
    "value": 1
  }
}
```

## Aggregation mapping

Streaming metric aggregation types map directly:

| Stripe aggregation | Metronome aggregation | Notes |
| --- | --- | --- |
| `SUM` | `SUM` | Sums a numeric property across events |
| `COUNT` | `COUNT` | Counts matching events |
| `LAST` | `LATEST` | Takes the most recent value in the window |
| `MAX` (legacy only) | `MAX` | Maximum value in a window |
| — | `UNIQUE` | Count distinct; requires SQL billable metric |

For `UNIQUE` (count distinct) aggregation, use a [SQL billable metric](https://docs.metronome.com/guides/implement-metronome/core-concepts/billable-metrics-sql-editor).

## Credit grant mapping

| Stripe Credit Grant property | Metronome equivalent |
| --- | --- |
| `amount` | Commit or credit `access_schedule` amount (**use remaining balance, not original**) |
| `applicability_config` (scope to prices) | Product-specific commit or credit (`applicable_product_ids`) |
| `priority` | Priority ordering on contract |
| `effective_at` | `access_schedule` start date |
| `expires_at` | `access_schedule` end date |
| `category: "paid"` | **Prepaid Commit** (has invoice schedule — customer pays) |
| `category: "promotional"` | **Credit** (no invoice schedule — complimentary) |

Retrieve remaining balances using [`GET /v1/billing/credit_balance_summary`](https://docs.stripe.com/api/billing/credit-balance-summary). The credit grant object stores only the original amount, not the current balance.
