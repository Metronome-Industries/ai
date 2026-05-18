# Credits and commits

## Table of contents

- Commits overview
- Prepaid commits
- Postpaid commits
- Credits
- Access schedules
- Ledger and balance
- Thresholds and auto-recharge
- Traps to avoid

## Commits overview

Commits are financial commitments attached to [contracts](https://docs.metronome.com/overview/contracts/). They represent an agreement between you and the customer about minimum spend or prepaid balance. Two types:

| Type     | Cash flow        | Invoice timing | Overage behavior                      |
| -------- | ---------------- | -------------- | ------------------------------------- |
| Prepaid  | Customer pays up front | At purchase    | Usage beyond balance billed at standard rates |
| Postpaid | Customer pays at end   | At period end  | True-up invoice for shortfall         |

## Prepaid commits

The customer pays upfront for a committed amount. Metronome generates a scheduled invoice for the purchase immediately. As usage accrues, the prepaid balance is drawn down automatically against eligible usage invoices.

When the balance is exhausted, additional usage is billed at standard overage rates from the rate card. Prepaid commits can include [access schedules](#access-schedules) to control when the balance becomes available.

Prepaid commits can also be **payment-gated** — the commit only activates after successful payment of the purchase invoice. This is important for payment flows that require authorization (e.g., India e-mandate for RBI compliance).

## Postpaid commits

The customer agrees to a minimum spend over a period (quarter, year). No upfront payment is required. At the end of the commitment period:

- If actual usage >= committed amount: no additional charge.
- If actual usage < committed amount: Metronome generates a **true-up invoice** for the difference.

Postpaid commits can be configured to disable true-up invoices if the shortfall should be waived.

## Credits

Credits are monetary or unit balances that customers can apply to usage invoices. They are subtracted from invoice charges before calculating the final payable amount.

- **Manual grants**: Issue credits for promotions, refunds, or customer goodwill.
- **Product-scoped**: Credits can be restricted to specific products via `applicable_product_ids` or `applicable_tags`.
- **Global credits**: When no product filter is set, credits apply to all eligible charges.
- **Auto-recharge**: Credits can be configured to automatically replenish when the balance drops below a threshold (see [Thresholds](#thresholds-and-auto-recharge)).

## Access schedules

Access schedules control **when** commit or credit balance becomes available for drawdown. They divide a large balance into time-segmented amounts.

Example: A $500K annual prepaid commit with quarterly access schedule:

| Quarter | Available balance |
| ------- | ----------------- |
| Q1      | $125,000          |
| Q2      | $125,000          |
| Q3      | $125,000          |
| Q4      | $125,000          |

This prevents the customer from exhausting their entire annual balance in Q1. Each segment's balance expires at the end of its window unless rollover is configured.

The **access schedule** (when balance is drawable) is separate from the **invoice schedule** (when the customer is billed for the commit).

## Ledger and balance

Metronome maintains a ledger of all credit and commit transactions. The balance is **computed from the underlying events** rather than stored as a running total. Ledger entry types:

- **Segment starting balance** — From access schedule segments
- **Deductions** — From finalized and draft invoice applications
- **Manual adjustments** — Explicit credit/debit entries
- **Rollovers** — Balance transferred to a renewal commit
- **Expirations** — Unused balance from completed access schedule segments

Query the ledger to display customer-facing balance dashboards or to reconcile credit usage over time.

## Thresholds and auto-recharge

Two threshold types trigger automated actions:

**Spend threshold**: Fires when an invoice total reaches or exceeds a configured amount. Triggers a new commit issuance (recharge). Spend thresholds **cannot** have product filters — this restriction prevents an infinite loop where the recharge itself triggers the threshold again.

**Credit balance threshold**: Fires when available balance drops to or below a configured amount. Triggers a recharge commit with product filters supported (`applicable_product_ids`, `applicable_tags`).

Configure threshold notifications via the [Notifications API](https://docs.metronome.com/api-reference/notifications/) to alert your systems or customers when thresholds are crossed.

**Multi-contract edge case**: Threshold alerts may evaluate aggregate balance across all of a customer's contracts, while recharge logic checks per-contract balance. For customers with multiple contracts, this can cause thresholds to behave unexpectedly. If using threshold billing on multi-contract customers, test the behavior thoroughly or limit to one contract per customer.

## Traps to avoid

- Do not confuse prepaid (customer pays upfront, draws down) with postpaid (customer pays at end if shortfall). They have opposite cash flow patterns.
- Do not set access schedule segments that extend past the contract end date. Balance released after the contract ends cannot be consumed.
- Do not rely on balance queries during active billing periods for exact values. Usage processing may lag slightly behind real-time.
- Do not configure spend-threshold auto-recharge with product filters. This will cause an infinite recharge loop.
- Do not use threshold billing on multi-contract customers without understanding the aggregate-vs-per-contract gap.
- Do not manually adjust ledger entries outside the API. Use the Commits and Credits API for all balance modifications to maintain auditability.
