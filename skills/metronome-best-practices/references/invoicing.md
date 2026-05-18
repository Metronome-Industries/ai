# Invoicing

## Table of contents

- Invoice types
- Invoice lifecycle
- Grace periods
- Finalization flow
- Invoice preview and regeneration
- Line item considerations
- Traps to avoid

## Invoice types

Metronome generates three types of invoices:

| Type                | Trigger                                 | Service period | Finalization    |
| ------------------- | --------------------------------------- | -------------- | --------------- |
| Usage               | End of billing period + grace period    | Yes            | After grace     |
| Scheduled           | Specific date (commit purchase, fee)    | No             | Immediate       |
| Usage (consolidated)| Hierarchy rollup across child accounts  | Yes            | After grace     |

**Usage invoices** contain metered charges from billable metrics over a service period (e.g., January 1-31). They are the most common type. For account hierarchies, a **usage consolidated** invoice rolls up charges across child accounts.

**Scheduled invoices** are issued on a specific date for fixed charges: prepaid commit purchases, subscription fees, and one-time charges. They have no service period and finalize immediately.

For **postpaid commits**, when actual usage is less than the committed amount, a usage invoice at the end of the commitment period includes a true-up charge for the shortfall.

## Invoice lifecycle

Metronome invoice states:

```
DRAFT  →  FINALIZED
                ↘  VOID
```

- **DRAFT**: In-flight during the billing period. Amounts recompute as new usage events arrive.
- **FINALIZED**: Issue date has passed (after grace period for usage invoices). Totals and line items are locked. No further changes allowed.
- **VOID**: Invoice has been cancelled. Voided invoices can be regenerated.

Draft invoices are estimates. Do not treat draft amounts as final — they will change as new events are ingested and processed.

Once finalized, the invoice is pushed to the downstream billing provider (Stripe, NetSuite, etc.). Payment tracking (sent, paid, failed) is handled by the billing provider, not by Metronome invoice states.

## Grace periods

The grace period is a configurable window after a billing period closes during which late events are still accepted and counted toward that period's invoice.

- **Default**: Configurable per contract or globally. A common setting is 24 hours after the billing period end.
- **Configure** based on your data pipeline's maximum latency. If events routinely arrive 6 hours late, set the grace period to at least 8 hours.
- Events arriving after the grace period expires are **not** counted toward the closed period. They may be attributed to the next period depending on their timestamp.

Grace periods apply only to usage and true-up invoices. Scheduled invoices finalize immediately.

## Finalization flow

After the grace period expires:

1. Metronome calculates final totals for all line items.
2. Line items and totals are locked (invoice transitions to FINALIZED).
3. If a billing provider (Stripe, NetSuite) is configured, the invoice is synced downstream.
4. Tax calculation must complete before Stripe-side finalization (see [Stripe integration](https://docs.metronome.com/integrations/stripe/)).

Do not manually trigger finalization before the grace period ends unless you are certain all events have been ingested.

## Invoice preview and regeneration

- **Preview**: Use the invoice preview endpoint to see what the current draft invoice would look like if finalized now. Useful for validating pricing and providing customers with cost estimates.
- **Regenerate**: Recalculate a draft invoice after corrections (e.g., after fixing a billable metric or adding an override). Regeneration is an expensive operation — do not call it frequently.

## Line item considerations

Each Metronome product or metric dimension becomes a separate line item on the invoice. Keep these limits in mind:

- **Stripe hard limit**: 250 line items per Stripe invoice. Exceeding this causes sync failure.
- **High-cardinality metrics**: If your product has dimensional pricing across many values (e.g., per-endpoint or per-model pricing), the line item count can grow quickly.
- **Mitigation**: Use composite products to aggregate related charges into fewer line items. Plan product granularity during the design phase rather than after hitting limits in production.

## Traps to avoid

- Do not set grace periods shorter than your data pipeline's maximum latency. Late events will be permanently lost for that billing period.
- Do not treat draft invoice amounts as final. Amounts change continuously until finalization.
- Do not manually edit Stripe invoices that Metronome manages. Changes will be overwritten or cause validation mismatches.
- Do not regenerate invoices frequently. It is a computationally expensive operation intended for corrections, not polling.
- Do not rely on invoice creation being synchronous with billing period end. Grace period processing and downstream sync introduce delays.
