# Product catalog design

## Table of contents

- Billable metrics design
- Group keys
- Products
- Rate cards
- Custom pricing units

## Billable metrics design

Two types of billable metrics:

- **Streaming Metric** — Covers most use cases. Optimized for performance with real-time aggregation as events arrive.
- **SQL Metric** — For complex calculations like daily averages, unique counts per period, or weighted formulas.

### Immutability warning

Group keys, aggregation type, and event type filter **cannot be modified after creation**. Plan these carefully:

- Include more group keys than you think you need — you can ignore unused group keys, but cannot add them later.
- Contact Metronome if a group key's cardinality approaches 1,000.
- Avoid high-cardinality properties (like `request_id` or unbounded IDs) as group keys.

### Design principles

- **If you use Stripe meter segments**: Evaluate whether Metronome's dimensional pricing (compound group keys) allows you to consolidate multiple Stripe Meters into fewer Metronome billable metrics.
- **If you don't use segments**: Your Metronome billable metrics are likely a 1:1 mapping from existing Stripe Meters with the same aggregation type.
- **Include all future-useful properties as group keys**: Properties you send in events but don't include as group keys cannot be used for pricing or invoice presentation later.

### Creation steps

1. **Name** your metric (e.g., "Input Tokens")
2. Set the **event type filter** — must exactly match the `event_type` your application sends
3. Define **properties** — include all properties you may want to aggregate on or group by
4. Choose **aggregation type** (SUM, COUNT, MAX, or LATEST for streaming; additionally UNIQUE for SQL)
5. Define **group keys** — include all properties you might want to price by or display on invoices

After creation, Metronome shows an **example event payload** in the UI — use this to validate your event instrumentation.

API Reference: [Create Billable Metric](https://docs.metronome.com/api-reference/billable-metrics/create-a-billable-metric)

## Group keys

Group keys determine what you can price by and display on invoices. Think of them like a `GROUP BY` clause in SQL — they break aggregated usage into buckets.

Group keys enable two downstream uses (configured on the Product):

| Downstream use | What it does | Example |
| --- | --- | --- |
| **Pricing group key** | Different prices per dimension value | `model_name` → charge $1.50 for model-A, $0.30 for model-B |
| **Presentation group key** | Invoice line-item breakdowns (same price) | `user_id` → show per-user usage on invoice |

### Common group key examples

- `model_name` — per-model pricing (pricing group key)
- `region` — per-region pricing (pricing group key)
- `instance_type` — per-GPU/instance pricing (pricing group key)
- `user_id` — per-user invoice breakdowns, or seat-based billing using Unique aggregation (presentation group key)
- `project_id` — per-project invoice breakdowns (presentation group key)

### Migration tip

Review your Stripe meter segment dimensions — these are your candidates for Metronome group keys. Also consider additional properties in your event payload that you don't currently use for segmentation but might want for future pricing flexibility or invoice presentation.

Stripe UBBv1 supports up to 2 segment dimensions per meter. Metronome supports compound group keys with flexible cardinality, which can simplify configurations where you previously needed multiple meters.

## Products

Metronome Products represent individual service offerings:

| Type | Use case | Stripe equivalent |
| --- | --- | --- |
| **Usage** | Variable pricing based on consumption (requires a billable metric) | Usage-based Price |
| **Subscription** | Recurring fee on a schedule (platform fees, seat licenses) | Recurring Price |
| **Composite** | Percentage charge on a group of other products | — (no direct equivalent) |
| **Fixed** | One-time or scheduled charges (used for commits and credits) | — (no direct equivalent) |

### Product configuration

- Assign **pricing group keys** (different prices per dimension) or **presentation group keys** (invoice breakdowns) — these must be a subset of the group keys defined on the billable metric
- **Quantity conversion** — send individual tokens but display and price per million tokens on the invoice
- **Rounding conversion** — send seconds but round to the nearest minute on the invoice

### Creation steps

1. Enter a **Name** (appears on the invoice)
2. Select **Product Type**: Usage, Subscription, Composite, or Fixed
3. For Usage products, select the billable metric
4. Assign group keys (pricing and/or presentation)
5. (Optional) Add quantity conversions or rounding conversions

API Reference: [Create Product](https://docs.metronome.com/api-reference/products/create-a-product)

## Rate cards

A Rate Card is a centralized pricing template containing rates for all your Products. Rate cards use a single fiat currency.

### Standard recommendation

Design a single rate card as your source of truth for standard pricing. When you update rates, changes propagate to all contracts that reference the rate card. Manage custom pricing for specific customers through **overrides** on individual contracts.

### Rate card features

- **Dimensional pricing** — If using pricing group keys, define rates per dimension value (e.g., `model-A` at $1.50, `model-B` at $0.30)
- **Tiered pricing** — Set volume-based tiers on any product (e.g., first 1M tokens at $1.00, next 1M at $0.80)
- **Commit rates** — Set rates that apply specifically when usage draws down from a commit
- **Rate changes** — Edit rates with a start date; changes propagate to referencing contracts

### Creation steps

1. **Name** your rate card (e.g., "Standard Rate Card")
2. **Add products** and set their rates
3. If using dimensional pricing, define values for each dimension and set a rate per value
4. (Optional) Configure tiered pricing, custom pricing units, or commit-specific rates

API Reference: [Create Rate Card](https://docs.metronome.com/api-reference/rate-cards/create-a-rate-card)

## Custom pricing units

If you bill in credits or a custom unit rather than fiat currency:

1. Create a Custom Pricing Unit under Offering → Pricing Units in the Metronome UI
2. Configure the conversion rate on the rate card (e.g., 1 credit = $0.01)
3. Events are rated in custom units; invoices show both custom unit consumption and fiat equivalent

Reference: [Custom Pricing Units](https://docs.metronome.com/guides/pricing-packaging/make-pricing-changes/use-currency-custompricingunits)
