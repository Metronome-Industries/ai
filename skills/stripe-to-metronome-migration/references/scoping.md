# Scoping a Stripe UBBv1 to Metronome migration

## Table of contents

- Discovery questionnaire
- Metering assessment
- Pricing model assessment
- Credit grants assessment
- Customer lifecycle assessment
- Dashboards and alerting assessment
- Workstream identification

## Discovery questionnaire

Before migrating, audit the current Stripe integration to choose the correct migration path and identify required workstreams.

### Current tech stack

| Question | Why it matters |
| --- | --- |
| How are you ingesting meter events? (v1 `/v1/billing/meter_events` or v2 high-throughput Meter Event Stream?) | Determines event pipeline changes needed |
| What Stripe products do you use alongside UBB? (Subscriptions, Checkout, Tax, Revenue Recognition, Radar) | Identifies what stays on Stripe vs. moves to Metronome |
| Do you use Stripe's Customer Portal for self-service? | Portal functionality must be rebuilt or replaced |
| Current CRM, CPQ, ERP/GL, and Data Warehouse? | Integration points that need updating |
| Do you use Stripe Data Pipeline or Sigma? | Data reporting pipeline changes needed |
| Tax provider? (Stripe Tax, Anrok, Avalara) | Tax continues to work at Stripe invoice finalization |

### Metering

| Question | Migration impact |
| --- | --- |
| How many Billing Meters configured? | Determines number of Billable Metrics to create |
| Aggregation formulas used? (SUM, COUNT, LAST) | Maps directly to Metronome aggregation types |
| Meter segments in use? How many dimensions per meter? | Candidates for Metronome group keys — may consolidate multiple meters |
| Tenant-level grouping for multi-tenant attribution? | Map to presentation group keys |
| Event ingestion volume (events/second)? | Capacity planning for Metronome ingestion |
| Are required properties already in event payloads? | Determines if event instrumentation changes are needed |

### Pricing models

| Question | Migration impact |
| --- | --- |
| Pricing models in use? (per-unit, tiered/volume, graduated, package) | Maps to Metronome rate types |
| Using Stripe Credit Grants? | Must migrate to Metronome commits/credits |
| Prepaid, postpaid, or hybrid billing? | Contract design decisions |
| Billing intervals? (monthly, annual, custom) | Contract cadence configuration |
| Currencies used? | Rate cards are single-currency |
| Subscription schedules for phased pricing? | Maps to contract scheduling and amendments |
| Billing in custom units (credits)? | Requires Metronome Custom Pricing Units |

### Credit grants

| Question | Migration impact |
| --- | --- |
| How many credit grant types? | Number of commits/credits to create per contract |
| Scoped to specific prices or global? | Product-specific vs. global commits/credits |
| Priority ordering for multiple grants? | Priority configuration on Metronome contracts |
| Issued via API, manually, or recurring automation? | Automation must be rebuilt against Metronome APIs |
| Expiration dates? | Access schedule end dates |

### Customer lifecycle

| Question | Migration impact |
| --- | --- |
| PLG: Self-serve acquisition flow? (Checkout, Payment Links, custom) | Metronome Packages for standardized onboarding |
| PLG: Plan changes? (upgrades, downgrades, cancellations) | Contract edits workflow |
| PLG: Trials, promo codes, promotional credits? | Map to Metronome credits |
| SLG: Enterprise flow? (discounts, commits, custom contracts) | Contract overrides and commits |
| Using Stripe Connect or multi-entity billing? | Entity mapping configuration |

## Workstream identification

Based on the scoping assessment, a typical migration involves these workstreams:

1. **Product catalog setup** — Billable metrics, products, rate cards
2. **Event pipeline** — Redirect or dual-write events to Metronome
3. **Customer onboarding** — Create Metronome customers, link to Stripe
4. **Contract creation** — Rate card assignment, commits, credits, overrides
5. **Credit grant migration** — Transfer remaining balances from Stripe
6. **Dashboard/reporting update** — Swap API calls or embed Metronome dashboards
7. **Alerting update** — Replace Stripe webhook-driven alerting
8. **Parallel validation** — Run both systems and compare invoice totals
9. **Production cutover** — End Stripe subscriptions, enable Metronome billing

Not all workstreams apply to every migration. The scoping assessment determines which are required.
