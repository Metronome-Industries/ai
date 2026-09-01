---
name: metronome-group-keys
description: >-
  Designs group_keys for a billable metric across pricing, invoice presentation,
  spend breakdowns, seat-based credits, and usage alerts — including when to use a
  standalone vs. compound key and how to avoid the most common invoice-cost mistakes.
  Use when a billable metric needs more than one flat pricing dimension, when deciding
  pricing_group_key vs. presentation_group_key, or when an existing setup has slow
  invoices or unexpectedly costly spend breakdowns.
argument-hint: <event_schema_description>
---

# metronome-group-keys

Designs the `group_keys` array on a billable metric, and the matching
`pricing_group_key` / `presentation_group_key` on its product. Extends
`metronome-setup-catalog`'s Step 1 — read this before calling
`POST /v1/billable-metrics/create` whenever more than one dimension is involved.

**`property_filters` is required whenever `group_keys` is set.** Every property
referenced in `group_keys`, plus the `aggregation_key`, must also appear in
`property_filters`. Omitting any one returns `"The specified aggregation key must be
one of the property filter names"` with no further detail — this is the single most
common mistake when adding group keys to an existing metric.

---

## Step 1 — Identify dimensions

Ask: **what fields do you send on each usage event?**

For each one, get a rough sense of scale: a fixed, known set of values (a region, a
plan tier, a model name), or something that grows as usage grows (a user ID, a
session ID, any per-entity identifier). An exact count isn't necessary yet — knowing
which category each dimension falls into is.

---

## Step 2 — Identify the pricing dimensions

Ask: **which dimensions affect the price?**

These become `pricing_group_key` on the product. One pricing dimension is a
standalone key; multiple pricing dimensions form a compound key, one combination per
unique value pair.

---

## Step 3 — Identify what else each dimension is used for

| Feature | Question to ask | What it needs |
|---|---|---|
| Invoice line item breakdown | Separate line items per dimension on the invoice? | `presentation_group_key`: pricing dims + the extra dim |
| Spend breakdowns | Spend broken down by a dimension outside the invoice? | A group key covering pricing dims + the breakdown dim |
| Seat-based credits | Do seats draw from their own credit balance? | A standalone seat key, or pricing dims + the seat dim — accessed via API/dashboard, never invoice-nested |
| Usage alerts | Alerts scoped to a specific dimension? | A group key covering pricing dims + the alert dim — **only on a fixed, known set of values** |

**Each dimension gets its own group key; if two features need the same dimension, one
key covers both** — don't build a second, redundant key for a dimension already
covered.

**Alerts are a firmer rule than the others, with a real cap.** Per-key balance alerts
are limited to 3 per customer, each supporting up to 1,000 cardinality (unique
key-value pairs). Don't scope usage alerts to a dimension that grows with usage —
that cap gets breached as the dimension grows, and the failure can be silent. If
that's the real need, that's a conversation with your account team, not something to
configure directly.

---

## Step 4 — Standalone vs. compound

For each feature dimension from Step 3 that isn't already a pricing dimension:

- **Small combined cardinality** (pricing dims × feature dim stays modest) → add it
  directly: `group_keys: [[...pricing_dims, feature_dim]]`.
- **Large combined cardinality** (the feature dimension has many values, or several
  pricing dimensions are already combined) → give it a **standalone key** instead:
  `group_keys: [[feature_dim]]`. As a rule of thumb, treat "large" as anything that
  would put the *compound* key's combined cardinality above roughly 1,000 distinct
  combinations (see Mandatory gotchas below). A standalone key avoids the cross-product scan cost
  a compound key has — but it isn't exempt from cardinality limits in general: any
  group key expected to reach ~1,000 unique values per customer is worth flagging to
  Metronome support regardless of whether it's standalone or compound.
- **If the same dimension needs both invoice nesting and an API-only feature, check
  nesting first.** The combined key invoice nesting requires already covers any
  API-only feature needing that same dimension — don't also build a standalone key
  for it.
- **Shortcut:** if every feature is already covered by some pricing dimension — not
  necessarily the same one for each feature — no additional group keys are needed.

---

## Confirmation gate — required before creating or updating group_keys

`group_keys` is immutable after the metric is created. Present this table and get
explicit confirmation before calling the API:

| Dimension | In `group_keys`? | Role: pricing / presentation / spend / SBC / alerts / none |
|---|---|---|
| (fill in per dimension from Steps 1–3) | yes / no | |

Include every dimension that might ever be needed — unused group keys are free, but
missing ones cannot be added to this metric later.

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

**The combined key is not optional for either tree shape.** Without a group key
covering every pricing dimension and the presentation dimension together, there's no
match and invoice compute fails outright — not slowly, not at all. Confirm this group
key exists before committing to either structure. **And remember `property_filters`**
(see the top of this skill) — adding a new dimension to `group_keys` here is exactly
the moment that rule gets forgotten, since the create call otherwise fails with an
error that doesn't mention `property_filters` at all.

**If the breakdown is only needed via the spend-breakdowns API, not on the invoice
itself**, keep the pricing key standalone and add a separate group key for that
dimension — this is almost always cheaper than combining.

**group_keys control which dimensions appear and how they're grouped — not display
order.** A request to reorder dimensions already in the pricing key, with no new
dimension involved, is a display question, not a group-key change.

---

## Mandatory gotchas

- Do not set `group_keys` without matching `property_filters` — every property in
  `group_keys` and the `aggregation_key` must also be in `property_filters`, or the
  create call fails with an unhelpful error.
- Do not put every dimension on one compound key. This is the most common group-key
  mistake — every invoice calculation reads the full cross-product of every
  dimension, even if pricing depends on only two of them. The cost is the product of
  every dimension's cardinality: four dimensions with 5,000 / 8 / 100,000 / 5 values
  combined is 20,000,000,000 combinations, even if pricing only needs two of them. Fix
  it by re-running Steps 2–4: only the real pricing dimensions go on `pricing_group_key`,
  and each remaining dimension gets its own key from Step 4 (standalone if its combined
  cardinality with pricing would be large) — not all four on one key.
- Do not assume `group_values` filtering on a compound key is cheap. Compound key
  values are stored together — filtering to one inner value still requires reading
  every value of every other dimension in that key. Give the filtered dimension its
  own standalone key instead.
- Do not scope a usage alert to a dimension that grows with usage (a user ID, a
  session ID, any accumulating entity ID) — bounded enums only (model, tier, region).
- Do not combine two unrelated feature dimensions onto one key to save a key slot —
  they'll interfere with each other's lookups.
- Do not treat a compound key's cardinality math the same as a standalone key's. A
  standalone key never has the cross-product cost a compound key does — a compound
  key's cost is the product of every dimension's cardinality, a standalone key's
  isn't. That's a scan-cost distinction, not a blanket exemption: contact Metronome
  support if *any* group key's per-customer cardinality — standalone or compound —
  may reach ~1,000 unique values, since other behavior (API latency on
  usage/spend-breakdown queries) scales with cardinality either way. This refines
  `metronome-setup-catalog`'s general cardinality warning with the standalone/compound
  cost distinction, without exempting standalone keys from the cardinality figure
  itself.

---

Once the billable metric and product are created here, **return to
`metronome-setup-catalog` Step 3** (Rate Card) to continue the rest of the setup —
this skill only covers group key design, not the full catalog flow.

## Key documentation

- [Metronome Documentation](https://docs.metronome.com/)
- [API Reference](https://docs.metronome.com/api-reference/)
- [Design Usage Events](https://docs.metronome.com/guides/events/design-usage-events)
