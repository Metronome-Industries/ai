# Stripe integration

## Table of contents

- Integration overview
- Arrears invoicing flow
- Tax configuration
- Line item mapping
- Rounding and discrepancies
- Webhook and error handling
- NetSuite considerations
- Traps to avoid

## Integration overview

Metronome creates [Stripe invoices](https://docs.metronome.com/integrations/stripe/) in arrears after each billing period. The integration requires:

1. A Stripe customer must exist for each Metronome customer.
2. Metronome customer IDs must be mapped to Stripe customer IDs via billing provider configuration.
3. The billing provider credential must be set on the customer or contract before the first invoice syncs.

Metronome manages the full lifecycle of synced Stripe invoices — from line item creation through finalization and payment tracking.

## Arrears invoicing flow

When a billing period ends and the grace period expires:

```
Metronome invoice finalized
  → Pending line items created in Stripe
  → Draft Stripe invoice created (auto-includes pending items)
  → Monetary totals validated (Metronome total ≈ Stripe total)
  → Stripe invoice finalized
  → Stripe handles payment collection
  → Payment status synced back to Metronome via webhooks
```

Key design details:

- **Line items before invoice**: Metronome creates line items first, then the Stripe invoice. This ordering ensures tax providers (which listen for `invoice.created`) see all line items when calculating tax.
- **Partitioned by Stripe customer**: Only one Metronome invoice is processed per Stripe customer at a time. This prevents mixing line items from different Metronome invoices.
- **Asynchronous**: Invoice sync is not instantaneous. Expect a delay between billing period end and Stripe invoice creation due to grace period processing and queue-based delivery.

## Tax configuration

Configure your tax provider (Stripe Tax, Avalara, or Anrok) on the Stripe side. Metronome passes untaxed line items — tax is calculated during Stripe invoice finalization.

- **With Stripe Tax or Anrok v2**: The Stripe invoice can be finalized immediately. Tax is calculated inline.
- **With Avalara or Anrok v1**: The Stripe invoice stays in draft until tax metadata is received (typically up to 1 hour). A safety cron finalizes stale drafts if the tax provider is slow.
- **Do not** enable "send tax to NetSuite" while also using NetSuite's Tax commit mode. This causes double taxation.

## Line item mapping

Each Metronome product becomes one or more Stripe invoice line items:

- Usage products with dimensional pricing generate one line item per dimension value (e.g., one per region).
- Subscription, composite, and fixed products generate one line item each.
- Metronome sets service period timestamps on each line item, incrementing by one second per item to preserve ordering.

**250-item limit**: Stripe enforces a default maximum of 250 line items per invoice. If a Metronome invoice exceeds this limit, all line items are **collapsed into a single line item** showing the company name and total amount — losing per-product detail on the Stripe invoice. Mitigate by:

- Reducing product granularity (fewer dimensional values)
- Using composite products to aggregate related charges
- Splitting customers across multiple Stripe invoices if needed

Metronome includes metadata on each Stripe invoice and line item: Metronome invoice ID, customer ID, and environment.

## Rounding and discrepancies

Minor sub-cent rounding differences between Metronome and Stripe totals are expected. Stripe stores amounts with up to 12 decimal places; Metronome uses higher precision internally. The validation step accepts small discrepancies within a margin of error.

The **Stripe invoice is the source of truth** for payment amounts. If you need to reconcile, use the Stripe invoice total as the authoritative figure.

**Caution**: Changes to rounding logic have historically caused production incidents. Do not modify validation or rounding behavior without thorough testing.

## Webhook and error handling

Monitor Stripe webhook events for invoice sync status:

- `invoice.created` — Stripe invoice created from Metronome data
- `invoice.finalized` — Invoice finalized and ready for collection
- `invoice.paid` — Payment received
- `invoice.payment_failed` — Payment attempt failed

Common sync failures:

| Failure                   | Cause                                              | Resolution                                  |
| ------------------------- | -------------------------------------------------- | ------------------------------------------- |
| Missing payment method    | Stripe customer has no default payment method       | Add payment method before next billing cycle |
| Invalid customer          | Metronome→Stripe customer mapping is broken         | Verify billing provider configuration       |
| Line item collapse        | >250 line items generated                           | Reduce product granularity or aggregate     |
| Tax provider timeout      | Avalara/Anrok did not respond within window          | Invoice auto-finalizes after safety timeout |

Metronome tracks sync status in a Billing Provider Invoice (BPI) record. Failed invoices can be retried. Unrecoverable errors are sent to a dead letter queue.

## NetSuite considerations

Metronome supports NetSuite integration in two modes:

- **Revenue recognition**: NetSuite handles accounting and rev rec. Stripe handles billing and collection. Invoices pushed to NetSuite for ASC 606 compliance.
- **Billing**: NetSuite generates and collects invoices directly. Metronome provides the invoice data; NetSuite manages the customer-facing invoice.

Requirements for NetSuite integration:

- Every Metronome product must have a NetSuite item mapping (via Managed Fields). Missing mappings cause silent sync failures.
- The Metronome customer must be mapped to a NetSuite customer ID before invoices can sync.
- Only one NetSuite connection per Metronome environment is supported.
- Do not use NetSuite as both billing provider and revenue system on the same contract.

## Traps to avoid

- Do not manually edit Stripe invoices that Metronome manages. Changes will be overwritten or cause validation mismatches on the next sync.
- Do not finalize Stripe invoices programmatically before tax calculation completes. Wait for the tax provider webhook or use inline-tax providers (Stripe Tax, Anrok v2).
- Do not process multiple Metronome invoices for the same Stripe customer concurrently. This causes race conditions on pending line items and can exceed the 250-item limit.
- Do not exceed 250 line items per Stripe invoice. Plan product granularity during integration design.
- Do not forget to map Metronome customers to Stripe customers before the first billing period ends. Unmapped customers will have failed invoice syncs.
- Do not assume Stripe invoice creation is synchronous with billing period end. Grace period processing, queue delivery, and tax calculation all introduce delays.
- Do not skip low-value invoices without explicitly configuring the skip setting (`skip_zero_dollar_invoices`). When enabled, invoices with a total less than $0.50 are skipped — not just $0.00 invoices. Some integrations require these invoices for compliance or audit purposes.
