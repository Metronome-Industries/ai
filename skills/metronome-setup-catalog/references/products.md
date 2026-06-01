# Products

Products define what appears as a line item on customer invoices. Each product maps to one type of charge.

## Product types

| Type        | What it charges for                                    | Requires              |
| ----------- | ------------------------------------------------------ | --------------------- |
| USAGE       | Metered consumption linked to a billable metric        | `billable_metric_id`  |
| FIXED       | One-time or scheduled fixed amounts (commits, credits) | —                     |
| SUBSCRIPTION| Recurring flat fee (platform fee, seat fee)            | —                     |
| COMPOSITE   | Percentage-based charge derived from other products    | Feature flag          |
| PRO_SERVICE | Professional services charge                           | Feature flag          |

For most integrations you will create at least one USAGE product. FIXED products are needed when adding prepaid commits or credits to a contract.

## Linking to a billable metric

USAGE products must reference a billable metric via `billable_metric_id`. The metric determines what events feed into this product's charges.

One product → one billable metric. If you have two aggregation types (e.g., SUM of tokens and COUNT of requests), create two separate billable metrics and two separate products.

## Group key configuration

Group keys are defined on the billable metric but **activated on the product**. Two optional fields control downstream behavior:

**`pricing_group_key`** — enables dimensional pricing. Metronome looks up the rate matching the event's property value. Example: `["model_name"]` → charge `$0.02/token` for `gpt-4` and `$0.005/token` for `gpt-3.5`.

**`presentation_group_key`** — splits invoice line items by property at the same rate. Example: `["user_id"]` → one line item per user showing their individual usage, all charged at the same rate.

Both fields take an array of property names that must be a subset of the billable metric's `group_keys`.

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
  "presentation_group_key": ["<dimension>"]
}
```

Required fields: `name`, `type`.
`billable_metric_id` required when `type` is `USAGE`.

**Save the returned `id`** — you will need it when adding rates to the rate card.

## Examples

**Simple USAGE product — API calls:**
```json
{
  "name": "API calls",
  "type": "USAGE",
  "billable_metric_id": "<bm_uuid>"
}
```

**USAGE product with dimensional pricing:**
```json
{
  "name": "Tokens processed",
  "type": "USAGE",
  "billable_metric_id": "<bm_uuid>",
  "pricing_group_key": ["model_name"]
}
```

**FIXED product — for use in commit/credit access schedules:**
```json
{
  "name": "Prepaid commit",
  "type": "FIXED"
}
```

## Traps to avoid

- Do not forget to pass `billable_metric_id` for USAGE products — the API accepts the call without it but the product will not accumulate any usage charges.
- Do not use COMPOSITE or PRO_SERVICE without confirming the feature flag is enabled on your account.
- Do not use `presentation_group_key` for a property not in the billable metric's `group_keys` — rates will not resolve correctly.
- Product IDs are not easily discoverable after creation — save them immediately and record them in your integration notes.
