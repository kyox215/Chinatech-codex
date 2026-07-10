import { describe, expect, it } from "vitest";

import {
  assertSupabaseAdminMutationTarget,
  mutationConfirmation,
  parseCliArgs,
  projectRefFromSupabaseUrl,
  stringArg,
} from "./supabase-admin-safety";

const storeId = "00000000-0000-4000-8000-000000000001";

describe("Supabase admin script safety", () => {
  it("parses explicit flags without treating booleans as values", () => {
    const args = parseCliArgs(["--apply", "--store-id", storeId, "--project-ref=local"]);
    expect(args.get("apply")).toBe(true);
    expect(stringArg(args, "store-id")).toBe(storeId);
    expect(stringArg(args, "project-ref")).toBe("local");
  });

  it("derives hosted and local project refs without exposing credentials", () => {
    expect(projectRefFromSupabaseUrl("https://abcdefghijklmnopqrst.supabase.co")).toBe(
      "abcdefghijklmnopqrst",
    );
    expect(projectRefFromSupabaseUrl("http://127.0.0.1:54321")).toBe("local");
    expect(() => projectRefFromSupabaseUrl("https://db.example.com")).toThrow();
  });

  it("requires exact project, store, confirmation, and backup gates", () => {
    expect(() =>
      assertSupabaseAdminMutationTarget({
        apply: true,
        supabaseUrl: "http://127.0.0.1:54321",
        projectRef: "wrong",
        storeId,
        confirmation: mutationConfirmation("local", storeId),
        localOnly: true,
        requireBackupDir: true,
        backupDir: "/tmp/repairdesk-backup",
      }),
    ).toThrow("project-ref");

    expect(() =>
      assertSupabaseAdminMutationTarget({
        apply: true,
        supabaseUrl: "http://127.0.0.1:54321",
        projectRef: "local",
        storeId,
        confirmation: "YES",
        localOnly: true,
        requireBackupDir: true,
        backupDir: "/tmp/repairdesk-backup",
      }),
    ).toThrow("confirm");

    expect(() =>
      assertSupabaseAdminMutationTarget({
        apply: true,
        supabaseUrl: "http://127.0.0.1:54321",
        projectRef: "local",
        storeId,
        confirmation: mutationConfirmation("local", storeId),
        localOnly: true,
        requireBackupDir: true,
      }),
    ).toThrow("backup-dir");
  });

  it("refuses remote destructive scripts even when the target phrase matches", () => {
    const projectRef = "abcdefghijklmnopqrst";
    expect(() =>
      assertSupabaseAdminMutationTarget({
        apply: true,
        supabaseUrl: `https://${projectRef}.supabase.co`,
        projectRef,
        storeId,
        confirmation: mutationConfirmation(projectRef, storeId),
        localOnly: true,
      }),
    ).toThrow("restricted to local");
  });
});
