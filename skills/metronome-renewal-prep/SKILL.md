---
name: metronome-renewal-prep
description: Prepares a renewal brief for a customer — contract terms, trailing consumption, burn rate, and pricing scenarios. Use when asked to prep for a renewal, build a renewal brief, assess consumption trajectory, or calculate TCV for an expiring contract.
argument-hint: <customer_name>
---

# metronome-renewal-prep

All API calls are read-only. Use `$METRONOME_API_TOKEN` for auth on every request. Base URL: `https://api.metronome.com/v1` (prod) or `https://staging.api.metronome.com/v1` (sandbox). If an API call returns $0 or no data, apply the fallback calculation described in the gotchas before attempting anything else. Produces a renewal brief: current contract terms, trailing consumption, burn rate, and suggested renewal pricing range for a single customer.

---

## What are you trying to do?

- Full renewal brief (contract + consumption + pricing scenarios)? → **Full Renewal Brief** section below
- Just upcoming renewal dates across customers? → **Renewal Pipeline** section below
- Modeling TCV / margin / expansion ratio math? → **Renewal Pricing Math** section below

---

## Full Renewal Brief

### Phase 1 — Data Collection

Collect all data before analysis. DO NOT proceed to Phase 2 until the inventory table is complete.

**Step 1:** Resolve the customer name to a UUID.
```http
GET /v1/customers
Authorization: Bearer $METRONOME_API_TOKEN
```
Returns all customers — match by `name` field from the response.

**Step 2:** Fetch the active contract — start date, end date, platform fee, rate card, rate overrides, commit structure.
```http
POST /v2/contracts/list
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{ "customer_id": "<customer_id>" }
```
If `ending_before` is null or missing, ASK the user for the contract end date before proceeding.

**Step 3:** Fetch trailing spend — two calls covering the last two completed calendar months.
```http
GET /v1/customers/{customer_id}/costs?starting_on=<month_start>&ending_before=<month_end>
Authorization: Bearer $METRONOME_API_TOKEN
```
**Do NOT use USAGE invoice totals for burn rate.** For customers burning included credits (CREDIT type allotments), USAGE invoice totals are $0 even when the customer is actively using the product. The costs endpoint aggregates actual usage and is the correct source.

If the costs endpoint also returns $0: the customer may be burning credits faster than the billing period closes. Fall back to balance delta: `(original_amount - remaining_balance) / months_elapsed`.

For burn rate context, also fetch the last 3 USAGE invoices — but use them for invoice status and MoM trend only, not as the burn rate figure.
```http
GET /v1/customers/{customer_id}/invoices?type=USAGE&sort=date-desc&limit=3
Authorization: Bearer $METRONOME_API_TOKEN
```

**Step 4:** Fetch current period spend and the prior period for MoM comparison — two calls to the costs endpoint with different date ranges.

**Step 5:** Fetch remaining commit balance.
```http
POST /v1/contracts/customerBalances/list
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{ "customer_id": "<customer_id>", "include_balance": true }
```

**Required intermediate artifact — produce this table before Phase 2:**

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
| Period N-2 spend (USAGE invoices only) | |
| Period N-1 spend (USAGE invoices only) | |
| Period N spend (current period) | |
| Trailing 3-period average spend | |
| MoM trend direction | accelerating / steady / decelerating |

---

### Phase 2 — Renewal Brief

Work from the Phase 1 table. Every claim must trace to a specific row.

**Burn rate:** Trailing 3-period average using USAGE invoices only.

**Trajectory classification:**

| Signal | Classification |
|---|---|
| Each period spend > prior period by >10% | Accelerating — upsell signal |
| Periods within ±10% of each other | Steady |
| Each period spend < prior period by >10% | Decelerating — renewal risk |

**Projected annual run rate:**
```
annual_run_rate = trailing_avg_monthly_spend × 12
```
Label as **forecast**.

**Commit sizing recommendation:**
- Conservative: current TCV − 5%
- Base: match projected annual run rate
- Aggressive: projected run rate + 15%

**Remaining balance note:** If `commit_remaining` is significant (>10% of original), flag it — unused balance is a negotiating point.

**Reconciliation:** Check that the trailing spend trend is consistent with the remaining balance. If spend is accelerating but a large balance remains, flag the inconsistency and ask the user to verify the data before presenting to a customer.

---

### Edge cases — handle before Phase 2

**PAYGO customer (no prepaid commit):**
If the balances endpoint returns no PREPAID rows, the customer has no commit. The renewal brief changes: skip burn rate and commit sizing. Instead show trailing spend trend and note "PAYGO — renewal conversation should focus on commit conversion, not renewal of existing commit."

**Evergreen contract (no `ending_before`):**
If `ending_before` is absent, there is no renewal date. Do NOT ask the user to supply one for an evergreen contract — it doesn't exist by design. Note: "Evergreen contract — billing continues month-to-month. No fixed renewal date." Show trailing spend and remaining balance only. Skip TCV and days-remaining fields in the Phase 1 table.

**Flat fee only (no usage invoices):**
If all invoices are `type: SCHEDULED` and `type: USAGE` invoices are zero or absent, there is no usage-based burn rate to calculate. Note: "Platform fee only — no usage billing found." Show the platform fee and contract term; skip burn rate projections.

### Mandatory gotchas

- **Not all customers invoice through Metronome.** If the invoices endpoint returns zero results for a customer with an active contract, they likely bill outside Metronome. Do not flag this as an anomaly — ask instead: "Does this customer invoice through Metronome?" If not, skip invoice-based burn rate and rely on the costs endpoint and balance data only.

- **All amounts are in cents.** `GET /v1/customers/{id}/invoices` returns `total` in cents — divide by 100. There is no `formatted_total` field. For `POST /v1/contracts/customerBalances/list`, ALL amounts are also in cents — divide by 100. Check `credit_type.name: "USD (cents)"` to confirm. A commit amount of `42760500` = $427,605. DO NOT present raw cent values.
- **USAGE vs SCHEDULED invoices:** ALWAYS filter to `type=USAGE` for burn rate. SCHEDULED invoices are flat platform fee charges — including them overstates consumption and inflates renewal pricing recommendations.
- **Contract end date may be null.** If missing, ask the user before building any projections.
- **Label all projections as forecasts.** Never present a projected run rate as a committed number.
- **Current period spend is partial.** Mid-month figures follow an S-curve (day 13 ≈ 37% of monthly total). Do not use the current period figure as the burn rate — use the trailing 3-period average from completed USAGE invoices.

---

## Renewal Pipeline

Use when asked: "what renewals are coming up?" or "which contracts expire in the next 90 days?"

```http
POST /v2/contracts/list
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{ "customer_id": "<customer_id>" }
```

From the response, use the `ending_before` field to compute `days_until_renewal = ending_before − today`. For spend context per renewal, call the costs endpoint per customer.

Evergreen contracts (no `ending_before`) are included — do not report "no renewals" if only evergreen contracts exist. Label them as "Evergreen — no fixed renewal date."

---

## Renewal Pricing Math

Use when the user provides cost data and asks for TCV, margin, or expansion ratio scenarios.

The user must supply: unit COGS (e.g., "$0.004/unit"), margin floor target (e.g., "40%"), and current TCV. No additional API calls needed unless data is stale.

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
