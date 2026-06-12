# Scenario: Start billing from scratch — SaaS with prepaid credits

**Mode tested**: Start billing
**Starting state**: Empty sandbox (no existing rate cards, metrics, or customers)
**Patterns exercised**: Pattern 3 (subscription + overage) + Pattern 4 (prepaid credits)

---

## Setup

No sandbox setup required. This test starts from a completely clean environment.

Confirm the sandbox has:
- No existing billable metrics
- No existing rate cards
- No existing customers

---

## Opener

Paste this as the first prompt:

> Help me set up billing for my AI writing assistant. Users pay $29/month which includes $20 worth of credits. They burn credits on usage — we charge per 1,000 tokens generated. Once credits run out, they keep getting charged at the same rate. We have two models: "fast" at $0.50 per 1K tokens and "quality" at $2.00 per 1K tokens.

---

## Founder responses

Use these scripted responses at each decision point:

### When asked to confirm pricing understanding:
> Yes, that's right. $29/month subscription, $20 in credits included, then overage at the same rates. Two models with different per-token pricing.

### When shown the matched pattern:
> That looks right. The customer should see the subscription fee, then usage broken out by model, with credits covering the first $20 of usage each month.

### When shown the mock invoice:
> Almost — change the subscription to $29 not $20. And the credit should be $20 worth, not $29. So if someone uses $50 of tokens, they pay $29 subscription + $30 overage ($50 usage minus $20 credit).

### When shown the corrected mock invoice:
> Perfect, that's exactly what the customer should see.

### When shown the event schema:
> Looks good. Our backend can send those events. Ship it.

### When asked about group keys or dimensions:
> Just the model name is the pricing dimension. We might want to track user_id for analytics later but it shouldn't affect pricing.

### When asked about credit rollover:
> No rollover. Unused credits expire at the end of each month. Fresh $20 each month.

### When asked about what happens at credit exhaustion:
> Keep billing at the same rate. No hard stop.

---

## Expected outcome

### Expected mock invoice

```
INVOICE — Test Customer — January 2026
─────────────────────────────────────────────────────────────────
Monthly Subscription              1        $29.00/mo      $29.00
Token Generation — fast      50,000 tok    $0.50/1K tok   $25.00
Token Generation — quality   10,000 tok    $2.00/1K tok   $20.00
Monthly credits applied                                  -$20.00
─────────────────────────────────────────────────────────────────
TOTAL DUE                                                 $54.00
```

### Expected Metronome objects

| Object | Expected configuration |
|---|---|
| Billable metric | name: ~"Token Generation", event_type: ~"token_generation", aggregation: SUM, aggregation_key: ~"tokens", group_keys: [["model"]] |
| Product (subscription) | type: SUBSCRIPTION, name: ~"Monthly Subscription" |
| Product (usage) | type: USAGE, linked to token generation metric |
| Rate card | Contains subscription rate ($29 = 2900 cents) + flat rates per model (fast: 0.05 cents/token, quality: 0.2 cents/token) |
| Customer | Created with billing config |
| Contract | References rate card, includes monthly prepaid commit of $20 (2000 cents) with monthly access schedule, no rollover |

### Key verification points

1. **Cents conversion**: Subscription rate = 2900 cents. Token rates: fast = 0.05 cents/token (which is $0.50/1K), quality = 0.20 cents/token (which is $2.00/1K).
2. **Credit structure**: Prepaid commit of 2000 cents ($20), monthly access schedule segments, expires end of month (no rollover).
3. **Group key**: `model` is a group key on the billable metric AND has pricing_group_values set on the rate card with per-model rates.
4. **Mock invoice verification**: After ingesting test events, draft invoice total should match the expected mock.

### Test events to ingest for verification

```json
[
  {
    "transaction_id": "test_gen_001_2026-01-15T10:00:00Z",
    "customer_id": "<customer_id>",
    "event_type": "token_generation",
    "timestamp": "2026-01-15T10:00:00Z",
    "properties": { "model": "fast", "tokens": 50000 }
  },
  {
    "transaction_id": "test_gen_002_2026-01-15T11:00:00Z",
    "customer_id": "<customer_id>",
    "event_type": "token_generation",
    "timestamp": "2026-01-15T11:00:00Z",
    "properties": { "model": "quality", "tokens": 10000 }
  }
]
```

Expected draft invoice total after these events: **$54.00** ($29 sub + $25 fast + $20 quality - $20 credit).
