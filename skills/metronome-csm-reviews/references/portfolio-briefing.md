# Portfolio briefing

Orchestrates commit health, renewal, and anomaly checks across a bounded customer list and produces a structured monthly briefing.

---

## What are you trying to do?

- Full monthly portfolio report? → **Portfolio report** section below
- Quick risk scan only? → **Quick risk scan** section below
- Output for Slack or a doc? → **Output formats** section below

---

## Before you start

Fleet scans are NOT feasible. If the CSM asks for "all customers," respond:
> "Portfolio reports require a customer list. Paste your accounts (names or IDs) and I'll run the full briefing."

Recommended list size: 10–30 customers. Above ~50, split into batches.

---

## Data source hierarchy

**Pass 1 — Direct API calls (always start here)**
Use shared API calls from SKILL.md. They handle auth, pagination, and unit conversion.

**Pass 2 — Fallback (only if Pass 1 returns $0)**
If costs endpoint returns $0 for a customer with an active commit, use the fallback burn rate from SKILL.md. Label as "estimated."

Never fabricate data — if an API call returns an error, surface it to the user.

---

## Portfolio report

### Phase 1 — Data collection

For each customer, collect all signals in parallel before Phase 2. DO NOT begin Phase 2 until every row is populated.

Per customer (fan out in parallel where possible):
1. `GET /v1/customers` → UUID
2. `POST /v2/contracts/list` → contract type, end date, commit structure
3. `POST /v1/contracts/customerBalances/list` with `include_balance: true` → commit %, remaining, priority order
4. `GET /v1/customers/{id}/costs` (last 2 completed months, two calls) → burn rate
5. `GET /v1/customers/{id}/invoices?type=USAGE` → DRAFT status + invoice type classification
6. `POST /v2/contracts/list` → `ending_before` for days-to-renewal

**Required intermediate artifact — one row per customer:**

| Customer | Contract type | End date | Commit % used | Remaining ($) | Burn rate (3mo avg) | Days to renewal | MoM Δ% | Stuck DRAFT | Flags |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | |

**Contract type values:** `COMMIT` (prepaid), `PAYGO` (no commit), `EVERGREEN` (no end date), `FLAT_FEE` (SCHEDULED only).

**Edge cases to record, not skip:**
- PAYGO → commit % = "—", remaining = "—"
- Evergreen → end date = "∞", days to renewal = "∞"
- New customer (no invoices) → MoM Δ% = "—", mark as NEW
- Flat fee only → MoM Δ% = "—" (SCHEDULED invoices excluded)

---

### Phase 2 — Analysis

Work from Phase 1 table only. Apply thresholds from SKILL.md. Every flag must reference a specific row and column.

**Reconciliation:** A customer flagged for both overrun risk and spend decline is contradictory — re-check the data before reporting.

---

### Phase 3 — Report output

Structure in this order:

**1. Executive summary (3–5 bullets)**
- How many customers reviewed
- How many flagged 🔴 / 🟠 / 🟡
- Top 1–2 most urgent items by name
- Any pattern worth calling out

**2. Action required (🔴 and 🟠 only)**
One paragraph per customer: name, flag type, specific number, recommended next action.

**3. Watch list (🟡 only)**
Compact table: customer, flag, key metric, suggested follow-up.

**4. Healthy customers**
Single line: "X customers are on pace with no flags."

**5. Full data table**
The complete Phase 1 inventory table.

---

## Quick risk scan

Collect only: `customerBalances/list` (commit %) + `POST /v2/contracts/list` (days to renewal). Skip burn rate and MoM variance. Flag only 🔴 overrun and renewal ≤30 days. Output as a single compact table — no narrative.

---

## Output formats

**For Slack:**
Executive summary and action required only. Under 400 words. Plain text — no markdown tables. Flagged customers as bullet points with emoji.

**For a Google Doc or Notion:**
Full report (all 5 sections). Markdown tables for Phase 1 data and watch list.

**For CSV (trend tracking):**
Phase 1 table only with an added `report_date` column. One row per customer. No narrative. Designed to be appended to a running spreadsheet month over month.
