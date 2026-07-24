import { afterEach, describe, expect, it } from "vitest";

import {
  createStableCustomerStatusToken,
  getActiveCustomerStatusKeyVersion,
  parseAndVerifyStableCustomerStatusToken,
} from "./customer-status-token";

const originalVersion = process.env.CUSTOMER_STATUS_QR_HMAC_ACTIVE_VERSION;
const originalKeys = process.env.CUSTOMER_STATUS_QR_HMAC_KEYS;

afterEach(() => {
  process.env.CUSTOMER_STATUS_QR_HMAC_ACTIVE_VERSION = originalVersion;
  process.env.CUSTOMER_STATUS_QR_HMAC_KEYS = originalKeys;
});

describe("stable customer status tokens", () => {
  it("creates a deterministic, verifiable token without exposing the order id", () => {
    process.env.CUSTOMER_STATUS_QR_HMAC_ACTIVE_VERSION = "1";
    process.env.CUSTOMER_STATUS_QR_HMAC_KEYS = JSON.stringify({
      1: Buffer.alloc(32, 7).toString("base64url"),
    });
    const identity = {
      publicId: "9e5b9bd0-f497-4ee7-8609-37cd23d19cc9",
      generation: 3,
      keyVersion: 1,
    };
    const first = createStableCustomerStatusToken(identity);
    const second = createStableCustomerStatusToken(identity);

    expect(first).toBe(second);
    expect(first).not.toContain(identity.publicId);
    expect(getActiveCustomerStatusKeyVersion()).toBe(1);
    expect(parseAndVerifyStableCustomerStatusToken(first)).toEqual(identity);
  });

  it("rejects tampering and unknown key versions", () => {
    process.env.CUSTOMER_STATUS_QR_HMAC_ACTIVE_VERSION = "1";
    process.env.CUSTOMER_STATUS_QR_HMAC_KEYS = JSON.stringify({
      1: Buffer.alloc(32, 9).toString("base64url"),
    });
    const token = createStableCustomerStatusToken({
      publicId: "9e5b9bd0-f497-4ee7-8609-37cd23d19cc9",
      generation: 1,
      keyVersion: 1,
    });
    expect(parseAndVerifyStableCustomerStatusToken(`${token.slice(0, -1)}A`)).toBeNull();
    expect(parseAndVerifyStableCustomerStatusToken(token.replace(/^v2\.1\./, "v2.2."))).toBeNull();
  });
});
