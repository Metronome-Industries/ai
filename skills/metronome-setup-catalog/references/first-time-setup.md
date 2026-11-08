---
public: true
hidden: true
---

# First-time setup

Guide a user who is new to Metronome from "what do I charge for?" to a draft invoice. This reference changes how you talk to the user, not which API calls you make: follow Steps 1–7 in `SKILL.md` for every write.

Use it when the user says they are onboarding, getting started, or new to Metronome, or when they arrive from the onboarding wizard. The wizard's prompt is: "I'm onboarding to Metronome in my sandbox environment. Help me get started."

---

## Environment

The onboarding wizard creates a sandbox API key. Objects created in sandbox do not bill real customers. When the user says they are onboarding in their sandbox, that is confirmation of the environment — do not ask again.

If the user did not come from the wizard and has not named an environment, ask before writing, as `SKILL.md` requires.

## The user is watching a live checklist

Users who came from the wizard have a Metronome tab open that shows a box for each object type. A box gets a check mark as soon as at least one object of that type exists in sandbox:

1. Billable metrics
2. Products
3. Rate cards
4. Customers
5. Contracts

When all five boxes are checked, the **View draft invoice** button becomes clickable. Creating objects in the `SKILL.md` order fills the checklist from top to bottom.

---

## Conversation flow

### 1. Ask what they charge for

Ask about the two kinds of charges the wizard uses. Offer the examples if the user is unsure.

* **Flat fees** allow you to charge for seats, prepaid credits, and more. Examples: seat-based charge, platform fee.
* **Usage fees** are based on usage events you send to Metronome. Examples: CPU hours, GPU hours, API calls, input tokens, storage, bandwidth.

Then map the answer to a pattern using the "Match pricing intent to Metronome architecture" reference in the `SKILL.md` routing table.

**Every first-time setup needs at least one usage fee.** Flat fees have no billable metric, so a setup with only flat fees can't complete Step 7 in `SKILL.md`, and the Metronome tab's checklist never checks its billable metrics box. If the user only describes flat fees, explain this and ask whether they have a usage-based charge. If they don't, offer the Compute Hours usage fee from [Defaults](#defaults). The onboarding wizard applies the same rule: it adds Compute Hours whenever a setup has no usage fee.

### 2. Confirm the plan before writing

List every object you will create, with a count and a name for each, using the terms in the glossary below. Include any usage fee you added under the rule above, so the user approves it explicitly. Tell the user: "I will now create Metronome objects corresponding to these settings." Wait for confirmation before the first write.

### 3. Explain each object as you create it

Before each step, explain the object in one sentence using its glossary description, word for word. These are the same descriptions the user sees in the Metronome tab, so the terminal and the screen agree.

### 4. Verify, then send the user back to Metronome

Complete Step 7 in `SKILL.md`. Once a draft invoice line item appears, tell the user to return to the Metronome tab and click **View draft invoice**.

---

## Glossary

Use these descriptions exactly. They match the onboarding wizard.

| Object | Description |
| --- | --- |
| Billable metric | Convert raw usage events into an amount of usage. |
| Product | Define what you charge for. |
| Usage fee (a usage product) | Charge based on how much a customer uses. |
| Flat fee (a subscription product) | Charge a flat fee. |
| Rate card | Contains a set of products and their default prices. |
| Customer | The entity that you bill. |
| Contract | Defines how you bill a given Customer. |

Supporting explanations from the wizard:

* **Rates:** "These are your base prices. They can be overridden when they are applied to a contract."
* **`entitled`:** "When 'on' this line item will appear on Customer Contracts by default." When off, the line item must be enabled manually on a contract.
* **Unit price:** "Unit price is multiplied by quantity to calculate total due for this line item."

---

## Defaults

If the user does not know what to charge, or asks for defaults, offer the wizard's example settings. All flat fees bill monthly in USD. API prices are in cents.

| Product | Type | Price | API `price` | Quantity on contract | `entitled` |
| --- | --- | --- | --- | --- | --- |
| Standard Seats | Flat fee | $30 | `3000` | 20 | `true` |
| Pro Seats | Flat fee | $100 | `10000` | 0 | `false` |
| Platform Fee | Flat fee | $1,000 | `100000` | 1 | `true` |
| Professional Services Plan | Flat fee | $4,000 | `400000` | 1 | `true` |
| Credit purchase | Flat fee | $100 | `10000` | 1 | `true` |
| Compute Hours | Usage fee | $1 per unit | `100` | — | `true` |

Compute Hours uses a billable metric named "Compute Hours" that sums `duration_seconds` on events with `event_type` `compute_usage`, grouped by `hardware_tier`. It has one rate for each `hardware_tier` value: `small`, `medium`, and `large`. Flat fee (subscription) rates and pricing group keys are covered by the "Set default pricing" and "Define invoice line items" references in the `SKILL.md` routing table.

Show the defaults in the confirmation summary from step 2. Displaying a default is not approval.

---

## Out of scope

Connecting Stripe and sending an invoice to Stripe happen in the Metronome app after the draft invoice. Point the user back to the Metronome tab for those steps.
