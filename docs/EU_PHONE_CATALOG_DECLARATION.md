# European Phone Catalog Declaration

Status: active

Owner: Inventory + Product Data / Integration Lead

Scope: `/inventory/new` phone identity and configuration selection

Last reviewed: 2026-07-26 CEST by `TASK-20260726-002-eu-phone-catalog`

## Purpose

RepairDesk uses a version-controlled European phone catalog to reduce duplicate brand,
model and configuration spellings during single-phone intake. The catalog is an input
assistant, not an allowlist: a missing or older device must always remain writable through
manual entry.

The runtime table lives in
`src/features/inventory/model/eu-phone-catalog.ts`. The first release contains 20 brand
groups and more than 190 European-market model records, with common RAM, storage and
physical-finish options where evidence is available.

## Normative rules

1. The default model list uses a rolling ten-year cutoff calculated from the current UTC
   calendar day. The cutoff day is included; the rule must not be hard-coded to one year.
2. Brand selection scopes model selection. Model selection scopes RAM, storage and color.
3. Changing a brand clears model, RAM, storage and color. Changing a model clears RAM,
   storage and color. The UI must disclose this cleanup.
4. An exact employee-confirmed catalog model is `standard`. Manual values are
   `unstandardized`. AI/scan candidates stay `needs_review` until explicitly confirmed.
5. Catalog failure, a missing model, or a missing option must never block inventory intake.
6. Apple RAM is not inferred from unofficial sources. When the manufacturer does not
   publish a field, the option list remains empty and manual entry stays available.
7. Saved inventory fields remain canonical text values. Physical swatch CSS values never
   enter the API or database payload.
8. This release does not change migrations, permissions, RPCs, historical inventory or
   store rollout flags.

## Physical color exception

Application status and interface colors still come only from semantic tokens in
`src/styles.css`. OEM physical finishes are business catalog data, so their swatches may
use catalog hex values or gradients solely inside the color preview circle.

Every color option must render:

- a complete readable name;
- a bordered visual swatch (including white finishes);
- a non-color selected state such as border, check icon and `aria-checked`;
- an accessible name independent of the swatch.

Multi-tone finishes use multiple swatches rendered as a gradient. The stored value is the
finish name, never the gradient string.

## Source and maintenance policy

Primary references for verification and future catalog refreshes:

- Apple model identification: <https://support.apple.com/it-it/108044>
- Google Play supported devices: <https://support.google.com/googleplay/answer/1727131>
- Google device catalog rules: <https://support.google.com/googleplay/android-developer/answer/7353455>
- GSMA Device Information service (licensed future enrichment only):
  <https://servicesshowcase.gsma.com/gsma-services-showcase-mwc23/device-information>
- Manufacturer European/Italian product pages for Samsung, Xiaomi, Google, Motorola,
  OPPO, OnePlus, HONOR, Huawei, realme, vivo, HMD, Sony, Nothing, ASUS, Fairphone, TCL and
  ZTE/nubia.

Do not bulk-copy an unlicensed commercial device database. Catalog changes require:

1. an official manufacturer or platform source;
2. release date and European-market relevance;
3. canonical brand/model spelling;
4. verified configurations only; unknown fields remain empty;
5. unit tests for identifiers, rolling cutoff and duplicate canonical IDs.

## Rollback

Revert the application release. Existing inventory records remain valid because the API
contract continues to store strings and no database migration or backfill is involved.
Manual intake remains the fail-safe path.
