# Blast radius: pricing change protocol

## Contents

- Change type taxonomy
- Enumeration protocol
- Propagation rules
- Before/after diff template
- Override vs. rate card update decision tree

---

## Change type taxonomy

| Change type | Affects | Rate card modification? |
| --- | --- | --- |
| New product addition to rate card | All contracts on that rate card (new line item appears) | Yes |
| Rate change on existing product | All contracts WITHOUT overrides for that product | Yes |
| New tier added to tiered product | All contracts WITHOUT overrides for that product | Yes |
| Customer-specific rate adjustment | One customer only | No — use contract override |
| New rate card (separate pricing track) | Only future contracts assigned to it | Yes (new card) |

---

## Enumeration protocol

Before any rate card modification, execute these steps:

### Step 1 — Identify the rate card

Determine which rate card contains the product/rate being changed. Use:
- `GET /v1/contract-pricing/rate-cards/list` to find the rate card by name or alias
- `GET /v1/contract-pricing/rate-cards/getRateSchedule` to confirm the current rate

### Step 2 — List affected contracts

Find all contracts referencing this rate card:
- `POST /v2/contracts/list` filtered by `rate_card_id`
- Include only active contracts (not ended or archived)

### Step 3 — Check for overrides

For each contract, determine if the product being changed has a contract-level override:
- `POST /v1/contracts/getContractRateSchedule` for the specific product
- If the product has an override (overwrite or multiplier), that contract is NOT affected by the rate card change

### Step 4 — Present to founder

Show the affected customer list with estimated impact. Contracts with overrides are explicitly marked as unaffected.

---

## Propagation rules

**Rate card changes propagate automatically** to all contracts that reference the rate card, UNLESS:
- The contract has a **contract-level override** for that specific product (overwrite or multiplier)
- The contract has already ended
- The rate card change has a `starting_at` date in the future (changes are not retroactive — they apply from the specified date forward)

**What propagates:**
- Price changes (flat rate amount, tier breakpoints, percentage values)
- New products added to the rate card (appear as new entitled products on contracts)
- Rate type changes (e.g., flat → tiered) for products without overrides

**What does NOT propagate:**
- Changes to overridden products — the override continues to take precedence
- Retroactive pricing — rate changes apply forward from their `starting_at` date
- Archived products — archiving a product does not remove it from existing contracts

---

## Before/after diff template

Present pricing changes in this format:

```
BLAST RADIUS — [Rate Card Name] — [Product Name]
────────────────────────────────────────────────────────────────────────────
Customer          | Status      | Current Rate    | New Rate        | Est. Monthly Δ
────────────────────────────────────────────────────────────────────────────
Acme Corp         | AFFECTED    | $0.01/unit      | $0.015/unit     | +$50.00
Beta Inc          | AFFECTED    | $0.01/unit      | $0.015/unit     | +$120.00
Gamma LLC         | OVERRIDE *  | $0.008/unit     | $0.008/unit     | $0.00
Delta Co          | ENDED       | —               | —               | —
────────────────────────────────────────────────────────────────────────────
Summary: 2 customers affected | Est. total impact: +$170.00/month
         1 customer unaffected (has override)
         1 contract ended (not relevant)
```

`*` = has contract-level override, not affected by rate card change.

**Estimated monthly impact** = (new rate - current rate) × average monthly quantity for that customer. Pull recent usage from invoice breakdowns to estimate.

---

## Override vs. rate card update decision tree

Use this decision tree to determine the correct approach:

```
Q: Should ALL customers on this rate card get the new price?
│
├─ YES → Update the rate card directly
│        (change propagates to all non-overridden contracts)
│
└─ NO
   │
   Q: Should only NEW customers get the new price?
   │
   ├─ YES → Update the rate card AND add overrides to all
   │        existing contracts to preserve their current rate
   │        (existing = old price via override, new = new price from card)
   │
   └─ NO
      │
      Q: Should only SPECIFIC existing customers get a different price?
      │
      ├─ YES → Add contract-level overrides to those specific contracts
      │        (rate card stays unchanged for everyone else)
      │
      └─ Create a NEW rate card for the new pricing track
         and assign new customers to it
         (use when the pricing model is fundamentally different,
          not just a rate adjustment)
```

---

## Timing considerations

- **Rate card changes take effect from `starting_at`**. Set this to the next billing period boundary (e.g., first of next month) to avoid mid-period rate changes.
- **Mid-period changes** split the billing period: usage before the change date bills at the old rate, usage after bills at the new rate. This is correct behavior but may confuse the founder if unexpected.
- **Communicate to affected customers** before making the change. Metronome will automatically reflect the new rate on the next invoice — there is no "pending approval" state.
- **No undo on rate card changes**. To revert, you must add a new rate with the old price and a new `starting_at` date. The history of the change is preserved in the rate card's schedule.
