# Implementation steps

## Table of contents

- Order of operations
- Step 1: Configure product catalog
- Step 2: Connect Metronome to Stripe
- Step 3: Set up event ingestion
- Step 4: Create customers
- Step 5: Set billable status
- Step 6: Create contracts
- Step 7: Migrate credit grants
- Step 8: Configure alerts
- Step 9: Update dashboards and reporting

## Order of operations

Create objects in this sequence — each depends on the previous:

```
Billable Metrics → Products → Rate Cards → Customers → Contracts
```

## Step 1: Configure product catalog

### 1a. Create billable metrics

Create billable metrics matching your Stripe Meter configurations:

1. Name your metric
2. Set the event type filter (must exactly match your application's `event_type`)
3. Define properties (all properties you may aggregate or group by)
4. Choose aggregation type (SUM, COUNT, MAX, or LATEST)
5. Define group keys (all properties you might price by or display on invoices)

After creation, verify the example event payload shown in the UI matches your expected format.

API: [Create Billable Metric](https://docs.metronome.com/api-reference/billable-metrics/create-a-billable-metric)

### 1b. Create products

Create one Product per billable SKU/item:

1. Name (appears on invoice)
2. Product Type: Usage, Subscription, Composite, or Fixed
3. For Usage products, select the billable metric from Step 1a
4. Assign group keys (pricing and/or presentation)
5. (Optional) Quantity or rounding conversions

API: [Create Product](https://docs.metronome.com/api-reference/products/create-a-product)

### 1c. Create rate cards

Create a rate card with rates for each product:

1. Name your rate card
2. Add products and set their rates
3. If using dimensional pricing, define dimension values and per-value rates
4. (Optional) Tiered pricing, custom pricing units, or commit-specific rates

API: [Create Rate Card](https://docs.metronome.com/api-reference/rate-cards/create-a-rate-card)

## Step 2: Connect Metronome to Stripe

1. Connect your Stripe account in Metronome UI (General Settings → Integrations)
2. Configure entity mappings if you have multiple Stripe entities
3. Set collection method preferences (per-customer or account-level)

Reference: [Invoice with Stripe](https://docs.metronome.com/integrations/invoice-integrations/stripe)

## Step 3: Set up event ingestion

Redirect your usage event pipeline to send events to **both** Stripe and Metronome during the parallel run.

### Key format changes required

| Attribute | Stripe format | Metronome format |
| --- | --- | --- |
| Deduplication | Auto-generated | Required `transaction_id` (unique per event) |
| Customer ID | `stripe_customer_id` | Metronome UUID or ingest alias |
| Timestamp | Unix integer | RFC 3339 string (e.g., `2024-01-15T10:00:00Z`) |
| Numeric values | String (`"1"`) | Number (`1`) |
| Event type field | `event_name` | `event_type` |

### Ingest aliases

Use Metronome's ingest aliases to send events using your internal customer ID instead of Metronome's UUID. Set aliases when creating customers to simplify event pipeline changes.

- [Ingest API](https://docs.metronome.com/api-reference/usage/ingest-events)
- [Design Usage Events](https://docs.metronome.com/guides/events/design-usage-events)

## Step 4: Create customers

For each Stripe Customer being migrated:

1. Create a customer in Metronome
2. (Recommended) Set **ingest aliases** — your internal customer ID for event routing
3. Set the `stripe_customer_id` on the Metronome customer (links invoicing)
4. Set billing provider configuration to Stripe

API: [Set Billing Provider Configurations](https://docs.metronome.com/api-reference/customers/set-billing-provider-configurations-for-a-customer)

## Step 5: Set billable status

Set migrating customers as **unbillable** before creating contracts to prevent double-billing:

- When **unbillable**: Metronome generates invoices but does NOT send them to Stripe
- When **billable**: Metronome sends finalized invoices to Stripe for payment collection

Key rules:
- Scoped to the customer level; applies only to contract invoices
- The `effective_at` date can be past or future (cannot predate last finalized invoice)
- Toggling billable status may trigger invoice finalization for accumulated usage up to the effective date

## Step 6: Create contracts

Create a contract for each customer:

1. Select your rate card
2. Set contract start date and end date
3. Configure billing provider (Stripe) with configuration from Step 4
4. (Optional) Include customer-specific terms:
   - Prepaid commits or credits (migrated from Stripe Credit Grants)
   - Overrides (customer-specific pricing different from rate card)
   - Discounts

For PLG/self-serve flows: Use Metronome **Packages** to encode standard rate card and contract details into a reusable template.

## Step 7: Migrate credit grants

Map active Stripe Credit Grants to Metronome commits or credits on contracts:

| Stripe Credit Grant property | Metronome equivalent |
| --- | --- |
| Remaining balance (from `credit_balance_summary`) | `access_schedule` amount |
| `applicability_config` (scope to prices) | Product-specific commit/credit |
| `priority` | Priority ordering on contract |
| `effective_at` | `access_schedule` start date |
| `expires_at` | `access_schedule` end date |
| `category: "paid"` | **Prepaid Commit** (has invoice schedule) |
| `category: "promotional"` | **Credit** (no invoice schedule) |

**Critical**: Use the **remaining balance** from `GET /v1/billing/credit_balance_summary`, not the original `amount` on the credit grant object.

## Step 8: Configure alerts

1. Set up Metronome alerts (spend thresholds, balance alerts)
2. Configure Metronome webhook endpoints
3. Ensure your system differentiates between Stripe-originated and Metronome-originated webhooks during parallel run
4. Set up webhooks for payment statuses if using payment-gated commits

## Step 9: Update dashboards and reporting

| Approach | Action |
| --- | --- |
| Embeddable dashboards | Integrate iframe using `/dashboards/getEmbeddableUrl` |
| Custom dashboards | Swap Stripe Meter Usage Analytics API calls for Metronome usage/invoice APIs (behind a feature flag) |
| Data export | Enable Metronome data export and integrate into reporting pipeline |

Reference: [Metronome Data Export](https://docs.metronome.com/guides/reporting-insights/data-export/overview)
