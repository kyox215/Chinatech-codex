import { describe, expect, it } from "vitest";

import type { StoreSettings } from "@/lib/repairdesk/types";
import {
  acceptStoreSettingsSaveResult,
  buildStoreSettingsSectionUpdateRequest,
  createStoreSettingsDrafts,
  discardStoreSettingsSectionDraft,
  getDirtyStoreSettingsSections,
  isStoreSettingsSectionDirty,
  materializeStoreSettingsDraft,
  rebaseStoreSettingsSectionDraft,
  reconcileIncomingStoreSettings,
  updateStoreSettingsDraft,
} from "./store-settings-draft";

describe("store settings section drafts", () => {
  it("builds a request for only the edited section", () => {
    const initial = createStoreSettingsDrafts(settings());
    const edited = updateStoreSettingsDraft(initial, "notifications", {
      print_footer: "Nuovo footer",
    });

    expect(buildStoreSettingsSectionUpdateRequest(edited, "notifications")).toEqual({
      section: "notifications",
      expectedStoreId: "5248dda1-2b32-46cd-8ed0-d15386a9e8ed",
      expectedUpdatedAt: "2026-07-12T10:00:00.000Z",
      input: { print_footer: "Nuovo footer", message_signature: "Firma" },
    });
    expect(buildStoreSettingsSectionUpdateRequest(edited, "notifications")).not.toHaveProperty(
      "input.store_name",
    );
  });

  it("does not overwrite a dirty section during background refresh", () => {
    const edited = updateStoreSettingsDraft(createStoreSettingsDrafts(settings()), "store", {
      store_name: "Local draft",
    });
    const reconciled = reconcileIncomingStoreSettings(
      edited,
      settings({
        store_name: "Server name",
        print_footer: "Server footer",
        updated_at: "2026-07-12T10:01:00.000Z",
      }),
    );

    expect(reconciled.sections.store.value.store_name).toBe("Local draft");
    expect(reconciled.sections.store.conflict?.serverValue.store_name).toBe("Server name");
    expect(reconciled.sections.notifications.value.print_footer).toBe("Server footer");
    expect(() => buildStoreSettingsSectionUpdateRequest(reconciled, "store")).toThrow(
      "当前分组存在版本冲突",
    );
  });

  it("cleans only the saved section and rebases another dirty section to the new row version", () => {
    let drafts = createStoreSettingsDrafts(settings());
    drafts = updateStoreSettingsDraft(drafts, "store", { store_name: "Saved name" });
    drafts = updateStoreSettingsDraft(drafts, "rules", {
      default_inventory_warranty_months: 24,
    });
    const accepted = acceptStoreSettingsSaveResult(
      drafts,
      "store",
      settings({ store_name: "Saved name", updated_at: "2026-07-12T10:02:00.000Z" }),
      "2026-07-12T10:02:01.000Z",
    );

    expect(isStoreSettingsSectionDirty(accepted, "store")).toBe(false);
    expect(isStoreSettingsSectionDirty(accepted, "rules")).toBe(true);
    expect(accepted.sections.rules.value.default_inventory_warranty_months).toBe(24);
    expect(buildStoreSettingsSectionUpdateRequest(accepted, "rules").expectedUpdatedAt).toBe(
      "2026-07-12T10:02:00.000Z",
    );
  });

  it("discards to the latest server value after a conflict and rejects cross-store responses", () => {
    const edited = updateStoreSettingsDraft(createStoreSettingsDrafts(settings()), "store", {
      store_name: "Local draft",
    });
    const conflicted = reconcileIncomingStoreSettings(
      edited,
      settings({ store_name: "Server name", updated_at: "2026-07-12T10:03:00.000Z" }),
    );
    const discarded = discardStoreSettingsSectionDraft(conflicted, "store");

    expect(discarded.sections.store.value.store_name).toBe("Server name");
    expect(discarded.sections.store.baseUpdatedAt).toBe("2026-07-12T10:03:00.000Z");
    expect(isStoreSettingsSectionDirty(discarded, "store")).toBe(false);
    expect(() =>
      reconcileIncomingStoreSettings(
        discarded,
        settings({ store_id: "4c48f33b-a46c-4adb-9bd4-771481ecf928" }),
      ),
    ).toThrow("其他店铺");
  });

  it("rebases a reviewed local value without silently saving it", () => {
    const edited = updateStoreSettingsDraft(createStoreSettingsDrafts(settings()), "store", {
      store_name: "Local draft",
    });
    const conflicted = reconcileIncomingStoreSettings(
      edited,
      settings({
        store_name: "Server name",
        store_phone: "+39 333 999 0000",
        updated_at: "2026-07-12T10:04:00.000Z",
      }),
    );
    const rebased = rebaseStoreSettingsSectionDraft(conflicted, "store");
    expect(rebased.sections.store.value.store_name).toBe("Local draft");
    expect(rebased.sections.store.value.store_phone).toBe("+39 333 999 0000");
    expect(rebased.sections.store.base.store_name).toBe("Server name");
    expect(rebased.sections.store.conflict).toBeNull();
    expect(isStoreSettingsSectionDirty(rebased, "store")).toBe(true);
    expect(buildStoreSettingsSectionUpdateRequest(rebased, "store").expectedUpdatedAt).toBe(
      "2026-07-12T10:04:00.000Z",
    );
  });

  it("orders every dirty section with the visible section first", () => {
    let drafts = createStoreSettingsDrafts(settings());
    drafts = updateStoreSettingsDraft(drafts, "store", { store_name: "Local store" });
    drafts = updateStoreSettingsDraft(drafts, "notifications", { print_footer: "Local footer" });

    expect(getDirtyStoreSettingsSections(drafts, "notifications")).toEqual([
      "notifications",
      "store",
    ]);
  });

  it("materializes derived warranty text for previews without sending it to the server", () => {
    const drafts = updateStoreSettingsDraft(createStoreSettingsDrafts(settings()), "rules", {
      default_order_warranty_months: 12,
    });
    expect(materializeStoreSettingsDraft(drafts).default_order_warranty_text).toBe("12个月");
    expect(buildStoreSettingsSectionUpdateRequest(drafts, "rules").input).not.toHaveProperty(
      "default_order_warranty_text",
    );
  });
});

function settings(overrides: Partial<StoreSettings> = {}): StoreSettings {
  return {
    id: "settings_1",
    store_id: "5248dda1-2b32-46cd-8ed0-d15386a9e8ed",
    store_name: "Ripara Subito",
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
    updated_at: "2026-07-12T10:00:00.000Z",
    ...overrides,
  };
}
