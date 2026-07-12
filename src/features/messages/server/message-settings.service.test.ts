import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor, StoreSettings } from "@/lib/repairdesk/types";

const storeId = "5248dda1-2b32-46cd-8ed0-d15386a9e8ed";
const version = "2026-07-12T10:00:00.000Z";

const mocks = vi.hoisted(() => ({
  assertStaffRole: vi.fn(),
  getStoreSettingsRow: vi.fn(),
  updateStoreSettingsRow: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/server/auth-context", () => ({ assertStaffRole: mocks.assertStaffRole }));
vi.mock("@/server/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("./message-settings.repository", () => ({
  getStoreSettings: mocks.getStoreSettingsRow,
  getMessageTemplate: vi.fn(),
  listMessageTemplates: vi.fn(),
  resetMessageTemplateRow: vi.fn(),
  updateMessageTemplateRow: vi.fn(),
  updateStoreSettingsRow: mocks.updateStoreSettingsRow,
}));

import { toStoreSettingsUpdateInput, updateStoreSettings } from "./message-settings.service";

describe("message settings service concurrency contract", () => {
  const actor: AuditActor = {
    id: "actor_1",
    displayName: "Owner",
    role: "owner",
    storeRole: "owner",
    storeId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStoreSettingsRow.mockResolvedValue(settings());
    mocks.updateStoreSettingsRow.mockResolvedValue(
      settings({ store_name: "Saved", updated_at: "2026-07-12T10:01:00.000Z" }),
    );
    mocks.writeAuditLog.mockResolvedValue(undefined);
  });

  it("fails before any read or write when the expected store differs from the actor", async () => {
    await expect(
      updateStoreSettings(
        storeRequest({ expectedStoreId: "4c48f33b-a46c-4adb-9bd4-771481ecf928" }),
        actor,
      ),
    ).rejects.toMatchObject({ code: "SETTINGS_STORE_CONTEXT_CHANGED", status: 409 });
    expect(mocks.assertStaffRole).toHaveBeenCalledWith(actor, ["owner", "manager"]);
    expect(mocks.getStoreSettingsRow).not.toHaveBeenCalled();
    expect(mocks.updateStoreSettingsRow).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rejects a stale baseline before the repository write", async () => {
    mocks.getStoreSettingsRow.mockResolvedValueOnce(
      settings({ updated_at: "2026-07-12T10:00:30.000Z" }),
    );
    await expect(updateStoreSettings(storeRequest(), actor)).rejects.toMatchObject({
      code: "SETTINGS_VERSION_CONFLICT",
      status: 409,
    });
    expect(mocks.updateStoreSettingsRow).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("turns a lost atomic CAS into a conflict without audit", async () => {
    mocks.updateStoreSettingsRow.mockResolvedValueOnce(null);
    await expect(updateStoreSettings(storeRequest(), actor)).rejects.toMatchObject({
      code: "SETTINGS_VERSION_CONFLICT",
    });
    expect(mocks.updateStoreSettingsRow).toHaveBeenCalledWith(
      expect.objectContaining({ expectedUpdatedAt: version, storeId }),
    );
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("writes and audits only the selected section after a successful CAS", async () => {
    const result = await updateStoreSettings(storeRequest(), actor);
    expect(result.store_name).toBe("Saved");
    expect(mocks.updateStoreSettingsRow).toHaveBeenCalledWith({
      input: {
        store_name: "Saved",
        store_address: "Via Roma 1",
        store_phone: "+39 333 111 2222",
        store_whatsapp: "+39 333 111 2222",
        store_email: "owner@example.com",
      },
      expectedUpdatedAt: version,
      actorId: "actor_1",
      storeId,
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        before: { updated_at: version },
        after: { updated_at: "2026-07-12T10:01:00.000Z" },
        metadata: {
          section: "store",
          changedFields: [
            "store_name",
            "store_address",
            "store_phone",
            "store_whatsapp",
            "store_email",
          ],
        },
      }),
    );
  });

  it("derives warranty text on the server", () => {
    expect(
      toStoreSettingsUpdateInput({
        section: "rules",
        expectedStoreId: storeId,
        expectedUpdatedAt: version,
        input: {
          default_order_warranty_months: 12,
          default_inventory_warranty_months: 24,
        },
      }),
    ).toEqual({
      default_order_warranty_months: 12,
      default_inventory_warranty_months: 24,
      default_order_warranty_text: "12个月",
    });
  });
});

function storeRequest(overrides: { expectedStoreId?: string } = {}) {
  return {
    section: "store" as const,
    expectedStoreId: overrides.expectedStoreId ?? storeId,
    expectedUpdatedAt: version,
    input: {
      store_name: "Saved",
      store_address: "Via Roma 1",
      store_phone: "+39 333 111 2222",
      store_whatsapp: "+39 333 111 2222",
      store_email: "owner@example.com",
    },
  };
}

function settings(overrides: Partial<StoreSettings> = {}): StoreSettings {
  return {
    id: "settings_1",
    store_id: storeId,
    store_name: "Before",
    store_address: "Via Roma 1",
    store_phone: "+39 333 111 2222",
    store_whatsapp: "+39 333 111 2222",
    store_email: "owner@example.com",
    default_order_warranty_text: "6个月",
    default_order_warranty_months: 6,
    default_inventory_warranty_months: 12,
    print_footer: "Footer",
    message_signature: "Firma",
    created_at: "2026-07-12T09:00:00.000Z",
    updated_at: version,
    ...overrides,
  };
}
