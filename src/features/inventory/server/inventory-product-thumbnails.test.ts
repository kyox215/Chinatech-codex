import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";

const attachmentId = "00000000-0000-4000-8000-000000000901";
const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  download: vi.fn(),
  writeAuditLog: vi.fn(),
  client: {} as Record<string, unknown>,
}));

vi.mock("@/server/permissions", () => ({ can: mocks.can }));
vi.mock("@/server/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/server/supabase", () => ({ getSupabaseAdmin: () => mocks.client }));

import {
  listInventoryProducts,
  readInventoryProductThumbnail,
  selectProductThumbnailCandidates,
} from "./inventory-product.repository";

const actor = { id: "owner-1", storeId: "store-1", role: "owner" } as AuditActor;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.can.mockReturnValue(true);
  mocks.writeAuditLog.mockResolvedValue({ ok: true });
  mocks.download.mockResolvedValue({
    data: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }),
    error: null,
  });
  mocks.client = createClient([validAttachment()]);
});

describe("inventory product thumbnail projection", () => {
  it("returns only the latest safely scoped bound device photo candidate", () => {
    const candidates = selectProductThumbnailCandidates(
      [
        validAttachment({ created_at: "2026-08-06T10:00:00.000Z" }),
        validAttachment({
          id: "00000000-0000-4000-8000-000000000902",
          storage_path: "store-1/item-1/device_photo/00000000-0000-4000-8000-000000000902.webp",
          mime_type: "image/webp",
          created_at: "2026-08-07T10:00:00.000Z",
        }),
        validAttachment({ item_id: "item-2", storage_path: "store-1/item-2/photo.jpg" }),
        validAttachment({ sensitivity: "restricted" }),
        validAttachment({ evidence_status: "staged" }),
        validAttachment({ evidence_status: "rejected" }),
        validAttachment({ evidence_status: "deleted" }),
        validAttachment({ kind: "invoice_photo" }),
        validAttachment({ mime_type: "image/heic" }),
        validAttachment({ storage_bucket: "repairdesk-buyback-evidence" }),
        validAttachment({ storage_path: "store-2/item-1/device_photo/photo.jpg" }),
        validAttachment({ storage_path: "store-1/item-1/other/photo.jpg" }),
      ],
      "store-1",
      ["item-1"],
    );

    expect(candidates).toEqual([
      {
        attachmentId: "00000000-0000-4000-8000-000000000902",
        itemId: "item-1",
        storagePath: "store-1/item-1/device_photo/00000000-0000-4000-8000-000000000902.webp",
        mimeType: "image/webp",
        createdAt: "2026-08-07T10:00:00.000Z",
      },
    ]);
  });

  it("returns only an opaque same-origin thumbnail handle in the product list", async () => {
    const result = await listInventoryProducts({}, actor);

    expect(result.items[0]).toMatchObject({
      id: "item-1",
      thumbnail_url: `/api/repairdesk/inventory/product-thumbnails/${attachmentId}`,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("/object/sign/");
    expect(serialized).not.toContain("repairdesk-inventory-attachments");
    expect(serialized).not.toContain(`store-1/item-1/device_photo/${attachmentId}.jpg`);
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("does not query or return thumbnail handles without attachment permission", async () => {
    mocks.can.mockReturnValue(false);
    const result = await listInventoryProducts({}, { ...actor, role: "technician" });

    expect(result.items[0]).not.toHaveProperty("thumbnail_url");
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("keeps the product list available when attachment metadata cannot be read", async () => {
    mocks.client = createClient([], { attachmentError: { message: "metadata unavailable" } });

    await expect(listInventoryProducts({}, actor)).resolves.toMatchObject({
      items: [expect.not.objectContaining({ thumbnail_url: expect.anything() })],
      total: 1,
    });
  });

  it("downloads and audits a valid thumbnail without releasing its storage location", async () => {
    const result = await readInventoryProductThumbnail(attachmentId, actor);

    expect(result.contentType).toBe("image/jpeg");
    expect([...result.bytes]).toEqual([0xff, 0xd8, 0xff, 0xd9]);
    expect(mocks.download).toHaveBeenCalledWith(`store-1/item-1/device_photo/${attachmentId}.jpg`);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "read_inventory_product_thumbnail",
        entityId: attachmentId,
        metadata: { item_id: "item-1", mime_type: "image/jpeg" },
      }),
    );
  });

  it("rejects malformed same-item paths before storage access", async () => {
    mocks.client = createClient([
      validAttachment({ storage_path: `store-1/item-1/other/${attachmentId}.jpg` }),
    ]);

    await expect(readInventoryProductThumbnail(attachmentId, actor)).rejects.toMatchObject({
      status: 404,
    });
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("rejects a device-photo filename that is not bound to the attachment id", async () => {
    mocks.client = createClient([
      validAttachment({
        storage_path: "store-1/item-1/device_photo/00000000-0000-4000-8000-000000000999.jpg",
      }),
    ]);

    await expect(readInventoryProductThumbnail(attachmentId, actor)).rejects.toMatchObject({
      status: 404,
    });
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("fails closed when the thumbnail audit record cannot be written", async () => {
    mocks.writeAuditLog.mockRejectedValue(new Error("audit unavailable"));

    await expect(readInventoryProductThumbnail(attachmentId, actor)).rejects.toThrow(
      "audit unavailable",
    );
  });
});

function createClient(
  attachments: Record<string, unknown>[],
  options: { attachmentError?: { message: string } } = {},
) {
  const inventoryItems = chainableQuery();
  inventoryItems.range.mockResolvedValue({ data: [productRow()], error: null });

  const attachmentQuery = chainableQuery();
  attachmentQuery.order.mockResolvedValue({
    data: attachments,
    error: options.attachmentError ?? null,
  });
  attachmentQuery.maybeSingle.mockResolvedValue({
    data: attachments[0] ?? null,
    error: options.attachmentError ?? null,
  });

  return {
    from: vi.fn((table: string) => {
      if (table === "inventory_items") return inventoryItems;
      if (table === "inventory_attachments") return attachmentQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
    storage: {
      from: vi.fn(() => ({ download: mocks.download })),
    },
  };
}

function chainableQuery() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    maybeSingle: vi.fn(),
  };
  for (const method of ["select", "eq", "neq", "in", "order"] as const) {
    query[method].mockReturnValue(query);
  }
  return query;
}

function validAttachment(overrides: Record<string, unknown> = {}) {
  return {
    id: attachmentId,
    item_id: "item-1",
    kind: "device_photo",
    sensitivity: "internal",
    evidence_status: "bound",
    storage_bucket: "repairdesk-inventory-attachments",
    storage_path: `store-1/item-1/device_photo/${attachmentId}.jpg`,
    mime_type: "image/jpeg",
    file_size: 4,
    created_at: "2026-08-07T10:00:00.000Z",
    ...overrides,
  };
}

function productRow() {
  return {
    id: "item-1",
    public_no: "I001234",
    status: "ready_for_sale",
    source_type: "manual_stock",
    category: "phone",
    brand: "Apple",
    model: "iPhone 13",
    color: "黑色",
    storage_capacity: "128GB",
    serial_or_imei: "123456789012345",
    buyback_price: 260,
    list_price: 420,
    currency_code: "EUR",
    warranty_months: 12,
    notes: "",
    legacy_payload: {
      inventory_product_quick_create: true,
      internal_sku: "I001234",
      list_price_provided: true,
      location: "A-02",
    },
    created_at: "2026-08-07T10:00:00.000Z",
    updated_at: "2026-08-07T10:00:00.000Z",
  };
}
