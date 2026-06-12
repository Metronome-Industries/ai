# Pricing patterns

## Contents

- Pattern 1: Pure usage (per-unit)
- Pattern 2: Tiered usage (volume breakpoints)
- Pattern 3: Subscription + overage
- Pattern 4: Prepaid credits (burn-down)
- Pattern 5: Enterprise commit (annual prepay)
- Pattern 6: Hybrid (subscription + multiple usage dimensions)
- Pattern 7: Free trial → paid conversion

---

## Pattern 1: Pure usage (per-unit)

**Examples**: Twilio (per-SMS), simple API pricing (per-call), storage (per-GB-month)

### Invoice shape

```
API Calls                    150,000    $0.001/call    $150.00
───────────────────────────────────────────────────────────────
TOTAL DUE                                              $150.00
```

### Metronome decomposition

| Object | Configuration |
| --- | --- |
| Billable metric | event_type: `api_call`, aggregation: COUNT (or SUM if variable quantity per event) |
| Product | Usage product, linked to the billable metric |
| Rate card rate | Flat rate: price per unit in cents |

### Decision forks

1. **COUNT or SUM?** If each event = 1 unit of work → COUNT. If each event carries a variable quantity (e.g., tokens, bytes) → SUM with `aggregation_key`.
2. **Any free tier?** If first N units are free, this is actually Pattern 3 (subscription + overage with $0 subscription) or Pattern 4 (prepaid credits for the free amount).
3. **Minimum charge?** If there's a monthly minimum regardless of usage, add a postpaid commit for the minimum amount.

---

## Pattern 2: Tiered usage (volume breakpoints)

**Examples**: Stripe API pricing (volume discounts), cloud compute (tier-based per-hour rates)

### Invoice shape

```
API Calls (0–10,000)         10,000     $0.010/call    $100.00
API Calls (10,001–100,000)   40,000     $0.005/call    $200.00
API Calls (100,001+)         50,000     $0.002/call    $100.00
───────────────────────────────────────────────────────────────
TOTAL DUE                                              $400.00
```

### Metronome decomposition

| Object | Configuration |
| --- | --- |
| Billable metric | event_type: `api_call`, aggregation: COUNT |
| Product | Usage product, linked to the billable metric |
| Rate card rate | Tiered rate type with breakpoints and per-tier prices |

### Decision forks

1. **Graduated or volume?** Metronome uses **graduated** tiers by default (each unit priced at its tier's rate). Volume pricing (total quantity determines the rate for ALL units) requires a different approach — typically modeled as a custom rate or post-hoc adjustment. Confirm with the founder which they mean.
2. **Per-unit or per-thousand?** Clarify the unit of measurement before setting rates. $0.01/call vs. $10/thousand calls are the same price but different rate card configurations.
3. **Reset period?** Tiers typically reset each billing period (monthly). If tiers accumulate across periods, this needs special handling.

---

## Pattern 3: Subscription + overage

**Examples**: OpenAI (Plus subscription + token usage), Vercel (Pro plan + bandwidth overage), most SaaS with usage caps

### Invoice shape

```
Pro Plan (monthly)             1        $49.00/month    $49.00
API Calls (overage > 10,000) 5,000      $0.01/call     $50.00
───────────────────────────────────────────────────────────────
TOTAL DUE                                               $99.00
```

### Metronome decomposition

**Option A — Subscription + usage product (simple base fee, no included usage):**

| Object | Configuration |
| --- | --- |
| Product (subscription) | Subscription type, flat monthly amount |
| Billable metric | event_type: `api_call`, aggregation: COUNT |
| Product (overage) | Usage product linked to the metric |
| Rate card | Subscription rate + flat/tiered usage rate |

**Option B — Prepaid commit as the "included" allowance:**

| Object | Configuration |
| --- | --- |
| Billable metric | event_type: `api_call`, aggregation: COUNT |
| Product (usage) | Usage product linked to the metric |
| Rate card | Usage rate (e.g., $0.01/call) |
| Prepaid commit | Amount = $100 (covers 10,000 calls at $0.01), access schedule = monthly |
| Contract | References rate card + commit; overage billed at rate card rate when commit exhausted |

### Decision forks

1. **Is the base fee a simple platform fee or does it include an allowance?** If the base fee says "includes 10,000 calls" → use Option B (prepaid commit). If the base fee is just access to the platform with all usage billed separately → use Option A (subscription product).
2. **What happens when the allowance runs out?** Bill at overage rate (most common) or hard-stop the customer (requires threshold notification + external enforcement).
3. **Does the unused allowance roll over?** If yes, configure the commit with rollover. If no (resets monthly), use monthly access schedule segments.

---

## Pattern 4: Prepaid credits (burn-down)

**Examples**: OpenAI API credits, Anthropic credits, cloud provider committed-use discounts

### Invoice shape

**Purchase invoice (day 0):**
```
Credit Purchase               1        $500.00         $500.00
───────────────────────────────────────────────────────────────
TOTAL DUE                                              $500.00
```

**Monthly usage invoice (credits applied):**
```
API Calls (GPT-4)           100,000    $0.003/call     $300.00
Credits applied                                        -$300.00
───────────────────────────────────────────────────────────────
TOTAL DUE                                                $0.00
```

**After credits exhausted:**
```
API Calls (GPT-4)           100,000    $0.003/call     $300.00
───────────────────────────────────────────────────────────────
TOTAL DUE                                              $300.00
```

### Metronome decomposition

| Object | Configuration |
| --- | --- |
| Billable metric | event_type: matches usage, aggregation: SUM or COUNT |
| Product (usage) | Usage product linked to the metric |
| Rate card | Rate for the usage product |
| Prepaid commit | Amount = purchase total (in cents), invoice_schedule = immediate, access_schedule = full period or quarterly tranches |
| Contract | References rate card + commit |

### Decision forks

1. **All-at-once or quarterly tranches?** All-at-once: full balance available immediately. Quarterly tranches: use access_schedule to release $125K per quarter from a $500K annual purchase.
2. **Product-scoped or global?** Can credits be used against any product, or only specific ones? Set `applicable_product_ids` or `applicable_tags` to scope.
3. **What happens at exhaustion?** Bill overage at standard rates (default behavior) or stop service (requires external enforcement via threshold notification).
4. **Expiration?** Do unused credits expire? Set the commit's end date to enforce expiration.
5. **Auto-recharge?** Should the system automatically purchase more credits when balance drops below a threshold? Configure credit balance threshold with recharge amount.

---

## Pattern 5: Enterprise commit (annual prepay)

**Examples**: AWS Enterprise Discount Program, GCP committed-use discounts, annual SaaS contracts with usage

### Invoice shape

**Annual commit invoice (contract start):**
```
Annual Platform Commitment    1        $120,000.00    $120,000.00
───────────────────────────────────────────────────────────────────
TOTAL DUE                                             $120,000.00
```

**Quarterly usage invoice (drawdown):**
```
Compute Hours               50,000     $0.10/hour      $5,000.00
Storage (GB-months)          2,000     $0.05/GB          $100.00
Credits applied (from commit)                         -$5,100.00
───────────────────────────────────────────────────────────────────
TOTAL DUE                                                  $0.00
```

**True-up invoice (if postpaid, usage < commit):**
```
Commitment shortfall                                   $20,000.00
───────────────────────────────────────────────────────────────────
TOTAL DUE                                              $20,000.00
```

### Metronome decomposition

| Object | Configuration |
| --- | --- |
| Billable metrics | One per usage dimension (compute, storage, etc.) |
| Products | Usage products linked to respective metrics |
| Rate card | Rates for each product |
| Commit | Prepaid (pay upfront) or Postpaid (true-up at end). Amount = annual commitment. Access schedule = quarterly segments if needed. |
| Contract | References rate card + commit. Duration = 1 year. |

### Decision forks

1. **Prepaid or postpaid?** Prepaid: customer pays $120K upfront, draws down against usage. Postpaid: customer uses freely, pays shortfall at year end if usage < $120K.
2. **Rollover unused balance?** If quarterly tranches, does unused Q1 balance roll to Q2? Configure rollover on the commit.
3. **Commit-specific rates vs. standard rates?** Some enterprises get discounted rates within the commit and standard rates for overage. Model with multiplier overrides on the contract.
4. **Multiple products covered?** If the commit covers all products (global), leave `applicable_product_ids` unset. If only specific products, scope the commit.

---

## Pattern 6: Hybrid (subscription + multiple usage dimensions)

**Examples**: Vercel (Pro plan + bandwidth + function invocations + build minutes), Datadog (per-host + per-GB logs + per-APM trace)

### Invoice shape

```
Pro Plan (monthly)             1         $20.00/month     $20.00
Bandwidth (GB)             1,200         $0.10/GB        $120.00
Function Invocations   2,000,000         $0.60/million    $1.20
Build Minutes                500         $0.02/minute     $10.00
───────────────────────────────────────────────────────────────────
TOTAL DUE                                                $151.20
```

### Metronome decomposition

| Object | Configuration |
| --- | --- |
| Product (subscription) | Subscription type, flat monthly |
| Billable metric (bandwidth) | event_type: `bandwidth`, aggregation: SUM, aggregation_key: `bytes` |
| Billable metric (invocations) | event_type: `function_invocation`, aggregation: COUNT |
| Billable metric (build) | event_type: `build`, aggregation: SUM, aggregation_key: `duration_minutes` |
| Products (usage) | One usage product per metric |
| Rate card | Subscription rate + rate per usage product |

### Decision forks

1. **Which dimensions get different prices?** If bandwidth costs differently per region, use `group_keys: ["region"]` on the metric and set per-dimension rates (pricing group values) on the rate card. Only add group keys for dimensions that affect price — presentation-only breakdowns use invoice breakdowns, not group keys.
2. **Are there included amounts per dimension?** E.g., "100GB bandwidth included in Pro plan." Model as a product-scoped credit for $10.00 (100GB × $0.10) that resets monthly.
3. **Composite fees?** If there's a percentage-based surcharge across all usage (e.g., 5% support fee), use a composite product.

---

## Pattern 7: Free trial → paid conversion

**Examples**: Any SaaS with a trial period before paid plan activates

### Invoice shape

**During trial (invoices show $0):**
```
API Calls                   50,000     $0.01/call       $500.00
Trial credit applied                                   -$500.00
───────────────────────────────────────────────────────────────────
TOTAL DUE                                                  $0.00
```

**After conversion (normal pricing):**
```
API Calls                   50,000     $0.01/call       $500.00
───────────────────────────────────────────────────────────────────
TOTAL DUE                                                $500.00
```

### Metronome decomposition

**Option A — Credit-funded trial (usage tracked, but covered by credit):**

| Object | Configuration |
| --- | --- |
| Billable metric + product + rate card | Normal setup (same as post-conversion) |
| Credit | Amount = expected max trial usage cost. Expiration = trial end date. |
| Contract | Starts immediately. Credit covers charges during trial window. After credit expires, usage bills normally. |

**Option B — Delayed contract start (no billing during trial):**

| Object | Configuration |
| --- | --- |
| Billable metric + product + rate card | Normal setup |
| Contract | `starting_at` = conversion date (end of trial). No charges before start. |

### Decision forks

1. **Time-limited or usage-limited trial?** Time-limited (14 days free): use Option A with credit expiring at trial end, or Option B with delayed contract start. Usage-limited (first 10,000 calls free): use Option A with credit amount = 10,000 × rate.
2. **Track usage during trial?** If you want visibility into trial usage for conversion signals, use Option A (events flow, credit covers cost). If trial usage is irrelevant, Option B is simpler.
3. **What happens if trial credit runs out early?** Bill the overage (aggressive conversion) or stop service (gentle trial). This affects whether you set up a threshold notification.
4. **Auto-conversion or manual?** If auto: Option A handles it naturally (credit expires, billing starts). If manual: use Option B and set `starting_at` when the founder triggers conversion.
