import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_DISPLAY_NAME,
  DEFAULT_STORE_ID,
  loadEnvFile,
  resolveBootstrapConfig,
} from "../scripts/ensure-owner-admin";

describe("ensure-owner-admin bootstrap config", () => {
  it("requires Supabase server configuration", () => {
    expect(() => resolveBootstrapConfig({ ADMIN_PASSWORD: "secret" })).toThrow("SUPABASE_URL");
  });

  it("requires an admin password", () => {
    expect(() =>
      resolveBootstrapConfig({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      }),
    ).toThrow("ADMIN_PASSWORD");
  });

  it("uses safe defaults for the default store owner", () => {
    const config = resolveBootstrapConfig({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      ADMIN_PASSWORD: "secret",
    });

    expect(config.email).toBe(DEFAULT_ADMIN_EMAIL);
    expect(config.displayName).toBe(DEFAULT_DISPLAY_NAME);
    expect(config.storeId).toBe(DEFAULT_STORE_ID);
  });

  it("loads env files without overriding existing values", () => {
    const dir = mkdtempSync(join(tmpdir(), "repairdesk-admin-"));
    const envPath = join(dir, ".env");
    const env: Record<string, string | undefined> = {
      ADMIN_EMAIL: "existing@example.com",
    };

    writeFileSync(
      envPath,
      [
        "ADMIN_EMAIL=file@example.com",
        'ADMIN_DISPLAY_NAME="最高管理员"',
        "SUPABASE_URL=https://example.supabase.co",
      ].join("\n"),
    );

    loadEnvFile(envPath, env);

    expect(env.ADMIN_EMAIL).toBe("existing@example.com");
    expect(env.ADMIN_DISPLAY_NAME).toBe("最高管理员");
    expect(env.SUPABASE_URL).toBe("https://example.supabase.co");
  });
});
