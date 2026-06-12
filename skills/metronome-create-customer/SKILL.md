---
name: metronome-create-customer
description: Creates a new customer record in Metronome with name, ingest alias, Salesforce ID, and Slack channel. Use when asked to create a customer, add a customer, onboard a new account, or set up their account in Metronome.
argument-hint: <company_name>
---

# metronome-create-customer

Creates a single customer record in Metronome. Two-step: preview then confirm.
Calls the API directly for both the duplicate check and the write.

Base URL: `https://api.metronome.com/v1` (prod) or `https://staging.api.metronome.com/v1` (sandbox).

---

## Step 1 — Collect fields

Ask the user for anything not already provided:

| Field | Required | Notes |
|---|---|---|
| Legal entity name | Yes | Appears verbatim on invoices — use exact legal name |
| Ingest alias | Yes | The customer's client ID in their own system |
| Salesforce account ID | Yes | Alphanumeric ID from the Salesforce account URL |
| External Slack channel | Yes | The shared channel name (not internal) — used by Pylon for support |

---

## Step 2 — Check for duplicate

```http
GET /v1/customers
Authorization: Bearer $METRONOME_API_TOKEN
```
Returns all customers — match by `name` field from the response.

- Match found → show it and ask the user to confirm this is a different entity.
- No match → proceed.

---

## Step 3 — Preview

```
NEW CUSTOMER PREVIEW

  Name:          <legal entity name>
  Ingest alias:  <alias>
  Salesforce ID: <id>
  Slack channel: <channel>

Reply "confirmed" to create.
```

Do not call the API until the user confirms.

---

## Step 4 — Create

```http
POST /v1/customers
Authorization: Bearer $METRONOME_API_TOKEN
Content-Type: application/json

{
  "name": "<legal entity name>",
  "ingest_aliases": ["<ingest_alias>"],
  "customer_config": {
    "salesforce_account_id": "<salesforce_id>"
  },
  "custom_fields": {
    "slack_channel": "<slack_channel>"
  }
}
```

Return the `id` from the response — the user will need it for `metronome-create-contract`.

> **Note:** `custom_fields` keys must be pre-registered in your Metronome account before use. If `slack_channel` is not registered, the API returns `"Invalid custom field keys"`. Ask your Metronome admin to register it first, or omit `custom_fields` entirely if not configured.
