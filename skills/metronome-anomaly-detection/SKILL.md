---
name: metronome-anomaly-detection
description: Scans a bounded customer list for billing anomalies — MoM spend variance, stuck DRAFT invoices, and commit burn irregularities. Use when asked which customers need attention, have unusual spend, MoM variance, stuck invoices, or for a month-end review.
argument-hint: <customer_list_or_count>
---

# metronome-anomaly-detection

All API calls are read-only. Use `$METRONOME_API_TOKEN` for auth on every request. Base URL: `https://api.metronome.com/v1` (prod) or `https://staging.api.metronome.com/v1` (sandbox). If an API call returns $0 or no data, note it in the Phase 1 table and flag the customer for manual verification. Scans a bounded list of customers for billing anomalies: revenue variance, stuck DRAFT invoices, commit burn spikes, and stale credit balances.

---

## What are you trying to do?

- Reviewing a list of customers for any anomalies? → **Portfolio Anomaly Scan** section below
- Checking MoM spend variance only? → **MoM Spend Variance** section below
- Looking for stuck DRAFT invoices? → **Stuck Draft Invoices** section below
- Checking commit burn irregularities? → **Commit Burn Anomalies** section below

---

## Portfolio Anomaly Scan

### Before you start — get the customer list

Fleet scans are NOT feasible. There is no Metronome API endpoint to retrieve all customers at once. DO NOT attempt to iterate all customers automatically.

If the user asks for "all customers" or a fleet scan, respond:
> "Portfolio scans require a customer list — Metronome's API doesn't have a fleet endpoint. Paste your target accounts (names or IDs) and I'll scan each one."

Once you have the list, proceed below.

---

### Phase 1 — Data Collection

For each customer in the list, collect all four signals. DO NOT skip a customer or proceed to Phase 2 until the inventory table is fully populated.

**Per customer:**

1. Resolve name → UUID:
```http
GET /v1/customers
Authorization: Bearer $METRONOME_API_TOKEN
```
Returns all customers — match by `name` field from the response. Skip if UUID provided directly.

2. Fetch current and prior period spend (two calls, one per period):
```http
GET /v1/customers/{customer_id}/costs?starting_on=<period_start>&ending_before=<period_end>
Authorization: Bearer $METRONOME_API_TOKEN
```

3. Fetch recent invoices — check for DRAFT status past billing period end:
```http
GET /v1/customers/{customer_id}/invoices?type=USAGE&sort=date-desc
Authorization: Bearer $METRONOME_API_TOKEN
```

4. Fetch commit balances — check for burn rate anomalies and stale credits:
```http
POST /v1/contracts/customerBalances/list
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{ "customer_id": "<customer_id>", "include_balance": true }
```

**Required intermediate artifact — one row per customer:**

| Customer | Period N spend | Period N-1 spend | MoM Δ% | Invoice status | Commit % consumed | Credit last moved |
|---|---|---|---|---|---|---|
| | | | | | | |

Compute `MoM Δ% = (period_N − period_N-1) / period_N-1 × 100`.

---

### Phase 2 — Flag Anomalies

Work from the Phase 1 table only. DO NOT make additional API calls.

**Apply these thresholds:**

| Signal | Threshold | Condition |
|---|---|---|
| Revenue variance | > 20% MoM | FINALIZED invoices only — ignore DRAFT |
| Stuck DRAFT invoice | Invoice in DRAFT past billing period end date | |
| Commit burn spike | > 30% MoM increase in consumed amount | |
| Stale credit balance | Credit balance unchanged for 60+ days | Flag as potential billing misconfiguration |

**Mid-month data rule:** If the current period invoice is still in DRAFT, mark it as draft in your output. DO NOT alarm on mid-month figures — spend follows an S-curve (day 13 ≈ 37% of monthly total). Only flag variance on FINALIZED invoices from completed periods.

**Output format:** Return a ranked list — highest-severity anomalies first. For each flagged customer, state: the signal, the specific numbers, and the recommended next action (investigate, reach out, no action needed).

**Reconciliation:** Cross-check: if a customer shows high MoM revenue variance AND a commit burn spike, confirm they're the same customer and the figures are consistent. Inconsistencies between signals often indicate a data timing issue rather than a real anomaly.

---

### Edge cases — handle per customer in Phase 1

**PAYGO customer (no PREPAID balance rows):**
Skip the commit burn column for this customer. Revenue variance and stuck DRAFT checks still apply. Note "PAYGO" in the commit status column.

**Evergreen contract:**
No `ending_before` on an evergreen contract, so "days past renewal" doesn't apply. Stuck DRAFT detection still works normally — use `end_timestamp` on the invoice itself, not the contract.

**New customer (no invoices yet):**
If the invoices endpoint returns zero rows, mark all columns as "—" for this customer. Do NOT flag as an anomaly — absence of invoices on a new customer is expected.

**Flat fee only (no USAGE invoices):**
MoM variance on SCHEDULED invoices is not a billing anomaly signal — platform fees are fixed. Skip the revenue variance flag for this customer. Only check stuck DRAFT and commit burn.

### Mandatory gotchas

- **Not all customers invoice through Metronome.** Zero invoices for an active customer is not a stuck DRAFT or anomaly — it means they bill outside Metronome. Do not flag it. Skip invoice-based checks for that customer and note "external invoicing" in the flags column.

- **All invoice and balance amounts are in cents.** `GET /v1/customers/{id}/invoices` returns `total` in cents — divide by 100. There is no `formatted_total` field. For `POST /v1/contracts/customerBalances/list`, ALL amounts (`balance`, `consumed`, `remaining`, `access_schedule` amounts) are also in cents — divide by 100. A balance of `33115635` = $331,156. DO NOT present raw cent values when computing variance — convert first or all % calculations will be wrong.
- **Mid-month drafts are not anomalies.** Day 13 ≈ 37% of monthly spend. Only apply variance thresholds to finalized, complete billing periods.
- **20% threshold applies to FINALIZED invoices only.** Do not flag a 50% variance on a DRAFT invoice mid-month.
- **Fleet scans are blocked by the API.** The correct path is always: ask for a bounded list, then fan out per customer.
- **Stale credit balance ≠ billing error.** It is a signal worth investigating, not a confirmed problem. Frame it as a flag.
- **`POST /v1/contracts/customerBalances/list` is capped at 25 results per page** — unlike other endpoints which allow 100. Paginate using `next_page` if a customer has many commits or credits.

---

## MoM Spend Variance

Use when asked: "which customers had big spend changes last month?" or "flag MoM variance > 15%."

1. Get customer list from user.
2. For each, resolve name → UUID via `GET /v1/customers` (match by `name` field), then call `GET /v1/customers/{id}/costs` × 2 periods → compute delta.
3. Flag where `abs(MoM Δ%) > threshold` (default 20%; use user-specified threshold if provided).
4. Apply to FINALIZED invoices only. If the current period is still open, use the most recently finalized period as "current."

---

## Stuck Draft Invoices

Use when asked: "do we have any invoices stuck in DRAFT?" or "which invoices haven't finalized?"

1. Get customer list from user (or a single customer name).
2. For each:
```http
GET /v1/customers/{customer_id}/invoices?status=DRAFT
Authorization: Bearer $METRONOME_API_TOKEN
```
3. Flag any DRAFT invoice whose `end_timestamp` is in the past.
4. Return: customer name, invoice ID, billing period, how many days past expected finalization.

Note: a DRAFT invoice in the current open billing period is normal — only flag invoices from periods that have already closed.

---

## Commit Burn Anomalies

Use when asked: "are any customers burning through commits unusually fast?" or "commit burn irregularities."

1. Get customer list from user.
2. For each:
```http
POST /v1/contracts/customerBalances/list
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{ "customer_id": "<customer_id>", "include_balance": true }
```
Get `percentage_consumed` and remaining.
3. Compare current `percentage_consumed` to what would be expected at this point in the contract term.

Expected consumption rate:
```
expected_pct = days_elapsed / contract_term_days × 100
```

Flag if `actual_percentage_consumed > expected_pct + 20` (burning faster than pro-rata) or `actual_percentage_consumed < expected_pct − 30` (burning much slower — breakage risk).

Return a table: customer, expected %, actual %, variance, and classification.
