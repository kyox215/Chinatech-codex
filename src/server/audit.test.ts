import { beforeEach, describe, expect, it, vi } from "vitest";

import { sanitizeAuditRecord, writeAuditLog } from "./audit";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: mocks.from,
  }),
  hasSupabaseConfig: () => true,
}));

describe("audit log redaction", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.insert.mockReset();
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockReturnValue({ error: null });
  });

  it("redacts sensitive nested audit fields before persistence", async () => {
    await writeAuditLog({
      actor: {
        id: "staff_1",
        email: "staff@example.com",
        displayName: "Staff",
        storeId: "store_1",
      },
      action: "upload",
      entityType: "order_attachment",
      entityId: "order_1",
      after: {
        attachment: {
          id: "attachment_1",
          data_base64: "raw-photo-base64",
          signed_url: "https://example.test/signed",
          storage_path: "store_1/order_1/attachment_1.jpg",
          file_name: "customer-passport.jpg",
          mime_type: "image/jpeg",
          file_size: 123,
        },
      },
      metadata: {
        input: {
          customer: {
            name: "Zhang San",
            phone_raw: "+39123456789",
          },
          body: "raw customer message",
          safe_status: "ok",
        },
      },
    });

    expect(mocks.from).toHaveBeenCalledWith("audit_logs");
    const payload = mocks.insert.mock.calls[0]?.[0] as Record<string, unknown>;
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("raw-photo-base64");
    expect(serialized).not.toContain("https://example.test/signed");
    expect(serialized).not.toContain("customer-passport.jpg");
    expect(serialized).not.toContain("+39123456789");
    expect(serialized).not.toContain("Zhang San");
    expect(serialized).not.toContain("raw customer message");
    expect(serialized).toContain("image/jpeg");
    expect(serialized).toContain("safe_status");
  });

  it("summarizes overlong strings and data URLs", () => {
    const sanitized = sanitizeAuditRecord({
      preview: "x".repeat(600),
      image: "data:image/png;base64,abc",
    });

    expect(sanitized?.preview).toBe("[redacted:600 chars]");
    expect(sanitized?.image).toBe("[redacted]");
  });

  it("keeps non-sensitive boolean presence flags", () => {
    const sanitized = sanitizeAuditRecord({
      has_target_owner_email: true,
      target_owner_email: "owner@example.com",
    });

    expect(sanitized?.has_target_owner_email).toBe(true);
    expect(sanitized?.target_owner_email).toBe("[redacted]");
  });

  it("keeps aggregate AI token counts while continuing to redact token values", () => {
    const sanitized = sanitizeAuditRecord({
      input_token_count: 120,
      cached_input_token_count: 40,
      cache_write_token_count: 10,
      output_token_count: 30,
      total_token_count: 150,
      estimated_cost_microusd: 12,
      access_token: "SECRET",
    });

    expect(sanitized).toEqual({
      input_token_count: 120,
      cached_input_token_count: 40,
      cache_write_token_count: 10,
      output_token_count: 30,
      total_token_count: 150,
      estimated_cost_microusd: 12,
      access_token: "[redacted]",
    });
  });

  it("redacts every internal cost payload shape", () => {
    const sanitized = sanitizeAuditRecord({
      cost_inputs: [{ line_id: "line-1", amount: 15 }],
      cost_amount: 15,
      default_cost_amount: 10,
      internal_cost: 8,
      cost: 7,
      unit_cost: 6,
      internalCost: 5,
      safe_item_count: 1,
    });

    expect(sanitized).toEqual({
      cost_inputs: "[redacted]",
      cost_amount: "[redacted]",
      default_cost_amount: "[redacted]",
      internal_cost: "[redacted]",
      cost: "[redacted]",
      unit_cost: "[redacted]",
      internalCost: "[redacted]",
      safe_item_count: 1,
    });
  });

  it("redacts all device identifier payload shapes", () => {
    const serialized = JSON.stringify(
      sanitizeAuditRecord({
        identifiers: [{ kind: "eid", value: "89043051202500726225007991441943" }],
        eid: "89043051202500726225007991441943",
        gtin: "4006381333931",
        display_value: "490154203237518",
        normalized_value: "490154203237518",
        safe_identifier_count: 2,
      }),
    );
    expect(serialized).not.toContain("89043051202500726225007991441943");
    expect(serialized).not.toContain("4006381333931");
    expect(serialized).not.toContain("490154203237518");
    expect(serialized).toContain("safe_identifier_count");
  });
});
