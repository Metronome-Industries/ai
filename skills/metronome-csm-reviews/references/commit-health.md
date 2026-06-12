# Commit health

Analyzes a single customer's prepaid commit — burn rate, overrun risk, breakage risk, and projected exhaustion date.

---

## What are you trying to do?

- Single customer commit health? → **Single customer** section below
- Which commit burns first? → **Burn order** section below
- Unused balance expiring? → **Breakage risk** section below
- Multiple customers at once? → **Multi-customer scan** section below

---

## Single customer

### Phase 1 — Data collection

DO NOT proceed to Phase 2 until this table is complete.

**Step 1:** Resolve name → UUID (shared API call).

**Step 2:** Fetch balances with `sort_by_priority: true`:
```http
POST /v1/contracts/customerBalances/list
{ "customer_id": "<id>", "include_balance": true, "sort_by_priority": true }
```

**Step 3:** Fetch burn rate — two calls for last two completed calendar months (shared API call). If $0 returned for a customer with an active commit, they may be burning included credits first (CREDIT type before PREPAID). Check whether CREDIT balance rows are declining before flagging.

**Step 4:** Fetch contract for end date:
```http
POST /v2/contracts/list
{ "customer_id": "<id>" }
```
If `ending_before` is null or missing, ask the user before building any projections.

**Required table:**

| Field | Value |
|---|---|
| Customer UUID | |
| Contract end date | (ask user if null) |
| Days remaining in contract | |
| Commit: original amount | |
| Commit: consumed | |
| Commit: remaining | |
| Commit: percentage_consumed | |
| Commit: expiry date | |
| Commit: priority | |
| Commit: scope (product-specific or global) | |
| Month N-2 spend | |
| Month N-1 spend | |
| Month N spend (current, incomplete) | |
| Trailing 3-month average spend | |

---

### Phase 2 — Analysis

**Burn rate:** Use the costs endpoint average over the last two completed months. Do NOT use USAGE invoice totals — they show $0 for credit-burning customers. If costs returns $0, use fallback from SKILL.md and label as "estimated."

**Projected exhaustion date:**
```
months_remaining = commit_remaining / trailing_avg_monthly_spend
exhaustion_date = today + months_remaining
```
Label as **forecast** — never present as a fact.

**Risk classification:** Use shared thresholds from SKILL.md (≥80% overrun, <20% at >80% term breakage).

**Reconciliation:** State explicitly whether the commit is expected to run out before or after the contract ends.

---

## Edge cases

**PAYGO customer (no PREPAID rows):** No commit to analyze. Respond: "No prepaid commit found — this customer is PAYGO. Show spend trend instead?" Stop unless user confirms.

**Evergreen contract (no `ending_before`):** Cannot compute % of term elapsed. Skip breakage risk. Show raw burn rate only. Note: "Evergreen contract — no fixed term."

**Credits-only customer (CREDIT rows, no PREPAID):** Treat CREDIT rows the same as PREPAID for burn rate. Label as "included allotment" not "prepaid commit."

**`CREDIT_EXPIRATION` ledger entries are NOT charges.** They record unused balance being written off at term end. The negative sign looks identical to a real charge — it is not. Do not alarm on this entry.

---

## Burn order

Use when asked: "which commit burns first?" or "why is the wrong commit being consumed?"

```http
POST /v1/contracts/customerBalances/list
{ "customer_id": "<id>", "include_balance": true, "sort_by_priority": true }
```

Return rows sorted ascending by `priority` — lowest number burns first. The `is_active` field shows which commit is currently drawing down. Note: priority controls burn order, not commit type.

---

## Breakage risk

Flag if `percentage_consumed < 20%` at `> 80%` of contract term elapsed.

`CREDIT_EXPIRATION` entries in the ledger record the write-off of unused balance at term end — the negative sign looks like a charge but it is not.

---

## Multi-customer commit scan

Fleet scans are not feasible. Ask the user for a bounded list, then fan out per customer:
1. Resolve name → UUID
2. `POST /v1/contracts/customerBalances/list` with `include_balance: true` + `sort_by_priority: true`
3. Compute `percentage_consumed` and classify risk

Return ranked: overrun risk first, then breakage risk, then healthy.
