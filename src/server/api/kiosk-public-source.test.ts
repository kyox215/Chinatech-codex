import { afterEach, describe, expect, it, vi } from "vitest";

import { kioskPublicSource } from "./kiosk-public-source";

describe("kioskPublicSource", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the mock kiosk source when local E2E auth bypass is enabled", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    vi.stubEnv("REPAIRDESK_E2E_BUSINESS_DESKTOP", "1");

    const [source, mockSource] = await Promise.all([
      kioskPublicSource(),
      import("@/features/kiosk/testing/mock-api"),
    ]);

    expect(source.pairKioskDevice).toBe(mockSource.pairKioskDevice);
  });

  it("uses the Supabase kiosk source when configured without E2E bypass", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");

    const [source, supabaseSource] = await Promise.all([
      kioskPublicSource(),
      import("@/features/kiosk/server/kiosk.service"),
    ]);

    expect(source.pairKioskDevice).toBe(supabaseSource.pairKioskDevice);
  });
});
