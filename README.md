# Metronome AI

AI agent skills for [Metronome](https://metronome.com), the usage-based billing platform.

These skills encode Metronome best practices, integration patterns, and the pitfalls that are easy to hit and hard to debug. Point a coding agent at them and it gets context-aware guidance for building on Metronome instead of guessing at API shapes.

> **This directory is generated.** The source of truth for `skills/` is `docs/skills/` in the private `Metronome-Industries/api` repository. Pull requests that edit `skills/` here will be closed — the next sync overwrites them. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to propose a change.

## Using the skills

Install every skill straight from the docs site, no clone required:

```bash
npx skills add https://docs.metronome.com
```

Or install one:

```bash
npx --yes skills add https://docs.metronome.com --skill metronome-best-practices --yes
```

You can also point an agent at a skill by URL, for example `https://docs.metronome.com/.well-known/skills/metronome-best-practices/SKILL.md`. The machine-readable index of everything available is at [`/.well-known/skills/index.json`](https://docs.metronome.com/.well-known/skills/index.json).

## Available skills

<!-- BEGIN SYNCED SKILLS -->
| Skill | Description |
|-------|-------------|
| [metronome-best-practices](skills/metronome-best-practices/) | Guides Metronome usage-based billing integration decisions — event ingestion (single and batch, idempotency, billable metrics), contract design (rate cards, overrides, dimensional pricing, products... |
| [metronome-create-contract](skills/metronome-create-contract/) | Creates a Metronome contract for an existing customer from signed order form terms — commits, credits, and rate overrides. |
| [metronome-create-customer](skills/metronome-create-customer/) | Creates a new customer record in Metronome with name, ingest alias, Salesforce ID, and Slack channel. |
| [metronome-csm-reviews](skills/metronome-csm-reviews/) | Customer health reviews for CSMs — anomaly detection (MoM spend variance, stuck DRAFT invoices, commit burn spikes), commit health (burn rate, overrun and breakage risk for a single customer), port... |
| [metronome-group-keys](skills/metronome-group-keys/) | Designs group_keys for a billable metric across pricing, invoice presentation, spend breakdowns, seat-based credits, and usage alerts — and flags cardinality risk (a combined key's cost is the prod... |
| [metronome-plg-billing](skills/metronome-plg-billing/) | Guides PLG founders through billing setup, pricing changes, and customer diagnostics on Metronome. |
| [metronome-setup-catalog](skills/metronome-setup-catalog/) | End-to-end Metronome setup from pricing intent to a verified live contract — billable metrics, products, rate card, customer, and contract in order. |
| [metronome-token-billing](skills/metronome-token-billing/) | Set up and verify Metronome Token Billing for an AI application through public APIs. |
| [stripe-to-metronome-migration](skills/stripe-to-metronome-migration/) | Guides migration from Stripe Usage-Based Billing (Billing Meters and Subscriptions) to Metronome. |
<!-- END SYNCED SKILLS -->

Each skill is a `SKILL.md` with YAML frontmatter, plus a `references/` directory for the detail that only matters once you are on a specific path. The `SKILL.md` routes to the right reference so an agent loads what it needs rather than everything.

Reference files are linked by absolute `docs.metronome.com` URL. That is deliberate: the docs site serves only `SKILL.md` for each skill, so a relative link would resolve for someone who cloned this repo and break for everyone installing from the docs site.

## Documentation

* [Metronome documentation](https://docs.metronome.com/)
* [API reference](https://docs.metronome.com/api-reference/)
* [Agent-friendly doc index](https://docs.metronome.com/llms.txt)
* [Stripe integration guide](https://docs.metronome.com/integrations/stripe/)

## License

[MIT](LICENSE)
