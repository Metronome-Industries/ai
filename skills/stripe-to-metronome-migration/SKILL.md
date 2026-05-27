---
name: stripe-to-metronome-migration
description: >-
  Guides migration from Stripe Usage-Based Billing (Billing Meters and
  Subscriptions) to Metronome. Covers scoping and discovery (metering,
  pricing models, credit grants, dashboards), design (concept mapping,
  billable metrics, group keys, rate cards, integration pattern selection),
  implementation (product catalog setup, event ingestion, customer creation,
  contracts, credit grant migration, alerting), testing (parallel run parity
  checks, sandbox validation), and production cutover (legacy customer
  migration, rollback planning). Use when planning, executing, or
  troubleshooting a migration from Stripe UBBv1 to Metronome — including
  scoping the effort, mapping Stripe objects to Metronome equivalents,
  designing billable metrics and group keys, running parallel validation,
  migrating credit grants, or cutting over production customers.
---

This skill covers migrating from Stripe's Usage-Based Billing (Billing Meters, Prices, Subscriptions, Credit Grants) to Metronome. For general Metronome integration guidance not specific to migration, use the `metronome-best-practices` skill instead.

## Migration routing

| Task                                         | Reference                             |
| -------------------------------------------- | ------------------------------------- |
| Scoping the migration effort                 | <references/scoping.md>               |
| Mapping Stripe concepts to Metronome         | <references/concept-mapping.md>       |
| Designing billable metrics and group keys    | <references/product-catalog-design.md>|
| Choosing an integration pattern              | <references/integration-patterns.md>  |
| Implementing step by step                    | <references/implementation.md>        |
| Migrating legacy customers (parallel run)    | <references/legacy-migration.md>      |
| Testing and parity validation                | <references/testing.md>               |
| Production cutover and monitoring            | <references/cutover.md>               |

Read the relevant reference file before answering any migration question or generating migration code.

## Critical rules

- *Always set migrating customers as unbillable* before creating contracts. This prevents double-billing during the parallel run period.
- *Always use a parallel run* (minimum one full billing cycle) before cutting over legacy customers. Compare Stripe and Metronome invoice totals to validate parity.
- *Always align cutover to a billing period boundary* (typically month start). Mid-period cutovers create partial billing gaps or overlaps.
- *Always migrate credit grant remaining balances*, not original amounts. Use `GET /v1/billing/credit_balance_summary` to retrieve remaining balances from Stripe.
- *Never enable auto-recharge on Metronome contracts during the parallel run.* Auto-recharge ignores unbillable status and will generate real charges.
- *Never send events with string-typed numeric values to Metronome.* Stripe accepts `"value": "1"` (string); Metronome requires `"value": 1` (number).
- *Never modify group keys, aggregation type, or event type filter after creating a billable metric.* These are immutable — plan carefully upfront and include more group keys than you think you need.
- *Never skip the 24-hour grace period in production.* Late-arriving events after the grace period expires are lost from that billing period.

## Key documentation

| Resource | URL |
| --- | --- |
| How Metronome works with Stripe | https://docs.stripe.com/billing/how-metronome-works-with-stripe |
| Metronome API Quickstart | https://docs.metronome.com/guides/get-started/api-quickstart |
| Metronome API Reference | https://docs.metronome.com/api-reference/introduction |
| Design Usage Events | https://docs.metronome.com/guides/events/design-usage-events |
| Credits and Commits | https://docs.metronome.com/guides/pricing-packaging/apply-credits-and-commits |
| Invoice with Stripe | https://docs.metronome.com/integrations/invoice-integrations/stripe |
| Metronome Production Checklist | https://docs.metronome.com/guides/implement-metronome/production-checklist |
| Stripe Billing Meters | https://docs.stripe.com/billing/subscriptions/usage-based/meters/configure |
| Stripe Credit Grants API | https://docs.stripe.com/api/billing/credit-grant |
| Stripe Credit Balance Summary | https://docs.stripe.com/api/billing/credit-balance-summary |
