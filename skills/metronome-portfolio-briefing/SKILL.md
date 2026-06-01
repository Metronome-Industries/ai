---
name: metronome-portfolio-briefing
description: Runs commit health, renewal, and anomaly checks across a bounded customer list and produces a structured monthly briefing. Use when asked for a monthly report, portfolio briefing, all-customer summary, who needs attention this month, or end of month review.
argument-hint: <customer_list>
---

# metronome-portfolio-briefing

Orchestrates commit health, renewal, and anomaly checks across a bounded customer list and produces a structured monthly briefing. All API calls are read-only.

Base URL: `https://api.metronome.com/v1` (prod) or `https://staging.api.metronome.com/v1` (sandbox). Use `$METRONOME_API_TOKEN` for auth on every request.

---

## Data source hierarchy

Always follow this order. Do NOT skip to a later pass unless the earlier one fails or returns no data.

**Pass 1 — Direct API calls (always start here)**

| Data needed | API call |
|---|---|
| Customer UUID | `GET /v1/customers` — match by `name` field from response |
| Contract terms, end date | `POST /v2/contracts/list` with `{ "customer_id": "<id>" }` |
| Commit / credit balances | `POST /v1/contracts/customerBalances/list` with `include_balance: true` |
| Burn rate, spend trend | `GET /v1/customers/{id}/costs?starting_on=<date>&ending_before=<date>` (two calls) |
| Invoice status, type | `GET /v1/customers/{id}/invoices?type=USAGE&sort=date-desc` |
| Renewal dates | `POST /v2/contracts/list` — use `ending_before` field to compute days until renewal |

**Pass 2 — fallback calculation (only if Pass 1 returns $0 or is unavailable)**
If the costs endpoint returns $0 for a customer with an active commit, compute an estimated burn rate from balance data: `(original_balance - remaining_balance) / months_elapsed`. Label any figure derived this way as **estimated**.

**Never skip to raw guesses.** If an API call returns an error, surface the error to the user rather than fabricating data.

---

## What are you trying to do?

- Full monthly portfolio report? → **Portfolio Report** section below
- Just the risk summary (quick scan)? → **Quick Risk Scan** section below
- Output for Slack or a doc? → **Output Formats** section below

---

## Portfolio Report

### Before you start

Fleet scans are NOT feasible — there is no Metronome API endpoint that returns all customers at once. If the user asks for "all customers," respond:
> "Portfolio reports require a customer list. Paste your accounts (names or IDs) and I'll run the full briefing."

Recommended list size: 10–30 customers. Above ~50, split into batches across multiple conversations.

---

### Phase 1 — Data Collection

For each customer in the list, collect all signals in parallel before any analysis. DO NOT begin Phase 2 until every customer row is populated.

**Per customer (fan out in parallel where possible):**
1. `GET /v1/customers` → match by `name` field → UUID (skip if UUID provided)
2. `POST /v2/contracts/list` → contract type, end date, commit structure
3. `POST /v1/contracts/customerBalances/list` with `include_balance: true` → commit %, remaining, priority order
4. `GET /v1/customers/{id}/costs` (last 2 completed months, two calls) → burn rate
5. `GET /v1/customers/{id}/invoices?type=USAGE` → DRAFT status check + invoice type classification
6. `POST /v2/contracts/list` → `ending_before` field gives renewal date; compute `days_until_renewal`

**Burn rate source — important:** Use the costs endpoint, NOT invoice totals. USAGE invoices show $0 for customers burning included credits (CREDIT type allotments), which would produce a false $0 burn rate. If costs also returns $0, fall back to: `(original_balance - remaining_balance) / months_elapsed`. Label this as estimated.

**Required intermediate artifact — one row per customer, all columns before Phase 2:**

| Customer | Contract type | End date | Commit % used | Remaining ($) | Burn rate (3mo avg) | Days to renewal | MoM Δ% | Stuck DRAFT | Flags |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | |

**Contract type values:** `COMMIT` (prepaid), `PAYGO` (no commit), `EVERGREEN` (no end date), `FLAT_FEE` (SCHEDULED only).

**Edge cases to record in the table, not skip:**
- PAYGO → commit % = "—", remaining = "—"
- Evergreen → end date = "∞", days to renewal = "∞"
- New customer (no invoices) → MoM Δ% = "—", mark as NEW
- Flat fee only → MoM Δ% = "—" (SCHEDULED invoices excluded from variance)

---

### Phase 2 — Analysis

Work from the Phase 1 table only. Every flag must reference a specific row and column.

**Apply these thresholds to classify each customer:**

| Signal | Threshold | Flag |
|---|---|---|
| Commit % consumed | ≥ 80% | 🔴 Overrun risk |
| Commit % consumed | < 20% at > 80% of term | 🟡 Breakage risk |
| Burn rate projected exhaustion | Before contract end date | 🔴 Overrun risk |
| Days to renewal | ≤ 30 days | 🟠 Renewal imminent |
| Days to renewal | 31–90 days | 🟡 Renewal upcoming |
| MoM Δ% | > +20% (finalized invoices) | 🟠 Spend spike |
| MoM Δ% | < −20% (finalized invoices) | 🟡 Spend decline |
| Stuck DRAFT | Invoice `end_timestamp` is in the past | 🟠 Billing issue |

**Mid-month rule:** If the current period invoice is DRAFT, exclude it from MoM variance. Use only finalized periods.

**Reconciliation:** For any customer with multiple flags, confirm they are consistent. A customer flagged for both overrun risk and spend decline is contradictory — re-check the data before reporting.

---

### Phase 3 — Report Output

Structure the output in this order:

#### 1. Executive Summary (3–5 bullets)
- How many customers reviewed
- How many flagged 🔴 / 🟠 / 🟡
- Top 1–2 most urgent items by name
- Any pattern worth calling out (e.g., "3 of 5 customers with renewals in 30 days have >70% commit remaining")

#### 2. Action Required (🔴 and 🟠 only)
One paragraph per flagged customer. Include: customer name, flag type, the specific number, and recommended next action.

#### 3. Watch List (🟡 only)
Compact table: customer name, flag, key metric, suggested follow-up.

#### 4. Healthy Customers
Single line: "X customers are on pace with no flags."

#### 5. Full Data Table
The complete Phase 1 inventory table for reference.

---

## Quick Risk Scan

Use when the user wants a fast read without full renewal math.

Collect only: `POST /v1/contracts/customerBalances/list` (commit %) + `POST /v2/contracts/list` (days to renewal from `ending_before`) per customer. Skip burn rate and MoM variance. Flag only 🔴 overrun and renewal ≤30 days. Output as a single compact table — no narrative.

---

## Output Formats

**For Slack:**
Produce the Executive Summary and Action Required sections only. Keep to under 400 words. Use plain text — no markdown tables (Slack renders them poorly). List flagged customers as bullet points with emoji.

**For a Google Doc or Notion:**
Produce the full report (all 5 sections). Use markdown tables for Phase 1 data and Watch List.

**For CSV (trend tracking):**
Output only the Phase 1 table with an added `report_date` column (today's date). One row per customer. No narrative. This format is designed to be appended to a running spreadsheet month over month.

---

## Mandatory gotchas

- **All amounts are in cents.** `POST /v1/contracts/customerBalances/list` and `GET /v1/customers/{id}/invoices` both return amounts in cents — divide `total` by 100. There is no `formatted_total` field on invoices.
- **PAYGO, evergreen, flat-fee, and new customers must appear in the report.** Do NOT silently drop them because they lack commit data. Use "—" or a descriptive label.
- **MoM variance applies to finalized USAGE invoices only.** Mid-month DRAFT invoices and SCHEDULED (platform fee) invoices are excluded.
- **Fleet scans are blocked by the API.** Always start from a user-supplied list. If the user says "all customers," ask for the list.
- **`POST /v1/contracts/customerBalances/list` is capped at 25 results per page** — unlike other endpoints which allow 100. Paginate using `next_page` if a customer has many commits or credits.
- **Projections are forecasts.** Label any exhaustion date or run-rate figure as a forecast, not a fact.
