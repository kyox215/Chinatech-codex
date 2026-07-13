import { describe, expect, it } from "vitest";

import {
  assertKioskSubmissionRequirements,
  normalizeKioskReturnInput,
  normalizeKioskSessionCreateInput,
  normalizeKioskSubmission,
  publicKioskSubmissionDraft,
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

  it("keeps only the bounded public source marker from request payload", () => {
    expect(
      sanitizeKioskPayload({
        source: "order_detail",
        password: "1234",
        imei: "490154203237518",
        internal_note: "do not expose",
      }),
    ).toEqual({ source: "order_detail" });
    expect(sanitizeKioskPayload({ source: "x".repeat(65) })).toEqual({});
    expect(sanitizeKioskPayload({ source: "invalid source" })).toEqual({});
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

  it("requires explicit customer confirmation on every public submission", () => {
    expect(() => normalizeKioskSubmission({ customer_name: "Cliente" })).toThrow(
      "请先确认客户资料",
    );
  });

  it("requires contact identity for contact-oriented sessions", () => {
    expect(() =>
      assertKioskSubmissionRequirements("intake_contact", {
        customer_name: "Cliente",
        confirmation_checked: true,
      }),
    ).toThrow("请输入客户电话");
    expect(() =>
      assertKioskSubmissionRequirements("pickup_signature", {
        confirmation_checked: true,
      }),
    ).not.toThrow();
  });

  it("projects only editable public draft fields and never raw signature data", () => {
    expect(
      publicKioskSubmissionDraft({
        customer_name: " Cliente ",
        customer_phone: "+39 333 111 2222",
        confirmation_checked: true,
        signature_data_url: "data:image/png;base64,SECRET",
        staff_return_reason: "internal",
        password: "1234",
      }),
    ).toEqual({
      customer_name: "Cliente",
      customer_phone: "+39 333 111 2222",
      confirmation_checked: true,
      has_signature: true,
    });
  });

  it("requires a bounded return reason for staff review", () => {
    expect(() => normalizeKioskReturnInput({ id: "session_1", reason: "  " })).toThrow(
      "请输入退回原因",
    );
    expect(normalizeKioskReturnInput({ id: " session_1 ", reason: " 号码 不清楚 " })).toEqual({
      id: "session_1",
      reason: "号码 不清楚",
    });
  });
});
