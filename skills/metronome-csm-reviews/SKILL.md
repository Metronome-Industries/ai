---
name: metronome-csm-reviews
description: >-
  Customer health reviews for CSMs — anomaly detection (MoM spend variance,
  stuck DRAFT invoices, commit burn spikes), commit health (burn rate, overrun
  and breakage risk for a single customer), portfolio briefing (monthly
  all-customer report with exec summary and action items), and renewal prep
  (contract terms, trailing consumption, TCV scenarios). Use when asked which
  customers need attention, how a customer is tracking against their commit,
  for a monthly report or portfolio briefing, or to prep for a renewal.
argument-hint: <customer_name_or_list>
---

All API calls are read-only. Use `$METRONOME_API_TOKEN` for auth. Base URL: `https://api.metronome.com/v1` (prod) or `https://staging.api.metronome.com/v1` (sandbox).

## Routing

| CSM asks... | Mode | Load |
| --- | --- | --- |
| "which customers need attention", "MoM variance", "stuck invoices", "month-end review", "anomalies" | Anomaly detection | <references/anomaly-detection.md> |
| "how is [customer] tracking", "commit burn rate", "overrun risk", "will they run out", "commit health" | Commit health | <references/commit-health.md> |
| "monthly report", "portfolio briefing", "all-customer summary", "end of month", "who needs attention this month" | Portfolio briefing | <references/portfolio-briefing.md> |
| "prep for renewal", "renewal brief", "TCV scenarios", "contract expiring", "consumption trajectory" | Renewal prep | <references/renewal-prep.md> |

Read the relevant reference file before making any API calls or analysis.

---

## Shared API calls

All modes use the same 5 endpoints. Collect data in this order per customer:

| Data needed | Call |
| --- | --- |
| Customer UUID | `GET /v1/customers` — match by `name` field from response |
| Contract terms, end date | `POST /v2/contracts/list` with `{ "customer_id": "<id>" }` |
| Commit / credit balances | `POST /v1/contracts/customerBalances/list` with `{ "customer_id": "<id>", "include_balance": true }` |
| Burn rate | `GET /v1/customers/{id}/costs?starting_on=<date>&ending_before=<date>` — two calls, last 2 completed months |
| Invoice status | `GET /v1/customers/{id}/invoices?type=USAGE&sort=date-desc` |

---

## Shared thresholds

Apply these to FINALIZED data only. Never flag mid-month DRAFT invoices.

| Signal | Threshold | Flag |
| --- | --- | --- |
| Commit % consumed | ≥ 80% | 🔴 Overrun risk |
| Commit % consumed | < 20% at > 80% of contract term elapsed | 🟡 Breakage risk |
| MoM Δ% | > +20% (FINALIZED invoices only) | 🟠 Spend spike |
| MoM Δ% | < −20% (FINALIZED invoices only) | 🟡 Spend decline |
| Days to renewal | ≤ 30 | 🟠 Renewal imminent |
| Days to renewal | 31–90 | 🟡 Renewal upcoming |
| Stuck DRAFT invoice | `end_timestamp` in the past, status still DRAFT | 🟠 Billing issue |

---

## Fallback burn rate

If `GET /v1/customers/{id}/costs` returns $0 for a customer with an active commit, the customer is likely burning included credits first. Fall back to:

```
estimated_burn_rate = (original_balance − remaining_balance) / months_elapsed
```

Label any figure derived this way as **estimated**. Do not present it as a confirmed rate.

---

## Mandatory gotchas

- **All amounts are in cents.** Divide by 100 before presenting. There is no `formatted_total` field — use `total` from invoices and divide by 100. A balance of `5562901` = $55,629.01.
- **`include_balance: true` is required** on `customerBalances/list` or `percentage_consumed` and remaining balance are null.
- **`customerBalances/list` is capped at 25 results per page** — unlike other endpoints (100 max). Paginate with `next_page` if a customer has many commits or credits.
- **Zero invoices ≠ anomaly.** Some customers bill outside Metronome. Note "external invoicing" and skip invoice-based checks for that customer.
- **Use completed months only for burn rate.** Current period follows an S-curve (day 13 ≈ 37% of monthly total). Never use the current open period as the burn rate.
- **If costs API returns $0 but FINALIZED USAGE invoices show non-zero totals, use invoice totals for trend analysis.** The costs endpoint returns $0 when usage draws from a prepaid commit or custom credit type — invoice totals reflect actual charges after commit offset and are the reliable signal in those cases.
- **If costs API returns $0 AND recent USAGE invoices are also $0 or absent**, include this in the output: *"No billing activity found in the review window. This customer may have been active in an earlier period — reply 'check history' to extend the lookback."*
- **Mid-month DRAFT invoices are not anomalies.** Only flag DRAFT invoices whose `end_timestamp` is in the past.
- **Contract end date may be null.** Evergreen contracts have no `ending_before`. Ask the user before building any projections that require a fixed end date.
- **Filter to `type=USAGE` for burn rate.** SCHEDULED invoices are flat platform fees — including them overstates consumption and inflates renewal pricing.
