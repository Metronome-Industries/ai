# Dogfood testing framework

Manual testing framework for the `metronome-plg-billing` skill. A human tester plays the PLG founder role, interacts with the agent, and evaluates both the interaction process and the actual Metronome objects created.

## How to run a test

### Prerequisites

* Access to a Metronome sandbox (staging API)
* Claude Code with the `metronome-plg-billing` skill loaded
* Sandbox pre-seeded per the scenario's **Setup** section (if applicable)

### Steps

1. Pick a scenario from `scenarios/`
2. Complete any sandbox setup described in the scenario
3. Copy `scorecards/template.md` to `runs/{date}-{scenario-name}.md`
4. Open a fresh Claude Code session with the skill active
5. Paste the **Opener** prompt from the scenario
6. Respond to the agent's questions using the **Founder responses** script
7. Let the agent implement (if the scenario reaches implementation)
8. Fill out the scorecard by checking objects in the Metronome dashboard or via API
9. Run the **Money test** if the scenario reaches invoice verification

### Scoring guidance

* **Process signals**: Did the agent follow the skill's prescribed workflow? Every unchecked box is a skill failure — either the guardrail wasn't strong enough or the routing was wrong.
* **Correction signals**: Did the agent avoid the known traps? These are the high-value checks — the whole skill exists to prevent these failures.
* **Output verification**: Are the Metronome objects correctly configured? Check via dashboard or API.
* **Invoice verification**: Does the draft invoice match the expected mock? This is the definitive test.

### After the run

Note in the scorecard:
* What surprised you (good or bad)
* Where the agent deviated from the expected flow
* Where the skill's guidance was insufficient or excessive
* Any new corrections or guardrails that should be added

### Iterating on the skill

After accumulating 3-5 runs:
1. Identify patterns in failures (same guardrail missed repeatedly → strengthen it)
2. Identify unnecessary guidance (agent always gets it right → consider removing)
3. Update the skill and re-run the failing scenarios to confirm the fix
