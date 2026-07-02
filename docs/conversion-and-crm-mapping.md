# Conversion and CRM Mapping

The website sends structured browser events and server-side lead payloads. This keeps the public site simple while giving the operator useful marketing signals.

## Browser Events

| Event | Trigger | Use |
| --- | --- | --- |
| `consent_updated` | Cookie banner choice saved | Consent audit and tag governance |
| `assessment_complete` | Diagnostic tool completed | GA4 event, lead magnet scoring, remarketing audience |
| `lead_magnet_download` | Resource capture clicked | Content intent audience |
| `generate_lead` | Lead form submitted successfully | Primary conversion event |

## Google Ads

Set:

```text
NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO=AW-CONVERSION_ID/LABEL
NEXT_PUBLIC_CONVERSION_CURRENCY=INR
NEXT_PUBLIC_LEAD_CONVERSION_VALUE=0
```

When `generate_lead` fires, the browser also sends a Google Ads `conversion` event with `send_to`, `currency`, and `value`.

## LinkedIn

Set:

```text
NEXT_PUBLIC_LINKEDIN_PARTNER_ID=
NEXT_PUBLIC_LINKEDIN_LEAD_CONVERSION_ID=
```

LinkedIn Insight loads only after marketing consent. If a conversion ID is configured, `generate_lead` sends it through `lintrk`.

## Meta

Set:

```text
NEXT_PUBLIC_META_PIXEL_ID=
```

Meta Pixel loads only after marketing consent and receives the standard `Lead` event when a lead is created.

## HubSpot Field Mapping

Basic HubSpot contact fields are always sent when `HUBSPOT_PRIVATE_APP_TOKEN` is configured:

- `email`
- `firstname`
- `lastname`
- `phone`
- `lifecyclestage`

Optional custom fields can be mapped with JSON:

```text
HUBSPOT_FIELD_MAPPING_JSON={"pipeline":"network_pipeline","score":"network_score","priority":"network_priority","interest":"network_interest","country":"network_country","source":"lead_source_detail"}
```

The left side is the website lead field. The right side is the HubSpot property name.

## Zoho Field Mapping

Basic Zoho lead fields are always sent when Zoho credentials are configured:

- `Last_Name`
- `Email`
- `Phone`
- `Lead_Source`
- `Description`

Optional custom fields can be mapped with JSON:

```text
ZOHO_FIELD_MAPPING_JSON={"pipeline":"Network_Pipeline","score":"Network_Score","priority":"Priority","interest":"Service_Interest","country":"Country"}
```

The left side is the website lead field. The right side is the Zoho API field name.

## Supported Lead Fields

These fields can be used in HubSpot or Zoho mapping JSON:

- `id`
- `name`
- `email`
- `phone`
- `interest`
- `challenge`
- `pipeline`
- `score`
- `priority`
- `stage`
- `country`
- `source`
- `medium`
- `campaign`
- `landing`
- `referrer`
- `createdAt`
