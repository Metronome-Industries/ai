# Billable metrics

Billable metrics define what you measure and bill for. Each metric specifies an aggregation rule applied to usage events over a billing period.

## Aggregation types

| Type   | Behavior                                    | Use when                                      |
| ------ | ------------------------------------------- | --------------------------------------------- |
| COUNT  | Counts the number of matching events        | API calls, requests, jobs, transactions       |
| SUM    | Sums a numeric property across events       | Tokens consumed, bytes transferred, GB stored |
| MAX    | Takes the highest value seen in the period  | Peak seats, peak concurrent connections       |
| UNIQUE | Counts distinct values of a property        | Active users, unique devices                  |
| LATEST | Uses the most recent value before period end| Current seat count, snapshot metrics          |

`aggregation_key` is **required** for SUM, MAX, UNIQUE, and LATEST — it names the event property to aggregate. It is not used for COUNT.

**MAX vs LATEST for seat billing:** Use MAX to capture mid-period spikes (e.g., peak seats above a threshold). LATEST only captures the end-of-period snapshot and will miss overages that occur and then drop before the period closes.

## Group keys

Group keys on a billable metric control what you can aggregate and price by.

**Immutable after creation** — `group_keys`, `aggregation_type`, and `event_type_filter` cannot be changed once the metric is saved. Include every dimension you might ever need, even if you don't plan to use all of them immediately. Unused group keys have no cost.

**A group_key on the metric enables internal aggregation only.** It does NOT appear on invoices unless you also configure it on the product:
- `pricing_group_key` on the product → charge different rates per dimension value (e.g., `model_name`: gpt-4 vs gpt-3.5)
- `presentation_group_key` on the product → split invoice line items by dimension at the same rate (e.g., `user_id`: per-user breakdown)

To keep a dimension internal (hidden from customers), add it as a `group_key` but do NOT add it as `presentation_group_key` on the product.

**Cardinality warning:** Avoid high-cardinality properties as group keys (e.g., `request_id`, unbounded UUIDs). Contact Metronome support if any group key may exceed 1,000 distinct values.

---

## Confirmation gate — required before creating any metric

Group keys are immutable after creation. Before calling the API, present this table to the user and get explicit confirmation:

| Property | Include as group_key? | Use: pricing / presentation / internal |
|---|---|---|
| (fill in based on user's pricing) | yes / no | |

**Questions to ask:**
- Which properties drive different prices? (→ `pricing_group_key` candidates)
- Which properties should appear on the invoice? (→ `presentation_group_key` candidates)
- Which future dimensions might you add? (→ include now, no cost to unused keys)

**Do not call `POST /v1/billable-metrics/create` until the user confirms this table.**

---

## API call

```http
POST /v1/billable-metrics/create
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "name": "<metric name>",
  "aggregation_type": "SUM",
  "aggregation_key": "<property name>",
  "event_type_filter": {
    "in_values": ["<event_type>"]
  },
  "property_filters": [
    { "name": "<aggregation_key>", "exists": true },
    { "name": "<dimension>", "exists": true }
  ],
  "group_keys": [["<dimension>"]]
}
```

Required fields: `name`, `aggregation_type`.
`aggregation_key` required when `aggregation_type` is SUM, MAX, UNIQUE, or LATEST.

**`property_filters` is required when using `group_keys`**: every property referenced in `group_keys` AND the `aggregation_key` must appear in `property_filters`. Omitting any one returns `"The specified aggregation key must be one of the property filter names"` with no further detail.

**Save the returned `id`** — you will need it when creating products in the next step.

**After creating the metric, generate a matched sample event** using the user's actual `event_type` and property names so they can verify ingestion immediately:

```json
{
  "transaction_id": "<source>_<record_id>_<timestamp>",
  "customer_id": "<ingest_alias>",
  "event_type": "<the event_type you just configured>",
  "timestamp": "<ISO8601 within contract period>",
  "properties": {
    "<aggregation_key>": 1,
    "<group_key_dimension>": "<example value>"
  }
}
```

---

## Examples

**COUNT — API calls:**
```json
{
  "name": "API calls",
  "aggregation_type": "COUNT",
  "event_type_filter": { "in_values": ["api_call"] }
}
```

**SUM — tokens with model dimension:**
```json
{
  "name": "Tokens processed",
  "aggregation_type": "SUM",
  "aggregation_key": "tokens",
  "event_type_filter": { "in_values": ["inference"] },
  "property_filters": [
    { "name": "tokens", "exists": true },
    { "name": "model_name", "exists": true }
  ],
  "group_keys": [["model_name"]]
}
```

## Traps to avoid

- Do not use LATEST for seat overage billing — use MAX. LATEST misses spikes that resolve before period end.
- Do not use SUM without `aggregation_key` — the API accepts the call but aggregation silently produces zero.
- Do not send `"tokens": "1500"` (string) in events for a SUM metric — the property must be a number. Strings cause silent zero aggregation.
- Do not use `group_keys` without declaring matching `property_filters` — every property in `group_keys` AND the `aggregation_key` must appear in `property_filters` or the API returns a confusing error.
- Do not create the metric and move on — generate a sample event and verify ingestion before building downstream objects.
- Do not use `request_id` or other unbounded identifiers as group keys.
- Do not set `presentation_group_key` on the product for dimensions you want to keep internal — group_key on the metric alone is sufficient for internal aggregation.
