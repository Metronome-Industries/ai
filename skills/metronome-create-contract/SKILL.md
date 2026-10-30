---
name: metronome-create-contract
description: Creates a Metronome contract for an existing customer from signed order form terms — commits, credits, and rate overrides. Use when asked to create a contract, set up a contract, add a commit or credit, configure pricing, or start a new contract.
argument-hint: <customer_id_or_name>
public: true
---

# metronome-create-contract

Creates a contract for an existing Metronome customer from signed order form terms.
Two-step: preview then confirm. Calls the API directly for both the read check and the write.
The user is the decision-maker. This skill never fills a gap, never picks between two readings of the form, never relies on an assumption without asking, and never creates anything the user has not seen listed.

Base URL: `https://api.metronome.com/v1`.

Confirm the environment with the user before any write. If it is unclear, ask. Never switch environments on your own.

**Prerequisites the user must supply:**
- Customer ID (from `metronome-create-customer` or via `GET /v1/customers` — match by `name` field)
- Product IDs for commits or credits — these must be **FIXED-type products**. Create them in `metronome-setup-catalog` Step 2 before this step. Commits, credits, and recurring_credits all require a FIXED product. (`POST /v1/contract-pricing/products/create` with `{ "name": "...", "type": "FIXED" }` creates one.)
- For a platform, access or support fee: a **SUBSCRIPTION-type product** (`{ "name": "...", "type": "SUBSCRIPTION" }`) with a base FLAT rate and a `billing_frequency` on the rate card. The user can supply the product and base rate, or this skill adds them as a setup write the user approves in the preview (see "Platform fee as a subscription" under Step 4).

---

## Run setup (ask once per run, before reading any form)

Ask these four things once. Do not ask them again on each form.

1. Environment: which account and base URL to write to. Never assume.
2. IDs: the rate card, and the product IDs the form needs (FIXED for commits and credits, SUBSCRIPTION for a platform, access or support fee, one product for each usage rate the form sets).
3. Customer: the customer ID, or the exact name to look up. If you look it up, show every candidate and let the user pick.
4. Is the file the signed copy? Take the user's answer. A text export of a PDF does not show signature images, so blank signature fields in the export are not proof the form is unsigned.

---

## Step 0 — Check the form (stop and ask)

Read the whole form first. Then tell the user what you found and ask before going further if any of these is true. Quote the form's own words.

| Check | Ask the user when |
|---|---|
| Is it an order form? | It is a blank template, a signing log, a memo, or an amendment to a form you do not have |
| Is it signed? | The user did not confirm a signed copy in run setup, and the signature fields are blank or there is no completion record |
| Who is the customer? | The name is a placeholder, differs between pages, or has more than one candidate in `GET /v1/customers` |
| Is the term current? | The term has ended, has not started, or auto-renews and you cannot tell whether it renewed (a term that ends today is handled below) |
| Currency | It is not USD, or the form shows "$" and nothing in an amount, the pricing section or the payment clause names the currency (ask; do not assume USD; a stray "USD" in an unrelated clause does not settle it). This skill has no currency field |

Do not continue past a "yes" until the user answers. Add the questions from Step 1 to the same list and ask the whole list together, once, instead of one at a time. Split the list in two: DECISIONS (a real ambiguity, an unseen document, a conflict between two readings: the user must choose) and CONFIRM THESE DERIVED VALUES (end dates, instalment dates, converted units: the user can accept all of them with one yes or correct any). Nothing is assumed in either part. Show the preview after the user has answered; its NEEDS YOUR CONFIRMATION section then holds only what is still open (for example the past dates warning).

**Term status.** The last day of a term is `ending_before` minus one day. A term "ends today" when that last day is today's date: treat it as current, and put it in NEEDS YOUR CONFIRMATION together with any auto-renewal clause.

**If the term has ended, ask whether to back-fill it or skip it.** Do not assume either way. If the user chooses back-fill, show how many invoices would finalize and the dollar total (see "Past dates warning" in Step 3). A form that auto-renews may have renewed: ask, and do not guess.

---

## Step 1 — Collect terms from the order form

Extract or ask for:

| Field | Notes |
|---|---|
| Customer ID | UUID — use `GET /v1/customers` and match by `name` if only a name is known |
| Contract start date | ISO 8601 |
| Contract end date | ISO 8601 — `ending_before` is exclusive (last day + 1) |
| Net payment terms | e.g. "Net 30" → `net_payment_terms_days: 30` on the contract. Optional. |
| Rate Card ID | UUID — from `metronome-setup-catalog` or an existing rate card |
| Prepaid commit amount(s) | In dollars per year — note if different per year. When the amount differs by year, create one commit per contract year. If the form prices several product lines separately inside one period, ask; do not decide |
| Invoice date(s) for each commit | A timestamp for every invoice. A date is stated when the form gives it, or gives it by reference to a date the form states ("on the Effective Date" when the Effective Date is written). It is derived when you calculate or infer it (six months after, the first of each month, "annual upfront" with no date); mark derived dates. If the form gives no way to work it out, ask |
| Included allotments | e.g. "2B events/year" — must be converted to dollars: `count × rate/1K` |
| Platform, access, support or flat fee | May be $0. If non-zero, create it as a subscription (see "Platform fee as a subscription" under Step 4). Collect the fee per year, how often it is billed (annual, quarterly, monthly), in advance or in arrears, and the start date. If the form gives no billing frequency or date, ask; never guess a frequency. If one instalment bundles several fixed lines and a discount (a package, support, a discount, a payment fee), create one subscription at the instalment total, list each line under NOT CREATED as "included in the subscription price", and put the choice under NEEDS YOUR CONFIRMATION. Never put one customer's fee on the shared rate card |
| Per-unit rate overrides | Note if variable year-over-year |
| Product IDs | Must be **FIXED-type products** for commits and credits. Use existing ones, create one as a setup write the user approves (`POST /v1/contract-pricing/products/create` with `{ "name": "...", "type": "FIXED" }`), or run `metronome-setup-catalog` Step 2 first. |

**Reconcile before previewing.** For each commit, add up its invoice items and compare to the commit amount. The API does not check this (it accepts invoice items that add up to more or less than the commit), so this skill is the only check. If an invoice also carries a fixed fee that goes into a subscription or under NOT CREATED (a platform fee or a support fee bundled into the commit invoice), subtract that fee's share first and compare what is left. Any difference goes under NEEDS YOUR CONFIRMATION with the options: remove the fixed fee's share from each item (when one is bundled in), trim the last item, or keep the form's numbers. When an annual fee sits inside semi-annual or quarterly instalments, there is a further option: attach the whole fee to the instalment that falls on the fee's anniversary and lower that commit item by the fee. This reproduces the form's total on every invoice date (for example a $25,000 annual fee in two $262,500 instalments becomes a $25,000 subscription invoice plus a $237,500 commit item on the anniversary, and a $262,500 commit item six months later). Do the same for each subscription: the invoices it will produce must match the fee schedule the form states.

**These always go under NOT CREATED, with the form's own amount and wording:**

- Allotments with no dollar rate (for example "1,000,000 MAUs", "50 connections", "up to 100 vehicles"). They cannot be converted to dollars.
- Stubs (a part-period amount before the first full period), negative amounts, and one-time discounts or credits against a fee. If a bundled instalment total already nets a discount, list the discount as "included in the subscription price" instead.
- Percentage-of-Billings fees, tiered or threshold rates (a rate that applies only above a quantity), minimum-spend commitments, commitments counted in units rather than dollars, invoices triggered by consumption, and amendments to other order forms. This skill does not create them.
- Auto-renewal clauses and renewal pricing. This skill creates the initial term only.
- Waived or $0 fees, late fees, tax and governing-law clauses, and non-monetary terms (marketing commitments, logo rights). Net payment terms are not in this list: create them with `net_payment_terms_days`.

**Every assumption is a question.** If you are about to rely on something the form does not say, or on something you worked out instead of read, ask the user. Do not carry on with a default. You may do these without asking: convert units (dollars to cents, a rate per 1,000 to a rate per unit), write `ending_before` as the last day plus one, and use a date the form states directly or by reference to a date it states. Everything else is a question, including a date you derive (six months after, the first of each month), which customer record matches, which product a credit or override applies to, a commit's or credit's access window when the form gives none, whether the customer has a billing provider (this skill does not read it, so ask), and which of two readings is right. Each question gives the options, the form's own words, and your suggested answer. The preview is not final until the user has answered every question.

**Fixed defaults, always shown in the preview.** Times are 00:00:00 UTC. A subscription has quantity 1 and no proration. Names come from the form's own wording (for example "Pre-paid Credit Year 1", "Base SaaS Fees"). Change a default only when the form says otherwise.

**Never fill a gap and never choose between readings.** Stop and ask the user, listing the options with the form's quotes, when:

- two totals or two amounts are possible (for example a stated total that does not equal the sum of its lines)
- a rate, amount or fee shows two or more values with no label (a redline, or a cell such as "$30,000 $25,000 $30,000 $25,000"). A text export may keep bold markers (**value**) but lose strikethroughs, so you cannot be sure which value is current. A bold value beside a plain one is often the replacement; still ask
- a fee has no billing frequency or no billing date. If the form states two or more billing dates a year, a quarter or a month apart, the frequency they imply counts as derived: put it in CONFIRM THESE DERIVED VALUES instead of asking it as a decision
- a commit's or credit's access window is not stated
- the customer name differs from the form, or more than one customer could match
- it is unclear which product a credit or override applies to (for example standard or premium exports, events or rows exported)
- the form incorporates another document you cannot see (an MSA, terms of service, an earlier order form) and its terms could change the contract (renewal, payment, credits): ask the user to supply it or to confirm it can be ignored
- the form contradicts itself on dates, for example an offer that "expires on" a date earlier than the signatures, or a date format that could be read two ways (8/6/2025)
- the form says "upon execution", shows more than one signature date, and that date feeds an invoice date or a term date: ask which date is the execution date. If no date in the payload depends on it, do not ask
- a fee's billing frequency is not annual, quarterly or monthly (for example semi-annual)
- the form gives a time of day or a time zone for a term start or end, an invoice date or a billing date (ignore support hours, audit-trail timestamps and similar)
- the fee's billing anchor is later than the start of its first period, which creates a part-period: ask how it should bill
- a date, amount or product is missing
- one invoice covers more than one commit, or a commit plus a fixed fee, and the form does not give the split
- the form calls a billed amount a "credit" (this skill treats a paid amount as a commit and an included amount as a credit; confirm with the user)

---

## Step 1b — Read what is already on the rate card

Before proposing any setup write, read the rate card: `POST /v1/contract-pricing/rate-cards/getRates` with `{ "rate_card_id": "<id>", "at": "<contract start ISO8601>" }` (documented in `metronome-setup-catalog`). If the product already has a rate for the billing frequency starting before the contract start, no base rate is needed. Say what you found in the preview, and say that the rate card is shared. Every product an override uses must already have a rate on the rate card (see the gotchas below): check each of them the same way.

---

## Step 2 — Check no active contract exists

```http
POST /v2/contracts/list
Authorization: Bearer $METRONOME_BEARER_TOKEN
Content-Type: application/json

{ "customer_id": "<customer_id>", "covering_date": "<current ISO8601 timestamp>" }
```

**Always pass `covering_date`, not just `customer_id`.** Results come back in chronological order capped at 20 per page, so a customer with more contract history than that can have its active contract sitting on a later page — a `customer_id`-only call can miss it and let a duplicate active contract get created. `covering_date` filters server-side to contracts active on that date instead of relying on pagination; if a non-null `cursor` still comes back, follow it rather than assuming the first page is complete. The v2 contracts API has no `status` field — determine active contracts by checking that `starting_at` ≤ today and (`ending_before` is null OR `ending_before` > today). If an active contract already exists, surface it and ask whether to amend or create a new one. Do not create a second active contract without confirmation. This skill has no amend path; if the user wants to amend, say so and stop.

This check only sees contracts that are active on `covering_date`. For an ended term or a renewal form, also call it with `covering_date` set to the form's start date: any contract returned already covers that period. Ask the user about any earlier term you cannot see.

---

## Step 3 — Preview (then wait)

```
CONTRACT PREVIEW  —  <customer name>   (environment: <base URL>)

  Term:       <start> → <end>
  Customer:   <customer_id>
  Net payment terms: <days>   [if the form has them]

  Commits (paid — priority 100, burns after credits):
    <name>    $<amount>    <start>→<end>    product: <product_id>
      invoice: <date> $<amount>   [derived | stated in form]

  Credits (included allotments — priority 50, burns first):
    <name>    $<amount>    <start>→<end>    product: <product_id>    scope: <product only>

  Rate overrides:
    <product>  <rate>  <start>→<end>

  Subscriptions (platform / access / support fees):
    <name>    billed <annual|quarterly|monthly> in <advance|arrears>    <start>→<end>    product: <subscription_product_id>
      price by year: <year 1> $<x>, <year 2> $<y>   [one override per year]
      billing cycle: anchor <date>, <ON_SCHEDULED_INVOICE | ON_USAGE_INVOICE>
      invoices: <date> $<amount>, ...   [derived | stated in form]

  Amounts in payload (cents):
    Commit:  $<amount> → <amount × 100> cents
    Credit, subscription and override amounts the same way (a rate per unit is shown per unit)

SETUP WRITES (done before the contract is created)
  - create product "<name>" (<FIXED | SUBSCRIPTION | USAGE>)
  - add a base rate on rate card "<name>": <product>, <frequency>, <price>, starting_at <1 January of the year before the earliest contract start, proposed; the user confirms>
    (the rate card is shared: say so, and say what already sits on it for this product)

AFTER CREATE
  - read the contract back and compare it to this preview
  - ingest one test event (<event type from the usage product's billable metric>, <timestamp>), unless the term is outside the ingest window (see Step 5)

NOT CREATED FROM THIS FORM (this skill has no field for these)
  - <term, with the form's amount and wording>
  - ...

NEEDS YOUR CONFIRMATION (anything still open after your answers: each item has the options, the form's quote, and my suggested answer; nothing here is assumed)
  - <question>

Answer the questions, then reply "confirmed" to create. I will not call the API until you do.
```

Show NOT CREATED and NEEDS YOUR CONFIRMATION every time, even when empty ("none"). "Confirmed" means the user has seen what was left out.

**Past dates warning.** If the contract start or any invoice date is in the past, say so in NEEDS YOUR CONFIRMATION: creating it finalizes every past commit invoice, every past subscription invoice and every past usage invoice immediately. A commit invoice dated in the past is FINALIZED within seconds of create, and a two-year contract that has already ended produces one finalized usage invoice per calendar month it touched (25 for a term from 2023-03-03 to 2025-03-03). State how many commit and subscription invoices would finalize and their dollar total, and how many usage invoices (count only). Usage invoices follow calendar months: those that finalize run from the start month through the earlier of the term's last month and the month before today's month, and the current month's stays in draft. If the customer has a billing provider configured, ask before continuing.

---

## Step 4 — Create

```http
POST /v1/contracts/create
Authorization: Bearer $METRONOME_BEARER_TOKEN
Content-Type: application/json

{
  "customer_id": "<uuid>",
  "starting_at": "<ISO8601>",
  "ending_before": "<ISO8601>",
  "rate_card_id": "<rate_card_uuid>",
  "net_payment_terms_days": <int>,
  "commits": [
    {
      "temporary_id": "<local_commit_ref>",
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
      "overwrite_rate": { "rate_type": "FLAT", "price": <cents per unit> }
    }
  ]
}
```

### Platform fee as a subscription

Use this when the form has a non-zero platform, access, support or flat fee. Example: a fee of $150,000 in year 1 and $450,000 in year 2, billed annually in advance.

Setup, once per product:

1. Create a SUBSCRIPTION product: `POST /v1/contract-pricing/products/create` with `{ "name": "Platform Fee", "type": "SUBSCRIPTION" }`.
2. Put a base rate on the rate card with the billing frequency, in cents. The base is a placeholder; the contract overrides it. `POST /v1/contract-pricing/rate-cards/addRates` with `{ "product_id": "<id>", "rate_type": "FLAT", "price": 100, "billing_frequency": "ANNUAL", "starting_at": "<ISO8601 before every contract start>", "entitled": true }`.

Then add this to the contract payload. One override per year when the fee changes by year (cents):

```json
"subscriptions": [
  {
    "name": "Platform Fee",
    "collection_schedule": "ADVANCE",
    "proration": { "is_prorated": false, "invoice_behavior": "BILL_IMMEDIATELY" },
    "subscription_rate": { "billing_frequency": "ANNUAL", "product_id": "<subscription_product_uuid>" },
    "initial_quantity": 1,
    "billing_cycle_config": { "anchor_date": "<contract start>", "invoice_placement": "ON_SCHEDULED_INVOICE" }
  }
],
"overrides": [
  {
    "starting_at": "<year 1 start>", "ending_before": "<year 1 end>", "type": "OVERWRITE",
    "override_specifiers": [{ "product_id": "<subscription_product_uuid>", "billing_frequency": "ANNUAL" }],
    "overwrite_rate": { "rate_type": "FLAT", "price": 15000000 }
  },
  {
    "starting_at": "<year 2 start>", "ending_before": "<year 2 end>", "type": "OVERWRITE",
    "override_specifiers": [{ "product_id": "<subscription_product_uuid>", "billing_frequency": "ANNUAL" }],
    "overwrite_rate": { "rate_type": "FLAT", "price": 45000000 }
  }
]
```

Billing periods and timing:
- Set `billing_cycle_config.anchor_date` to the date the form bills from (usually the Effective Date), and `invoice_placement: "ON_SCHEDULED_INVOICE"`, so the fee gets its own invoice on each anniversary. With `ON_SCHEDULED_INVOICE` the proration `invoice_behavior` must be `BILL_IMMEDIATELY`.
- Without `billing_cycle_config`, fee periods follow the 1st of the month and the fee rides the monthly usage invoice (`ON_USAGE_INVOICE`, the default, with `invoice_behavior: "BILL_ON_NEXT_COLLECTION_DATE"`). For a contract starting on a date other than the 1st, an annual fee then renews on the next 1st, not on the anniversary, and a per-year price override that changes on the anniversary can miss: a contract starting 2025-11-15 billed its second period (2026-11-01 to 2027-11-01) at the year-1 price of $150,000 instead of $450,000.
- With the anchor set to the start date, the same contract produced $150,000 for 2025-11-15 to 2026-11-15 and $450,000 for 2026-11-15 to 2027-11-15.
- A subscription override `price` is per billing period: 1,000,000 cents billed monthly is 1,000,000 a month, and billed quarterly is 1,000,000 a quarter. Do not convert an annual fee to a per-period price on your own; if the form's fee is annual and you bill quarterly, that is a question.
- `initial_quantity` multiplies the price: quantity 3 at 1,000,000 cents billed 3,000,000 a period.
- ANNUAL, QUARTERLY and MONTHLY billing, and `ADVANCE` and `ARREARS` collection, are accepted. In arrears the charge for a month appears on that month's usage invoice.
- Always read the invoices back and check each fee line's own period (`starting_at`, `ending_before`) against the form.

Rules the API enforces:
- `collection_schedule: "ADVANCE"` needs `proration.invoice_behavior`, or the API returns 400 "Subscription collection schedule ADVANCE must have a proration invoice behavior set".
- `invoice_placement: "ON_SCHEDULED_INVOICE"` with `BILL_ON_NEXT_COLLECTION_DATE` returns 400 "cannot use BILL_ON_NEXT_COLLECTION_DATE as invoice behavior"; use `BILL_IMMEDIATELY`.
- An override on a subscription product must carry the billing frequency inside `override_specifiers`. A plain `product_id` override returns 400 "Subscription product types must use a flat rate with billing frequency".
- The subscription's product and billing frequency must match a rate on the rate card.
- Without `starting_at`, the subscription starts with the contract and, without `ending_before`, ends with it.

Return the contract `id` on success. If the API rejects the payload, show the user the exact error and stop. Do not retry with a changed payload without asking. Only give a commit a `temporary_id` if an override in the same request needs to reference it (see below) — otherwise omit the field. Omit `net_payment_terms_days` when the form has no payment terms.

---

## Commit-specific discounts

A plain date-bounded override (`starting_at`/`ending_before` only) discounts *every* charge for that product in the window, including overage. If the order form says a discount applies "only to committed spend" or should stop once a commit is exhausted, that's not enough — use a **commit-specific override** instead:

1. Give the relevant commit a `temporary_id` in the same `contracts/create` call.
2. On the override, set `"is_commit_specific": true` and reference the commit inside `override_specifiers.commit_ids`.
3. The override is only active while that commit still has balance. Once it's drawn down, usage automatically falls back to the rate card's list rate — no separate "overage reverts to list price" logic needed.

```json
{
  "commits": [
    {
      "temporary_id": "commit_A",
      "product_id": "<product_uuid>",
      "type": "PREPAID",
      "name": "<name>"
    }
  ],
  "overrides": [
    {
      "type": "MULTIPLIER",
      "multiplier": 0.2,
      "is_commit_specific": true,
      "override_specifiers": [{ "commit_ids": ["commit_A"], "product_id": "<product_uuid>" }],
      "starting_at": "<ISO8601>",
      "ending_before": "<ISO8601>"
    }
  ]
}
```

`is_commit_specific` defaults to `false`. Setting `commit_ids` (or `recurring_commit_ids` / `any_commit_or_credit_ids`) in `override_specifiers` without `is_commit_specific: true` is rejected by the API. If the discount is also time-limited on top of being commit-limited (e.g. "80% off, but only in Year 1"), keep `starting_at`/`ending_before` on the override too — the two conditions are independent and both apply.

**Two more fields only apply to commit-specific overrides:**

- **`target`** (on the override itself): `"COMMIT_RATE"` or `"LIST_RATE"`, defaults to `"LIST_RATE"`. It picks whether the override's effect applies to usage that would otherwise bill at this commit's own discounted rate (`COMMIT_RATE`) or at the rate card's standard price (`LIST_RATE`) within that commit's scope — it is **not** a blanket "revert this product to list price" switch. A commit or credit separately has its own `rate_type` field (same enum) that sets what rate usage drawing against *that commit* bills at in the first place; don't conflate the override's `target` with the commit's `rate_type`.
- **`override_specifiers[].any_commit_or_credit_ids`**: an array of commit/credit/recurring-commit/recurring-credit IDs (including a same-request `temporary_id`), for applying one override across several different commits or credits at once instead of a single one. Like `commit_ids`, it requires `is_commit_specific: true` and must be paired with one of `product_id`, `product_tags`, `pricing_group_values`, or `presentation_group_values` on the same specifier. It is mutually exclusive with `commit_ids`/`recurring_commit_ids` on that specifier — combining them is rejected by the API.

---

## Step 5 — Verify contract is active

```http
POST /v2/contracts/list
Authorization: Bearer $METRONOME_BEARER_TOKEN
Content-Type: application/json

{ "customer_id": "<customer_id>", "covering_date": "<current ISO8601 timestamp>" }
```

Confirm: `starting_at` ≤ today AND (`ending_before` is null OR `ending_before` > today). As in Step 2, pass `covering_date` rather than `customer_id` alone — the new contract could otherwise be sitting past the first 20-result page.

Read the contract back and compare it to the preview: amounts, dates, invoice schedule, credit scope, overrides, subscriptions. Report any difference. To check subscription invoices, list the customer's invoices with `GET /v1/customers/<customer_id>/invoices` (no type filter) and check each fee line's own period (`starting_at`, `ending_before`) and amount against the form.

Ingest rejects events dated more than 34 days in the past and events more than 24 hours in the future (see `metronome-setup-catalog`). So the test event's timestamp must be inside the contract term and within that window. If the term has ended or has not started, skip the test event, tell the user, and verify through the read-back plus the rate on any existing usage invoice line (`unit_price` shows the override that was applied). Otherwise ingest one test event, using the event type from the usage product's billable metric (the test event is listed under AFTER CREATE in the preview, and is skipped if the user declines), and confirm a line item appears on the draft invoice:

```http
GET /v1/customers/<customer_id>/invoices?type=USAGE&status=DRAFT
Authorization: Bearer $METRONOME_BEARER_TOKEN
```

---

## Mandatory gotchas

- **Amounts are in cents.** Multiply every dollar figure by 100. $50,000 → `5000000`.
- **`ending_before` is exclusive.** A contract ending Dec 31 2026 = `"2027-01-01T00:00:00Z"`.
- **Credits burn before commits.** Set credits to priority 50, commits to priority 100.
- **Credits must be product-scoped.** Set `applicable_product_ids` to restrict the credit to the right product — without it, the credit applies to all usage.
- **Converting included events to dollars:** `event_count × rate_per_1K / 1000`. E.g. 2B × $0.03/1K = $60,000.
- **Multi-year variable rates:** create a separate override entry per year, each with its own date range.
- **Product IDs are not discoverable via this API flow** (Step 1b's `getRates` lists only products that already have a rate on the rate card). Ask the user or look at an existing customer's contract via `POST /v2/contracts/list`.
- **Overrides only work on products already on the rate card.** The `product_id` in `overrides[]` must reference a product that has a rate on the contract's `rate_card_id`. Passing a product not on the rate card returns `"No such product in rate card"` — add the product's rate to the rate card first via `addRates`.
- **"Discount applies only to committed spend" needs `is_commit_specific`, not just dates.** A date-bounded override discounts overage too if the overage happens to fall in the same window. See Commit-specific discounts above.
- **An override `price` is cents per unit.** A rate quoted per 1,000 is divided by 1,000 first: $0.03 per 1,000 events = `0.003`. Fractional values are accepted and kept exactly.
- **Invoice-schedule items use `unit_price`, access-schedule items use `amount`, and overrides use `price`.** Sending `unit_price` in an override returns 400 "Price is required for flat, percentage, and subscription rate types".
- **Never add a customer-specific price to the shared rate card.** The rate card applies to every contract on it. Put a base rate on the card and override it on the contract.
- **A usage override uses a plain `product_id`.** An override on a SUBSCRIPTION product uses `override_specifiers` with `billing_frequency` (see "Platform fee as a subscription").
- **Creating a rate card can fail on an account limit.** If it does, ask the user for an existing rate card instead of retrying.
