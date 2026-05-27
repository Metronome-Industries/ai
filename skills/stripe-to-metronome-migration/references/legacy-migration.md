# Legacy customer migration

## Table of contents

- Recommended approach: month-boundary parallel run
- Phase 1: Preparation
- Phase 2: Contract creation
- Phase 3: Parallel run
- Phase 4: Production cutover
- Phase 5: Cleanup
- Migrating active credit grants
- Migrating threshold billing / auto-recharge

## Recommended approach: month-boundary parallel run

The safest approach for migrating existing Stripe UBBv1 customers is a parallel run aligned to billing period boundaries. Both systems run simultaneously for at least one full billing cycle, with Metronome in unbillable mode, to validate parity before cutting over.

## Phase 1: Preparation

1. **Set customers as unbillable** in Metronome using the `setBillableStatus` endpoint
2. **Create Metronome customers** with `stripe_customer_id` linked and ingest aliases configured
3. **Set Stripe billing provider configuration** on each Metronome customer

## Phase 2: Contract creation

1. **Create contracts** for each customer:
   - Point to your standard rate card
   - Set contract start date to beginning of parallel run period
   - Set invoice generation to begin at the parallel run start
   - Include any credits or commits (migrated from Stripe Credit Grants)
   - Set the contract billing provider to the Stripe configuration from Phase 1

## Phase 3: Parallel run

Duration: Minimum one full billing cycle (recommended: one month).

1. **Send usage events to both Stripe and Metronome** (dual-write)
2. **Stripe Subscriptions remain active** — Stripe continues to invoice customers normally
3. **Metronome generates unbillable invoices** — these exist for parity validation only (not sent to Stripe)
4. **Run parity checks** comparing Stripe invoice totals vs. Metronome invoice totals

### Common troubleshooting

If you see usage in Metronome (under **Connections**) but no charges on the invoice:
- Verify that your events' property values match the **pricing group key values** configured on your rate card
- This is the most common setup issue (e.g., rate card has `model_name = "gpt-4"` but events send `model_name = "GPT-4"` — case-sensitive mismatch)

## Phase 4: Production cutover

Aligned to a billing period boundary (e.g., month start):

1. **End Stripe subscriptions** at the end of the current billing period:
   - Use subscription schedules to cancel at period end, OR
   - Update subscriptions with `cancel_at_period_end: true` (`POST /v1/subscriptions/{id}`)
2. **Schedule customers as billable** in Metronome effective at the start of the next period
3. **Stop sending events to Stripe** (redirect exclusively to Metronome)
4. **Result**: Next period's invoices come exclusively from Metronome, pushed to Stripe for payment collection

## Phase 5: Cleanup

- Remove legacy Stripe Meter configurations (or leave dormant)
- Archive unused Stripe Prices
- Flip feature flags for dashboards, alerting, and reporting
- Decommission dual-write event pipeline

## Migrating active credit grants

If customers have active Stripe Credit Grants:

1. **Before cutover**: Create equivalent commits or credits on the Metronome contract
   - Match: **remaining balance** (not original amount), priority, expiration, applicability
   - Map `category: "paid"` → Metronome **Prepaid Commit** (has invoice schedule)
   - Map `category: "promotional"` → Metronome **Credit** (no invoice schedule)
2. **At cutover**: Stripe Credit Grant stops being drawn down (Stripe no longer generates usage invoices)
3. **Post-cutover**: Metronome credits/commits draw down against Metronome invoices

### Critical detail

Stripe Credit Grants are not automatically transferred. You must:
1. Retrieve remaining balances using [`GET /v1/billing/credit_balance_summary`](https://docs.stripe.com/api/billing/credit-balance-summary) (the credit grant object only stores the original amount)
2. Recreate in Metronome with the **remaining balance**

## Migrating threshold billing / auto-recharge

If you use Stripe's threshold billing or auto-recharge:

1. Create the Metronome contract **without** auto-recharge initially
2. Complete your parallel run and parity validation
3. At cutover:
   - End the Stripe subscription
   - Migrate remaining credit balance to Metronome commit
   - Enable auto-recharge on the Metronome contract
   - Set the customer as billable

### Warning

Metronome's unbillable status is **not respected** if auto-recharge is enabled on the contract. Do not enable auto-recharge until you are ready to go live. Enabling it during the parallel run will generate real charges regardless of billable status.
