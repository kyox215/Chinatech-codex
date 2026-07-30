import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyElectronicsCsvImport,
  assertBuybackSaleReadiness,
  assertDirectInventoryTransactionAllowed,
  assertBuybackEvidenceCaptureActor,
  assertBuybackSensitiveAttachmentWriteEnabled,
  assertBuybackSensitiveWorkflowWriteEnabled,
  assertInventoryAttachmentAccessState,
  assertInventoryIntakeDoesNotBypassBuybackFinalize,
  assertLegacyInventorySaleAllowed,
  assertInventoryTransitionActor,
  assertInventoryTransitionDoesNotBypassBuybackReversal,
  assertInventoryUpdateDoesNotBypassBuybackAgreement,
  assertLegacyElectronicsImportActor,
  buildInventoryCheckItemPatch,
  fetchInventoryRows,
  fetchInventoryTransactionSummaries,
  finalizeBuybackPurchase,
  inventoryMutationCas,
  isInventoryAttachmentStorageScoped,
  mergeBuybackLegacyPayloadForUpdate,
  recordInventoryCheck,
  returnedBuybackInspectionReset,
  sanitizeBuybackLegacyPayload,
  sellInventoryItem,
  uploadInventoryAttachment,
} from "@/features/inventory/server/inventory.repository";
import { BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE } from "@/features/buyback/model/buyback-evidence-policy";
import type { AuditActor, BuybackFinalizeInput } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => mocks.supabase,
  hasSupabaseConfig: () => false,
}));

const scopedInventoryAttachment = {
  store_id: "store_1",
  item_id: "item_1",
  storage_bucket: "repairdesk-inventory-attachments",
  storage_path: "store_1/item_1/photo.jpg",
};

describe("inventory repository tenant storage boundaries", () => {
  it("allows signing only for the active store and inventory item path", () => {
    expect(isInventoryAttachmentStorageScoped(scopedInventoryAttachment, "store_1", "item_1")).toBe(
      true,
    );
  });

  it("allows the dedicated private buyback evidence bucket within the same tenant path", () => {
    expect(
      isInventoryAttachmentStorageScoped(
        {
          ...scopedInventoryAttachment,
          storage_bucket: "repairdesk-buyback-evidence",
          storage_path: "store_1/item_1/signature/evidence.png",
        },
        "store_1",
        "item_1",
      ),
    ).toBe(true);
  });

  it("rejects attachment metadata pointing to another store path", () => {
    expect(
      isInventoryAttachmentStorageScoped(
        {
          ...scopedInventoryAttachment,
          storage_path: "store_2/item_1/photo.jpg",
        },
        "store_1",
        "item_1",
      ),
    ).toBe(false);
  });

  it("rejects attachment metadata for another inventory item or bucket", () => {
    expect(
      isInventoryAttachmentStorageScoped(
        {
          ...scopedInventoryAttachment,
          item_id: "item_2",
          storage_path: "store_1/item_2/photo.jpg",
        },
        "store_1",
        "item_1",
      ),
    ).toBe(false);
    expect(
      isInventoryAttachmentStorageScoped(
        {
          ...scopedInventoryAttachment,
          storage_bucket: "public",
        },
        "store_1",
        "item_1",
      ),
    ).toBe(false);
  });

  it("fails closed for expired, rejected, deleted or unknown restricted evidence states", () => {
    const future = "2026-07-13T12:00:00.000Z";
    const now = Date.parse("2026-07-13T10:00:00.000Z");
    expect(() =>
      assertInventoryAttachmentAccessState(
        { evidence_status: "staged", staging_expires_at: future },
        true,
        now,
      ),
    ).not.toThrow();
    expect(() =>
      assertInventoryAttachmentAccessState(
        { evidence_status: "staged", staging_expires_at: undefined },
        true,
        now,
      ),
    ).toThrow(/暂存期已过/);
    for (const status of ["rejected", "deleted"] as const) {
      expect(() =>
        assertInventoryAttachmentAccessState(
          { evidence_status: status, staging_expires_at: future },
          true,
          now,
        ),
      ).toThrow(/拒绝或删除/);
    }
    expect(() =>
      assertInventoryAttachmentAccessState(
        { evidence_status: undefined, staging_expires_at: future },
        true,
        now,
      ),
    ).toThrow(/状态无效/);
  });
});

describe("inventory repository protected buyback writes", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
    mocks.supabase.storage.from.mockReset();
  });

  it("keeps safe quote fields while stripping sensitive legacy evidence markers", () => {
    expect(
      sanitizeBuybackLegacyPayload({
        unexpected: { raw: "keep-me-out" },
        buyback_quote: {
          intent_outcome: "accepted",
          final_offer: 300,
          risk_notes: ["Mario Rossi +39 333 1234567"],
          quote_expires_at: "2026-07-20T12:00:00.000Z",
        },
        buyback_customer: {
          name: "Mario Rossi",
          phone: "+39 333 1234567",
          document_number: "DEMO12345678",
          document_type: "id_card",
          document_no_masked: "••••A123",
          signature_status: "signed",
          signature_captured: true,
        },
        buyback_device: {
          purchase_region: "Italia",
          warranty_status: "Scaduta",
          serial_or_imei: "356789012345678",
        },
      }),
    ).toEqual({
      buyback_quote: {
        intent_outcome: "accepted",
        final_offer: 300,
        quote_expires_at: "2026-07-20T12:00:00.000Z",
      },
      buyback_device: {
        purchase_region: "Italia",
        warranty_status: "Scaduta",
      },
    });
  });

  it("preserves allowlisted stored evidence metadata while stripping inbound replacements", () => {
    const merged = mergeBuybackLegacyPayloadForUpdate(
      {
        integration_marker: "keep-existing",
        buyback_quote: { final_offer: 250 },
        buyback_customer: {
          name: "Stored seller must not be copied",
          phone: "+39 333 0000000",
          document_type: "id_card",
          document_no_masked: "••••A123",
          signature_status: "signed",
          signature_captured: true,
          id_front_captured: true,
        },
      },
      {
        buyback_quote: { final_offer: 275 },
        buyback_customer: {
          name: "Inbound seller must be stripped",
          phone: "+39 333 1111111",
          document_type: "passport",
          document_no_masked: "••••Z999",
          signature_status: "pending",
          signature_captured: false,
          id_front_captured: false,
        },
      },
    );

    expect(merged).toMatchObject({
      integration_marker: "keep-existing",
      buyback_quote: { final_offer: 275 },
      buyback_customer: {
        document_type: "id_card",
        document_no_masked: "••••A123",
        signature_status: "signed",
        signature_captured: true,
        id_front_captured: true,
      },
    });
    expect(merged.buyback_customer).not.toHaveProperty("name");
    expect(merged.buyback_customer).not.toHaveProperty("phone");
  });

  it("fails closed for every buyback or restricted attachment without blocking normal stock files", () => {
    for (const kind of [
      "id_front",
      "id_back",
      "signature",
      "invoice_photo",
      "box_photo",
    ] as const) {
      expect(() => assertBuybackSensitiveAttachmentWriteEnabled(kind, "manual_stock")).toThrow(
        BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE,
      );
    }
    for (const kind of ["device_photo", "other"] as const) {
      expect(() => assertBuybackSensitiveAttachmentWriteEnabled(kind, "buyback")).toThrow(
        BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE,
      );
      expect(() =>
        assertBuybackSensitiveAttachmentWriteEnabled(kind, "manual_stock"),
      ).not.toThrow();
    }
  });

  it("uploads a normal stock attachment with the production legacy row shape", async () => {
    const owner: AuditActor = {
      id: "staff_owner",
      displayName: "Owner",
      storeId: "store_1",
      storeRole: "owner",
    };
    const itemQuery = createSupabaseSingleQuery({ source_type: "manual_stock" });
    let insertedAttachmentRow: Record<string, unknown> = {};
    const attachmentSingle = vi.fn(async () => ({ data: insertedAttachmentRow, error: null }));
    const attachmentSelect = vi.fn(() => ({ single: attachmentSingle }));
    const attachmentInsert = vi.fn((row: Record<string, unknown>) => {
      insertedAttachmentRow = row;
      return { select: attachmentSelect };
    });
    const eventInsert = vi.fn(async () => ({ error: null }));
    mocks.supabase.from.mockImplementation((table: string) => {
      if (table === "inventory_items") return itemQuery;
      if (table === "inventory_attachments") return { insert: attachmentInsert };
      if (table === "inventory_events") return { insert: eventInsert };
      throw new Error(`Unexpected table: ${table}`);
    });
    const storageUpload = vi.fn(async () => ({ error: null }));
    const storageRemove = vi.fn(async () => ({ error: null }));
    mocks.supabase.storage.from.mockReturnValue({
      upload: storageUpload,
      remove: storageRemove,
    });
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const result = await uploadInventoryAttachment(
      "item-normal-1234",
      {
        kind: "device_photo",
        file_name: "device.png",
        mime_type: "image/png",
        file_size: pngBytes.byteLength,
        data_base64: pngBytes.toString("base64"),
        note: "Normal inventory photo",
      },
      owner,
    );

    expect(result.attachment.kind).toBe("device_photo");
    expect(storageUpload).toHaveBeenCalledTimes(1);
    expect(attachmentInsert).toHaveBeenCalledTimes(1);
    for (const migratedColumn of [
      "sensitivity",
      "evidence_status",
      "sha256",
      "agreement_hash",
      "staging_expires_at",
    ]) {
      expect(insertedAttachmentRow).not.toHaveProperty(migratedColumn);
    }
    expect(insertedAttachmentRow).toMatchObject({
      store_id: "store_1",
      item_id: "item-normal-1234",
      kind: "device_photo",
      storage_bucket: "repairdesk-inventory-attachments",
      file_name: "device.png",
      note: "Normal inventory photo",
    });
  });

  it("rejects direct upload, finalize and legacy apply before their downstream writes", async () => {
    const owner: AuditActor = {
      id: "staff_owner",
      displayName: "Owner",
      storeId: "store_1",
      storeRole: "owner",
    };
    const itemQuery = createSupabaseSingleQuery({ source_type: "buyback" });
    mocks.supabase.from.mockReturnValue(itemQuery);

    await expect(
      uploadInventoryAttachment(
        "item-private-1234",
        {
          kind: "device_photo",
          file_name: "identity-private-1234.png",
          mime_type: "image/png",
          file_size: 1,
          data_base64: "not-valid-base64",
        },
        owner,
      ),
    ).rejects.toThrow(BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE);
    expect(itemQuery.single).toHaveBeenCalledTimes(1);

    mocks.supabase.from.mockReset();
    await expect(
      finalizeBuybackPurchase("item-private-5678", {} as BuybackFinalizeInput, owner),
    ).rejects.toThrow(BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE);
    await expect(applyElectronicsCsvImport("private-csv-value", owner)).rejects.toThrow(
      BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE,
    );
    expect(mocks.supabase.from).not.toHaveBeenCalled();
    expect(() => assertBuybackSensitiveWorkflowWriteEnabled()).toThrow(
      BUYBACK_SENSITIVE_WORKFLOW_DISABLED_MESSAGE,
    );
  });

  it("rejects legacy intake shapes that used to create a payment implicitly", () => {
    expect(() =>
      assertInventoryIntakeDoesNotBypassBuybackFinalize({
        brand: "Apple",
        model: "iPhone 13",
        buyback_price: 300,
      }),
    ).toThrow(/回收成本只能由.*确认成交操作写入/);

    expect(() =>
      assertInventoryIntakeDoesNotBypassBuybackFinalize({
        brand: "Apple",
        model: "iPhone 13",
        buyback_price: 300,
        quote_payload: { buyback_quote: { final_offer: 300 } },
      }),
    ).toThrow(/回收成本只能由.*确认成交操作写入/);

    expect(() =>
      assertInventoryIntakeDoesNotBypassBuybackFinalize({
        brand: "Apple",
        model: "iPhone 13",
        buyback_price: 0,
        quote_payload: { buyback_quote: { final_offer: 300 } },
      }),
    ).toThrow(/专用透明报价入口/);
  });

  it("freezes buyback cost and signed acquisition fields outside the finalize flow", () => {
    const staged = { source_type: "buyback", status: "intake", purchased_at: null };
    const purchased = {
      source_type: "buyback",
      status: "purchased",
      purchased_at: "2026-07-13T08:00:00.000Z",
    };

    expect(() =>
      assertInventoryUpdateDoesNotBypassBuybackAgreement({ buyback_price: 0 }, staged),
    ).toThrow(/回收成本不能通过通用库存更新修改/);
    expect(() =>
      assertInventoryUpdateDoesNotBypassBuybackAgreement({ payment_method: "cash" }, staged),
    ).not.toThrow();
    expect(() =>
      assertInventoryUpdateDoesNotBypassBuybackAgreement({ payment_method: "other" }, purchased),
    ).toThrow(/已成交回收的签署资料不能通过通用库存更新修改/);
    expect(() =>
      assertInventoryUpdateDoesNotBypassBuybackAgreement({ brand: "Other" }, purchased),
    ).toThrow(/已成交回收的签署资料不能通过通用库存更新修改/);
    expect(() =>
      assertInventoryUpdateDoesNotBypassBuybackAgreement(
        { customer_name: "Other Seller" },
        purchased,
      ),
    ).toThrow(/已成交回收的签署资料不能通过通用库存更新修改/);
    expect(() =>
      assertInventoryUpdateDoesNotBypassBuybackAgreement({ color: "Blue" }, purchased),
    ).not.toThrow();
    expect(() =>
      assertInventoryUpdateDoesNotBypassBuybackAgreement(
        { buyback_price: 1 },
        { source_type: "manual_stock", status: "listed", purchased_at: null },
      ),
    ).not.toThrow();
  });

  it("requires a dedicated reversal for a completed buyback without blocking normal processing", () => {
    const staged = { source_type: "buyback", status: "intake", purchased_at: null };
    const purchased = {
      source_type: "buyback",
      status: "purchased",
      purchased_at: "2026-07-13T08:00:00.000Z",
    };

    expect(() =>
      assertInventoryTransitionDoesNotBypassBuybackReversal("cancelled", staged),
    ).not.toThrow();
    expect(() =>
      assertInventoryTransitionDoesNotBypassBuybackReversal("data_wipe", purchased),
    ).not.toThrow();
    expect(() =>
      assertInventoryTransitionDoesNotBypassBuybackReversal("cancelled", purchased),
    ).toThrow(/专用冲正流程/);
    expect(() =>
      assertInventoryTransitionDoesNotBypassBuybackReversal("cancelled", {
        source_type: "manual_stock",
        status: "purchased",
        purchased_at: "2026-07-13T08:00:00.000Z",
      }),
    ).not.toThrow();
  });

  it("requires write-off permission before moving inventory to recycled", () => {
    const owner: AuditActor = {
      id: "staff_owner",
      displayName: "Owner",
      storeId: "store_1",
      storeRole: "owner",
    };

    expect(() => assertInventoryTransitionActor(owner, "recycled")).not.toThrow();
    expect(() =>
      assertInventoryTransitionActor({ ...owner, storeRole: "sales" }, "recycled"),
    ).toThrow();
    expect(() =>
      assertInventoryTransitionActor({ ...owner, storeRole: "sales" }, "evaluating"),
    ).not.toThrow();
  });

  it("builds status and version CAS filters for every generic inventory write", () => {
    expect(
      inventoryMutationCas({ status: "offer_made", updated_at: "2026-07-13T08:00:00.000Z" }),
    ).toEqual({ status: "offer_made", updatedAt: "2026-07-13T08:00:00.000Z" });
    expect(() => inventoryMutationCas({ status: "offer_made" })).toThrow();
  });

  it("invalidates prior inspection results when a sold buyback is returned", () => {
    expect(returnedBuybackInspectionReset({ source_type: "buyback" }, "returned")).toEqual({
      imei_check_status: "unchecked",
      activation_lock_status: "unchecked",
      data_wipe_status: "unchecked",
    });
    expect(returnedBuybackInspectionReset({ source_type: "manual_stock" }, "returned")).toEqual({});
    expect(returnedBuybackInspectionReset({ source_type: "buyback" }, "listed")).toEqual({});
  });

  it("patches only explicitly submitted quality fields", () => {
    expect(
      buildInventoryCheckItemPatch(
        { expected_updated_at: "2026-07-13T08:00:00.000Z", data_wipe_status: "pass" },
        { id: "staff_owner", displayName: "Owner", storeId: "store_1", storeRole: "owner" },
        "2026-07-13T08:01:00.000Z",
      ),
    ).toEqual({
      data_wipe_status: "pass",
      updated_by: "staff_owner",
      updated_at: "2026-07-13T08:01:00.000Z",
    });
  });

  it("blocks a buyback from sale until data wipe, IMEI and activation lock pass", () => {
    const purchased = {
      source_type: "buyback",
      status: "purchased",
      data_wipe_status: "unchecked",
      imei_check_status: "pass",
      activation_lock_status: "pass",
      functional_grade: "passed",
      cosmetic_grade: "good",
      list_price: 399,
    };
    expect(() => assertBuybackSaleReadiness(purchased, "ready_for_sale")).toThrow(
      /资料尚未确认清除/,
    );
    expect(() =>
      assertBuybackSaleReadiness({ ...purchased, data_wipe_status: "pass" }, "ready_for_sale"),
    ).not.toThrow();
    expect(() =>
      assertBuybackSaleReadiness(
        {
          ...purchased,
          data_wipe_status: "pass",
          functional_grade: "untested",
          cosmetic_grade: "unknown",
          list_price: 0,
        },
        "ready_for_sale",
      ),
    ).not.toThrow();
    expect(() =>
      assertBuybackSaleReadiness(
        { ...purchased, data_wipe_status: "pass", activation_lock_status: "fail" },
        "sold",
      ),
    ).toThrow(/账号锁/);
    expect(() =>
      assertBuybackSaleReadiness({ ...purchased, source_type: "manual_stock" }, "ready_for_sale"),
    ).not.toThrow();
    expect(() =>
      assertBuybackSaleReadiness(
        {
          ...purchased,
          source_type: "manual_stock",
          legacy_payload: { inventory_v2_intake: true },
        },
        "ready_for_sale",
      ),
    ).toThrow(/资料尚未确认清除/);
  });

  it("forces V2-linked stock through the atomic sale command", () => {
    expect(() =>
      assertLegacyInventorySaleAllowed({ legacy_payload: { inventory_v2_intake: true } }),
    ).toThrow(/必须使用原子成交入口/);
    expect(() => assertLegacyInventorySaleAllowed({ legacy_payload: {} })).not.toThrow();
  });

  it("rejects V2-linked inspection in the legacy one-sided write path", async () => {
    const row = {
      id: "item-v2-check",
      store_id: "store_1",
      status: "intake",
      updated_at: "2026-07-26T00:00:00.000Z",
      legacy_payload: { inventory_v2_intake: true },
    };
    mocks.supabase.from.mockReturnValue(createSupabaseSingleQuery(row));

    await expect(
      recordInventoryCheck(
        row.id,
        { expected_updated_at: "2026-07-25T00:00:00.000Z" },
        { id: "staff_owner", displayName: "Owner", storeId: "store_1", storeRole: "owner" },
      ),
    ).rejects.toThrow(/原子库存工作流/);
  });

  it("rejects V2-linked stock in the legacy sale path before any write", async () => {
    const row = {
      id: "item-v2-sale",
      store_id: "store_1",
      status: "listed",
      updated_at: "2026-07-26T00:00:00.000Z",
      legacy_payload: { inventory_v2_intake: true },
    };
    const readQuery = createSupabaseSingleQuery(row);
    mocks.supabase.from.mockReturnValue(readQuery);

    await expect(
      sellInventoryItem(
        row.id,
        { sale_price: 399 },
        { id: "staff_owner", displayName: "Owner", storeId: "store_1", storeRole: "owner" },
      ),
    ).rejects.toThrow(/必须使用原子成交入口/);
    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
  });

  it("rejects direct buyback payment transactions outside the finalize RPC", () => {
    expect(() =>
      assertDirectInventoryTransactionAllowed({
        transaction_type: "buyback_payment",
        amount: 300,
      }),
    ).toThrow(/只能由.*确认成交操作生成/);
    expect(() =>
      assertDirectInventoryTransactionAllowed({ transaction_type: "repair_cost", amount: 20 }),
    ).not.toThrow();
  });

  it("keeps legacy electronics import owner-only at the repository boundary", () => {
    const owner: AuditActor = {
      id: "staff_owner",
      displayName: "Owner",
      storeId: "store_1",
      storeRole: "owner",
    };
    expect(() => assertLegacyElectronicsImportActor(owner)).not.toThrow();
    expect(() => assertLegacyElectronicsImportActor({ ...owner, storeRole: "sales" })).toThrow();
  });

  it("rejects direct restricted-evidence uploads from sales before storage access", () => {
    const actor: AuditActor = {
      id: "staff_sales",
      displayName: "Sales",
      storeId: "store_1",
      storeRole: "sales",
    };
    expect(() => assertBuybackEvidenceCaptureActor(actor, "id_front")).toThrow();
    expect(() => assertBuybackEvidenceCaptureActor(actor, "invoice_photo")).toThrow();
    expect(() => assertBuybackEvidenceCaptureActor(actor, "box_photo")).toThrow();
    expect(() =>
      assertBuybackEvidenceCaptureActor({ ...actor, storeRole: "manager" }, "id_front"),
    ).not.toThrow();
    expect(() => assertBuybackEvidenceCaptureActor(actor, "device_photo", "buyback")).toThrow();
    expect(() =>
      assertBuybackEvidenceCaptureActor(actor, "device_photo", "manual_stock"),
    ).not.toThrow();
  });
});

describe("inventory repository pagination", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
  });

  it("reads filtered inventory rows beyond the first 1000 with a stable tie-breaker", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({ id: `item_${index}` }));
    const firstQuery = createSupabaseQuery({ data: firstPage, error: null });
    const secondQuery = createSupabaseQuery({ data: [{ id: "item_1000" }], error: null });
    mocks.supabase.from.mockReturnValueOnce(firstQuery).mockReturnValueOnce(secondQuery);

    const rows = await fetchInventoryRows("store_1", {
      statuses: ["listed"],
      sourceTypes: ["trade_in"],
      categories: ["phone"],
    });

    expect(rows).toHaveLength(1001);
    expect(firstQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
    expect(firstQuery.in).toHaveBeenCalledWith("status", ["listed"]);
    expect(firstQuery.in).toHaveBeenCalledWith("source_type", ["trade_in"]);
    expect(firstQuery.in).toHaveBeenCalledWith("category", ["phone"]);
    expect(firstQuery.order).toHaveBeenNthCalledWith(1, "updated_at", { ascending: false });
    expect(firstQuery.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(firstQuery.range).toHaveBeenCalledWith(0, 999);
    expect(secondQuery.range).toHaveBeenCalledWith(1000, 1999);
  });

  it("reads more than 1000 transaction rows before calculating item profit", async () => {
    const firstPage = Array.from({ length: 1000 }, () => ({
      item_id: "item_1",
      transaction_type: "repair_cost",
      amount: 1,
    }));
    const firstQuery = createSupabaseQuery({ data: firstPage, error: null });
    const secondQuery = createSupabaseQuery({
      data: [{ item_id: "item_1", transaction_type: "repair_cost", amount: 2 }],
      error: null,
    });
    mocks.supabase.from.mockReturnValueOnce(firstQuery).mockReturnValueOnce(secondQuery);

    const result = await fetchInventoryTransactionSummaries("store_1", ["item_1"]);

    expect(result.get("item_1")).toHaveLength(1001);
    expect(firstQuery.in).toHaveBeenCalledWith("item_id", ["item_1"]);
    expect(firstQuery.range).toHaveBeenCalledWith(0, 999);
    expect(secondQuery.range).toHaveBeenCalledWith(1000, 1999);
  });
});

function createSupabaseQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => result),
  };
  return query;
}

function createSupabaseSingleQuery(data: Record<string, unknown>) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(async () => ({ data, error: null })),
  };
  return query;
}
