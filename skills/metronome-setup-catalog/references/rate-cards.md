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
| SUBSCRIPTION      | Fixed recurring amount                            | Deprecated    |

Use FLAT for simple per-unit pricing. Use TIERED for volume discounts. Avoid SUBSCRIPTION — it is deprecated; use a SUBSCRIPTION-type product with a FLAT rate instead.

## Step 1 — Create the rate card

```http
POST /v1/contract-pricing/rate-cards/create
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "name": "<rate card name>"
}
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

**`starting_at`** sets when the rate takes effect. Use your contract start date or earlier.

**`price` is in cents.** $0.01/unit → `1`. $10/unit → `1000`. $100/unit → `10000`.

## Example — full setup

Create a rate card for an API platform with per-call and per-token rates:

**Create rate card:**
```json
{ "name": "Standard API pricing" }
```

**Add rates:**
```json
{
  "rate_card_id": "<rate_card_uuid>",
  "rates": [
    {
      "product_id": "<api_calls_product_uuid>",
      "rate_type": "FLAT",
      "price": 1,
      "starting_at": "2026-01-01T00:00:00Z",
      "entitled": true
    },
    {
      "product_id": "<tokens_product_uuid>",
      "rate_type": "FLAT",
      "price": 2,
      "starting_at": "2026-01-01T00:00:00Z",
      "entitled": true
    }
  ]
}
```

This sets $0.01/API call and $0.02/1000 tokens (2 cents per token).

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
  "starting_at": "2026-01-01T00:00:00Z",
  "entitled": true
}
```

`size: null` on the last tier means "all remaining units." `price` is in cents per unit.

## Traps to avoid

- Do not use `addRate` (singular) for multiple rates — use `addRates` (plural) for batch efficiency.
- Do not omit `entitled: true` — the product will be silently inactive.
- Do not set prices in dollars — all amounts are in cents.
- Do not edit the rate card to give one customer a custom rate — use a contract-level override.
- Do not set `starting_at` in the future if you want rates to apply to contracts that start before that date — the rate only applies to usage on or after `starting_at`.
