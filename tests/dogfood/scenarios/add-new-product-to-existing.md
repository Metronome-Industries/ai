# Scenario: Add a net-new product to an existing setup

**Mode tested**: Start billing (adding to existing) + Change pricing (blast radius awareness)
**Starting state**: Working billing setup with one usage product and active customers
**Tests**: Adding a new product without disrupting existing billing, correct blast radius awareness, new metric creation workflow

---

## Setup

Pre-seed the sandbox with the following objects (or reuse the state from the "change-pricing-raise-rate" scenario if already seeded).

### Existing objects

| Object | Configuration |
|---|---|
| Billable metric | "API Calls", event_type: `api_call`, aggregation: COUNT |
| Product | "API Calls", type: USAGE |
| Rate card: "Standard" | Rate for API Calls: FLAT, $0.01/call (1 cent) |
| Customer: Alpha Corp | Contract referencing "Standard" rate card, active |
| Customer: Beta Inc | Contract referencing "Standard" rate card, active |

Both customers are actively sending `api_call` events and receiving invoices. Billing is working.

### How to verify setup is correct
- Pull a recent draft or finalized invoice for Alpha → shows "API Calls" line item
- `GET /v1/billable-metrics/list` → only "API Calls" metric exists
- Customers are actively billing

---

## Opener

Paste this as the first prompt:

> I want to add a new product called "Storage" to my billing. Customers should be charged $0.05 per GB-month. This is in addition to the API calls they're already being billed for. How do I add this without messing up what's already working?

---

## Founder responses

### When asked about the usage event structure:
> Each customer's storage is measured hourly. We'd send one event per hour with the current GB stored. At the end of the month we want to bill for the average GB across the month. Actually wait — is there a better way? Maybe we just send one event at end of month with the total GB-months?

### When the agent explains aggregation options (SUM vs. latest vs. hourly):
> Let's keep it simple. We'll send one event per day with the GB stored that day, and sum them up. So 30 events in a month, each with a `gb` property. 10 GB stored for 30 days = 300 GB-days... actually no, let's think in GB-months. We'll just send one event at end of month with the total GB-months used. So one event, `gb_months: 10` means the customer stored 10 GB for the full month.

### When asked to confirm metric dimensions / group keys:
> No dimensions needed for storage. Just total GB-months. Don't need to break it down by region or storage class right now. But actually — should I add region as a group key just in case, since it's immutable later?

### When the agent advises on the group key decision:
> You're right, let me add `region` as a group key now even if I price it the same everywhere initially. Better to have it and not need it.

### When shown the mock invoice (showing both existing and new product):
> Yes, that's what the customer should see — the API calls line they already get, plus the new Storage line.

### When the agent mentions blast radius (adding product to rate card affects all contracts):
> Both Alpha and Beta should get the new Storage line item. That's fine — I want all customers to have it available. They just won't get charged unless they actually use storage.

### When asked to confirm implementation:
> Go ahead.

---

## Expected outcome

### Expected mock invoice

```
INVOICE — Alpha Corp — February 2026
─────────────────────────────────────────────────────────────────
API Calls                  120,000        $0.01/call     $1,200.00
Storage                         15 GB-mo  $0.05/GB-mo       $0.75
─────────────────────────────────────────────────────────────────
TOTAL DUE                                               $1,200.75
```

### Expected new Metronome objects

| Object | Expected configuration |
|---|---|
| Billable metric (NEW) | name: ~"Storage", event_type: ~"storage", aggregation: SUM, aggregation_key: ~"gb_months", group_keys: [["region"]] |
| Product (NEW) | name: ~"Storage", type: USAGE, linked to storage metric |
| Rate on "Standard" rate card (NEW) | Product: Storage, rate_type: FLAT, price: 5 cents ($0.05/GB-month), pricing_group_values: none (same price all regions for now) |

### Objects that should NOT be modified

| Object | Should remain unchanged |
|---|---|
| Billable metric "API Calls" | No changes |
| Product "API Calls" | No changes |
| Rate for "API Calls" on rate card | Still 1 cent/call |
| Alpha's contract | No modifications needed — new product appears via rate card |
| Beta's contract | No modifications needed |

### Key verification points

1. **Existing billing undisrupted**: Alpha and Beta's API Calls line items should be unchanged on the next invoice. Pull a draft invoice after adding the product — the API Calls line should still show correctly.

2. **New product appears on rate card**: After adding the Storage rate to the "Standard" rate card, both Alpha and Beta's contracts should show Storage as an entitled product (it propagates).

3. **No charges without events**: Until storage events are actually sent, the Storage line item should not appear on invoices (or should appear as $0.00). Adding a product to a rate card does not create phantom charges.

4. **Group key decision captured**: The billable metric should have `group_keys: [["region"]]` even though all regions are priced the same for now. This future-proofs the metric.

5. **Metric confirmation happened**: The agent should have explicitly confirmed event_type, aggregation_type (SUM), aggregation_key (`gb_months`), and group_keys (`region`) BEFORE creating the metric.

6. **Blast radius acknowledged**: The agent should have mentioned that adding a product to the rate card makes it available to all contracts on that card (Alpha and Beta both get it). Even though this is the desired behavior, the agent should have flagged it.

### Test events to ingest for verification

After implementation, ingest for Alpha:

```json
[
  {
    "transaction_id": "storage_alpha_2026-02-01",
    "customer_id": "<alpha_customer_id>",
    "event_type": "storage",
    "timestamp": "2026-02-28T23:59:00Z",
    "properties": { "gb_months": 15, "region": "us-east-1" }
  }
]
```

Expected: Alpha's draft invoice should show the existing API Calls line (from ongoing events) PLUS a new Storage line: 15 GB-months × $0.05 = $0.75.

### Edge case to watch

The agent might suggest creating a new contract or amending the existing contracts to "add" the storage product. This is WRONG — adding the product to the rate card automatically makes it available on all contracts referencing that card. No contract modification needed. If the agent proposes contract edits here, that's a skill failure (the rate card propagation rule wasn't applied).
