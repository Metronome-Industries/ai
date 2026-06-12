---
name: metronome-commit-health
description: Analyzes a customer's prepaid commit health — burn rate, overrun risk, and breakage risk. Use when asked how a customer is tracking against their commit, commit burn rate, overrun risk, run out of budget, commit health, or exhaustion date.
argument-hint: <customer_name>
---

# metronome-commit-health

All API calls are read-only. Use `$METRONOME_API_TOKEN` for auth on every request. Base URL: `https://api.metronome.com/v1` (prod) or `https://staging.api.metronome.com/v1` (sandbox). If an API call returns $0 or no data, use the fallback calculation described in the gotchas before attempting anything else. Answers: how is a customer pacing against their prepaid commit? Are they at risk of overrun (spending too fast) or breakage (underspending, unused balance expiring)?

---

## What are you trying to do?

- Checking a single customer's commit health? → **Single Customer Commit Health** section below
- Checking burn order (which commit is consumed first)? → **Commit Burn Order** section below
- Identifying breakage risk (unused balance expiring)? → **Breakage Risk** section below
- Checking multiple customers at once? → **Multi-Customer Commit Scan** section below

---

## Single Customer Commit Health

### Phase 1 — Data Collection

Collect the following before any analysis. DO NOT proceed to Phase 2 until the inventory table is complete.

**Step 1:** Resolve the customer name to a UUID.
```http
GET /v1/customers
Authorization: Bearer $METRONOME_API_TOKEN
```
Returns all customers — match by `name` field from the response.

**Step 2:** Fetch all active commit and credit balances.
```http
POST /v1/contracts/customerBalances/list
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{ "customer_id": "<customer_id>", "include_balance": true, "sort_by_priority": true }
```
ALWAYS pass `include_balance: true` — without this, `percentage_consumed` and remaining balance are null.

**Step 3:** Fetch burn rate — two calls covering the last two completed calendar months.
```http
GET /v1/customers/{customer_id}/costs?starting_on=<month_start>&ending_before=<month_end>
Authorization: Bearer $METRONOME_API_TOKEN
```
Use actual calendar month boundaries. Do NOT use a single "last 90 days" window — month boundaries matter.

**If this endpoint returns $0 for a customer with an active commit:** the customer is likely burning through included credits (CREDIT type) before their paid commit (PREPAID type). This is expected behaviour — credits with lower priority numbers burn first. Verify by checking whether CREDIT balance rows are declining. Do NOT flag $0 spend as anomalous without first checking credit consumption.

**Step 4:** Fetch contract details for the end date and commit scope.
```http
POST /v2/contracts/list
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{ "customer_id": "<customer_id>" }
```
If the contract end date is missing or null from the API response, ASK the user to confirm it before building any projections.

**Required intermediate artifact — produce this table before Phase 2:**

| Field | Value |
|---|---|
| Customer UUID | |
| Contract end date | (ask user if null) |
| Days remaining in contract | |
| Commit: original amount | |
| Commit: consumed | |
| Commit: remaining | |
| Commit: percentage_consumed | (null if include_balance not passed) |
| Commit: expiry date | |
| Commit: priority | |
| Commit: scope (product-specific or any) | |
| Month N-2 spend | |
| Month N-1 spend | |
| Month N spend (current) | |
| Trailing 3-month average spend | |

---

### Phase 2 — Analysis

Work from the Phase 1 table. Every claim must reference a specific cell.

**Burn rate:** Use `GET /v1/customers/{id}/costs` over the last two completed calendar months and average them. Do NOT use USAGE invoice totals — they show $0 for credit-burning customers whose usage is covered by included allotments, making them unreliable for burn rate. If costs returns $0, compute a fallback burn rate from balance data: `(original_amount - remaining) / months_elapsed`. Label this as an estimated rate.

Current month data follows an S-curve (day 13 ≈ 37% of monthly total) — always use completed months only.

**Projected exhaustion date:**
```
months_remaining = commit_remaining / trailing_avg_monthly_spend
exhaustion_date = today + months_remaining
```
Label this explicitly as a **forecast**, not an observation.

**Risk classification:**

| Signal | Classification |
|---|---|
| percentage_consumed ≥ 80% | Overrun risk — flag |
| projected exhaustion < contract end date | Overrun risk — flag |
| percentage_consumed < 20% at > 80% of contract term | Breakage risk — flag |
| On pace | Healthy |

**Reconciliation:** Compare the projected exhaustion date against the contract end date. State explicitly whether the commit is expected to run out before or after the contract ends.

---

### Edge cases — handle before Phase 2

**PAYGO customer (no prepaid commit):**
If the balances endpoint returns no rows with `type: PREPAID`, the customer has no commit. Do NOT attempt burn rate or exhaustion projections. Respond: "No prepaid commit found — this customer is on pay-as-you-go. Show spend trend instead?" Then stop unless the user confirms.

**Evergreen contract (no `ending_before`):**
If the contract has no `ending_before` date, the % of term elapsed cannot be computed. Breakage risk classification requires a fixed end date — skip it. Note: "Evergreen contract — no fixed term. Showing raw burn rate only." Overrun risk can still be assessed if a commit amount exists.

**Credits-only customer (CREDIT rows, no PREPAID):**
Some customers have included allotments (free credits) but no paid commit. Treat each CREDIT row the same as a PREPAID for burn rate purposes, but label them as "included allotment" not "prepaid commit" in the output.

### Mandatory gotchas

- **Not all customers invoice through Metronome.** Before calling the invoices endpoint, confirm the customer uses Metronome billing. Some customers will have no invoice data — returning zero invoices is not an error, it means invoicing happens outside Metronome. Ask the user to confirm if unclear.

- **All monetary amounts from the API are in USD cents.** The `credit_type.name` field will say "USD (cents)". Divide every amount by 100 before presenting to users. A balance of `5562901` = $55,629.01. DO NOT present raw cent values.
- **`include_balance: true` is required.** DO NOT call the balances endpoint without it.
- **`POST /v1/contracts/customerBalances/list` is capped at 25 results per page** — unlike other endpoints which allow 100. Paginate using `next_page` if a customer has many commits or credits.
- **Contract end date is often absent from the API response.** If `ending_before` is null or missing, ask the user before making any projection.
- **`CREDIT_EXPIRATION` ledger entries are NOT charges.** They record unused commit balance being written off at term end — the negative sign matches a charge but it is not one. Do not alarm on this entry.
- **Priority field:** lower number = higher priority = consumed first. A commit with priority 50 burns before one with priority 100.
- **Projections must be labeled as forecast.** Never present an exhaustion date as a fact.

---

## Commit Burn Order

Use when asked: "which commit will be consumed first?" or "why is the wrong commit being burned?"

1. Call the balances endpoint with `sort_by_priority: true` and `include_balance: true`:
```http
POST /v1/contracts/customerBalances/list
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{ "customer_id": "<customer_id>", "include_balance": true, "sort_by_priority": true }
```
2. Return rows sorted ascending by `priority` — the lowest-numbered row is consumed first.
3. The `is_active` field indicates which commit is currently being drawn against.
4. Note commit type: manually purchased vs. auto-recharge. Customers sometimes expect auto-recharge credits to burn first — the priority field controls this, not the type.

---

## Breakage Risk

Use when asked: "which customers have unused commit expiring?" or "revenue breakage analysis."

**Definition:** Breakage = commit balance remaining when the contract term ends. High breakage = customer paid for capacity they didn't use = renewal negotiation risk.

**Threshold:** Flag if `percentage_consumed < 20%` at `> 80%` of contract term elapsed.

**`CREDIT_EXPIRATION` warning:** In ledger entries, this event records the remaining unused balance as it is written off. The negative sign looks identical to a `CREDIT_AUTOMATED_INVOICE_DEDUCTION` (a real charge). It is NOT a charge — it is the write-off of unearned balance. Do not report it as unexpected spend.

---

## Multi-Customer Commit Scan

Fleet commit scans are NOT feasible — there is no API endpoint to pull all customers' commit balances in one call. DO NOT attempt to iterate all customers.

**The correct approach:** Ask the user to provide a bounded list of customer names or IDs. Then fan out per customer.

Example prompt to give the user if they ask for a fleet scan:
> "Commit health scans require a customer list — Metronome's API doesn't support a fleet commit endpoint. Paste your target accounts (names or IDs) and I'll check each one."

For each customer in the list:
1. Resolve name → UUID via `GET /v1/customers` (match by `name` field; skip if UUID provided directly)
2. Call `POST /v1/contracts/customerBalances/list` with `include_balance: true` and `sort_by_priority: true`
3. Compute `percentage_consumed` and classify risk

Return a ranked summary: customers at overrun risk first, then breakage risk, then healthy.
