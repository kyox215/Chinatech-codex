# Repository-only migration lineage archive

This directory is an evidence-only archive for the three repository-only
migrations and their lifecycle pgTAP file identified during the 2026-08-25
lineage reconciliation. The bodies are byte-preserving copies from candidate
`871d2ca9ef8de6af056001454d66b082a1ac7e0d`; they are not active migrations.

- `production_applied`: `false`
- `other_environment_status`: `unknown`
- `status`: `evidence_only`
- `active_schema_implication`: `false`

The archive must not be executed, restored, renamed back into
`supabase/migrations`, or treated as evidence that any schema exists in an
environment. Do not use migration repair or an old timestamp to apply these
files. If a future owner-approved change needs related behavior, create a new
timestamped migration with a fresh lineage review, rehearsal, ACL/RLS review,
and release approval. The pgTAP file is static review evidence only and is
never a runnable artifact.

`MANIFEST.json` is the authoritative provenance and byte/hash record. It
contains no production rows, credentials, or secret values.

The archived lifecycle pgTAP file is static review evidence only and MUST NOT
be executed on any disposable, staging, or other database. Any future runnable
lifecycle test must be newly authored and reviewed under separate approval.

## Production-byte EOF exception

The production-authoritative migration
`supabase/migrations/20260804230127_seatable_import_preferred_channel_enum_fix_static.sql`
has SHA-256
`6aebb597ff202f67aa8d4421a70b7fb47de589178f01d140d8bbcfd2330486a4` and
intentionally ends with exactly two LF bytes (a final blank line). This is the
only permitted whitespace diagnostic, and only for that exact path and exact
SHA. SQL must not be trimmed. The machine-tested exception in `MANIFEST.json`
requires every other untracked file to produce zero whitespace diagnostics;
broad skips are forbidden.

The two production-authoritative SeaTable bodies are not byte-identical to
their repository aliases: `20260804225445` removes exactly one
`::public.message_channel` cast, while `20260804230127` appends exactly one LF.
Those derivations and both alias/candidate blob records are authoritative in
the manifest; no other normalization or formatting is allowed.
