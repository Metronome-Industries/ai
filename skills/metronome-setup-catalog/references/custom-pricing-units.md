# Custom Pricing Units (CPUs)

Custom Pricing Units let you denominate pricing in named synthetic currencies — "Credits", "Tokens", "Points" — instead of raw dollars. Customers see and purchase Credits; Metronome handles the fiat conversion internally.

**This is different from Metronome's monetary credits** (which are dollar-denominated balances that offset invoices). CPUs are a distinct abstraction layer — a named unit you define, price in, and commit in.

---

## When to use CPUs vs. monetary pricing

| Use CPUs when | Use monetary pricing when |
|---|---|
| Customers should see "Credits" not "$0.002/token" | Dollar amounts on invoices are fine |
| You want to change fiat pricing without changing what customers were "sold" | Pricing is straightforward per-unit |
| Multiple products price in the same abstract unit | Each product has its own independent rate |
| You want credit packs (buy 1,000 Credits for $10) | Standard prepaid commit is sufficient |

---

## How CPUs work

1. **Create a CPU** — defines the named unit ("Credits")
2. **Set a fiat conversion rate** on the rate card — `fiat_per_custom_credit` (e.g., 1 Credit = $0.001)
3. **Set rates in CPU units** on the rate card (e.g., 10 Credits per 1K tokens)
4. **Commit in CPU units** — customers purchase X Credits upfront
5. **Usage draws from the CPU balance** — overage bills at the fiat conversion rate automatically

---

## API: Create a CPU

> **Note:** CPU creation may require dashboard access or Metronome support enablement — the endpoint may not be available on all accounts. If `POST /v1/credit-types/create` returns 404, contact Metronome to enable CPUs on your account.

```http
POST /v1/credit-types/create
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{ "name": "Credits" }
```

Returns a `credit_type_id` for the CPU. Save this — you'll use it everywhere below.

---

## API: Rate card with CPU conversion

Set `credit_type_conversions` on the rate card to define the fiat ↔ CPU exchange rate:

```http
POST /v1/contract-pricing/rate-cards/create
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "name": "Credit-based pricing",
  "credit_type_conversions": [{
    "custom_credit_type_id": "<cpu_credit_type_id>",
    "fiat_per_custom_credit": 1000
  }]
}
```

`fiat_per_custom_credit` is in cents. `1000` = 1 Credit costs $0.01 (1,000 cents per Credit = $10/100 Credits).

---

## API: Set rates in CPU units

When adding rates to the rate card, specify `credit_type_id` to denominate the rate in CPUs:

```http
POST /v1/contract-pricing/rate-cards/addRates
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "rate_card_id": "<rate_card_id>",
  "rates": [{
    "product_id": "<usage_product_id>",
    "rate_type": "FLAT",
    "price": 10,
    "credit_type_id": "<cpu_credit_type_id>",
    "starting_at": "<ISO8601>",
    "entitled": true
  }]
}
```

`price: 10` here means 10 Credits per unit (not dollars). The conversion to fiat happens via `fiat_per_custom_credit` on the rate card.

---

## API: Commit in CPU units

On the contract, set `access_schedule` in CPU units with `credit_type_id`:

```json
"commits": [{
  "product_id": "<FIXED product id>",
  "type": "PREPAID",
  "priority": 100,
  "access_schedule": {
    "schedule_items": [{
      "amount": 100000,
      "credit_type_id": "<cpu_credit_type_id>",
      "starting_at": "<ISO8601>",
      "ending_before": "<ISO8601>"
    }]
  },
  "invoice_schedule": {
    "schedule_items": [{
      "unit_price": 1000000,
      "quantity": 1,
      "credit_type_id": "2714e483-4ff1-48e4-9e25-ac732e8f24f2",
      "timestamp": "<purchase date>"
    }]
  }
}]
```

`access_schedule.amount` is in CPU units (100,000 Credits). `invoice_schedule` is in fiat cents (USD).

---

## Automatic overage conversion

When the CPU balance hits zero, Metronome automatically bills overage at the fiat rate defined by `fiat_per_custom_credit`. No additional configuration needed — it's built into the rate card conversion.

---

## Worked example: "Buy 1,000 Credits for $10, use 10 Credits per API call"

```
1. CPU: "Credits" → credit_type_id: <cpu_id>
2. Rate card: fiat_per_custom_credit: 1000  (1 Credit = $0.01)
3. Rate: price: 10, credit_type_id: <cpu_id>  (10 Credits per call)
4. Commit: access_schedule amount: 1000 Credits, invoice amount: $10 (1000000 cents)

Customer buys 1,000 Credits → $10 invoice
Each API call → 10 Credits deducted from balance
100 calls → balance exhausted
101st call → overage: 10 Credits × $0.01/Credit = $0.10 on next invoice
```

---

## Customer-specific discount (contract override)

To give one customer a discounted CPU rate without changing the rate card for everyone, use a contract-level override:

```json
"overrides": [{
  "starting_at": "<contract start ISO8601>",
  "type": "MULTIPLIER",
  "product_id": "<usage product id>",
  "multiplier": 0.8
}]
```

A multiplier of `0.8` gives a 20% discount. The override applies only to this customer's contract — all other customers on the same rate card are unaffected.

For a fixed custom rate instead of a percentage discount, use `"type": "OVERWRITE"`:

```json
"overrides": [{
  "starting_at": "<contract start ISO8601>",
  "type": "OVERWRITE",
  "product_id": "<usage product id>",
  "overwrite_rate": { "rate_type": "FLAT", "price": <cents> }
}]
```

---

## Traps to avoid

- Do not confuse CPUs with monetary credits — CPUs are named units; monetary credits are dollar-denominated balances.
- Do not set `fiat_per_custom_credit` in dollars — it is in cents.
- If CPU creation returns 404, the feature requires enablement — contact Metronome support. While waiting, build the same structure using USD (cents) as the credit type: set `credit_type_id` to the USD credit type ID on rates and commits. Switch to the CPU `credit_type_id` once the feature is enabled — no other changes needed.
- Do not mix CPU and fiat units in the same `access_schedule` — keep commit denomination consistent.
