---
name: metronome-best-practices
description: >-
  Guides Metronome usage-based billing integration decisions — event ingestion
  (single and batch, idempotency, billable metrics), contract design (rate cards,
  overrides, dimensional pricing, products), invoicing lifecycle (grace periods,
  finalization, Stripe sync), credit and commit management (prepaid, postpaid,
  thresholds, auto-recharge), and Stripe integration (arrears invoicing, tax
  providers, line item limits). Use when building, modifying, or reviewing any
  Metronome integration — including ingesting usage events, creating contracts
  or rate cards, managing credits and commits, configuring invoicing, or syncing
  invoices with Stripe Billing.
---

Metronome API base: Production `https://api.metronome.com/v1` | Sandbox `https://staging.api.metronome.com/v1`. Authenticate with a Bearer token in the `Authorization` header. Always use Contracts (not legacy Plans) for new integrations.

## Integration routing

| Building...                                | Recommended API                  | Details                                |
| ------------------------------------------ | -------------------------------- | -------------------------------------- |
| Ingesting usage events                     | `POST /v1/ingest`  (batch)      | <references/events.md>                 |
| Defining what to measure                   | Billable Metrics API             | <references/events.md>                 |
| Enterprise pricing agreements              | Contracts + Rate Cards           | <references/contracts.md>              |
| Mid-term contract changes                  | Contract Edits                   | <references/contracts.md>              |
| Invoice lifecycle and finalization         | Invoices API                     | <references/invoicing.md>              |
| Prepaid or postpaid commitments            | Commits + Credits                | <references/credits-and-commits.md>    |
| Syncing invoices to Stripe                 | Stripe billing provider config   | <references/stripe-integration.md>     |
| Spend alerts and balance thresholds        | Notifications API                | <references/credits-and-commits.md>    |

Read the relevant reference file before answering any integration question or writing code.

## Critical rules

- *Always use Contracts*, not legacy Plans. Plans are deprecated and lack rate card overrides, commits, and flexible scheduling.
- *Always use Edits*, not deprecated Amendments, for contract modifications. Edits are the actively invested path and required for v2 subscription features.
- *Always use batch ingestion* (`POST /v1/ingest` with an array of events) for production workloads. Single-event ingestion is acceptable only for testing.
- *Always include a unique, deterministic `transaction_id`* on every event. This is the idempotency key that prevents double-counting on retries.
- *Never process multiple Metronome invoices for the same Stripe customer simultaneously.* Concurrent processing causes race conditions on pending line items.
- *Never hardcode pricing directly in contracts.* Define pricing in rate cards and use contract-level overrides for custom rates. This ensures un-overridden pricing stays current when the rate card changes.
- *Never finalize a Stripe invoice before tax calculation completes.* If using Stripe Tax, Avalara, or Anrok, the tax provider must process the invoice before finalization.
- *Never exceed 250 line items per Stripe invoice.* Exceeding this limit causes all line items to collapse into a single entry, losing per-product detail. Plan product granularity and use composite products to aggregate high-cardinality metrics.

## Key documentation

When the user's request does not clearly fit a single domain above, consult:

- [Metronome Documentation](https://docs.metronome.com/) — Start here for any Metronome question.
- [API Reference](https://docs.metronome.com/api-reference/) — Full endpoint reference.
- [LLM-friendly doc index](https://docs.metronome.com/llms.txt) — Machine-readable documentation index.
- [Stripe Integration Guide](https://docs.metronome.com/integrations/stripe/) — Syncing Metronome invoices with Stripe.
