---
name: metronome-plg-billing
description: >-
  Guides PLG founders through billing setup, pricing changes, and customer
  diagnostics on Metronome. Three modes: start billing (pricing intent through
  verified draft invoice), change pricing (blast radius enumeration and
  before/after diff), and customer story (single-customer diagnostic narrative
  with actionable next step). Use when a founder or technical decision-maker
  asks to bill their first customer, set up pricing, modify rates or tiers,
  investigate a customer account, or translate a pricing page into Metronome
  objects. Targets users who think in business terms (dollars, invoices,
  customers) rather than API objects.
---

This skill targets PLG founders who are both pricing decision-maker and billing implementer. Communicate in business language (dollars, invoices, customers). End every mode at a moment the founder can verify against their business intent.

## Routing

| Founder says (pattern) | Mode | Load reference |
| --- | --- | --- |
| "bill my first customer", "set up billing", "recreate [company] pricing", shares pricing URL, "how do I charge for X" | **Start billing** | <references/patterns.md> |
| "add a tier", "raise prices", "new product", "change rates", "update pricing", "add a fee" | **Change pricing** | <references/blast-radius.md> |
| "what's going on with customer X", "why is this invoice wrong", "where did credits go", "no usage showing" | **Customer story** | <references/diagnostics.md> |

If the founder's intent spans modes (e.g., "set up billing and also figure out why my test customer shows $0"), address modes sequentially. Complete mode 1 verification before starting mode 2.

For implementation-level API details after the founder confirms their intent, load <references/worked-examples.md>.

## Corrections

### Silent failures (API accepts bad input without error)

**Cents vs. dollars**: The Metronome API accepts monetary amounts in **cents** (integer). All communication with the founder must be in **dollars**. Convert at the boundary. If you pass `100` meaning "$100", the API treats it as $1.00 — the founder gets invoices 100x too low. If you pass `10000` meaning "100 cents", the founder sees $100.00 instead of $1.00.

Rule: Founder sees dollars. API receives cents. Always annotate: `10000  # $100.00`.

**34-day event backdating limit**: Events with timestamps older than 34 days from ingestion time are silently dropped. No error returned. The founder will see zero usage for that period. There is no way to recover — the events must be re-sent within the window.

**Event type mismatch**: Events with an `event_type` that does not match any billable metric's `event_type_filter` are silently ignored. No error, no warning, no dead-letter queue. The founder sees zero usage. This is the #1 cause of "I'm sending events but nothing shows up."

**String numbers in properties**: Sending `"tokens": "1500"` (string) instead of `"tokens": 1500` (number) causes SUM aggregation to produce zero or fail silently. The API accepts the event without error.

**`aggregation_key` without matching events**: Creating a SUM metric with `aggregation_key: "tokens"` works correctly only when events actually contain a numeric `tokens` property. If the property is missing, misspelled, or a string, aggregation silently produces zero.

**Group keys are immutable**: Once a billable metric is created, its `group_keys`, `aggregation_type`, and `event_type_filter` cannot be changed. If you get these wrong, you must archive the metric and create a new one. No update path exists.

### Architectural intent (invisible in the API surface)

**Rate card = shared pricing template**: A rate card defines default pricing for ALL customers on that card. Changing a rate on the card propagates to every contract referencing it (unless overridden). It is not a per-customer object. Think of it as the published price list.

**Override = customer-specific deviation**: To give one customer a discount, custom rate, or promotional pricing, use a contract-level override (overwrite or multiplier). The override shadows the rate card rate for that customer only. All other customers continue to see the rate card rate.

**Credit vs. commit**: Credits are complimentary balance — no invoice to the customer, just free spending power. Commits are financial obligations: prepaid (customer pays upfront via invoice, then draws down) or postpaid (customer pays shortfall at period end via true-up invoice). The API makes them look similar; the cash flow is opposite.

**Contracts, not Plans**: Plans are the legacy billing model. Contracts are the actively invested path with rate card overrides, commits, edits, subscriptions, and account hierarchies. Always use Contracts for new customers.

**Edits, not Amendments**: `POST /v2/contracts/edit` is current. `POST /v1/contracts/amend` is deprecated but still functional — the agent may discover it first through exploration. Always use Edits.

## Guardrails

- **NEVER** put customer-specific rates on the shared rate card. Use contract-level overrides instead. Modifying the rate card for one customer changes pricing for all customers on that card.
- **NEVER** create a billable metric without the founder confirming: (a) the `event_type` name, (b) the aggregation type (SUM/COUNT/MAX/UNIQUE/LATEST), (c) which properties will be `group_keys`. Group keys are immutable after creation — plan extra dimensions now rather than recreating later.
- **NEVER** modify a rate card without first enumerating all contracts that reference it and showing the founder which customers will be affected (blast radius).
- **NEVER** skip the mock invoice step. The founder must see a mock invoice with dollar amounts and confirm it matches their pricing intent before any API calls are made.
- **NEVER** send dollar amounts directly to the Metronome API. Convert to cents at the API boundary. Annotate every amount: `10000  # $100.00`.
- **ALWAYS** use Contracts (not Plans) and Edits (not Amendments).
- **ALWAYS** generate a deterministic `transaction_id` scheme for the event schema (e.g., `{source}_{record_id}_{timestamp}`), not random UUIDs.
- **ALWAYS** verify the final implementation by pulling a draft invoice from the API and comparing it line-by-line against the mock invoice from Phase 3. If amounts don't match, diagnose before declaring success.

## Mode 1: Start billing

Goal: take the founder from pricing intent to a verified draft invoice.

### Phase 1 — Understand pricing intent

Ask the founder to describe their pricing in any form:
- A pricing page URL
- "Like [company]" (e.g., "like OpenAI", "like Vercel")
- Prose description ("$20/month base, then $0.01 per API call after 10,000 free")
- Spreadsheet or table

Extract three things:
1. **Invoice shape** — what the customer sees on their bill (line items, amounts, structure)
2. **Usage triggers** — what actions generate charges (API calls, tokens, storage, seats)
3. **Dimensions** — what attributes differentiate pricing (model, region, tier, plan)

Gate: do not proceed until you can state the pricing model back to the founder in one sentence and they confirm.

### Phase 2 — Match to pattern

Load <references/patterns.md>. Match the founder's description to one of the 7 canonical patterns:
1. Pure usage (per-unit)
2. Tiered usage (volume breakpoints)
3. Subscription + overage
4. Prepaid credits (burn-down)
5. Enterprise commit (annual prepay)
6. Hybrid (subscription + multiple usage dimensions)
7. Free trial → paid conversion

If the pricing spans multiple patterns (common: "subscription + usage" = pattern 3, or "subscription + prepaid credits" = patterns 3+4), identify which patterns compose.

Present the matched pattern's invoice shape. Get confirmation: "Is this what your customer's invoice should look like?"

### Phase 3 — Mock invoice

Produce a concrete mock invoice using the founder's actual:
- Product/service names
- Prices (in dollars)
- Example quantities (realistic for their use case)

Format:

```
INVOICE — [Customer Name] — [Billing Period]
─────────────────────────────────────────────
Line item                    Qty     Rate      Amount
─────────────────────────────────────────────
[Product 1]                  [qty]   $[rate]   $[amount]
[Product 2]                  [qty]   $[rate]   $[amount]
...
─────────────────────────────────────────────
Subtotal                                       $[subtotal]
Credits applied                                -$[credits]
─────────────────────────────────────────────
TOTAL DUE                                      $[total]
```

The founder corrects in business language: "no, the first 1000 are free", "the base fee is $49 not $99", "credits should cover the first month."

Gate: founder confirms the mock invoice is correct. This is the verification target for Phase 6.

### Phase 4 — Event schema spec

From the confirmed mock invoice, derive:
- `event_type`(s) needed
- Required `properties` per event type (name, type, purpose)
- `transaction_id` pattern (deterministic, retryable)
- Example event JSON for each event_type

Present this as a deliverable the founder can hand to their engineer for instrumentation.

### Phase 5 — Implement

Two sub-phases. Shared infrastructure first, then customer-specific.

**Phase 5a — Shared infrastructure** (reusable across all customers):
1. Billable metric(s) — with confirmed event_type, aggregation, group_keys
2. Product(s) — usage, subscription, or composite
3. Rate card — with rates for each product (amounts in cents, annotated)

**Phase 5b — Customer-specific**:
1. Customer creation (with billing provider config if using Stripe)
2. Contract creation (referencing rate card, with any overrides, commits, or credits)

Load <references/worked-examples.md> for full API payload examples if the founder needs code-level detail.

### Phase 6 — Verify

1. Ingest test events using the schema from Phase 4
2. Pull the draft invoice from the API (`GET /v1/invoices` for the customer)
3. Compare draft invoice line items and total against the mock invoice from Phase 3
4. Gate: amounts match (within rounding tolerance from cents conversion)

If amounts do not match, load <references/diagnostics.md> and investigate before declaring success.

## Mode 2: Change pricing

Goal: show the founder who is affected and what changes before any modification is made.

### Step 1 — Classify the change

Determine which type:
- **New product addition** — adding a line item that doesn't exist today
- **Existing rate change** — modifying the price of an existing product
- **New tier addition** — adding breakpoints to a tiered product
- **Customer-specific adjustment** — one customer gets a different rate

### Step 2 — Enumerate blast radius

Load <references/blast-radius.md>.

For changes that touch the rate card:
1. Identify the rate card being modified
2. List all contracts referencing that rate card
3. For each contract, check if the affected product has an override (overridden = NOT affected)
4. Present the affected customer list

For customer-specific changes:
- Blast radius = 1 customer. Use a contract-level override.

### Step 3 — Before/after diff

Present a table:

```
Customer          | Current Rate    | New Rate        | Est. Monthly Impact
──────────────────|─────────────────|─────────────────|────────────────────
[Customer A]      | $0.01/unit      | $0.015/unit     | +$50.00
[Customer B]      | $0.01/unit      | $0.015/unit     | +$120.00
[Customer C]      | $0.008/unit *   | $0.008/unit *   | $0.00 (overridden)
──────────────────|─────────────────|─────────────────|────────────────────
Total impact                                           +$170.00/month
```

`*` = has contract-level override, not affected by rate card change.

### Step 4 — Confirm and execute

Gate: founder confirms the change and the affected customer list.

Then execute:
- Rate card update → propagates to non-overridden contracts
- OR contract override → affects only the specified customer
- OR rate card update + override existing customers to old rate → only new customers get new price

## Mode 3: Customer story

Goal: explain what happened to a specific customer in a narrative the founder can act on.

### Step 1 — Gather context

Ask:
- Which customer? (name or ID)
- What's the concern? ("invoice too high", "no usage", "credits gone", "unexpected charge")

### Step 2 — Match anomaly signature

Load <references/diagnostics.md>. Match the concern to one of the 4 anomaly signatures:
- Zero-usage contract
- Unexpected invoice amount
- Balance discrepancy
- Events not billing

### Step 3 — Investigate

Run the diagnostic steps for the matched signature. Pull relevant data:
- Invoice breakdowns (line items, quantities, rates)
- Commit/credit ledger entries
- Event search (recent events for this customer)
- Contract details (rate card, overrides, billing period)

### Step 4 — Narrate and recommend

Produce a single-customer narrative:
- **What happened**: one sentence summary
- **When**: specific date/period
- **Why**: root cause in business language (not API jargon)
- **What to do**: actionable next step the founder can take

Gate: the founder has a concrete action they can take (not just an explanation).
