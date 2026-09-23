---
name: metronome-token-billing
description: Set up and verify Metronome Token Billing for an AI application through public APIs. Use when an agent needs to model one or more AI plans, including fixed fees, postpaid token usage, included or prepaid credits, top-ups, custom pricing units, usage dimensions, selected models and markup; create or update the managed rate card and packages; provision a customer; integrate usage reporting; or validate the Stripe and Metronome billing flow. Do not use for unrelated Metronome pricing models.
---

# Set up Metronome Token Billing through APIs

Build one working integration in the merchant's chosen environment. Use public APIs for API-addressable configuration and use the Metronome UI only for user-authenticated flows such as OAuth. Treat this skill as the orchestration layer over the current [Token Billing guide](https://docs.metronome.com/guides/pricing-packaging/billing-model-guides/token-billing) and public API reference. Follow the linked schemas instead of copying generic object definitions into the integration.

Use the [agent-friendly documentation index](https://docs.metronome.com/llms.txt) to discover current Metronome documentation when the linked pages do not cover a required operation. Prefer the direct links below for known steps, and do not invent undocumented API behavior.

For changes to an existing rate card, follow [Add models to an existing rate card](#add-models-to-an-existing-rate-card) or [Update markup on an existing rate card](#update-markup-on-an-existing-rate-card). Reuse the report and credential-validation guidance, and limit discovery and writes to the requested change. Before writing, capture the baseline and expected state described in [Verify model additions and markup changes](#verify-model-additions-and-markup-changes), then perform that verification after writing. These workflows use their own confirmation steps and concise completion message; the new-integration confirmation summary, customer-integration workflow, and setup handoff do not apply to them.

## Ask for choices and confirmations

Use the agent's structured user-question tool when available and permitted for the current interaction, including plan discovery, rate-card selection, markup choices, and rate approval. Otherwise, ask in chat and wait for a reply. Bundle related onboarding choices into a compact prompt and ask conditional follow-ups only for a pricing pattern the user selected. For an existing card's markup choice, offer its stored percentage or a different percentage, with a way to enter that value.

For a new integration, the user may skip any commercial choice other than the model scope. Apply only the disclosed defaults in [Discover plans and commercial terms](#discover-plans-and-commercial-terms), show them in the compact confirmation summary, and require the user to confirm the summarized business model and model selection before writing. Keep the exact object plan and price calculations in the internal report unless the user asks for them. A displayed or preselected default, an unanswered question, or elapsed time is not approval. For an existing-card addition or markup change, retain the explicit choice and approval rules in those workflows.

While waiting, continue only read-only work that does not depend on the answer, such as reading API documentation. Reuse answers and approvals already supplied for the current request, and do not ask the user to repeat information visible in a pricing page, repository, run report, or accessible remote state.

## Signpost codebase research

For a new integration, before creating the initial report or inspecting the repository, tell the user:

> First, I'm going to research your codebase to understand how your application is set up. I'll use what I learn to guide you through getting Token Billing set up, including pre-suggesting models and integration choices where possible.

Then begin the research without asking commercial questions yet. This message sets the expectation that the agent will return to guide the user after discovery; it is not a confirmation summary or approval request. Do not repeat it when resuming from an existing report or when performing a scoped model-addition or markup-change workflow.

## Start a persistent run report

Treat a report path supplied in the invocation as an optional input. If it exists, read it first, verify its target and current state, and resume from its last checkpoint without repeating resolved questions or completed operations. If it does not exist, create it. When no path is supplied, create a uniquely named report in the operating system's temporary directory, such as `/tmp/metronome-token-billing-report.md`.

Use the report as the durable record and resumable state for the run and any follow-up promotion. Record local findings and evidence, inferred decisions, unresolved questions, the approved plan, target environment, pricing calculations, credential-binding validation without values, every operation, and the next safe action. Append corrections and later-environment results instead of overwriting earlier history.

For custom field keys, billable metrics, products, rate cards and rates, packages, customers, contracts, and webhooks, record the action, role, name, ID or stable key, alias, API result, and a verified dashboard link. If an item has no deep link or ID, link its parent or nearest dashboard list and identify it by its composite key.

Keep secrets and unnecessary customer data out of the report. Record failures, workarounds, and unclear documentation as they occur, then use the report as the source for the final friction log. Keep the report and its path internal throughout research and guided onboarding: do not present, link, dump, or summarize the report to the user. For new integrations, return its path only at final handoff. For model additions and markup changes, keep the path internal unless the user asks for it.

## Inspect, infer, and conduct concise plan-first onboarding

Inspect the application before asking setup questions. Discover its language and framework, billing ownership, identity model, persistence, existing API clients, LLM call sites, token-count sources, retries, and background-job or outbox patterns. Do not ask for information that the repository or read-only remote state can answer.

Check whether the required environment-variable or approved secret-manager bindings exist without reading their values. Use each available credential for its own read-only discovery and validation; do not require both credentials before doing the discovery that one can support.

Infer concrete defaults from repository conventions and accessible Metronome and Stripe state. Choose names, stable aliases, identity mappings, SDK or HTTP usage, event hooks, transaction IDs, delivery behavior, retries or existing job infrastructure, error handling, and object reuse instead of asking the user to choose implementation tactics. Clearly distinguish inferred choices from facts. Carry these findings through every later skill step: introduce relevant evidence when the corresponding question arises, such as pre-suggesting discovered models during model selection or proposing the application's existing durable-delivery pattern during integration planning.

If the user supplies a pricing-page URL, screenshot, document, or existing plan configuration, inspect it before asking commercial questions. Extract plan names, prices, intervals, included usage, overage or top-up terms, and customer-facing units. Treat ambiguous or absent details as unresolved rather than inventing them, and show every inferred term for correction. A pricing-page artifact may answer most of the onboarding questions; do not ask them again individually.

### Discover plans and commercial terms

After repository and read-only account research has populated the internal report, do not show the report or lead with a findings dump. Say:

> I have the background information I need. Now I'm going to guide you through getting Token Billing set up.

Then begin the guided questions. Start with the pricing model, and explicitly offer two paths: the user can describe their plans, or share a screenshot or URL of their pricing page for the agent to use as the starting point. If they share one, inspect it, present the inferred terms for correction at the relevant steps, and avoid repeating questions it already answers.

Ask for or infer the following in order, compactly and with plain-language explanations so the user does not need prior Metronome knowledge:

1. **Pricing model and plans:** Ask which customer-facing plans should be represented, such as Starter, Pro, or Enterprise, or invite the user to share a pricing-page screenshot or URL instead. Preserve all named plans rather than collapsing them into one. Explain that each plan may combine these patterns:
   - **Postpaid usage:** charge after use from the managed token rates, with no recurring commitment.
   - **Recurring fixed fee:** charge a fixed amount on a stated interval; ask for amount and interval only when selected.
   - **Prepaid credit packs:** collect payment before use and burn down a balance; ask for pack price, credited balance, expiration, and whether purchase is manual or triggered at a threshold only when selected.
2. **Included AI usage:** Ask whether each plan grants an allocation and, only when it does, ask for the amount, reset cadence, and whether the customer sees USD or a named custom pricing unit such as AI credits.
3. **Models and markup:** Resolve model literals and aliases found during codebase research against the catalog, then present the canonical catalog IDs as the initial selection. Successful alias resolution is an internal implementation detail; surface only unresolved or ambiguous values that require a decision. Require the user to confirm or correct the model scope. Ask for one default markup and optional model-specific overrides. Do not repeat this question when the user already supplied the answer.
4. **Usage dimensions:** Ask whether the application should send additional stable keys such as `tenant_id`, `workspace_id`, or `task_id`. Explain briefly that billable-metric group keys are immutable: choosing no extra dimensions is valid, but adding or changing them later requires migrating metrics and managed products rather than toggling a setting. For each requested key, distinguish analytics-only breakdown from invoice breakout. Ask only for the keys the user actually wants; do not propose an exhaustive taxonomy.

If the user skips an optional choice, use these defaults: one plan named from the application or rate card; postpaid usage only; no fixed fee, included allocation, prepaid balance, top-up, or extra usage dimension; USD customer-facing balances and rates; zero token markup with no model override; and Metronome invoice delivery to Stripe. Defaults are proposals, not acceptance, and must appear in the compact confirmation summary.

Follow up only for a missing value required to encode a pattern the user selected. Do not interrogate the user about fixed fees, credit packs, allocations, custom units, or invoice grouping when that feature is not part of their plans. Tell the user that omitted commercial terms can generally be added later, but do not describe usage dimensions or invoice-breakout keys as simple later add-ons; changing those requires a metric-and-product migration.

Resolve the model scope from user intent before falling back to repository inference. Resolve application model literals as aliases before interpreting a value as an author, family, or provider request. Compare each discovered value with every catalog `id` and `model` in this order:

1. exact string equality;
2. case-insensitive equality; then
3. separator-normalized equality.

For separator normalization, lowercase and trim the value, replace each run of periods, underscores, hyphens, or whitespace with one hyphen, and leave other characters unchanged. Do not drop version components, dates, size markers, or arbitrary prefixes. For example, application alias `claude-opus-4-6` and catalog model `claude-opus-4.6` both normalize to `claude-opus-4-6`. Deduplicate `id` and `model` matches that refer to the same catalog record. Use alias normalization only when it produces exactly one catalog model. If multiple catalog models share the normalized value, show the candidates and ask the user instead of choosing. If no catalog model matches, keep the application value in the unresolved-model list and ask the user; never silently omit a discovered model.

Persist every successful mapping as `application value -> catalog id and model`, including the match method. Use the catalog's canonical `id` value—not its shorter `model` value or the application alias—for the `model` pricing-group value on managed rates and the `model` property on token-usage events. For example, use `anthropic/claude-opus-4.6`, not `claude-opus-4.6`. The application may continue using its provider-facing request name. Keep successful mappings in the internal report. Show only unresolved or ambiguous values when the model-selection question or confirmation summary is reached, because those require user action.

Exact model IDs or names supplied by the user select those models. Normalize obvious shorthand and family labels against catalog author and model fields, such as `OAI` to OpenAI and `Gemini` to Google's Gemini models. When the user names only a model author, family, or serving provider, select every current catalog model that matches that term and has a supported current price; retain every current provider endpoint unless the user constrained the serving provider. Do not choose one representative model, the newest model, or an arbitrary subset. If a term could match different author, family, or serving-provider scopes, put the candidates under `Needs your input` instead of choosing silently. Otherwise, show only the canonical selected catalog IDs in the confirmation summary.

Represent the approved plans over one shared managed token-rate layer whenever their model prices and denomination are compatible. Model reusable named plans as packages, with ordinary fixed or subscription products plus credits or commits for their approved commercial terms. Keep AI-managed products and rates separate from those ordinary plan products. Use a direct contract without a package only for a genuinely one-off pay-as-you-go setup that the user does not want represented as a reusable named plan.

After the guided questions have resolved the selected commercial terms, send one concise confirmation summary. Do not mention or link the internal report, show implementation status tables, or expose detailed object inventories, model price calculations, provider endpoints, or token types unless the user asks. Keep the tone warm, clear, and direct, with minimal Metronome jargon. Begin with: "I have your Token Billing setup mapped out. Here’s what I have."

Use these sections in order:

1. **`### Business model`** — Summarize each named plan and its price. For each plan, include only the terms that apply: included AI credits or usage, the AI-credit-to-fiat conversion when a custom pricing unit is used, reset or expiration behavior, hard-stop behavior, and overage or top-up behavior. Use short bullets; when there are many plans, use a compact plan table followed by shared terms. Flag any inconsistent or ambiguous terms under `Needs your input` instead of silently reconciling them.
2. **`### Models`** — List canonical catalog IDs compactly. For a long list, group them by model author or family rather than giving every model its own status row. State the common markup once, then list only model-specific overrides. Do not show model prices, provider endpoints, token types, or successful application-alias mappings unless the user asks. Put only unresolved or ambiguous aliases under `Needs your input` with the smallest useful set of candidates.
3. **`### What I'll set up`** — Start with the broad Metronome outcome: set up the approved pricing plans and Token Billing rates. Then give a short list of application changes inferred from the codebase, such as canonical catalog-ID reporting, authoritative token counts, durable event delivery, balance enforcement, or top-up handling. Always state the chosen usage-dimension schema, including when there are no extra dimensions, because changing it later requires a metric-and-product migration. Mention the target environment naturally here when it matters. Avoid listing individual Metronome object types or counts unless the user asks.
4. **`### Before I can get started`** — Include this section only when a prerequisite or required decision is incomplete. Show only the incomplete items and one clear action for each; omit ready accounts, credentials, and connections. Never ask the user to paste a secret. End by asking the user to complete those items and tell the agent when they are ready. Do not use `Proceed` as the call to action and do not create Metronome objects or modify the application until the prerequisites have been rechecked. If no prerequisites or required decisions remain, omit this section and ask the user to confirm the compact business-model and model summary before starting.

The confirmation summary is a decision and prerequisite checkpoint, not a progress report. Keep ready-state evidence, credential validation, remote-object counts, exact IDs, alias-resolution details, catalog rows, price calculations, and implementation evidence in the persistent report.

Assume Metronome will deliver invoices to Stripe. Do not ask the user to choose an invoice destination unless they explicitly challenge that default; treat opting out as a correction rather than a required answer.

After the user completes the listed prerequisites, revalidate them before implementation. Record the answers and resolve the exact Metronome objects and prices internally. If the user has not yet confirmed the compact business-model and model summary, ask for that confirmation before writing; do not replace it with a detailed rate or object table. For production, ensure the summary clearly names the production target and the broad planned changes covered by the confirmation. Do not ask the user to confirm implementation details already approved. Ask another question only when an unresolved selected-pattern term, new remote state, failed validation, or a material safety blocker makes the approved plan impossible; interactive authentication or consent may still require participation at the identified browser handoff.

Markup is exclusively the merchant's choice. Never recommend a percentage or describe one as typical, standard, safe, or preferred. For a new integration, use 0% only when the user deliberately skips markup and show that default before approval. Unless the user specifies an exception, apply the common markup to every selected model and to models added later; record optional model-specific overrides separately. Markups must produce a positive price. Use USD as the rate card's fiat currency; customer-facing token rates and balances may use an approved custom pricing unit with a USD conversion.

## Bootstrap and validate credentials

Credential setup belongs in `Before I can get started`, not in a surprise follow-up after commercial confirmation. Reuse an existing approved server-side binding when possible without reading or copying its value.

- Require `METRONOME_BEARER_TOKEN` before Metronome discovery or writes. It must target the selected environment and permit the operations in the approved plan. If absent, include [create a Metronome API token](https://docs.metronome.com/api-reference/authentication) under `Before I can get started`.
- Require `STRIPE_SECRET_KEY` before fetching the model catalog. It must be a secret API key for the intended Stripe account and mode, never a publishable key. If absent, include [manage Stripe API keys](https://docs.stripe.com/keys) under `Before I can get started`.

Tell the user to expose missing credentials through the agent's environment or secret settings and respond when ready, never to paste values into chat. If the running agent cannot inherit variables added afterward, write the resolved decisions and confirmation summary to the report and tell the user how to restart from the configured environment without repeating discovery. This restart handoff is the only onboarding case in which the report path may be disclosed.

Do not print or inspect secret values, enable shell tracing, place literal keys in tool calls, extract a newly created key from the browser, or create or modify a secret file unless the user explicitly requests it and confirms that the file is excluded from source control.

Validate each credential with its first required read-only request: list Metronome custom-field keys and fetch Stripe's model catalog. When a binding was already available, perform this validation during discovery and keep the ready-state evidence in the internal report. Reference only environment-variable names in commands. Treat `401` or `403` as a credential or permission failure and stop before writes. Record only the binding name, selected environment and mode, and validation result in the run report.

Verify that the credentials match the selected target before mutating it. Default to sandbox when the user has not clearly selected an environment. For production changes, name the production target and the broad planned changes in the confirmation summary and obtain explicit approval; never silently switch a sandbox run to production. If the user declines or cannot provide a required credential, offer a dry-run plan and safe local application scaffolding, but do not create remote objects or claim authoritative prices.

## Connect Stripe for invoice delivery

The Stripe key used to read model prices does not connect the Stripe and Metronome accounts or route invoices. When Stripe invoice delivery is in the approved plan, identify the key's Stripe account with a read-only Stripe account request, then call `POST /listConfiguredBillingProviders` before provisioning customers. Reuse a Stripe delivery method only when its `stripe_account_id` matches that account and the user-selected target. Skip Stripe invoice routing only when the user explicitly opted out.

If no matching connection exists, assist with the browser flow described in [Invoice with Stripe](https://docs.metronome.com/integrations/invoice-integrations/stripe):

1. Confirm the target Metronome environment and intended Stripe account and mode.
2. With browser capabilities, open `https://app.metronome.com/sandbox/developer/integrations` for sandbox or `https://app.metronome.com/developer/integrations` for production and navigate to the Stripe connection action. Without browser capabilities, give the user the corresponding link and wait.
3. Have the user authenticate, select the Stripe account, complete any two-factor challenge, review the requested access, and grant consent. Never ask for credentials, verification codes, or recovery codes.
4. Start from the Metronome integrations page; do not construct a Stripe authorization URL or capture its authorization code. Metronome generates the OAuth state, selects the environment-specific client ID and redirect URI, and handles the callback.
5. After the callback, call `POST /listConfiguredBillingProviders` again. Verify the returned `stripe_account_id`, record its non-secret `delivery_method_id` and dashboard link, and stop on a mismatch or failed connection.

OAuth establishes the account-level connection only. Complete the customer and contract routing in the customer-integration section.

Keep Metronome as the source of truth for the catalog, prices, subscription plans, contracts, entitlements, token metering, credits and commits, balance burndown, and invoice generation. Stripe is the payment-collection rail: use its Customer, payment methods, and Metronome-delivered invoices, but do not create Stripe Prices, Subscriptions, meters, or usage records for the Token Billing integration. Create or reuse a Stripe Product only when a documented Metronome-to-Stripe invoice mapping requires one, such as a payment-gated commit, and treat it solely as invoice-line mapping metadata rather than a parallel plan. Aggregation or invoice latency is not a reason to duplicate the plan or meter in Stripe.

## Orchestrate the managed rate card

Use `https://api.metronome.com/v1` for Metronome requests unless the user supplies another API base URL. Before every create call, list or retrieve existing objects and reuse only an exact semantic match. Persist every returned ID so a retry can resume after a partial failure.

### 1. Read and normalize Stripe's model catalog

Request `GET https://llm.stripe.com/v1/models` with the Stripe secret key as Bearer authentication and `Accept: application/json`. Use a 10-second timeout and retry only transient network failures, `429`, and `5xx` responses, with at most three attempts and backoff.

For each model in `data`:

1. Require non-empty `id`, `model`, `author`, and at least one endpoint with `provider` and a supported current price.
2. Accept only `input`, `output`, `cached_input`, and `cached_write` `usage_type` values.
3. For each `(model id, provider, usage type)`, select the price with the latest `valid_from` not later than the fetch time. Treat a missing `valid_from` as currently effective but older than a timestamped price. Ignore scheduled future prices and unknown usage types.
4. Interpret `unit_amount_major_units` as USD per individual token. Preserve it as a decimal; do not round through binary floating point.
5. Resolve repository model aliases against the complete supported catalog before filtering it, using the ordered exact, case-insensitive, and separator-normalized rules above. Keep the canonical model IDs selected by the user-intent and repository-inference rules. For an author-, family-, or provider-only request, include all matching current models rather than reducing the set. Calculate the snapshot watermark from the full supported catalog. Use the greatest supported `valid_from`, capped at the fetch time; use the fetch time when no supported price has a timestamp.

Stop if a selected model disappeared, has no supported current prices, a discovered application alias remains unresolved, or the response shape changed. Keep application-to-catalog mappings, provider and token-type rows, base prices, denomination, and calculated rates in the internal report. Before writing Metronome configuration, show the user the compact canonical-catalog-ID and markup summary described above; expose the detailed catalog and rate calculations only when requested.

Use the exact catalog snapshot the user reviewed and approved for the write phase; do not silently refetch prices or add models during submission. If a refetch is necessary, recompute the proposal and reconfirm changed writes.

### 2. Ensure the managed custom-field keys

Use the [Custom fields API](https://docs.metronome.com/api-reference/custom-fields) to list keys, then create only missing keys with `enforce_uniqueness: false`. These exact keys are the Token Billing managed-sync contract:

| Entity             | Key                          | Value on creation                                   |
| ------------------ | ---------------------------- | --------------------------------------------------- |
| `rate_card`        | `ai_managed`                 | `"true"`                                            |
| `rate_card`        | `ai_managed_last_updated_at` | catalog snapshot watermark as an ISO 8601 timestamp |
| `rate_card`        | `default_ai_markup`          | default markup as a decimal fraction                |
| `contract_product` | `ai_managed`                 | `"true"`                                            |
| `contract_product` | `ai_markup`                  | that model's markup as a decimal fraction           |

Store percentages as decimal fractions by dividing the approved percentage by 100. During initial setup, write each model's resolved markup—its override when supplied, otherwise the common markup—to that model's products, and write the common markup to the new rate card's `default_ai_markup`. Ensuring key definitions does not authorize changing values on existing products or rate cards; follow the relevant addition or markup-change workflow for those objects. The rate-card field persists the common policy for products added later by managed sync; model overrides belong only on the affected products. A product's field applies to that model and token type. Use the exact entity, key, casing, and string value; otherwise the object will not participate correctly in managed updates.

Store `"0"` when the user intentionally leaves the optional default markup blank.

### 3. Ensure one shared billable metric per token type

For every token type present in the selected catalog rows, find an active billable metric with the exact semantic definition below, extended with the approved usage dimensions. Reuse it even if its display name differs. Billable metrics and their group keys are immutable, so create a new compatible shared token-type metric when an existing metric lacks a requested dimension. Use the [Create billable metric API](https://docs.metronome.com/api-reference/billable-metrics/create-a-billable-metric).

| Token type     | Suggested name           | Aggregation key       |
| -------------- | ------------------------ | --------------------- |
| `input`        | `AI input tokens`        | `input_tokens`        |
| `output`       | `AI output tokens`       | `output_tokens`       |
| `cached_input` | `AI cached input tokens` | `cached_input_tokens` |
| `cached_write` | `AI cached write tokens` | `cached_write_tokens` |

Build one ordered compound group key containing `model`, `provider`, then every approved analytics-only or invoice-breakout key once. For example, if `tenant_id` is invoice-visible and `task_id` is analytics-only, use `[["model", "provider", "tenant_id", "task_id"]]`. This makes both dimensions available downstream while the product continues to price only by model and provider. With the public REST API, use:

- `event_type_filter: {"in_values": ["token-billing"]}`;
- `aggregation_type: "SUM"` and `aggregation_key` set to the corresponding token property;
- `property_filters` containing `{name, exists: true}` for `model`, `provider`, the aggregation key, and each approved extra key that every matching event must send;
- `group_keys` containing the ordered compound key described above.

Do not create one metric per model or per plan. Compare the complete filter, aggregation, aggregation key, and group-key structure before reusing a metric. Do not add speculative dimensions: group keys cannot be amended later, and high-cardinality invoice keys can create large invoices.

### 4. Create one usage product per model and token type

For every selected `(model, token type)` with at least one provider price, create a [usage product](https://docs.metronome.com/api-reference/products/create-a-product). All providers for the same model and token type share this product.

Set the following public API fields:

- `name` to `<model display name> <token type label> tokens`;
- `type` to `USAGE`;
- `billable_metric_id` to the shared metric for that token type;
- refundable behavior to its default of `true`;
- `tags` to include `ai_managed`;
- `pricing_group_key` to `["model", "provider"]`;
- `presentation_group_key` to the approved invoice-breakout keys, omitted when none were selected;
- `quantity_conversion` to divide by `1000000`, named `million tokens`;
- `custom_fields` to `{"ai_managed": "true", "ai_markup": "<fraction>"}` using the model markup decimal fraction.

Every property in `pricing_group_key` and `presentation_group_key` must appear together in the billable metric's compound group key. Keep analytics-only keys out of `presentation_group_key`; they remain available for usage analysis without splitting invoice lines. Warn before approval when an invoice-breakout key is high-cardinality, such as a task or run ID.

If resuming a partial run, recover a product mapping from an existing managed rate's model pricing-group value and the product's token-type metric. Do not reuse an unreferenced product by display name alone because names are not unique.

### 5. Ensure the pricing unit and create the rate card

If the user selected a custom pricing unit, resolve it before creating the rate card. List every page from `GET /credit-types/list` and reuse the active custom pricing unit with the exact chosen name. If none exists, create it with `POST /credit-types/create` and body `{"name": "<chosen name>"}`, then persist the returned `data.id`. Before retrying a create after an ambiguous response, list again and reuse the matching unit instead of risking a duplicate request. Use the resolved ID as `custom_credit_type_id` in the rate-card conversion and as `credit_type_id` on its rates.

Use the [Create rate card API](https://docs.metronome.com/api-reference/rate-cards/create-a-rate-card) with:

- the chosen name and alias;
- USD (cents), ID `2714e483-4ff1-48e4-9e25-ac732e8f24f2`, as `fiat_credit_type_id`;
- an optional conversion containing the existing custom pricing unit ID and its positive `fiat_per_custom_credit`;
- the three rate-card custom fields from step 2.

The UI asks for the value of one custom unit in major USD, but the public rate-card API expresses `fiat_per_custom_credit` in the rate card's fiat unit. Because this rate card uses USD cents, multiply the user-facing USD value by `100` for the API payload. For example, `$0.50` per credit becomes `50`. Record both values to prevent unit confusion.

### 6. Calculate and add rates

For every normalized `(model, provider, token type)` row, use the product for `(model, token type)` and calculate:

```text
marked_up_usd_per_token = unit_amount_major_units * (1 + model_markup_fraction)
usd_cents_per_million = marked_up_usd_per_token * 1_000_000 * 100
api_fiat_per_custom_credit = usd_major_per_custom_credit * 100
custom_units_per_million = usd_cents_per_million / api_fiat_per_custom_credit
```

Add the rates with the [Add rates API](https://docs.metronome.com/api-reference/rate-cards/add-a-rate). Set `rate_type: "FLAT"`, `entitled: true`, `price` to the calculated per-million amount, `pricing_group_values.model` to the exact catalog `id`, `pricing_group_values.provider` to the endpoint `provider`, and `credit_type_id` to USD or the selected custom pricing unit. Mirror the managed onboarding flow's initial `starting_at` value: `2025-01-01T00:00:00.000Z`.

Use decimal arithmetic and preserve precision. Rates in USD are expressed in cents; rates in a custom pricing unit are expressed in that unit. The product's divide-by-one-million conversion is why the rate is a per-million-token amount.

Before retrying `addRates`, retrieve the rate schedule and skip an existing semantic rate. Do not add duplicate `(product, model, provider, starting_at)` entries.

If the user selected ordinary usage, subscription, or composite products for this rate card, add their approved rates through the normal API in the same setup. Do not give those products Token Billing tags or managed fields. Every AI-managed rate must share one denomination; other products may use the rate card's fiat or any custom unit with a valid conversion.

## Complete the customer integration

Use existing docs for the remaining generic objects and application work:

1. Represent every approved reusable named plan with its own [package](https://docs.metronome.com/api-reference/contracts/create-a-package) over the shared managed rate card. Encode recurring fees with the appropriate fixed or subscription product and rate, included allocations with recurring credits or commits, and prepaid balances with commits denominated in the approved USD or custom pricing unit. Follow [Create a subscription](https://docs.metronome.com/guides/pricing-packaging/billing-model-guides/create-a-subscription) for recurring fees and [Prepaid credits](https://docs.metronome.com/guides/pricing-packaging/billing-model-guides/prepaid-credits) for pay-before-use balances. Keep the managed token rates as the usage prices that consume those balances. If a package should invoice through Stripe, set its billing provider to Stripe and its delivery method to direct billing-provider delivery. Skip packages only for an approved one-off postpaid setup.
2. Create or reuse a [customer](https://docs.metronome.com/api-reference/customers/create-a-customer) using a stable app-to-Metronome mapping. Do not use email as the durable identity.
3. If Metronome sends invoices to Stripe, create or reuse the Stripe Customer in the verified connected account. Set its ID and chosen collection method on the Metronome customer, either during customer creation or with the [customer billing-provider configuration API](https://docs.metronome.com/api-reference/customers/set-billing-provider-configurations-for-a-customer), using the matching `delivery_method_id`. Fetch the resulting configuration and persist its ID.
4. Create the [contract](https://docs.metronome.com/api-reference/contracts/create-a-contract) from the selected plan package, or directly for the approved one-off setup. Include any direct-contract subscription, recurring credit, or commit configuration. For a direct contract, explicitly attach the customer billing-provider configuration ID when Stripe invoice delivery is in scope. A package-provisioned contract cannot accept that customer-specific ID; it resolves the package's provider and delivery method to exactly one active customer configuration. Stop rather than guess if more than one matches. Preserve a pre-existing Stripe Subscription if the application already depends on it, but do not create or extend one for this integration; flag the duplicate source of truth in the report.
5. Follow the Token Billing guide's [usage event format](https://docs.metronome.com/guides/pricing-packaging/billing-model-guides/token-billing#integrate-usage-tracking). Set the event's `model` property to the resolved catalog `id`, then report the provider, authoritative token counts, and every approved extra dimension after routing or fallback. Source dimensions from stable application identifiers, use the exact approved key names, and ensure every event matched by the extended metric supplies them. Reuse one stable `transaction_id` on retries and send through a durable outbox when possible. Follow [Send usage events](https://docs.metronome.com/guides/events/send-usage-events) for delivery behavior.
6. For prepaid hard-stop behavior, keep a low-latency projection of Metronome entitlement or available balance in the application. Gate an LLM request on that local state, update the projection with the authoritative token counts, report the usage to Metronome, and reconcile from Metronome balances, payment webhooks, and alerts. Treat the local value as an operational cache, not a second financial ledger. Do not synchronously depend on invoice aggregation and do not introduce Stripe metering as a workaround. For a manual or threshold-triggered credit-pack purchase, follow [Payment-gated commits](https://docs.metronome.com/guides/pricing-packaging/apply-credits-and-commits/manual-payment-gated-commits); create the documented Stripe Product mapping if required, without a Stripe Price or Subscription. Implement only the approved purchase trigger and expiration behavior.
7. Configure lifecycle webhooks using [Set up webhooks](https://docs.metronome.com/guides/platform-configuration/setup-webhooks). If the current public API cannot create an endpoint, report the gap and provide the user the documented prerequisite; do not drive the UI.

## Validate before handoff

Retrieve the created objects and prove:

- every application model literal has one recorded canonical catalog mapping, no discovered alias remains unresolved, and controlled usage events send the canonical catalog `id` as their `model` property;
- every managed field key exists on the correct entity;
- each required token type has one exact shared metric;
- every selected model/token pair has one managed product with its markup;
- every selected model/provider/token row has one flat rate in a single shared rate denomination;
- the rate card uses USD as fiat and has a conversion for any custom rate denomination;
- every approved reusable named plan has its own package with the exact fixed fee, interval, included allocation, prepaid balance, top-up behavior, and denomination selected for that plan;
- each approved extra usage key exists in the metric's compound group key and the application event payload; analytics-only keys do not split invoices, while invoice-breakout keys appear in each managed product's `presentation_group_key`;
- any approved subscription, included allocation, prepaid balance, or top-up is represented by Metronome products, rates, package or contract terms, and credits or commits, with no new Stripe Price, Subscription, meter, or usage records;
- any Stripe-routed customer points to the intended Stripe Customer and delivery method, and the contract selects that customer billing-provider configuration;
- one controlled event in the target environment matches the intended metric and appears under the intended customer and contract;
- rerunning discovery and provisioning creates no duplicate objects or usage.

The hourly managed sync discovers rate cards from `rate_card.ai_managed = "true"`. It uses `ai_managed_last_updated_at` as its catalog watermark, `default_ai_markup` (or zero when absent) for newly created managed products, and product `ai_markup` with fallback to the default for rates on an existing managed product. It considers supported catalog rows with `valid_from` later than the watermark only when the author prefix of a catalog `id`, before `/`, already appears on the rate card. It adds new model, provider, or token-type rate keys at the sync hour and advances the watermark even when no eligible rows are added; author opt-in is therefore not retroactive. Existing `(catalog id, token type, provider)` rate keys are skipped, so current provider-price changes are not automatically applied to an existing key.

The sync expects managed product tag `ai_managed`, product field `ai_managed = "true"`, shared token-type metrics, pricing group keys in `model`, `provider` order, one rate credit type across AI products, and a rate-card conversion when that type is custom. Approved analytics and presentation dimensions may extend the shared metrics' compound group key, but they must not change the products' pricing group key. A legacy per-model metric layout is not syncable.

At handoff, return the report path and a concise outcome covering the configured business model, models, broad Metronome setup, application changes, validation result, and any remaining user action. Keep non-secret object IDs, price calculations, detailed test evidence, and full reconciliation data in the report unless the user asks to see them. In production, keep any broader customer rollout separate from the explicitly approved configuration and controlled verification performed by this run.

## Choose the effective time for rate-card changes

For both model additions and markup changes, rates must start on an hour boundary. Before presenting the rates for approval or making any writes, resolve `starting_at` as follows:

- For "now" or no requested effective time, floor the current UTC time to the start of the current hour by setting minutes, seconds, and milliseconds to zero. For example, `2026-09-10T16:16:59.123Z` becomes `2026-09-10T16:00:00.000Z`. Do not round up to the next hour or reuse the initial onboarding timestamp.
- For a user-specified time, resolve its timezone and ensure it falls on a UTC hour boundary. If it does not, show the proposed hour-aligned adjustment in the rate proposal and obtain approval for that exact timestamp before writing.
- Persist the approved timestamp and use it for every affected rate and its effective-rate verification, even if approval or execution happens in a later hour. Historical comparison reads still use the appropriate earlier timestamp. If the approved time must change, obtain approval for the revised time before writing.

## Add models to an existing rate card

When the user asks to add models, use this sequence. Reuse a rate-card selection or markup choice already supplied for this request, but always present the calculated rates for approval before making writes.

1. Ask which rate card to add the requested models to and wait for the user's selection. If needed, use the [List rate cards API](https://docs.metronome.com/api-reference/rate-cards/list-rate-cards) to show names and IDs in the selected environment.
2. Retrieve the selected card with `POST /contract-pricing/rate-cards/get` and body `{"id":"<rate_card_id>"}`, then retrieve its products and complete rate schedule. Read its custom fields, including `default_ai_markup` and `ai_managed_last_updated_at`, and its existing rate denomination and any custom-unit conversion. For every AI-managed product referenced by the card, retrieve the product and its billable metric. Record each token type's existing metric ID and full semantic definition, the ordered extra dimensions after `model` and `provider` in its compound group key, and the product's `presentation_group_key`. Treat these as the card's established dimension schema. Require compatible extra dimensions across its managed token metrics and consistent presentation keys across its managed products; stop and surface the conflict instead of creating parallel metrics or guessing when the existing card is inconsistent. If the card has no managed token metric yet, resolve the schema now, before preparing the proposal: reuse dimensions already supplied for this request, or ask which additional keys are analytics-only and which should break out invoice lines. Treat an explicit choice of no extra dimensions as a resolved schema. Do not proceed until the exact ordered metric group keys and product presentation keys are known. Display the card's name and ID and its default markup as a percentage (`default_ai_markup * 100`). If the field is absent, explain that managed sync uses zero as the fallback and ask the user to choose the markup explicitly.
3. Fetch `GET https://llm.stripe.com/v1/models` and normalize prices using step 1 of the managed-rate-card setup above. Filter to the models the user requested, following the existing model-scope rules, and show the exact model IDs and provider endpoints. Require supported current prices for every requested model; resolve missing or ambiguous matches before proceeding. Identify any requested models or provider/token-type rates already on the card so they are not duplicated or repriced as part of an addition.
4. Ask whether to use the card's stored default markup for these additions or a different percentage, and wait for the user's choice. Showing the stored default is permitted in this workflow; do not invent or recommend a percentage. Convert the chosen percentage to a decimal fraction for the products' `ai_markup`. A different markup for these additions does not change the card's default for future models.
5. Calculate every new provider/token-type rate from `unit_amount_major_units * (1 + model_markup_fraction)` using step 6's decimal arithmetic, per-million-token conversion, and the card's existing denomination. Present a table of model, provider, token type, base USD price, chosen markup percentage, resulting rate, and rate unit. Include the target environment and rate card, the products and custom-field keys to create, the exact ordered metric group keys and product presentation keys they will use, any genuinely new token-type metric required, and `starting_at` resolved using [Choose the effective time for rate-card changes](#choose-the-effective-time-for-rate-card-changes). Do not present the proposal while any dimension key remains unresolved. Ask the user to confirm these rates, the dimension schema, and the writes, including the effective time, and wait for approval. For production, this confirmation must explicitly approve the production writes.
6. After approval, use the [Custom fields API](https://docs.metronome.com/api-reference/custom-fields) to list key definitions and create only missing `contract_product` keys `ai_managed` and `ai_markup`, with `enforce_uniqueness: false`. This step ensures key definitions only; do not apply setup-time custom-field values to existing objects. For a token type already present on the card, reuse its exact established billable metric ID; never create another matching metric. For a genuinely new token type, use setup step 3 to create one metric with the exact ordered dimensions and event-property requirements in the approved proposal. Create one usage product per new `(model, token type)` using step 4, copying the approved `presentation_group_key` or omitting it when the approved schema has none, and including the `ai_managed` tag, `custom_fields: {"ai_managed": "true", "ai_markup": "<chosen_markup_fraction>"}`, pricing group keys, and quantity conversion. Step 6 is execution-only: stop and reconfirm if the required schema is absent or differs from the approved proposal. Set these custom-field values only on newly created products. Reuse an existing product only when its model/token-type mapping, billable metric, presentation keys, and markup already match the approved addition; preserve every existing product's custom fields, including `ai_markup`. If a reuse candidate has a different markup or dimension schema, resolve that conflict before writing rather than changing it as part of the addition. Add the approved flat rates to the selected card through the [Add rates API](https://docs.metronome.com/api-reference/rate-cards/add-rates), using the product IDs, exact catalog-ID/provider pricing-group values, approved prices, denomination, and effective time. Use the approved catalog snapshot; reconfirm the rates if a necessary refetch changes the proposal.
7. Complete [Verify model additions and markup changes](#verify-model-additions-and-markup-changes) before reporting success.

Do not write the rate card's `ai_managed_last_updated_at` when manually adding models. A filtered model addition has not processed the full catalog, so advancing that watermark could cause managed sync to miss other updates. Preserve the rate card's `default_ai_markup` and other custom fields as well; the creation-time rate-card custom-field instructions in setup steps 2 and 5 do not apply here.

## Update markup on an existing rate card

Resolve the target environment, rate card, requested model scope, and new markup percentage from the user's request and existing state. Ask for any missing markup or scope decision. Resolve the effective time using [Choose the effective time for rate-card changes](#choose-the-effective-time-for-rate-card-changes). Markup remains the merchant's choice. Retrieve the rate card, its managed products and custom fields, and every page of its rate schedule. Map models through rate `pricing_group_values` and token types through the products' billable metrics, as in the setup workflow.

Fetch and normalize the current provider catalog using setup step 1. Use the same catalog snapshot for calculation and writes. Before any custom-field or rate write, complete the calculation and approval steps below. This workflow obtains its own explicit approval for the exact writes in the selected environment, including production; it does not use the new-integration setup checkpoint.

### Update one model's markup

A model has a separate product for each token type and may have rates for multiple providers. Include every managed product and provider rate for that model on the selected rate card in this procedure:

1. Divide the requested percentage by 100 to obtain `model_markup_fraction`. Recalculate each provider/token-type rate as `base_usd_per_token * (1 + model_markup_fraction)`. Use setup step 6's decimal arithmetic and per-million-token conversion, preserving the rate's denomination and the rate card's custom-unit conversion when applicable. Calculate from the provider's base token price, not from the already marked-up rate. Inspect scheduled changes and any shared-product impact before preparing the proposal.
2. Present the target environment and rate card, affected product IDs and model/provider/token-type rows, old and new markup, base prices, resulting rates and units, and the exact hour-aligned effective time. Include every proposed custom-field change and any future-default change from the whole-card workflow. Ask the user to approve the calculated rates and all corresponding writes, and wait for explicit approval before changing any product or rate-card custom field or rate. For production, this approval must explicitly cover the production writes. Record the approved proposal and timestamp; reconfirm changed writes if a necessary catalog refetch changes the proposal.
3. After approval, for each targeted token-type product, call `POST /customFields/setValues` with `entity: "contract_product"`, `entity_id` set to the product ID, and `custom_fields: {"ai_markup": "<model_markup_fraction>"}`. Preserve the other custom fields and all untargeted products.
4. Apply the approved prices with the [Add rates API](https://docs.metronome.com/api-reference/rate-cards/add-rates), using the existing product IDs, exact `model` and `provider` pricing-group values, and persisted approved `starting_at`. Apply only the approved schedule changes.

Both the product's `ai_markup` field and its actual rates must be updated. Changing the custom field alone does not reprice existing rates, and changing only the rates leaves the markup used by managed sync inconsistent. A model-only edit preserves the rate card's `default_ai_markup`. Product custom fields belong to the product, so if a product is shared with other rate cards, surface that shared impact before changing its markup.

### Update the whole rate card's markup

First ask the user whether the new percentage should also become the default for models added in the future, unless they already supplied that choice. Record the choice before preparing the proposal.

Apply the model-update procedure to every managed model currently on the rate card, including all token-type products and provider rates, with one combined calculation and approval covering the whole change. Include the chosen future-default outcome in that proposal. Leave ordinary usage, subscription, and composite products outside this markup change.

Only after that combined proposal is approved, if the user chose to change the future default, call `POST /customFields/setValues` with `entity: "rate_card"`, `entity_id` set to the rate card ID, and `custom_fields: {"default_ai_markup": "<new_markup_fraction>"}`. Otherwise, preserve the existing default. Updating the default alone does not update existing models. Preserve the rate card's other custom fields, including `ai_managed` and `ai_managed_last_updated_at`; a markup edit does not advance the catalog-sync watermark.

Complete [Verify model additions and markup changes](#verify-model-additions-and-markup-changes) after either markup workflow.

## Verify model additions and markup changes

Before making writes, save the baseline products, rates, and rate-card custom fields in the run report, together with the approved catalog snapshot, model/provider/token-type mappings, markup, calculated prices, denomination, conversion, effective time, and future-default decision. Build the expected result from that approved proposal, independently of the write responses. Successful API writes alone do not prove that the configuration is correct.

For both baseline and verification reads, product and rate-card `get` endpoints require `{"id":"<object_id>"}`. Rate endpoints use `rate_card_id` instead: `getRates` also requires `at`, and `getRateSchedule` also requires `starting_at`. Supply a baseline `starting_at` early enough to include the existing history being compared, and omit `ending_before` to include future scheduled changes. Check the request schema before issuing a call.

After writing, use fresh reads in the same environment. The paths below are relative to `https://api.metronome.com/v1`; follow all pagination on list and rate responses.

| Object | Read API | Required checks |
| ------ | -------- | --------------- |
| Usage products | `POST /contract-pricing/products/get` for each affected product | Active `USAGE` product; correct token-type billable metric; `ai_managed` tag and `ai_managed: "true"` custom field; `ai_markup` equal to the approved percentage divided by 100; pricing group keys `["model", "provider"]`; divide-by-one-million quantity conversion. For model additions, the billable metric ID matches the card's established metric for that token type and the presentation keys match its established invoice-breakout schema; a genuinely new token-type metric preserves the same ordered extra dimensions. Inspect the product state effective at the approved time, including scheduled product updates when relevant. |
| Effective rates | `POST /contract-pricing/rate-cards/getRates` with `rate_card_id` and `at` set to the approved effective time | Every expected catalog-ID/provider/token-type combination resolves to the intended product and exactly one effective rate with the approved flat price, credit type, and `entitled: true`. Check that `pricing_group_values.model` is the catalog `id`, plus the exact provider and units. |
| Rate schedule | `POST /contract-pricing/rate-cards/getRateSchedule` with the approved `starting_at` | Each change takes effect when approved, with no unexpected later segment reverting it. Historical segments are valid; identify duplicates by product, model, provider, and effective time rather than counting all historical rows as duplicates. Compare rates immediately before the change with the baseline when verifying that history was preserved. |
| Rate card | `POST /contract-pricing/rate-cards/get` | Correct card ID, fiat unit, custom-unit conversion, and managed fields. `default_ai_markup` matches the approved choice and changes only when requested. No write from this operation modifies `ai_managed_last_updated_at` or unrelated custom fields. |

Independently recompute expected prices from the saved catalog's base USD prices using decimal arithmetic:

```text
usd_cents_per_million = base_usd_per_token * (1 + approved_markup_percentage / 100) * 1_000_000 * 100
custom_units_per_million = usd_cents_per_million / api_fiat_per_custom_credit
```

Compare numeric values after normalizing their decimal representation. Do not derive the expected price from the stored marked-up rate or refetch the catalog for verification, since that could change the comparison baseline.

Reconcile the complete expected set against the read-back rows. Model additions must create only the approved missing products and rates; markup changes must cover every targeted product and provider/token-type rate. Compare unrelated products, rates, and rate-card configuration with the baseline to detect unintended changes. If managed sync or another writer changed state concurrently, investigate the difference rather than attributing it automatically to this operation or restoring a stale baseline. In particular, never roll back a sync watermark advanced by managed sync.

Record expected and verified counts, object IDs, calculations, mismatches, completed writes, and partial failures in the run report. On retry, inspect current state and complete only missing or incorrect writes within the approved scope. Report success only when all expected objects and rates match; failed or incomplete reads mean verification is incomplete, not successful.

For these follow-up workflows, keep the verification details in the run report. Tell the user only whether the products, rates, and rate card were configured correctly. If they were not, or verification could not finish, briefly identify the unresolved issue and any user action required. Do not include reconciliation tables, counts, calculations, IDs, or test evidence unless the user asks. Preserve the pre-write markup and rate approval steps.

If customer-specific billing behavior also needs verification, use `POST /contracts/getContractRateSchedule` to check rates after contract overrides. A controlled sandbox usage event is optional for an explicitly requested end-to-end billing check; routine configuration verification does not require sending usage or generating invoices.

## Submit integration feedback

As the final external action before handoff, submit any concrete integration feedback or friction points from the run report to Stripe. Do not submit an empty or generic entry when the report contains no useful feedback; record that no feedback was submitted instead. Sanitize feedback before submission. Exclude secrets, customer data, account or object IDs, local paths, and other run-specific identifiers. Choose a `positive`, `neutral`, or `negative` sentiment to represent the report accurately, and submit exactly one form-encoded `POST` to `https://api.stripe.com/v1/_unstable/feedback` with:

- `Authorization: Bearer ${STRIPE_SECRET_KEY}` without resolving, printing, or copying the value;
- `Stripe-Version: 2026-08-26.preview`;
- `sentiment` set from the report;
- `message` beginning with the exact searchable prefix `Metronome token billing skill for <merchant id>` and containing a report that explains what the integration was trying to accomplish and any issues or friction points;
- `feature_area=skills`, `channel=cli`, and `actor=agent`.

Use only the already validated `STRIPE_SECRET_KEY`; do not create, retrieve, or request another credential solely for feedback. Before sending, store a stable, non-sensitive idempotency key in the run report and include it as the `Idempotency-Key` header. On resume, do not submit again if the report already contains a successful feedback ID.

Treat a returned `fbk_` ID and `success: true` as success and record the ID in the run report. The endpoint accepts test-mode secret keys and appropriately permissioned restricted or agent credentials; an ordinary live-mode secret key can receive a deliberate `404`. Record a sanitized status and error category for a failed submission, do not retry a `4xx`, and do not let feedback submission change the integration's validation result. Retry only an unambiguously transient network error, `429`, or `5xx`, using the same idempotency key and at most the existing three-attempt retry policy.

## Offer relevant follow-up work

This section applies to new integrations. For model additions and markup changes on an existing rate card, end with the concise verification outcome; do not append a report path, production-promotion prompt, or other follow-up offer unless the user asks.

At handoff, offer concise, copy-ready prompts for relevant next steps. Substitute the actual report path and omit inapplicable prompts. If this run configured sandbox, always offer this production-promotion prompt:

```text
Use the Metronome Token Billing skill to promote the sandbox integration documented in <actual-report-path> to production. Treat that report as resumable state, inspect production independently, ask me interactively for unresolved production decisions and credentials, present the exact production writes for approval, and append production object IDs, dashboard links, validation evidence, and friction notes to the same report.
```

Do not describe promotion as copying sandbox IDs or silently reuse sandbox credentials. Reconfirm environment-specific resources, prices, integrations, and approvals before production writes. If the report is in temporary storage that may not survive the follow-up environment, offer to copy it first to a user-approved persistent path and use that path in the prompt; do not place it in the repository without approval.
