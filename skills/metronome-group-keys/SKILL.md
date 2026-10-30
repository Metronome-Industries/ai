---
name: metronome-group-keys
description: >-
  Designs group_keys for a billable metric across pricing, invoice presentation,
  spend breakdowns, seat-based credits, and usage alerts — and flags cardinality risk
  (a combined key's worst case is the product of every dimension's cardinality, not the sum)
  before it gets baked into an immutable metric. Use when a billable metric needs more
  than one flat pricing dimension, when deciding pricing_group_key vs.
  presentation_group_key, or when an existing setup has slow invoices or unexpectedly
  costly spend breakdowns.
argument-hint: <event_schema_description>
public: true
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
entry per dimension you group by — this is the single most common mistake when defining
group keys on a new metric.

`group_keys` can't be edited through the API once a metric exists. Changing them means
creating a new metric or having Metronome support make the change, and neither regroups
usage that was already ingested: that takes a reflow, and contracts backdated before the
change don't benefit. Contact Metronome support before changing a metric that is already
billing.

---

## Cardinality risk, up front

A group key's worst-case number of distinct combinations is the **product** of every
dimension's cardinality inside it, not the sum. Four dimensions with 5,000 / 8 / 100,000
/ 5 possible values combined on one key can produce up to 5,000 × 8 × 100,000 × 5 =
20,000,000,000 combinations — even if pricing only needs two of them. That product is
an upper bound, not a measurement: the combinations that actually occur per customer are
often far fewer (for example when each ID belongs to a single parent), and those, along
with event volume, set what a query costs. Size a key on the combinations you expect per
customer, and fall back to the product only when you can't estimate that. A query
against a compound key reads every dimension in it, so a dimension nothing needs adds
avoidable work. This is the single most common way a Metronome setup goes
wrong, and `group_keys` is immutable after the metric is created, so it has to be
gotten right before the first API call, not fixed afterward.

**The rule that decides everything below: any dimensions that need to appear together
in the same request — for pricing, invoice presentation, or a spend or usage query —
must be members of one combined `group_keys` entry, declared now.** There is no way
to combine two separately-declared keys later, and there is no exception based on
whether the request computes a dollar figure or just a count — combination is about
which dimensions co-occur in one request, not about what the request is for. (Spend
alerts scoped to a group key are evaluated the same way spend breakdowns are, so they
follow the same rule — see Step 3.)

**Ideal default: keep the pricing key to only the dimensions that actually set the
price, and give every other dimension its own standalone key** — unless that
dimension will always be queried together with pricing (invoice presentation, spend
breakdowns and spend alerts scoped to a dimension always are; a plain usage query only
is if you'll ask for both together in the same call).
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

**Invoice compute uses the smallest key that contains the dims it looks up.** It looks
up the pricing dims plus the presentation dims, if a presentation key is set. If the
only matching entry is a larger one (pricing `[model]`, no presentation key, only
`[model, token_type]` declared), every invoice computation reads every dimension of
the larger key to produce a result that needs only `[model]`. So with no presentation
key, declare the pricing key by itself alongside any larger key. With a presentation
key, the entry that must exist is pricing plus presentation (see "Choosing the
presentation key"), and a separate pricing-only key isn't needed for invoice compute.
The cost of that extra read grows with how many combinations the larger key actually
holds, so it matters most when that key is large.

---

## Step 3 — Identify what else each dimension is used for, and whether it co-occurs with pricing

For every dimension that isn't already a pricing dimension, ask: **what else is it
used for, and does that use ever need pricing dimensions in the same request?**

| Feature | Question to ask | Co-occurs with pricing dims? | Key needed |
|---|---|---|---|
| Invoice line item breakdown | Separate line items per dimension on the invoice? | Always — invoice generation rates the pricing dims and presents by this dim in the same computation | `presentation_group_key`: pricing dims + the extra dim, combined |
| Spend breakdowns (`POST /v1/customers/{id}/invoices/spend-breakdowns`) | Need spend broken down by this dim, on demand? | Always — the endpoint recomputes the invoice with this dim as the presentation key, so the lookup needs the pricing dims, any dim the request filters on, and this dim together in one key | One key: pricing dims + filter dims + this dim. Only a metric with no pricing dims, queried by this dim alone, can use a standalone key |
| Plain usage query by this dim | Need a raw quantity breakdown by this dim, on demand? | Only if you'll query it together with a pricing dim in the same call | Combined key if yes; a standalone key on the dim alone is fine and cheaper if it's only ever queried by itself |
| Seat-based credits | Do seats draw from their own credit balance? | Always — seat-scoped balances filter usage by the seat dim, and that filter is applied only to line items whose own pricing or presentation key contains the seat dim | The seat dim must be in the product's `pricing_group_key` or `presentation_group_key`, so one key: pricing dims + seat dim (set `presentation_group_key` to include the seat dim). A standalone seat key works only on a metric with no pricing dims. Size the combined key (Step 4): pricing combinations × seats |
| Spend alerts scoped to a dimension | Alerts on spend for one dimension (any value, or one specific value)? | Always — these alerts are evaluated by computing the invoice with this dim as the presentation key, the same way spend breakdowns are | One key: pricing dims + this dim. Only a metric with no pricing dims can use a standalone key. **Only on a fixed, known set of values**, never a dimension that grows with usage |

**The distinction that matters is which endpoint, not dollars versus quantity.** Spend
breakdowns, and spend alerts scoped to a dimension, recompute the invoice with the
requested dim swapped in as the presentation key, so the key lookup always includes the
product's pricing dims (and any dim the request filters on). If no single `group_keys`
entry contains all of them, the request still succeeds, but the breakdown isn't applied:
the response falls back to the invoice's configured grouping and no error is returned. A
plain usage query only needs the dims it actually names.

**A breakdown can also be skipped for reasons that have nothing to do with group
keys.** A spend breakdown also isn't applied, with the same fallback and no error, when
the metric uses MAX aggregation or quantity rounding, when the product's rate is tiered,
or when the contract has commit-specific overrides or rate overrides scoped to
presentation group values. If your metric or contract uses any of these, the breakdown
won't split out; contact Metronome about your setup before you build on it.

**Spend breakdowns are in private preview.** Metronome enables the endpoint per account,
and it returns a 403 until it is. Contact Metronome to get access before you build on it.

**Spend-breakdown requests have their own limits.** Every group key in a request needs
filter values (a request for all values is rejected unless Metronome has enabled it for
your account); only `day` and `none` windows are accepted; the number of `group_keys` per
request defaults to 2 and is set per account; and the total number of filter
values across all keys has a configured cap. These are enforced by the API, so they
return an error instead of falling back. Plan to group by one key per request and filter
by the others; each breakdown dimension then needs its own key containing the pricing
dims.

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
  one key can multiply the combinations each query against it reads (see "Cardinality
  risk, up front"). Treat anything above roughly 1,000 combined distinct values per
  customer as worth a
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

| `group_keys` entry | Serves: pricing / invoice breakdown / spend breakdown / usage query / seat credits / alerts | Worst-case combinations (product of its dims; "grows with usage" if any dim does) |
|---|---|---|
| (one row per key you plan to create, e.g. `[model, token_type, user_id]`) | | |

Then list any dimension you are deliberately leaving out of every key, with the reason.

Include every dimension that might ever be needed. Declaring a group key costs
nothing upfront, but that's not the same as it being free to run: every query that
resolves to a compound key reads all of its dimensions — estimate the combined
cardinality for every proposed compound key before confirming, not just what it serves. What you can't fix later is a *missing*
dimension — `group_keys` is immutable, so leave out a dimension now and there's no
adding it after the fact.

**Do not call `POST /v1/billable-metrics/create` until the user confirms this table.**

```http
POST /v1/billable-metrics/create
Authorization: Bearer $METRONOME_BEARER_TOKEN
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
Authorization: Bearer $METRONOME_BEARER_TOKEN
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
  own standalone key instead — except for spend breakdowns on a metric with pricing
  dims, which need those dims in the same key; there, keep the combined key and treat
  its cardinality as the cost.
- Do not scope a spend alert to a dimension that grows with usage (a user ID, a
  session ID, any accumulating entity ID) — bounded enums only (model, tier, region).
  The alert dimension needs a key that also contains the pricing dims (see Step 3), so
  it carries that key's full cardinality cost: size the key (Step 4) and flag it to
  Metronome support before launch if the dimension could be large.
- Do not combine two unrelated feature dimensions onto one key to save a key slot —
  they'll interfere with each other's lookups.
- Do not treat a compound key's cardinality math the same as a standalone key's. A
  standalone key never has the cross-product cost a compound key does. That's a
  combination-count distinction, not a blanket exemption: contact Metronome support if *any*
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
