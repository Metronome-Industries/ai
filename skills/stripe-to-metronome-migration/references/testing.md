# Testing and parity validation

## Table of contents

- Sandbox testing
- Parallel run parity checks
- Smoke test checklist
- Common issues

## Sandbox testing

Sign up for a Metronome sandbox account at [signup.metronome.com](https://signup.metronome.com/) if you don't have one.

### Test sequence

1. **Set up product catalog** in sandbox (billable metrics → products → rate cards)
2. **Configure Stripe test mode** integration in Metronome
3. **Test event ingestion**:
   - Send test meter events and verify they appear in Metronome
   - In sandbox, send test events from the UI: navigate to customer's contract view → click on a product on the rate card → use the test event sender
   - Verify: `transaction_id` is unique, `timestamp` is within last 34 days, `event_type` and `properties` match billable metric configuration
4. **Test invoice generation** — verify draft invoices have expected line items (Customers → Contract → Invoices)
5. **Test Stripe sync** — verify invoices appear in Stripe test mode with correct totals after 24-hour grace period and finalization
6. **Test credit drawdown** — verify commits/credits draw down correctly in expected priority order
7. **Test dashboards and alerting** — verify customer-facing and internal tools

### Tips

- Use Stripe's [Test Clocks](https://docs.stripe.com/billing/testing/test-clocks) to simulate time progression for Stripe-side invoice processing and payment collection. Test Clocks support Subscriptions and Invoices but may not simulate Billing Meter aggregation.
- In Metronome sandbox, events with timestamps older than 34 days are rejected.

## Parallel run parity checks

During production parallel run, automate these validations:

| Check | How |
| --- | --- |
| Invoice totals match | Compare Stripe invoice total vs. Metronome invoice total for same customer and period |
| Line item quantities match | Compare metered quantities on both invoices |
| Credit application matches | Compare credit drawdown amounts |
| All customers have contracts | Verify every active Stripe subscription customer has a corresponding Metronome contract |
| Event ingestion parity | Compare Stripe Meter Event Summaries vs. Metronome usage aggregations |
| Group key coverage | Verify all dimension values in events have corresponding rates on the rate card |

### Acceptable variance

Recommend less than 1% variance between Stripe and Metronome invoice totals before approving cutover. Minor sub-cent differences are expected due to rounding precision differences between the two systems.

## Smoke test checklist

- [ ] New customer creation flow works end-to-end
- [ ] Ingest aliases resolve correctly (events sent with internal ID appear on correct customer)
- [ ] Usage events are ingested and aggregated correctly
- [ ] Invoice finalization produces correct totals (after 24-hour grace period)
- [ ] Invoices appear in Stripe with correct line items
- [ ] Payments are processed successfully
- [ ] Credits and commits draw down in correct priority order (rollover commits → prepaid commits and credits → postpaid commits, then by priority within each type)
- [ ] Quantity conversions display correctly (e.g., tokens to millions of tokens)
- [ ] Alerts fire at configured thresholds
- [ ] Embeddable or custom dashboards show correct data
- [ ] Data export delivers expected datasets
- [ ] Webhook delivery is reliable for invoice and payment events

## Common issues

| Symptom | Cause | Resolution |
| --- | --- | --- |
| Usage visible in Connections but no charges on invoice | Event property values don't match pricing group key values on rate card | Verify exact match including case (e.g., `"gpt-4"` vs. `"GPT-4"`) |
| Events not appearing in Metronome | `event_type` doesn't match any billable metric filter | Verify event type exactly matches the billable metric's event type filter |
| Duplicate charges | Same event sent with different `transaction_id` values | Use deterministic IDs derived from source data |
| Missing events in billing period | Events sent after grace period expired | Align grace period with data pipeline's maximum latency |
| Credit not drawing down | Credit's `applicable_product_ids` don't match the products being charged | Verify product scoping on commits/credits |
| Invoice total mismatch between systems | Rounding differences, missing dimension rates, or timing differences | Check for uncovered group key values and rounding precision |
