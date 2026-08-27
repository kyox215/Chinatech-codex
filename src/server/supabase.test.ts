import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn(() => ({ auth: {} })));

vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { getSupabaseAdmin, hasSupabaseConfig } from "./supabase";

describe("Supabase server configuration", () => {
  beforeEach(() => {
    createClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the legacy service-role key when both server key variables are configured", () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "synthetic-secret-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "  synthetic-legacy-key  ");

    expect(hasSupabaseConfig()).toBe(true);
    getSupabaseAdmin();

    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "synthetic-legacy-key",
      expect.objectContaining({
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    );
  });

  it("falls back to a trimmed secret key when the legacy key is blank", () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "  synthetic-secret-key  ");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "   ");

    expect(hasSupabaseConfig()).toBe(true);
    getSupabaseAdmin();

    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "synthetic-secret-key",
      expect.any(Object),
    );
  });

  it("falls back to the secret key when the legacy key is missing", () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "synthetic-secret-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);

    expect(hasSupabaseConfig()).toBe(true);
    getSupabaseAdmin();

    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "synthetic-secret-key",
      expect.any(Object),
    );
  });

  it("fails closed when no server key is configured", () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(hasSupabaseConfig()).toBe(false);
    expect(() => getSupabaseAdmin()).toThrow(
      "Set SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
    );
    expect(createClient).not.toHaveBeenCalled();
  });
});
