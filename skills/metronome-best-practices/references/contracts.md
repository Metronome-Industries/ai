# Contracts, rate cards, and products

## Table of contents

- Contracts vs Plans
- Rate cards
- Product types
- Contract structure
- Overrides and dimensional pricing
- Contract Edits
- Scheduling
- Traps to avoid

## Contracts vs Plans

Always use [Contracts](https://docs.metronome.com/overview/contracts/) for new customers. Plans are the legacy billing model — they lack rate card overrides, commit support, and flexible scheduling. Contracts are the actively invested path and required for features like v2 subscriptions, edits, and account hierarchies.

If maintaining existing Plans integrations, they continue to work. But do not create new Plans-based customers.

## Rate cards

[Rate cards](https://docs.metronome.com/overview/pricing/) are reusable pricing templates that define the default rates for products. Create a rate card once and reference it across multiple customer contracts.

Supported rate types:

| Type              | Behavior                                           | Example                              |
| ----------------- | -------------------------------------------------- | ------------------------------------ |
| Flat              | Fixed price per unit                               | $0.01 per API call                   |
| Tiered            | Volume-based pricing with breakpoints              | $10/unit for 1-1000, $5/unit after   |
| Percentage        | Percentage of another product's charges            | 2% platform fee on usage charges     |
| Tiered percentage | Tiered percentage of another product's charges     | 1% on first $10K, 0.5% after        |
| Subscription      | Fixed recurring amount                             | $99/month base fee                   |
| Custom            | Custom pricing logic (restricted to specific use)  | Client-specific rating functions     |

Rate cards are the single source of truth for default pricing. When you update a rate on a rate card, all contracts referencing that rate card (without overrides) automatically inherit the change.

## Product types

Products define what appears as a line item on invoices:

- **Usage products** — Tied to a billable metric. Charge based on metered consumption. Most common type.
- **Subscription products** — Fixed recurring charges not tied to usage (e.g., base platform fee).
- **Composite products** — Percentage-based charges applied to other products on the invoice (e.g., support surcharge).
- **Fixed products** — One-time charges, commits, credits, and scheduled charges.

Choose the product type that matches the billing model. Use composite products to derive charges from other line items without additional metering.

## Contract structure

A [contract](https://docs.metronome.com/overview/contracts/) binds a customer to:

- **Rate card** — The pricing template (required)
- **Commits** — Prepaid or postpaid financial commitments
- **Credits** — Monetary balance the customer can draw against
- **Overrides** — Custom pricing deviations from the rate card
- **Scheduled charges** — One-time or recurring fixed charges at specific dates
- **Billing cadence** — Monthly, quarterly, or annual billing cycles
- **Start and end dates** — Contract validity period

Contracts are implemented using event sourcing — every change is recorded as an immutable event, providing a complete audit trail. You can reconstruct contract state at any historical point in time.

## Overrides and dimensional pricing

Override rate card prices at the contract level for customer-specific pricing without modifying the underlying rate card:

- **Overwrites** replace the rate entirely (e.g., custom flat rate for an enterprise customer)
- **Multipliers** apply percentage adjustments (e.g., 0.8 multiplier = 20% discount)
- **Custom tiered overrides** replace tier breakpoints for a specific customer

Multiplier priority: explicit priority value > greatest discount > most recently added.

[Dimensional pricing](https://docs.metronome.com/overview/pricing/) breaks down charges by attributes like region, service tier, or model. Each dimension appears as a separate line item on the invoice. Define dimensions on the product and set per-dimension rates on the rate card.

## Contract Edits

Use the Edits API (`POST /v2/contracts/edit`) to modify active contracts. Edits replace the deprecated Amendments system (`POST /v1/contracts/amend`) and support:

- Adding or removing products
- Changing pricing overrides
- Modifying commits and credits
- Adjusting schedules and billing cadence

Edits are applied as new events in the contract's event-sourced log, preserving the full modification history.

**Do not use Amendments.** They are deprecated and incompatible with newer features like v2 subscriptions.

## Scheduling

Contracts support time-based scheduling for rate changes and charges:

- **Scheduled rate changes** — Price increases or decreases that take effect at a future date (e.g., promotional rate for first 6 months, then standard rate).
- **Scheduled charges** — One-time charges triggered on a specific date (e.g., setup fee on contract start, annual renewal fee).
- **Billing frequency** — Monthly, quarterly, or annual invoice generation.

## Traps to avoid

- Do not use Plans for new customers. Always use Contracts.
- Do not use Amendments to modify contracts. Always use Edits.
- Do not hardcode pricing directly in contracts. Define pricing in rate cards and use overrides for customer-specific deviations.
- Do not create a new contract when an Edit to the existing contract would suffice. Unnecessary contracts add complexity.
- Do not forget to set an end date on contracts unless you intentionally want an evergreen agreement.
- Do not create overlapping contracts for the same customer and billing period without understanding how charges aggregate.
