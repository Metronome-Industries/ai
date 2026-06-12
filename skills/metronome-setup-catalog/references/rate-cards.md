# Rate cards

A rate card is the shared price list for your product catalog. It defines default rates for each product. Customer contracts reference a rate card by `rate_card_id` and inherit its rates unless overridden at the contract level.

## How rate cards work

One rate card → many customers. When you change a rate on the rate card, that change propagates to every contract referencing it — unless that contract has an override for the affected product.

**Never modify the rate card to give one customer a custom rate.** Use a contract-level override instead. This keeps the rate card as the canonical price list and isolates customer-specific pricing to the contract.

## Rate types

| Type              | Behavior                                          | Status        |
| ----------------- | ------------------------------------------------- | ------------- |
| FLAT              | Fixed price per unit                              | GA            |
| TIERED            | Volume-based breakpoints (graduated pricing)      | GA            |
| PERCENTAGE        | Percentage of another product's charges           | GA            |
| TIERED_PERCENTAGE | Tiered percentage of another product's charges    | Feature-gated |
| SUBSCRIPTION      | Fixed recurring amount                            | Deprecated — use FLAT with billing_frequency |

## Step 1 — Create the rate card

```http
POST /v1/contract-pricing/rate-cards/create
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{ "name": "<rate card name>" }
```

Only `name` is required. **Save the returned `id`** — you need it for adding rates and for every contract you create.

## Step 2 — Add rates

Use the batch endpoint (preferred over `addRate`):

```http
POST /v1/contract-pricing/rate-cards/addRates
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "rate_card_id": "<rate_card_uuid>",
  "rates": [
    {
      "product_id": "<product_uuid>",
      "rate_type": "FLAT",
      "price": 1000,
      "starting_at": "<ISO8601>",
      "entitled": true
    }
  ]
}
```

Required fields per rate: `product_id`, `rate_type`, `starting_at`, `entitled`.

**`entitled: true` is required** to make the product active on contracts. Omitting it means the product is defined but will never appear on invoices.

**`price` is in cents.** $0.01/unit → `1`. $10/unit → `1000`. $100/unit → `10000`.

## Subscription rate (platform fee)

For a flat monthly fee, use a SUBSCRIPTION-type product with a FLAT rate. **SUBSCRIPTION products require `billing_frequency`** — omitting it returns an error.

```json
{
  "product_id": "<subscription product uuid>",
  "rate_type": "FLAT",
  "price": 2000,
  "billing_frequency": "MONTHLY",
  "starting_at": "<ISO8601>",
  "entitled": true
}
```

The rate card handles both the subscription fee and usage charges — they appear as separate line items on the invoice.

## Dimensional rates (pricing_group_values)

When a product has a `pricing_group_key`, set separate rates per dimension value:

```json
{
  "rates": [
    {
      "product_id": "<tokens product uuid>",
      "rate_type": "FLAT",
      "price": 2,
      "pricing_group_values": { "model_name": "gpt-4" },
      "starting_at": "<ISO8601>",
      "entitled": true
    },
    {
      "product_id": "<tokens product uuid>",
      "rate_type": "FLAT",
      "price": 1,
      "pricing_group_values": { "model_name": "gpt-3.5" },
      "starting_at": "<ISO8601>",
      "entitled": true
    }
  ]
}
```

## Tiered rate example

For volume-based pricing (e.g., first 10K calls at $0.01, then $0.005):

```json
{
  "product_id": "<product_uuid>",
  "rate_type": "TIERED",
  "tiers": [
    { "size": 10000, "price": 1 },
    { "size": null, "price": 0 }
  ],
  "starting_at": "<ISO8601>",
  "entitled": true
}
```

`size: null` on the last tier means "all remaining units." `price` is in cents per unit.

## Monthly recurring credits (recurring_credits)

For free monthly credits (e.g., $50 of free usage per month), use `recurring_credits` on the contract — not manual `access_schedule` segments. This goes on the contract (Step 6), but plan the FIXED product needed here.

```json
"recurring_credits": [{
  "name": "Monthly free credits",
  "product_id": "<FIXED product id>",
  "access_amount": {
    "unit_price": 5000000,
    "quantity": 1,
    "credit_type_id": "<usd_credit_type_id>"
  },
  "priority": 1,
  "commit_duration": { "value": 1, "unit": "PERIODS" },
  "starting_at": "<contract start ISO8601>"
}]
```

`commit_duration: PERIODS` auto-provisions a new credit grant each billing period. One declaration — not 12 manual segments. `product_id` must reference a **FIXED-type product**.

## Threshold alerts

After setup, configure spend and balance alerts:

```http
POST /v1/alerts/create
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "name": "Low balance warning",
  "alert_type": "low_remaining_contract_credit_and_commit_balance_reached",
  "threshold": 1000000,
  "customer_id": "<uuid>",
  "credit_type_id": "<usd_credit_type_id>"
}
```

`credit_type_id` is **required** for balance alert types. `threshold` is in cents.
Use for: low-balance warnings, auto-recharge triggers, spend cap notifications.

## Traps to avoid

- Do not use `addRate` (singular) for multiple rates — use `addRates` (plural) for batch efficiency.
- Do not omit `entitled: true` — the product will be silently inactive.
- Do not set prices in dollars — all amounts are in cents.
- Do not edit the rate card to give one customer a custom rate — use a contract-level override.
- Do not set `starting_at` in the future if you want rates to apply to contracts that start before that date.
- Do not use FLAT rate alone for SUBSCRIPTION products — `billing_frequency: "MONTHLY"` is required.
- Do not omit `credit_type_id` when creating balance alerts — required for balance-type alert_types.
