# Anomaly detection

Scans a bounded customer list for billing anomalies across 4 signals: MoM spend variance, stuck DRAFT invoices, commit burn spikes, and stale credit balances.

---

## Before you start — get the customer list

Fleet scans are NOT feasible. There is no Metronome API endpoint to retrieve all customers at once. If the CSM asks for "all customers," respond:

> "Portfolio scans require a customer list — Metronome's API doesn't have a fleet endpoint. Paste your target accounts (names or IDs) and I'll scan each one."

---

## Phase 1 — Data collection

For each customer in the list, collect all four signals before Phase 2. DO NOT skip a customer or proceed until the table is fully populated.

Per customer (using shared API calls from SKILL.md):
1. Resolve name → UUID
2. Fetch current and prior period spend (two calls)
3. Fetch recent invoices — check for DRAFT status past `end_timestamp`
4. Fetch commit balances with `include_balance: true`

**Required intermediate artifact — one row per customer:**

| Customer | Period N spend | Period N-1 spend | MoM Δ% | Invoice status | Commit % consumed | Credit last moved |
|---|---|---|---|---|---|---|
| | | | | | | |

Compute `MoM Δ% = (period_N − period_N-1) / period_N-1 × 100`.

---

## Phase 2 — Flag anomalies

Work from the Phase 1 table only. DO NOT make additional API calls.

Apply thresholds from SKILL.md plus these anomaly-specific signals:

| Signal | Threshold | Notes |
|---|---|---|
| Commit burn spike | > 30% MoM increase in consumed amount | Specific to anomaly scan — not in shared thresholds |
| Stale credit balance | Balance unchanged for 60+ days | Flag as potential billing misconfiguration, not a confirmed problem |

**Output format:** Ranked list — highest-severity anomalies first. For each flagged customer: the signal, specific numbers, and recommended next action (investigate, reach out, no action needed).

**Reconciliation:** If a customer shows high MoM variance AND a commit burn spike, confirm they're consistent. Inconsistencies between signals often indicate a data timing issue, not a real anomaly.

---

## Edge cases

**PAYGO customer (no PREPAID balance rows):** Skip commit burn column. Revenue variance and stuck DRAFT checks still apply. Note "PAYGO."

**Evergreen contract:** No fixed `ending_before` on the contract. Stuck DRAFT detection still works — use `end_timestamp` on the invoice, not the contract.

**New customer (no invoices):** Mark all invoice columns as "—". Do NOT flag as anomaly — absence of invoices on a new customer is expected.

**Flat fee only (no USAGE invoices):** Skip revenue variance flag. SCHEDULED invoices are fixed — MoM variance is not a signal. Only check stuck DRAFT and commit burn.

**External invoicing:** Zero invoices for an active customer means they bill outside Metronome. Note "external invoicing" and skip all invoice-based checks.

---

## Shortcut modes

**MoM spend variance only:**
1. Get customer list.
2. Call costs endpoint × 2 periods per customer → compute delta.
3. Flag where `abs(MoM Δ%) > threshold` (default 20%; use user-specified if provided).
4. Apply to FINALIZED invoices only.

**Stuck DRAFT invoices only:**
```http
GET /v1/customers/{id}/invoices?status=DRAFT
```
Flag any DRAFT invoice whose `end_timestamp` is in the past. Return: customer, invoice ID, billing period, days overdue.

**Commit burn anomalies only:**
```http
POST /v1/contracts/customerBalances/list
{ "customer_id": "<id>", "include_balance": true }
```
Compute expected rate: `expected_pct = days_elapsed / contract_term_days × 100`.
Flag if `actual > expected + 20` (burning fast) or `actual < expected − 30` (breakage risk).
