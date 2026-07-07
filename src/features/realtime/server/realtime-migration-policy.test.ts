import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260706133632_repairdesk_realtime_private_broadcast_authorization.sql",
);

describe("RepairDesk realtime authorization migration draft", () => {
  it("keeps private broadcast authorization receive-only for browser clients", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("alter table realtime.messages enable row level security");
    expect(sql).toContain("grant select on table realtime.messages to authenticated");
    expect(sql).toContain(
      "revoke insert, update, delete on table realtime.messages from authenticated",
    );
    expect(sql).toContain("for select");
    expect(sql).toContain("to authenticated");
    expect(sql).toContain("realtime.messages.extension = 'broadcast'");
    expect(sql).toContain("select realtime.topic()");
    expect(sql).toContain("public.store_memberships");
    expect(sql).toContain("sm.user_id = (select auth.uid())");
    expect(sql).toContain("sm.status = 'active'");
    expect(sql).toContain("s.status = 'active'");
    expect(sql).not.toMatch(/create\s+policy[\s\S]+for\s+insert/i);
  });
});
