import { describe, expect, it } from "vitest";

import { assertKioskReviewWriteEnabled } from "./kiosk-review-gate";

describe("kiosk review production gate", () => {
  it("allows local verification without changing production state", () => {
    expect(() => assertKioskReviewWriteEnabled({ NODE_ENV: "test" })).not.toThrow();
  });

  it("fails closed in production until the owner explicitly enables reviewed writes", () => {
    expect(() => assertKioskReviewWriteEnabled({ NODE_ENV: "production" })).toThrow(
      "审核写入暂未启用",
    );
    expect(() =>
      assertKioskReviewWriteEnabled({
        VERCEL_ENV: "production",
        REPAIRDESK_KIOSK_REVIEW_WRITES_ENABLED: "1",
      }),
    ).not.toThrow();
  });
});
