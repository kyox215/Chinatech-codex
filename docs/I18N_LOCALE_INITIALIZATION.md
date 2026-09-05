# Initial interface language

Status: locally verified 2026-09-05; not deployed.
Owner: Frontend / Integration Lead.
Scope: `getServerLocale` and the existing locale provider.

The initial language is resolved in the server request:

1. A valid `repairdesk_locale` cookie (`zh-CN`, `it-IT`, or `en`) takes priority.
2. Otherwise, match the browser's `Accept-Language` preferences to the supported Chinese,
   Italian, and English locales. Regional/script variants match their base language.
   Quality weights take priority; equal weights retain the browser's order. Unsupported,
   malformed, wildcard, and zero-quality entries do not select a locale.
3. If no supported preference remains, retain the existing Chinese default.

Browsers normally derive these preferences from their configured/device languages. A browser
language override takes precedence over the operating system preference sent to websites.
No geographic, timezone, account, or store inference is used.

Metadata, document language, and the initial client provider share this server result, so a
first-time Italian/English visitor does not first receive a Chinese UI and switch after
hydration. No extra client request or browser-only initialization effect is added.

Automatic detection does not write or replace a language cookie. Existing manual language
switching continues to save the preference for later visits; browser preferences are used
again only when no valid saved preference is present. The supported translations, timezone,
cookie scope/retention, authentication, and business data are unchanged.

Regression evidence belongs to `TASK-20260905-002-device-locale`: locale parsing and server
precedence tests, fresh browser contexts with regional languages, manual selection/reload,
and saved-cookie override with first-response HTML checks.
