---
name: metronome-create-contract
description: Creates a Metronome contract for an existing customer from signed order form terms — commits, credits, and rate overrides. Use when asked to create a contract, set up a contract, add a commit or credit, configure pricing, or start a new contract.
argument-hint: <customer_id_or_name>
---

# metronome-create-contract

Creates a contract for an existing Metronome customer from signed order form terms.
Two-step: preview then confirm. Calls the API directly for both the read check and the write.

Base URL: `https://api.metronome.com/v1` (prod) or `https://staging.api.metronome.com/v1` (sandbox).

**Prerequisites the user must supply:**
- Customer ID (from `metronome-create-customer` or via `GET /v1/customers` — match by `name` field)
- Product IDs for commits or credits — these must be **FIXED-type products**. Create them in `metronome-setup-catalog` Step 2 before this step. Commits, credits, and recurring_credits all require a FIXED product.

---

## Step 1 — Collect terms from the order form

Extract or ask for:

| Field | Notes |
|---|---|
| Customer ID | UUID — use `GET /v1/customers` and match by `name` if only a name is known |
| Contract start date | ISO 8601 |
| Contract end date | ISO 8601 — `ending_before` is exclusive (last day + 1) |
| Rate Card ID | UUID — from `metronome-setup-catalog` or an existing rate card |
| Prepaid commit amount(s) | In dollars per year — note if different per year |
| Included allotments | e.g. "2B events/year" — must be converted to dollars: `count × rate/1K` |
| Platform fee | May be $0 — use a subscription if non-zero |
| Per-unit rate overrides | Note if variable year-over-year |
| Product IDs | Must be **FIXED-type products** from `metronome-setup-catalog` Step 2. Run that skill first if you don't have these IDs. |

---

## Step 2 — Check no active contract exists

```http
POST /v2/contracts/list
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{ "customer_id": "<customer_id>" }
```

The v2 contracts API has no `status` field — determine active contracts by checking that `starting_at` ≤ today and (`ending_before` is null OR `ending_before` > today). If an active contract already exists, surface it and ask whether to amend or create a new one. Do not create a second active contract without confirmation.

---

## Step 3 — Preview

```
CONTRACT PREVIEW  —  <customer name>

  Term:       <start> → <end>
  Customer:   <customer_id>

  Commits (paid — priority 100, burns after credits):
    <name>    $<amount>    <start>→<end>    product: <product_id>

  Credits (included allotments — priority 50, burns first):
    <name>    $<amount>    <start>→<end>    product: <product_id>    scope: <product only>

  Rate overrides:
    <product>  <rate>  <start>→<end>

  Amounts in payload (cents):
    Commit:  $<amount> → <amount × 100> cents

Reply "confirmed" to create.
```

---

## Step 4 — Create

```http
POST /v1/contracts/create
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "customer_id": "<uuid>",
  "starting_at": "<ISO8601>",
  "ending_before": "<ISO8601>",
  "rate_card_id": "<rate_card_uuid>",
  "commits": [
    {
      "product_id": "<product_uuid>",
      "type": "PREPAID",
      "name": "<name>",
      "access_schedule": {
        "schedule_items": [{ "amount": <cents>, "starting_at": "<ISO8601>", "ending_before": "<ISO8601>" }]
      },
      "invoice_schedule": {
        "schedule_items": [{ "unit_price": <cents>, "quantity": 1, "timestamp": "<ISO8601>" }]
      },
      "priority": 100
    }
  ],
  "credits": [
    {
      "product_id": "<product_uuid>",
      "type": "CREDIT",
      "name": "<name>",
      "access_schedule": {
        "schedule_items": [{ "amount": <cents>, "starting_at": "<ISO8601>", "ending_before": "<ISO8601>" }]
      },
      "applicable_product_ids": ["<product_uuid>"],
      "priority": 50
    }
  ],
  "overrides": [
    {
      "starting_at": "<ISO8601>",
      "ending_before": "<ISO8601>",
      "type": "OVERWRITE",
      "product_id": "<product_uuid>",
      "overwrite_rate": { "rate_type": "FLAT", "unit_price": <cents> }
    }
  ]
}
```

Return the contract `id` on success.

---

## Step 5 — Verify contract is active

```http
POST /v2/contracts/list
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{ "customer_id": "<customer_id>" }
```

Confirm: `starting_at` ≤ today AND (`ending_before` is null OR `ending_before` > today).

Then ingest one test event and confirm a line item appears on the draft invoice:

```http
GET /v1/customers/<customer_id>/invoices?type=USAGE&status=DRAFT
Authorization: Bearer $METRONOME_API_TOKEN
```

---

## Mandatory gotchas

- **Amounts are in cents.** Multiply every dollar figure by 100. $50,000 → `5000000`.
- **`ending_before` is exclusive.** A contract ending Dec 31 2026 = `"2027-01-01T00:00:00Z"`.
- **Credits burn before commits.** Set credits to priority 50, commits to priority 100.
- **Credits must be product-scoped.** Set `applicable_product_ids` to restrict the credit to the right product — without it, the credit applies to all usage.
- **Converting included events to dollars:** `event_count × rate_per_1K / 1000`. E.g. 2B × $0.03/1K = $60,000.
- **Multi-year variable rates:** create a separate override entry per year, each with its own date range.
- **Product IDs are not discoverable via this API flow.** Ask the user or look at an existing customer's contract via `POST /v2/contracts/list`.
- **Overrides only work on products already on the rate card.** The `product_id` in `overrides[]` must reference a product that has a rate on the contract's `rate_card_id`. Passing a product not on the rate card returns `"No such product in rate card"` — add the product's rate to the rate card first via `addRates`.
