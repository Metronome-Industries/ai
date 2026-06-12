# Scorecard: [scenario name]

**Date**: YYYY-MM-DD
**Tester**: @handle
**Sandbox**: staging / other
**Scenario**: [link to scenario file]

---

## Process signals

Did the agent follow the prescribed workflow?

- [ ] Routed to the correct mode
- [ ] Loaded the correct reference file
- [ ] Asked about pricing intent / change type / customer concern before acting
- [ ] Produced mock invoice (Start billing) or blast radius (Change pricing) or narrative (Customer story)
- [ ] Waited for confirmation before implementing
- [ ] Implemented shared infra before customer-specific objects (if applicable)
- [ ] Performed verification step at the end

## Correction signals

Did the agent avoid known traps?

- [ ] All API amounts in cents (annotated with dollar equivalents)
- [ ] Asked about group keys / aggregation before creating billable metric
- [ ] Used Contracts (not Plans)
- [ ] Used Edits (not Amendments) for contract modifications
- [ ] Used deterministic transaction_id pattern (not random UUID)
- [ ] Did not modify rate card for a single-customer need
- [ ] Did not skip mock invoice / blast radius step

## Output verification

What was created in Metronome? Check via dashboard or API.

### Objects created/modified

| Object type | Name/ID | Correct? | Issue (if any) |
|---|---|---|---|
| Billable metric | | [ ] Yes [ ] No | |
| Product | | [ ] Yes [ ] No | |
| Rate card | | [ ] Yes [ ] No | |
| Rate(s) | | [ ] Yes [ ] No | |
| Customer | | [ ] Yes [ ] No | |
| Contract | | [ ] Yes [ ] No | |
| Commit/Credit | | [ ] Yes [ ] No | |
| Override | | [ ] Yes [ ] No | |

### Configuration checks

- [ ] Billable metric event_type_filter matches event schema
- [ ] Billable metric aggregation_type correct for the use case
- [ ] Group keys include all pricing dimensions
- [ ] Rate amounts in cents (not dollars)
- [ ] Contract references correct rate card
- [ ] Commit/credit access schedule dates are correct
- [ ] Commit/credit product scope is correct (global vs. scoped)

## Invoice verification (the money test)

| | Expected (mock) | Actual (draft) | Match? |
|---|---|---|---|
| Line item 1 | $ | $ | [ ] |
| Line item 2 | $ | $ | [ ] |
| Line item 3 | $ | $ | [ ] |
| Credits/commits applied | -$ | -$ | [ ] |
| **Total** | **$** | **$** | [ ] |

## Overall result

- [ ] **PASS** — workflow followed, objects correct, invoice matches
- [ ] **PARTIAL** — workflow mostly followed, minor issues noted below
- [ ] **FAIL** — significant deviation or incorrect output

## Notes

### What went well

### What went wrong

### Skill improvements needed

### New test cases suggested
