-- These helpers depend only on the current transaction's verified Auth/session
-- and explicit store, never on the catalog row. A scalar subquery makes Postgres
-- evaluate the same existing permission rule once per statement (InitPlan),
-- rather than repeating the Auth/session/member lookups for every model.
-- Every new statement/transaction revalidates the current permission state.
-- Keep FORCE RLS, grants, function security modes and write policies unchanged.
alter policy catalog_control_read on chinatech_v2_private.device_catalog_control
  using ((select chinatech_v2_private.device_catalog_can_read()));
alter policy catalog_entries_read on chinatech_v2_private.device_catalog_entries
  using ((select chinatech_v2_private.device_catalog_can_read()));
