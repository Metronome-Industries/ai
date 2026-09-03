---
name: metronome-group-keys
description: >-
  Designs group_keys for a billable metric across pricing, invoice presentation,
  spend breakdowns, seat-based credits, and usage alerts — and flags cardinality risk
  (a combined key's cost is the product of every dimension's cardinality, not the sum)
  before it gets baked into an immutable metric. Use when a billable metric needs more
  than one flat pricing dimension, when deciding pricing_group_key vs.
  presentation_group_key, or when an existing setup has slow invoices or unexpectedly
  costly spend breakdowns.
argument-hint: <event_schema_description>
---

# metronome-group-keys

Designs the `group_keys` array on a billable metric, and the matching
`pricing_group_key` / `presentation_group_key` on its product. Extends
`metronome-setup-catalog`'s Step 1 — read this before calling
`POST /v1/billable-metrics/create` whenever more than one dimension is involved.

**Every property referenced in `group_keys`, and your `aggregation_key`, needs a
matching `property_filters` entry with `exists: true`.** These are two independent
checks — omitting either produces a specific, named error (`"Group key '<key>' does
not match one of the property filter names."` for a `group_keys` mismatch,
`"The specified aggregation key must be one of the property filter names."` for the
`aggregation_key`), and you can get several of these back together in one response.
`property_filters` is optional on the API, but in practice you'll always need one
entry per dimension you group by — this is the single most common mistake when adding
group keys to an existing metric.

---

## Cardinality risk, up front

A group key's scan cost is the **product** of every dimension's cardinality inside
it, not the sum. Four dimensions with 5,000 / 8 / 100,000 / 5 possible values combined
on one key is 5,000 × 8 × 100,000 × 5 = 20,000,000,000 combinations — even if pricing
only needs two of them. This is the single most common way a Metronome setup goes
wrong, and `group_keys` is immutable after the metric is created, so it has to be
gotten right before the first API call, not fixed afterward.

**The rule that decides everything below: any dimensions that need to appear together
in the same request — for pricing, invoice presentation, or a spend or usage query —
must be members of one combined `group_keys` entry, declared now.** There is no way
to combine two separately-declared keys later, and there is no exception based on
whether the request computes a dollar figure or just a count — combination is about
which dimensions co-occur in one request, not about what the request is for. (Usage
alerts are the one exception to "co-occurrence forces combination": alert evaluation
always queries a single dimension alone, so an alert dimension should stay standalone
— see Step 3.)

**Ideal default: keep the pricing key to only the dimensions that actually set the
price, and give every other dimension its own standalone key** — unless that
dimension will always be queried together with pricing (invoice presentation always
is; a spend or usage query only is if you'll ask for both together in the same call).
Standalone keys are the cheap, safe default; only combine when co-occurrence actually
forces it.

---

## Step 1 — Identify dimensions

Ask: **what fields do you send on each usage event?**

For each one, get a rough sense of scale: a fixed, known set of values (a region, a
plan tier, a model name), or something that grows as usage grows (a user ID, a
session ID, any per-entity identifier). This is the fork that determines cardinality
risk — an exact count isn't necessary yet, but knowing which category each dimension
falls into is.

---

## Step 2 — Identify the pricing dimensions

Ask: **which dimensions affect the price?**

These become `pricing_group_key` on the product. One pricing dimension is a
standalone key; multiple pricing dimensions form a compound key, one combination per
unique value pair.

---

## Step 3 — Identify what else each dimension is used for, and whether it co-occurs with pricing

For every dimension that isn't already a pricing dimension, ask: **what else is it
used for, and does that use ever need pricing dimensions in the same request?**

| Feature | Question to ask | Co-occurs with pricing dims? | Key needed |
|---|---|---|---|
| Invoice line item breakdown | Separate line items per dimension on the invoice? | Always — invoice generation rates the pricing dims and presents by this dim in the same computation | `presentation_group_key`: pricing dims + the extra dim, combined |
| Spend or usage breakdown by this dim | Need a dollar or quantity breakdown by this dim, on demand? | Only if you'll query it together with a pricing dim in the same call | Combined key if yes; a standalone key on the dim alone is fine and cheaper if it's ever queried by itself |
| Seat-based credits | Do seats draw from their own credit balance? | Usually queried alone via API/dashboard; combined only if you want per-seat invoice line items rolled up together | Standalone seat key by default; combine with pricing dims and set `presentation_group_key` to include the seat dim to get that invoice rollup |
| Usage alerts | Alerts scoped to a specific dimension? | No — alert evaluation queries one dimension in isolation | Standalone key on that dimension — **only on a fixed, known set of values**, never a dimension that grows with usage |

**There's no dollar-vs-quantity distinction here.** A priced spend breakdown and a raw
usage-quantity breakdown follow the identical rule — what matters is whether that
specific query ever needs pricing dimensions alongside the breakdown dimension in the
same request, not whether the result is denominated in dollars.

**Each dimension gets its own group key; if two features need the same dimension and
always co-occur with the same other dimensions, one key covers both** — don't build a
second, redundant key for a dimension already covered by an identical one. But if the
same dimension is queried standalone in one context and combined with pricing in
another (e.g. a raw count dashboard vs. an invoice-nested rollup), it genuinely needs
two different keys — that's two distinct needs, not a duplicate.

---

## Step 4 — Standalone vs. compound: sizing the cost

Step 3 already decided **which** dimensions must combine, because they co-occur in
some real request, and which can stay standalone. This step is purely about cost once
that's settled:

- **Combining is cheap when the combined cardinality stays small** — pricing dims ×
  the co-occurring dim, multiplied together, in the low hundreds or less:
  `group_keys: [[...pricing_dims, feature_dim]]`.
- **Combining gets expensive fast as combined cardinality grows** — every dimension in
  one key multiplies the scan cost of every query against it (see "Cardinality risk,
  up front"). Treat anything above roughly 1,000 combined distinct values as worth a
  second look — but this is a check that Step 3's co-occurrence answer was actually
  correct, not a cost-based excuse to override it: if the co-occurrence is real, the
  cost is required and this cannot be undone later. Only go back to Step 3 if, on
  reflection, that dimension doesn't actually need to appear alongside pricing in any
  real request. Invoice presentation's combined key in particular has no cost
  exception — see "Choosing the presentation key" below.
- **A dimension expected to reach ~1,000 unique values per customer, standalone or
  combined, is worth flagging to Metronome support before launch** — cardinality at
  that scale can affect API latency on usage and spend-breakdown queries regardless of
  key structure. This is a separate threshold from the combined-cardinality check
  above: going standalone to duck the previous bullet's cost concern does not exempt
  the dimension from this one if its own cardinality is high enough.
- **Shortcut:** if every feature is already covered by some pricing dimension — not
  necessarily the same one for each feature — no additional group keys are needed.

---

## Confirmation gate — required before creating group_keys

`group_keys` is immutable after the metric is created. Present this table and get
explicit confirmation before calling the API:

| Dimension | In `group_keys`? | Role: pricing / invoice breakdown / spend or usage query / seat credits / alerts / none | Estimated cardinality |
|---|---|---|---|
| (fill in per dimension) | yes / no | | fixed count, or "grows with usage" |

Include every dimension that might ever be needed. Declaring a group key costs
nothing upfront, but that's not the same as it being free to run: once events carry
that dimension, a compound key scans its full cross-product whether or not anything
ever queries it — estimate the combined cardinality for every proposed compound key
before confirming, not just its role. What you can't fix later is a *missing*
dimension — `group_keys` is immutable, so leave out a dimension now and there's no
adding it after the fact.

**Do not call `POST /v1/billable-metrics/create` until the user confirms this table.**

```http
POST /v1/billable-metrics/create
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "name": "<metric name>",
  "aggregation_type": "SUM",
  "aggregation_key": "<value field>",
  "event_type_filter": { "in_values": ["<event_type>"] },
  "property_filters": [
    { "name": "<value field>", "exists": true },
    { "name": "<pricing_dim_1>", "exists": true },
    { "name": "<pricing_dim_2>", "exists": true },
    { "name": "<feature_dim>", "exists": true }
  ],
  "group_keys": [
    ["<pricing_dim_1>", "<pricing_dim_2>"],
    ["<pricing_dim_1>", "<pricing_dim_2>", "<feature_dim>"]
  ]
}
```

Shown here with a two-dimension compound pricing key — `property_filters` must list
**every** dimension that appears anywhere in `group_keys`, not just one representative
dimension. A single pricing dimension is the same pattern with one fewer entry in
each list; more pricing or feature dimensions add more entries the same way.

This example uses `SUM`. For a raw usage breakdown that only needs an event count,
use `"aggregation_type": "COUNT"` and omit `aggregation_key` instead — see
`metronome-setup-catalog` Step 1 for the full aggregation_type options (SUM/COUNT/MAX/
UNIQUE/LATEST).

Then on the product:

```http
POST /v1/contract-pricing/products/create
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "name": "<product name>",
  "type": "USAGE",
  "billable_metric_id": "<id from above>",
  "pricing_group_key": ["<pricing_dim>"],
  "presentation_group_key": ["<pricing_dim>", "<presentation_dim>"]
}
```

Omit `presentation_group_key` entirely if there's no invoice breakdown beyond
pricing — one line item per pricing combination is the default.

---

## Choosing the presentation key (invoice structure)

| Shape | When | group_keys needed |
|---|---|---|
| Flat invoice | `presentation_group_key` = `pricing_group_key`, or omitted | Just the pricing key |
| Pricing as folders, extra dim as sub-items | `presentation_group_key` is a superset of pricing (e.g. pricing `[model]`, presentation adds `user_id`) | `[model, user_id]` — mandatory, not optional |
| Presentation dim as folders, pricing as sub-items | `presentation_group_key` is orthogonal to or a subset of pricing (e.g. presentation `user_id`, pricing `[model, token_type]`) | `[model, token_type, user_id]` — mandatory, not optional |

**The combined key is not optional for either tree shape.** Invoice presentation
always co-occurs with pricing dims in the same computation, so without a group key
covering every pricing dimension and the presentation dimension together, there's no
match and invoice compute fails — not slowly, not at all. Confirm this group key
exists before committing to either structure. **And remember `property_filters`**
(see the top of this skill) — adding a new dimension to `group_keys` here is exactly
the moment that rule gets forgotten.

**group_keys control which dimensions appear and how they're grouped — not display
order.** A request to reorder dimensions already in the pricing key, with no new
dimension involved, is a display question, not a group-key change.

---

## Mandatory gotchas

- Do not set `group_keys` without matching `property_filters` — every property in
  `group_keys`, and your `aggregation_key`, needs a matching entry or the create call
  fails with a specific, named error (see the top of this skill).
- Do not put every dimension on one compound key just because they're all on the same
  event — see "Cardinality risk, up front" above. Only dimensions that actually
  co-occur in a real request belong on the same key.
- Do not assume `group_values` filtering on a compound key is cheap. Compound key
  values are stored together — filtering to one inner value still requires reading
  every value of every other dimension in that key. Give the filtered dimension its
  own standalone key instead.
- Do not scope a usage alert to a dimension that grows with usage (a user ID, a
  session ID, any accumulating entity ID) — bounded enums only (model, tier, region).
  If an alert dimension ends up nested inside a large compound pricing key for some
  other reason, it inherits that key's full cardinality cost — flag it to Metronome
  support before launch.
- Do not combine two unrelated feature dimensions onto one key to save a key slot —
  they'll interfere with each other's lookups.
- Do not treat a compound key's cardinality math the same as a standalone key's. A
  standalone key never has the cross-product cost a compound key does. That's a
  scan-cost distinction, not a blanket exemption: contact Metronome support if *any*
  group key's per-customer cardinality — standalone or compound — may reach ~1,000
  unique values, since other behavior (API latency on usage/spend-breakdown queries)
  scales with cardinality either way.

---

Once the billable metric and product are created here, **return to
`metronome-setup-catalog` Step 3** (Rate Card) to continue the rest of the setup —
this skill only covers group key design, not the full catalog flow.

## Key documentation

- [Metronome Documentation](https://docs.metronome.com/)
- [API Reference](https://docs.metronome.com/api-reference/)
- [Design Usage Events](https://docs.metronome.com/guides/events/design-usage-events)
