# Production cutover and monitoring

## Table of contents

- Cutover checklist
- Post-cutover monitoring
- Rollback plan
- Net-new customer launch

## Cutover checklist

Complete all items before executing the production cutover:

- [ ] Parallel run completed with acceptable parity (recommend <1% variance)
- [ ] All active subscriptions scheduled for end-of-period cancellation
- [ ] All customers scheduled to become billable at period start
- [ ] Event pipeline redirected exclusively to Metronome
- [ ] Auto-recharge enabled on contracts that need it (only after billable status is set)
- [ ] Feature flags ready for dashboard, alerting, and reporting switchover
- [ ] Runbook prepared for rollback if issues discovered
- [ ] Customer communication sent (if invoice format or branding changes)

## Post-cutover monitoring

Monitor these areas during the first full billing cycle after cutover:

| What to monitor | How |
| --- | --- |
| Webhook delivery | Monitor Metronome webhook delivery for invoice and payment events |
| Payment failures | Monitor Stripe for payment failures on Metronome-pushed invoices |
| Invoice totals | Validate first full billing cycle totals against historical baselines |
| Billing provider errors | Watch for `invoice.billing_provider_error` webhooks from Metronome (indicates Stripe sync issues) |
| Grace period alignment | Verify 24-hour grace period timing aligns with late-arriving event patterns |
| Uncovered pricing | Check that all pricing group key values have rates (missing rates = unbilled usage) |

## Rollback plan

If critical issues are discovered post-cutover:

1. **Set affected customers back to unbillable** in Metronome
2. **Recreate Stripe subscriptions** (or reactivate if not yet fully canceled)
3. **Resume sending events to Stripe**
4. **Investigate and resolve issues** before re-attempting

### Rollback considerations

- If subscriptions were canceled with `cancel_at_period_end`, they can be reactivated before the period ends by removing the cancellation
- If subscriptions have already fully canceled, they must be recreated with the same pricing configuration
- Credit grants in Stripe are unaffected by the parallel run (they weren't drawn down if Metronome was unbillable)
- Events sent only to Metronome during the cutover window are lost from Stripe — plan for re-ingestion if rolling back

## Net-new customer launch

Before launching net-new customers on Metronome, ensure:

- Metronome product catalog configured (billable metrics, products, rate cards)
- Stripe integration connected and entity mappings saved
- Event ingestion pipeline sending to Metronome
- Customer dashboards ready
- Alert handling configured
- Internal reporting integrated

### Launch flow for new customers

1. Create customer in Metronome with Stripe billing provider configuration (linking `stripe_customer_id`) and set ingest aliases
2. Create a contract:
   - References standard rate card (or apply a **Package** for standardized self-serve onboarding)
   - Includes billing provider configuration pointing to Stripe
   - Includes any credits or commits (trial credits as **Credits**, paid prepaid as **Commits**)
   - Includes any negotiated discounts or overrides
3. Begin sending usage events for the customer
4. Metronome generates invoices and pushes finalized invoices to Stripe at billing period end (after 24-hour grace period)
5. Stripe handles payment collection, tax, Smart Retries, and retry settings
