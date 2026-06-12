# Renewal prep

Produces a renewal brief for a single customer: current contract terms, trailing consumption, burn rate, and suggested renewal pricing range.

---

## What are you trying to do?

- Full renewal brief (contract + consumption + pricing scenarios)? → **Full renewal brief** below
- Upcoming renewal dates across customers? → **Renewal pipeline** below
- TCV / margin / expansion math? → **Renewal pricing math** below

---

## Full renewal brief

### Phase 1 — Data collection

DO NOT proceed to Phase 2 until the inventory table is complete.

**Step 1:** Resolve name → UUID (shared API call).

**Step 2:** Fetch active contract:
```http
POST /v2/contracts/list
{ "customer_id": "<id>" }
```
Capture: start date, end date, platform fee, rate card, rate overrides, commit structure. If `ending_before` is null, ASK the user for the contract end date before proceeding.

**Step 3:** Fetch trailing spend — last two completed calendar months (shared API call). Do NOT use USAGE invoice totals for burn rate — customers burning included credits show $0 on invoices even when actively using the product.

Also fetch the last 3 USAGE invoices for status and MoM trend context (not burn rate):
```http
GET /v1/customers/{id}/invoices?type=USAGE&sort=date-desc&limit=3
```

**Step 4:** Fetch current and prior period spend for MoM comparison — two more calls to the costs endpoint.

**Step 5:** Fetch remaining commit balance (shared API call with `include_balance: true`).

**Required table:**

| Field | Value |
|---|---|
| Customer UUID | |
| Contract start date | |
| Contract end date | (ask user if null) |
| Days remaining | |
| Platform fee | |
| Prepaid commit: total | |
| Prepaid commit: consumed | |
| Prepaid commit: remaining | |
| Commit: percentage_consumed | |
| Period N-2 spend (USAGE only) | |
| Period N-1 spend (USAGE only) | |
| Period N spend (current, partial) | |
| Trailing 3-period average | |
| MoM trend direction | accelerating / steady / decelerating |

---

### Phase 2 — Renewal brief

**Burn rate:** Trailing 3-period average from USAGE invoices only. Do not include current period (partial, S-curve).

**Trajectory classification:**

| Signal | Classification |
|---|---|
| Each period > prior by > 10% | Accelerating — upsell signal |
| Periods within ±10% of each other | Steady |
| Each period < prior by > 10% | Decelerating — renewal risk |

**Projected annual run rate:**
```
annual_run_rate = trailing_avg_monthly_spend × 12
```
Label as **forecast**.

**Commit sizing recommendation:**
- Conservative: current TCV − 5%
- Base: match projected annual run rate
- Aggressive: projected run rate + 15%

**Remaining balance note:** If `commit_remaining` > 10% of original, flag it — unused balance is a negotiating point.

**Reconciliation:** If spend is accelerating but a large balance remains, flag the inconsistency and ask the user to verify the data before presenting to a customer.

---

## Edge cases

**PAYGO customer:** No commit to analyze. Note: "PAYGO — renewal conversation should focus on commit conversion, not renewal of existing commit."

**Evergreen contract:** No fixed renewal date. Note: "Evergreen contract — billing continues month-to-month. No fixed renewal date." Show trailing spend and remaining balance only. Skip TCV and days-remaining.

**Flat fee only:** No usage invoices to analyze. Note: "Platform fee only — no usage billing found." Show platform fee and term. Skip burn rate projections.

**External invoicing:** If invoices endpoint returns zero results for a customer with an active contract, ask: "Does this customer invoice through Metronome?" If not, skip invoice-based burn rate and use costs endpoint and balance data only.

---

## Renewal pipeline

Use when asked: "what renewals are coming up?" or "which contracts expire in the next 90 days?"

```http
POST /v2/contracts/list
{ "customer_id": "<id>" }
```

Use `ending_before` to compute `days_until_renewal = ending_before − today`. For spend context, call costs endpoint per customer. Evergreen contracts (no `ending_before`) are included — label as "Evergreen — no fixed renewal date."

---

## Renewal pricing math

Use when the user provides cost data and asks for TCV, margin, or expansion scenarios. The user must supply: unit COGS, margin floor target, and current TCV.

**Standard formulas:**
```
Revenue = (Forecasted Usage − Included Usage) / 1,000 × Unit Price
TCV = Platform Fee + Prepaid Commit
Margin = (TCV − COGS) / TCV
Expansion Ratio = New TCV / Current TCV
```

**Breakeven demand drop** (for price change scenarios):
```
d = 1 − 1/(1 + delta_bps/10000)
```
For +10bps: d ≈ 0.1% — any demand drop above this erodes revenue.

Run three scenarios (conservative / base / aggressive) as a table. Label all figures as projections.
