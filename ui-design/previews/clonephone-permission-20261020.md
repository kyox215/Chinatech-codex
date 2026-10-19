# Clone Phone permission-fix download update — 2026-10-20

The user requested the delivered permission-fix APK in Toolbox → Data transfer. This candidate updates the existing public download, its shared release facts, checksum and exact-byte contract test. It retains the established filename and UI. MobileTrans, Office, retired phone-tool recovery, dictionaries and visual components are outside this change.

## Frozen asset

- Public path: `/toolbox/clonephone/clonephone-universal-14.7.34.apk`
- SHA-256: `0205692068c9040b2f2c04808037ec3d9b800b1b2d74a7a9ce5e6e2bddedfc6e`
- Length: 32,362,184 bytes.
- Package/version: `com.coloros.backuprestore`, `14.7.34_third` / 140734; min SDK 26, target SDK 36.
- Existing signer SHA-256: `3ed212b6b1d66cf64c4ea44ffecca392551abb16a1e45eca8c5f7126f59ce0da`.
- Replaces the prior 32,358,088-byte download with SHA-256 `65ced175b9664ac39d616623ba60575814edf924e3b04cc29f165ebc24917e10`.

## Product change and verification boundary

The supplied APK checks whether the vendor app-list permission is requestable at runtime. Supported runtime permissions use the native system dialog; rejection or returning from Settings does not imply permission was granted. Unsupported non-runtime vendor app-list permissions no longer block standard package enumeration. Android special access still follows its system Settings flow.

The APK project's exact-candidate report records six permission cases on Android 8 / 15 and two file/APK transfer directions between Android 15 and Android 17 (16 KB). Its broader prior-candidate 44 transfer directions do not count for this APK. The phone in the user's photos and physical brands remain unverified. Website asset publication does not prove phone installation, pairing, private app-data transfer or account migration.

## Website validation

Candidate source starts from fresh origin/main `3dfaaa51c9bf9ca85f39d87bb6d140a391bae0f7`. Node 24.19.0: existing `node --test tests/clonephone-release.test.mjs` passed 22/22 (including its imported Office contracts); `tsc --noEmit` passed; scoped ESLint passed with no output; `scripts/check-i18n.mjs` passed for 4,354 keys. Logs are in `.company-tmp/clonephone-permission-20261020/`. Formal download verification belongs to the release handoff; this document does not claim deployment or production success.
