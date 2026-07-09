import { describe, expect, it } from "vitest";

import {
  normalizeKioskSessionCreateInput,
  normalizeKioskSubmission,
  sanitizeKioskPayload,
} from "./kiosk-session";

describe("kiosk-session model", () => {
  it("requires pickup sessions to be bound to an order", () => {
    expect(() =>
      normalizeKioskSessionCreateInput({
        device_id: "dev_1",
        session_type: "pickup_signature",
      }),
    ).toThrow("取机签名任务必须绑定工单");
  });

  it("clamps kiosk session expiry", () => {
    expect(
      normalizeKioskSessionCreateInput({
        device_id: "dev_1",
        session_type: "intake_contact",
        expires_in_minutes: 2,
      }).expires_in_minutes,
    ).toBe(5);
    expect(
      normalizeKioskSessionCreateInput({
        device_id: "dev_1",
        session_type: "intake_contact",
        expires_in_minutes: 999,
      }).expires_in_minutes,
    ).toBe(240);
  });

  it("keeps request payload flat and non-sensitive by shape", () => {
    expect(
      sanitizeKioskPayload({
        title: "取机确认",
        amount: 10,
        nested: { nope: true },
        "bad key": "drop",
      }),
    ).toEqual({ title: "取机确认", amount: 10 });
  });

  it("normalizes customer submissions", () => {
    expect(
      normalizeKioskSubmission({
        customer_name: " Mario   Rossi ",
        customer_phone: " 3331234567 ",
        preferred_channel: "whatsapp",
        confirmation_checked: true,
      }),
    ).toMatchObject({
      customer_name: "Mario Rossi",
      customer_phone: "3331234567",
      preferred_channel: "whatsapp",
      confirmation_checked: true,
    });
  });
});
