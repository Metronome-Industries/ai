---
public: true
hidden: true
---

# Events and billable metrics

## Table of contents

- Billable metrics
- Event structure
- Single vs batch ingestion
- Idempotency
- Timestamps and late events
- Ingest aliases
- Traps to avoid

## Billable metrics

Billable metrics define what you measure and bill for — API calls, storage GB, tokens processed, seats used, data transferred, etc. Create metrics before ingesting events that reference them. Events with an `event_type` that does not match any billable metric are silently ignored.

**Streaming metrics don't backfill.** A streaming billable metric only evaluates events ingested from the point it exists onward. Creating a new metric, or archiving one and creating a replacement, does **not** retroactively re-attribute or re-rate events that were already ingested — there is no backfill, even if the new metric's `event_type_filter` would otherwise match those older events. This is a separate failure mode from the "no matching metric" trap above: that one is about events never matching anything; this one is about events that already matched (or arrived before) a metric that didn't exist yet. (SQL billable metrics, which query a persistent `events` table rather than streaming forward, behave differently when swapped on a product — check current docs before assuming the same rule applies there.)

**Every dimension in `group_keys`, and the `aggregation_key` itself, needs a matching `property_filters` entry** or the create call fails with a named error (`"The specified aggregation key must be one of the property filter names."` / `"Group key '<key>' does not match one of the property filter names."`). See the `metronome-group-keys` skill for the full design flow when more than one dimension is involved.

Metric aggregation types:

| Type      | Behavior                              | Example                          |
| --------- | ------------------------------------- | -------------------------------- |
| Sum       | Sums a numeric property across events | Total tokens consumed            |
| Count     | Counts the number of events           | Total API calls                  |
| Max       | Takes the maximum value in the period | Peak concurrent connections      |
| Unique    | Counts distinct values of a property  | Active users                     |
| Latest    | Uses the most recent value            | Current seat count               |

Use the [Billable Metrics API](https://docs.metronome.com/api-reference/billable-metrics/) to create, list, and archive metrics.

## Event structure

Every usage event has these fields:

| Field            | Type   | Required | Description                                                        |
| ---------------- | ------ | -------- | ------------------------------------------------------------------ |
| `transaction_id` | string | Yes      | Unique idempotent identifier (1-128 characters)                    |
| `customer_id`    | string | Yes      | Metronome customer ID (or an ingest alias)                         |
| `event_type`     | string | Yes      | Must match a billable metric's event type                          |
| `timestamp`      | string | Yes      | ISO 8601 timestamp determining billing period attribution          |
| `properties`     | object | No       | Key-value pairs used by metric filters and grouping (e.g., region) |

Example:

```json
{
  "transaction_id": "myapp_req_abc123_2026-05-11T10:30:00Z",
  "customer_id": "cust_01H1VECZV...",
  "event_type": "api_call",
  "timestamp": "2026-05-11T10:30:00Z",
  "properties": {
    "model": "gpt-4",
    "region": "us-east-1",
    "tokens": 1500
  }
}
```

## Single vs batch ingestion

Use `POST /v1/ingest` for all event ingestion. For production workloads, always send events in batches (array of event objects in the request body). Each batch request accepts up to **100 events** (`maxItems: 100`). Batch ingestion is strongly preferred for throughput and efficiency.

Single-event calls are acceptable for testing and low-volume development. At scale, batching reduces API calls and costs significantly.

## Idempotency

The `transaction_id` field is the deduplication key. Sending the same `transaction_id` twice is safe — Metronome treats it as an idempotent retry and does not double-count.

Generate deterministic IDs derived from source data rather than random UUIDs. A pattern like `{source}_{record_id}_{timestamp}` enables safe retries without tracking which events were already sent.

```
# Good: deterministic, retryable
transaction_id: "billing-svc_req-7842_2026-05-11T10:30:00Z"

# Bad: random UUID, no safe retry
transaction_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

## Timestamps and late events

Events are attributed to a billing period based on their `timestamp` value, not when they arrive at Metronome. This means:

- Events can be sent out of order — Metronome uses the explicit timestamp for attribution.
- Events arriving after the billing period's grace period has expired will not count toward that closed period.
- Plan grace periods around your data pipeline's maximum latency to avoid losing events.
- **Events can only be backdated up to 34 days from ingestion time.** An out-of-range timestamp returns a `400` for the whole request, not a silent drop — `/v1/ingest` validates every event in the batch before publishing any of them, so one too-old (or future-dated beyond 24 hours) event fails the entire batch, including otherwise-valid events sent alongside it. Remove the invalid event(s) and retry the valid remainder rather than resending the batch unchanged. There is no self-serve recovery for data actually older than the window; corrections beyond 34 days require contacting Metronome's operations team. This is the same window used for `transaction_id` deduplication, so a retry more than 34 days after the original send is not deduplicated either.

See [invoicing reference](https://docs.metronome.com/overview/invoicing/) for grace period configuration.

## Ingest aliases

Customers can have multiple `ingest_aliases` — friendly identifiers that map to a single Metronome customer. Use aliases when different source systems use different customer identifiers (e.g., an internal database ID vs. an external platform ID).

Set aliases via `POST /v1/customers/{customer_id}/setIngestAliases`. Events sent with an alias in the `customer_id` field are automatically attributed to the correct customer.

## Traps to avoid

- Do not send events with an `event_type` that has no matching billable metric. They are silently ignored with no error returned.
- Do not use random UUIDs for `transaction_id` if you need retry safety. Use deterministic IDs derived from source event data.
- Do not send events with future timestamps. Events ahead of the current billing period may cause unexpected billing behavior.
- Do not rely on ingestion order for correctness. Always set explicit `timestamp` values.
- Do not over-aggregate before sending to Metronome. Metronome is optimized for granular events — pre-aggregating loses the ability to break down usage by dimensions.
- Do not wrap the ingest body in an object. The request body must be a bare JSON array: `[{...}, {...}]`. Sending `{ "usage": [...] }` or `{ "events": [...] }` returns a 400 with no clear error message — this is the most common Metronome ingest mistake.
