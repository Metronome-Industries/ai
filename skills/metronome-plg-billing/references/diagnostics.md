# Customer diagnostics

## Contents

- Anomaly 1: Zero-usage contract
- Anomaly 2: Unexpected invoice amount
- Anomaly 3: Balance discrepancy (credits/commits)
- Anomaly 4: Events not billing

---

## Anomaly 1: Zero-usage contract

### Symptoms

The founder says: "My customer shows zero usage" or "Invoice is $0" or "Only the subscription fee shows up, no usage charges."

### Common causes (ordered by likelihood)

1. **Event type mismatch** — The `event_type` on ingested events doesn't match the billable metric's `event_type_filter`. Events are silently ignored.
2. **Wrong customer_id or alias** — Events are being attributed to a different customer (or no customer).
3. **Events too old** — Timestamps on events are more than 34 days in the past. Silently dropped.
4. **Contract not started yet** — Events are arriving but the contract `starting_at` is in the future.
5. **Customer genuinely inactive** — No events have been sent for this customer.

### Diagnostic steps

1. **Check the billable metric**: `GET /v1/billable-metrics/{id}` — confirm `event_type_filter.in_values` matches what is being sent.
2. **Search recent events**: `POST /v1/usage/searchEvents` with the customer's `transaction_id` prefix — verify events exist and are attributed to the right customer.
3. **Check ingest aliases**: `GET /v1/customers/{id}` — verify the `ingest_aliases` include whatever ID the event source is using as `customer_id`.
4. **Check event timestamps**: Compare event `timestamp` values against current time. If gap > 34 days, events were dropped.
5. **Check contract dates**: `GET /v2/contracts/{id}` — confirm `starting_at` is before the event timestamps.

### Resolution

- **Type mismatch**: Fix the event source to send the correct `event_type`, OR update the billable metric name (note: `event_type_filter` is immutable — you must create a new metric if the filter is wrong).
- **Wrong customer_id**: Fix the event source or add the correct ingest alias.
- **Old events**: Re-send events with timestamps within the 34-day window. Previously dropped events cannot be recovered.
- **Contract timing**: Either backdate the contract start or wait for the contract to become active.

---

## Anomaly 2: Unexpected invoice amount

### Symptoms

The founder says: "The invoice is way too high", "This doesn't match our agreed pricing", "Why is the total $X when I expected $Y?"

### Common causes (ordered by likelihood)

1. **Missing override** — The customer is on rate card default rates, not the negotiated rate the founder intended. The override was never created or was created on the wrong product.
2. **Cents vs. dollars misconfiguration** — Rates were entered in dollars instead of cents (or vice versa), producing a 100x error. Invoice shows $10,000 instead of $100.
3. **Wrong aggregation type** — Metric uses SUM when it should be COUNT (or vice versa). SUM with a large property value per event inflates the quantity.
4. **Credit/commit exhausted** — The customer's prepaid balance ran out mid-period. Overage is now billing at standard rates, making the invoice higher than expected.
5. **Dimensional pricing default** — Events have a dimension value (e.g., `model: "gpt-5"`) that doesn't have an explicit rate. It falls to a default rate or is unpriced, causing unexpected charges or $0.
6. **Duplicate events** — Events with different `transaction_id` values for the same logical action. Double-counting usage.

### Diagnostic steps

1. **Pull invoice breakdowns**: `POST /v1/invoices/listBreakdowns` — examine each line item's quantity and rate.
2. **Compare rates against rate card**: `POST /v1/contract-pricing/rate-cards/getRates` for the product — compare with the rate on the invoice. If they differ, an override may be missing.
3. **Check for overrides**: `POST /v1/contracts/getContractRateSchedule` for the customer's contract — verify overrides exist for products with negotiated rates.
4. **Check commit/credit balance**: `POST /v1/credits/listBalances` — if balance is zero, overage is in effect.
5. **Verify aggregation**: Compare the line item quantity on the invoice against a manual count of events (`POST /v1/usage/searchEvents`). If the invoice quantity is much larger than event count, check if SUM aggregation is multiplying by a large property value.
6. **Check for rate unit**: Verify the rate on the rate card is in cents. A rate of `100` means $1.00, not $100.00.

### Resolution

- **Missing override**: Add contract-level override with the correct negotiated rate.
- **Cents/dollars error**: Correct the rate on the rate card (remember blast radius) or add a corrective override. Void the incorrect invoice and regenerate.
- **Wrong aggregation**: Archive the metric, create a new one with correct aggregation. Re-attribute events (may require re-ingestion if the period is still open).
- **Credit exhaustion**: Either top up the commit/credit or accept that overage billing is correct behavior.
- **Dimensional default**: Add the missing pricing group value to the rate card for the unpriced dimension.

---

## Anomaly 3: Balance discrepancy (credits/commits)

### Symptoms

The founder says: "Where did the credits go?", "Balance should be $X but it shows $Y", "Credits aren't applying to the invoice."

### Common causes (ordered by likelihood)

1. **Access schedule timing** — The balance exists but isn't available yet. The current quarter's tranche hasn't started, or a future segment is being confused with current availability.
2. **Expired segment** — A previous access schedule segment ended and its unused balance expired (no rollover configured).
3. **Product-scoped credits** — The credit has `applicable_product_ids` or `applicable_tags` set, and the current charges are for a different product.
4. **Draft invoice reservation** — Draft invoices already claim (reserve) commit balance. The balance appears lower because an in-progress invoice has tentatively applied the credit.
5. **Priority ordering** — Multiple commits/credits exist, and the one the founder expects to draw down has lower priority than another that is being consumed first.

### Diagnostic steps

1. **Pull ledger**: `POST /v1/credits/listBalances` with `include_ledgers: true` — shows every transaction (grants, deductions, expirations, rollovers).
2. **Check access schedule**: In the commit/credit details, verify `access_schedule.schedule_items` — which segment is current? What are the date boundaries?
3. **Check product scope**: Look at `applicable_product_ids` and `applicable_tags` on the credit/commit. Compare against the products generating current charges.
4. **Check draft invoices**: `POST /v1/invoices/list` with `status: "DRAFT"` — see if any draft invoices are claiming this balance.
5. **Check priority**: If multiple commits exist, check `priority` values. Lower number = consumed first.

### Resolution

- **Access schedule timing**: Explain to the founder when the next tranche becomes available. No action needed unless the schedule is wrong (use contract edit to fix).
- **Expired segment**: The balance is gone — expired segments cannot be recovered. For future: configure rollover on the commit.
- **Product scope**: Either broaden the credit scope (edit the credit) or accept that it's working as designed.
- **Draft reservation**: This is normal behavior. Once the invoice finalizes, the ledger entry becomes permanent. The balance will reflect the deduction.
- **Priority**: If the wrong commit is being consumed first, edit priority values via contract edit.

---

## Anomaly 4: Events not billing

### Symptoms

The founder says: "I'm sending events but they don't show up on the invoice", "Usage data is there but no charges", "Events are ingested but the invoice line is $0."

### Common causes (ordered by likelihood)

1. **Event type doesn't match any billable metric** — Events are silently ignored. The `event_type` string doesn't match any metric's `event_type_filter.in_values`.
2. **Property filters excluding events** — The billable metric has `property_filters` that the events don't satisfy (e.g., metric filters for `region: "us-east-1"` but events have `region: "us-west-2"`).
3. **Events after grace period** — The billing period closed, the grace period expired, and events arriving now with old timestamps are not counted toward the closed period.
4. **Contract date mismatch** — The contract hasn't started yet (events before `starting_at` don't bill) or has already ended.
5. **Usage filter routing to wrong contract** — Customer has multiple contracts and a usage filter is routing events to a contract that doesn't have the relevant product.
6. **Product not entitled on contract** — The product exists on the rate card but the contract doesn't include it (entitled = false or product not on the rate card referenced by the contract).

### Diagnostic steps

1. **Verify event_type match**: Compare exact `event_type` string in events against `event_type_filter.in_values` on all billable metrics. Case-sensitive. Common issue: plural vs. singular (`api_call` vs `api_calls`).
2. **Check property_filters on metric**: If the metric has property filters, verify events have matching property values.
3. **Check timing**: Compare event timestamps against the billing period and grace period window. If the billing period ended and grace period expired before events arrived, they're lost.
4. **Check contract**: `GET /v2/contracts/{id}` — verify `starting_at` is before event timestamps and contract hasn't ended.
5. **Check usage filter**: `GET /v1/contracts/getUsageFilter` — if set, verify the filter logic routes these events to the expected contract.
6. **Check entitlement**: `POST /v1/contracts/getContractRateSchedule` — verify the product is entitled (has a rate) on the customer's contract.

### Resolution

- **Type mismatch**: Fix event source or create new metric with correct filter (existing metrics can't change `event_type_filter`).
- **Property filters**: Fix event source to include the required properties, or archive metric and create a new one with corrected filters.
- **Grace period**: Events are permanently lost for that period. Fix pipeline latency. Adjust grace period for future periods if possible.
- **Contract timing**: Edit contract start date to cover the period, or accept that pre-contract usage isn't billable.
- **Usage filter**: Update the usage filter to correctly route events, or remove it if the customer should only have one contract.
- **Not entitled**: Add the product to the rate card or ensure the contract references a rate card that includes it.
