# Products

Products define what appears as a line item on customer invoices. Each product maps to one type of charge.

## Product types

| Type        | What it charges for                                    | Requires              |
| ----------- | ------------------------------------------------------ | --------------------- |
| USAGE       | Metered consumption linked to a billable metric        | `billable_metric_id`  |
| FIXED       | One-time or scheduled fixed amounts (commits, credits, recurring credits) | — |
| SUBSCRIPTION| Recurring flat fee (platform fee, seat fee)            | —                     |
| COMPOSITE   | Percentage-based charge derived from other products    | Feature flag          |
| PRO_SERVICE | Professional services charge                           | Feature flag          |

For most integrations you will create at least one USAGE product. **FIXED products are required when adding prepaid commits, credits, or recurring_credits to a contract** — create a FIXED product here and save its ID before moving to `metronome-create-contract`.

## Linking to a billable metric

USAGE products must reference a billable metric via `billable_metric_id`. The metric determines what events feed into this product's charges.

One product → one billable metric. If you have two aggregation types (e.g., SUM of tokens and COUNT of requests), create two separate billable metrics and two separate products.

## Group key configuration

Group keys are defined on the billable metric but **activated on the product**. Two optional fields control downstream behavior:

**`pricing_group_key`** — enables dimensional pricing. Metronome looks up the rate matching the event's property value. Example: `["model_name"]` → charge `$0.02/token` for `gpt-4` and `$0.005/token` for `gpt-3.5`.

**`presentation_group_key`** — splits invoice line items by property at the same rate. Example: `["user_id"]` → one line item per user showing their individual usage, all charged at the same rate.

Both fields take an array of property names that must be a subset of the billable metric's `group_keys`. Do not set `presentation_group_key` for dimensions you want to keep internal — omitting it keeps the dimension in the background aggregation only.

**Invoice rendering — what the customer sees:**

| Configuration | Invoice line items |
|---|---|
| No group keys | `Tokens — 2,300,000 units — $46.00` |
| `pricing_group_key` only | `Tokens — 2,300,000 units — $46.00` (one line, rated internally per tier) |
| `presentation_group_key` only | `Tokens (gpt-4o) — 300,000 units — $9.00` + `Tokens (gpt-4o-mini) — 2,000,000 units — $10.00` (one line per value, same rate) |
| Both keys | `Tokens (gpt-4o) — 300,000 units — $9.00` + `Tokens (gpt-4o-mini) — 2,000,000 units — $10.00` (one line per value, different rates) |

`presentation_group_key` controls visibility on the invoice. `pricing_group_key` controls which rate is applied. They are independent — you can price by dimension without showing it, or show it without pricing by it. The most common mistake is setting `presentation_group_key` when the user only wanted internal differentiation (keeps model hidden from customer).

## Per-unit scaling (quantity_conversion)

When pricing is expressed per-N units (e.g., $0.02 per 1,000 tokens), use `quantity_conversion` on the product to avoid fractional cent prices.

```json
"quantity_conversion": {
  "conversion_factor": 1000,
  "operation": "DIVIDE",
  "name": "1K tokens"
}
```

This divides the raw event quantity (e.g., 50,000 tokens → 50 units) before applying the rate. Set the rate on the rate card **per-1K in cents**. The invoice shows "1K tokens" as the unit label.

`operation` must be `"DIVIDE"`. `conversion_factor` is the divisor.

## API call

```http
POST /v1/contract-pricing/products/create
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "name": "<product name>",
  "type": "USAGE",
  "billable_metric_id": "<billable_metric_uuid>",
  "pricing_group_key": ["<dimension>"],
  "presentation_group_key": ["<dimension>"],
  "quantity_conversion": {
    "conversion_factor": 1000,
    "operation": "DIVIDE",
    "name": "1K tokens"
  }
}
```

Required fields: `name`, `type`.
`billable_metric_id` required when `type` is `USAGE`.

**Save the returned `id`** — you will need it when adding rates to the rate card, and when creating commits or credits on a contract.

## Examples

**Simple USAGE product — API calls:**
```json
{
  "name": "API calls",
  "type": "USAGE",
  "billable_metric_id": "<bm_uuid>"
}
```

**USAGE product with dimensional pricing and per-1K scaling:**
```json
{
  "name": "Tokens processed",
  "type": "USAGE",
  "billable_metric_id": "<bm_uuid>",
  "pricing_group_key": ["model_name"],
  "quantity_conversion": {
    "conversion_factor": 1000,
    "operation": "DIVIDE",
    "name": "1K tokens"
  }
}
```

**FIXED product — for prepaid commits, credits, and recurring_credits:**
```json
{
  "name": "Prepaid commit",
  "type": "FIXED"
}
```

**SUBSCRIPTION product — for recurring platform fees:**
```json
{
  "name": "Monthly platform fee",
  "type": "SUBSCRIPTION"
}
```

## Traps to avoid

- Do not forget to pass `billable_metric_id` for USAGE products — the API accepts the call without it but the product will not accumulate any usage charges.
- Do not use COMPOSITE or PRO_SERVICE without confirming the feature flag is enabled on your account.
- Do not use `presentation_group_key` for a property not in the billable metric's `group_keys` — rates will not resolve correctly.
- Do not use `divide_by` for quantity_conversion — the correct field is `conversion_factor` with `operation: "DIVIDE"`.
- Product IDs are not easily discoverable after creation — save them immediately and record them in your integration notes.
- FIXED products are required for commits, credits, and recurring_credits on contracts — not USAGE or SUBSCRIPTION products.
