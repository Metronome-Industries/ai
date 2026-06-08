# Pricing patterns

Match your pricing intent to a complete Metronome decomposition before creating any objects. Each pattern below specifies the exact primitives required, the key architectural insight, and a minimal API skeleton.

---

## How to use this reference

1. Identify which pattern (or combination) matches the user's pricing intent
2. Build the primitives in the order listed — dependencies flow top to bottom
3. Use the decision forks to handle variants without creating unnecessary objects

Multiple patterns can compose: "subscription + token usage" = Pattern 1 + Pattern 3.

---

## Pattern 1 — Per-unit PAYGO

**When:** Simple consumption billing, no commitments, pay in arrears. API calls, storage GB, compute minutes.

**Primitives:** COUNT or SUM metric → USAGE product → FLAT rate on rate card → contract

**Key insight:** One metric per unit type. If you have 3 billable units, create 3 metrics and 3 products.

**Skeleton:**
```
BM:       COUNT, event_type_filter: api_call
Product:  USAGE, billable_metric_id: <bm_id>
Rate:     FLAT, price: 1 (= $0.01/call), entitled: true
Contract: customer_id + rate_card_id + starting_at
```

---

## Pattern 2 — Token-based with model tiers

**When:** Different prices per model, region, or tier. "gpt-4 costs more than gpt-3.5."

**Primitives:** SUM metric with group_keys → USAGE product with pricing_group_key → rates with pricing_group_values

**Key insight:** One metric, one product, multiple rates. Do NOT create separate metrics per tier — that doubles object count and breaks dimensional pricing.

**Decision fork — should tiers appear on the customer invoice?**
- Yes → add `presentation_group_key` on the product (one invoice line per tier)
- No → `pricing_group_key` only (one invoice line total, rated internally by tier)

**Skeleton:**
```
BM:       SUM, aggregation_key: tokens, group_keys: [["model_name"]]
          property_filters: [{name: tokens}, {name: model_name}]
Product:  USAGE, billable_metric_id: <bm_id>, pricing_group_key: ["model_name"]
          optional: presentation_group_key: ["model_name"]
          optional: quantity_conversion: {conversion_factor: 1000, operation: DIVIDE, name: "1K tokens"}
Rates:    [{product_id, price: 2, pricing_group_values: {model_name: gpt-4}, ...},
           {product_id, price: 1, pricing_group_values: {model_name: gpt-3.5}, ...}]
Contract: standard
```

---

## Pattern 3 — Subscription + overage

**When:** Fixed monthly fee plus metered usage above a threshold. "$20/month base, then $0.01/API call."

**Primitives:** SUBSCRIPTION product + USAGE product → two rates on same rate card

**Key insight:** Both products go on the same rate card. The subscription generates a scheduled invoice; usage generates a usage invoice. They are separate line items.

**Critical:** SUBSCRIPTION rates require `billing_frequency: "MONTHLY"` — omitting it returns an error.

**Skeleton:**
```
Products: SUBSCRIPTION "Platform fee" + USAGE "API calls"
Rates:    [{product: platform_fee, rate_type: FLAT, price: 2000, billing_frequency: MONTHLY, entitled: true},
           {product: api_calls, rate_type: FLAT, price: 1, entitled: true}]
Contract: standard — both products active via same rate card
```

---

## Pattern 4 — Monthly free credits + overage

**When:** Customers get a free monthly allotment, then pay for overages. "$50 free each month, then $0.001/token."

**Primitives:** FIXED product → `recurring_credits` on contract + standard usage rate on rate card

**Key insight:** `recurring_credits` auto-provisions a new credit grant each billing period. One declaration, not 12 manual segments. The rate card handles overage at the standard rate automatically.

**Critical:** `recurring_credits` requires a FIXED-type product (not USAGE). `access_amount` needs both `unit_price` AND `quantity`.

**Skeleton:**
```
Products: FIXED "Monthly credits" + USAGE "Token usage"
Rate:     FLAT on USAGE product for overage (e.g., price: 1 per 1K tokens)
Contract: standard rate_card_id +
  recurring_credits: [{
    product_id: <FIXED id>,
    access_amount: { unit_price: 5000000, quantity: 1, credit_type_id: <usd_id> },
    priority: 1,
    commit_duration: { value: 1, unit: "PERIODS" },
    starting_at: <contract start>
  }]
```

When credits are exhausted, usage invoices at the rate card rate automatically.

---

## Pattern 5 — Enterprise prepaid commit

**When:** Customer pays upfront for a committed amount, then draws down against usage. Remaining balance invoices at contract end if postpaid.

**Primitives:** FIXED product → contract `commits[]` with `access_schedule` + `invoice_schedule`

**Key insight:** Two schedules on a commit — `access_schedule` controls when balance is drawable; `invoice_schedule` controls when the customer is billed. They can differ (e.g., annual access with quarterly billing).

**Prepaid vs postpaid:**
- Prepaid: customer pays upfront → invoice_schedule has a timestamp at purchase; usage draws from balance
- Postpaid: customer pays at end → no invoice_schedule; true-up invoice generated if usage < committed amount

**Skeleton (prepaid):**
```
Product:  FIXED "Annual commit"
Contract: commits: [{
  product_id: <FIXED id>,
  type: PREPAID,
  priority: 100,
  access_schedule: {
    schedule_items: [{ amount: 50000000, starting_at: <start>, ending_before: <end> }]
  },
  invoice_schedule: {
    schedule_items: [{ unit_price: 50000000, quantity: 1, timestamp: <purchase date> }]
  }
}]
```

Amounts in cents. $500 commit → `50000000`.

---

## Composing patterns

Patterns stack on the same rate card and contract:

| Combination | Common use case |
|---|---|
| Pattern 1 + 3 | API platform with base fee |
| Pattern 2 + 3 | AI inference with subscription tier |
| Pattern 2 + 4 | AI inference with monthly free credits |
| Pattern 3 + 5 | Enterprise: subscription + prepaid commit |
| Pattern 2 + 4 + 5 | Full OpenAI-style: tiers + monthly credits + enterprise commit |
