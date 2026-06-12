# Metronome AI

AI skills and plugin infrastructure for Metronome, Stripe's usage-based billing platform.

This repo contains AI coding assistant skills that encode Metronome best practices, integration patterns, and common pitfalls. Skills are consumed by IDE plugins (Claude, Cursor) to provide context-aware guidance when building Metronome integrations.

## Skills

Skills live in [`skills/`](skills/) and follow a standard format:

* `SKILL.md` — Main skill definition with YAML frontmatter, integration routing table, critical rules, and documentation links
* `references/` — Supporting reference documents with detailed guidance on specific topics

### Available skills

| Skill | Description |
|-------|-------------|
| [metronome-best-practices](skills/metronome-best-practices/) | Event ingestion, contracts, rate cards, invoicing, credits/commits, and Stripe integration |
| [metronome-setup-catalog](skills/metronome-setup-catalog/) | Set up the shared pricing catalog — billable metrics, products, and rate cards |
| [metronome-create-customer](skills/metronome-create-customer/) | Create a new customer record with name, ingest alias, Salesforce ID, and Slack channel |
| [metronome-create-contract](skills/metronome-create-contract/) | Create a contract from signed order form terms — commits, credits, and rate overrides |
| [metronome-commit-health](skills/metronome-commit-health/) | Analyze prepaid commit burn rate, overrun risk, and breakage risk for a customer |
| [metronome-anomaly-detection](skills/metronome-anomaly-detection/) | Scan a customer list for billing anomalies — MoM spend variance, stuck DRAFTs, commit burn spikes |
| [metronome-portfolio-briefing](skills/metronome-portfolio-briefing/) | Monthly portfolio report combining commit health, renewal dates, and anomaly checks |
| [metronome-renewal-prep](skills/metronome-renewal-prep/) | Renewal brief with contract terms, trailing consumption, burn rate, and pricing scenarios |

## Documentation

* [Metronome Documentation](https://docs.metronome.com/)
* [API Reference](https://docs.metronome.com/api-reference/)
* [Stripe Integration Guide](https://docs.metronome.com/integrations/stripe/)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add or modify skills.

## License

[MIT](LICENSE)
