import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth-context";

import {
  assertToolkitConsumer,
  assertToolkitPlatformAdmin,
  isToolkitRangeResponseAcceptable,
} from "./toolkit.service";

const activeMember = {
  id: "staff-1",
  displayName: "员工",
  email: "staff@example.com",
  emailVerified: true,
  storeId: "store-1",
};

describe("toolkit service authorization", () => {
  it("accepts only verified active store consumers and platform admins", () => {
    expect(assertToolkitConsumer(activeMember)).toBe(activeMember);
    expect(
      assertToolkitConsumer({
        ...activeMember,
        isPlatformAdmin: true,
        storeId: undefined,
      }),
    ).toMatchObject({ isPlatformAdmin: true });
  });

  it.each([
    ["unverified", { emailVerified: false }],
    ["system", { isSystem: true }],
    ["missing store", { storeId: undefined }],
  ])("rejects %s consumers", (_label, overrides) => {
    expect(() => assertToolkitConsumer({ ...activeMember, ...overrides })).toThrow(ForbiddenError);
  });

  it("requires a verified platform-owner email and recent AAL2 for management", () => {
    const recent = {
      ...activeMember,
      email: "kyox120@gmail.com",
      isPlatformAdmin: true,
      authAssuranceLevel: "aal2" as const,
      recentAuthAt: new Date(Date.now() - 1_000).toISOString(),
    };
    expect(assertToolkitPlatformAdmin(recent)).toBe(recent);
    expect(() => assertToolkitPlatformAdmin({ ...recent, authAssuranceLevel: "aal1" })).toThrow(
      ForbiddenError,
    );
    expect(() =>
      assertToolkitPlatformAdmin({
        ...recent,
        recentAuthAt: new Date(Date.now() - 6 * 60 * 1_000).toISOString(),
      }),
    ).toThrow(ForbiddenError);
  });
});

describe("toolkit storage range validation", () => {
  it("requires a matching 206 Content-Range or a bounded small 200 response", () => {
    expect(
      isToolkitRangeResponseAcceptable(
        new Response(null, {
          status: 206,
          headers: { "content-range": "bytes 0-511/4096" },
        }),
        "bytes=0-511",
        4096,
        512,
      ),
    ).toBe(true);
    expect(
      isToolkitRangeResponseAcceptable(
        new Response(null, {
          status: 206,
          headers: { "content-range": "bytes 1-511/4096" },
        }),
        "bytes=0-511",
        4096,
        512,
      ),
    ).toBe(false);
    expect(
      isToolkitRangeResponseAcceptable(
        new Response(null, { status: 200, headers: { "content-length": "512" } }),
        "bytes=0-511",
        512,
        512,
      ),
    ).toBe(true);
    expect(
      isToolkitRangeResponseAcceptable(
        new Response(null, { status: 200, headers: { "content-length": "513" } }),
        "bytes=0-511",
        513,
        513,
      ),
    ).toBe(false);
    expect(
      isToolkitRangeResponseAcceptable(
        new Response(null, {
          status: 206,
          headers: { "content-range": "bytes 0-511/100" },
        }),
        "bytes=0-511",
        100,
        512,
      ),
    ).toBe(false);
    expect(
      isToolkitRangeResponseAcceptable(
        new Response(null, {
          status: 206,
          headers: { "content-range": "bytes 0-99/100" },
        }),
        "bytes=0-511",
        100,
        100,
      ),
    ).toBe(true);
    expect(
      isToolkitRangeResponseAcceptable(
        new Response(null, {
          status: 206,
          headers: { "content-range": "bytes 0-511/4096" },
        }),
        "bytes=0-511",
        4096,
        511,
      ),
    ).toBe(false);
  });
});
