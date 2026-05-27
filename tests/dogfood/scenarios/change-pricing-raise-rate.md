# Scenario: Change pricing — raise the rate on an existing product

**Mode tested**: Change pricing
**Starting state**: Existing setup with rate card, 3 customers (one with override)
**Tests**: Blast radius enumeration, before/after diff, override vs. rate card decision

---

## Setup

Pre-seed the sandbox with the following objects. This can be done via API or dashboard before starting the test.

### Billable metric
- Name: "API Calls"
- event_type_filter: `api_call`
- aggregation_type: COUNT

### Product
- Name: "API Calls"
- Type: USAGE
- Linked to the "API Calls" metric

### Rate card: "Standard"
- Rate for "API Calls": FLAT, $0.01/call (1 cent)

### Customers and contracts

| Customer | Contract | Rate card | Override? | Typical monthly usage |
|---|---|---|---|---|
| Alpha Corp | Active, started 2026-01-01 | Standard | None | ~100,000 calls |
| Beta Inc | Active, started 2026-01-01 | Standard | None | ~250,000 calls |
| Gamma LLC | Active, started 2026-01-01 | Standard | Yes — overwrite at $0.008/call (0.8 cents) | ~500,000 calls |

### How to verify setup is correct
- `GET /v1/contract-pricing/rate-cards/list` → "Standard" rate card exists
- `POST /v2/contracts/list` → 3 active contracts, all referencing "Standard"
- `POST /v1/contracts/getContractRateSchedule` for Gamma → shows override at 0.8 cents

---

## Opener

Paste this as the first prompt:

> I want to raise my API call price from $0.01 to $0.015 per call. How do I do this without breaking anything?

---

## Founder responses

### When asked "Should all customers get this change?":
> Yes, all customers should move to the new price. Except Gamma — they have a special deal, I don't want to touch them.

### When shown the blast radius / affected customer list:
> Wait, Gamma already has an override? Good, so they won't be affected. And Alpha and Beta will both go to $0.015? What's the dollar impact?

### When shown the before/after diff with dollar estimates:
> That's fine. Alpha going up ~$500/month and Beta ~$1250/month is expected. Go ahead.

### When asked about timing:
> Start of next month. I don't want a mid-month rate change confusing things.

### When asked to confirm:
> Confirmed. Make the change.

---

## Expected outcome

### Expected blast radius output

The agent should show something like:

```
BLAST RADIUS — Standard rate card — API Calls
────────────────────────────────────────────────────────────────────────
Customer     | Status     | Current Rate  | New Rate      | Est. Monthly Δ
────────────────────────────────────────────────────────────────────────
Alpha Corp   | AFFECTED   | $0.010/call   | $0.015/call   | +$500.00
Beta Inc     | AFFECTED   | $0.010/call   | $0.015/call   | +$1,250.00
Gamma LLC    | OVERRIDE   | $0.008/call   | $0.008/call   | $0.00
────────────────────────────────────────────────────────────────────────
Summary: 2 customers affected | Est. total impact: +$1,750.00/month
         1 customer unaffected (has override)
```

### Expected implementation

The agent should:
1. Update the rate on the "Standard" rate card for "API Calls" from 1 cent to 1.5 cents
2. Set `starting_at` to the first of next month
3. NOT touch Gamma's contract or override (already protected)
4. NOT create new overrides for Alpha or Beta (they should inherit the rate card change)

### Key verification points

1. **Blast radius shown BEFORE any changes**: The agent must enumerate affected customers and get confirmation before modifying the rate card.
2. **Gamma not affected**: After the change, Gamma's contract rate schedule should still show 0.8 cents (override unchanged).
3. **Alpha and Beta affected**: After the change takes effect, their rate schedules should show 1.5 cents.
4. **Timing correct**: The new rate's `starting_at` should be first of next month, not today.
5. **No unnecessary overrides**: The agent should NOT create overrides for Alpha and Beta to "protect" them or to set the new rate — the rate card propagation handles it.

### Post-change verification

After the agent completes:

```
GET /v1/contract-pricing/rate-cards/getRateSchedule
  → Should show: 1 cent until end of current month, 1.5 cents starting first of next month

POST /v1/contracts/getContractRateSchedule (Alpha's contract)
  → Should show: 1.5 cents starting first of next month (inherited from rate card)

POST /v1/contracts/getContractRateSchedule (Gamma's contract)
  → Should show: 0.8 cents (override, unaffected by rate card change)
```
