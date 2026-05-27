# Integration patterns

## Table of contents

- Pattern 1: Metronome independently
- Pattern 2: Metronome with Stripe Subscriptions
- Invoicing lifecycle
- Customer dashboards
- Alerting

## Pattern 1: Metronome independently

Metronome handles all billing and metering, pushes finalized invoices to Stripe for payment collection.

**Choose this pattern if:**
- All your billing is usage-based
- You want Metronome's full contract and commit functionality
- You don't need Stripe Checkout or Payment Links for signup

**Flow:**
```
Usage Events → Metronome (metering + rating) → Invoice → Stripe (payment collection)
```

## Pattern 2: Metronome with Stripe Subscriptions

Stripe Subscriptions handles recurring and flat-rate billing; Metronome handles usage-based metering and invoicing separately. Both create invoices on the same Stripe Customer.

**Choose this pattern if:**
- You have flat-rate or seat-based recurring charges on Stripe Subscriptions
- You want to keep Checkout, Customer Portal, and Payment Links for non-usage billing
- You only need Metronome for the usage-based component

**Flow:**
```
Recurring charges → Stripe Subscriptions → Stripe Invoice (recurring)
Usage events → Metronome → Metronome Invoice → Stripe Invoice (usage)
```

Both invoice types appear on the same Stripe Customer but are managed independently.

Reference: [How Metronome works with Stripe](https://docs.stripe.com/billing/how-metronome-works-with-stripe)

## Invoicing lifecycle

When Metronome pushes invoices to Stripe:

1. **Draft** — Accumulates usage throughout the billing period (viewable in Metronome)
2. **Grace period** — 24-hour window (default) at end of billing period before finalization, allowing late-arriving usage data and corrections
3. **Finalized** — Locked after grace period; no further changes
4. **Sent to billing provider** — Metronome pushes finalized invoices to Stripe (creates `InvoiceItem` objects and an `Invoice` on the Stripe Customer)
5. **Paid or failed** — Stripe handles collection (Smart Retries, Radar, retry settings work automatically)

### Key considerations

- Stripe Tax, Anrok, or Avalara can be applied at Stripe invoice finalization
- Collection method (`charge_automatically` or `send_invoice`) is configurable per customer
- Manage payment status in the Stripe Dashboard, not in Metronome
- Set up webhooks for payment statuses if using payment-gated commits

## Customer dashboards

Options for customer-facing usage visibility:

| Approach | Description | Migration effort |
| --- | --- | --- |
| **Metronome embeddable dashboards** | Iframe-based usage, invoice, and commits/credits dashboards | Low — generate embed URL via API |
| **Custom dashboards (Metronome APIs)** | Swap Stripe Meter Usage Analytics API calls for Metronome usage and invoice APIs | Medium — API integration changes |
| **Stripe Data Pipeline / Sigma** | Stripe invoice and payment data remain queryable; Metronome-specific data requires Metronome data export | Low for Stripe data; additional pipeline for Metronome |

- Embeddable dashboard docs: [Embed a dashboard](https://docs.metronome.com/guides/customers-billing/optimize-customer-experience/customer-dashboards-and-reporting#embed-a-dashboard)
- Data export docs: [Metronome Data Export](https://docs.metronome.com/guides/reporting-insights/data-export/overview)

## Alerting

Metronome supports alerts for:

- **Spend alerts** — usage spend thresholds
- **Credit/Commit balance alerts** — low balance notifications
- **Invoice alerts** — finalization, payment status
- **Custom webhook events** — configurable for workflows

If you rely on Stripe webhook events (`invoice.finalized`, `invoice.paid`, `invoice.payment_failed`), both systems fire webhooks during the parallel run:

- Stripe fires webhooks for Stripe-managed invoices
- Metronome fires its own webhook events for Metronome invoices
- After cutover, Stripe continues to fire webhooks for invoices pushed from Metronome (since they become Stripe invoices)

Reference: [Metronome Webhooks](https://docs.metronome.com/guides/platform-configuration/setup-webhooks)
