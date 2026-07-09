import { describe, expect, it } from "vitest";

import {
  isOrderAttachmentStorageScoped,
  projectOrderDetailForActor,
  projectOrderListItemForActor,
} from "@/features/orders/server/order.repository";
import type { AuditActor, OrderDetail, OrderListItem } from "@/lib/repairdesk/types";

const scopedOrderAttachment = {
  store_id: "store_1",
  order_id: "ord_1",
  storage_bucket: "repairdesk-order-attachments",
  storage_path: "store_1/ord_1/photo.jpg",
};

describe("order repository tenant storage boundaries", () => {
  it("allows signing only for the active store and order path", () => {
    expect(isOrderAttachmentStorageScoped(scopedOrderAttachment, "store_1", "ord_1")).toBe(true);
  });

  it("rejects attachment metadata pointing to another store path", () => {
    expect(
      isOrderAttachmentStorageScoped(
        {
          ...scopedOrderAttachment,
          storage_path: "store_2/ord_1/photo.jpg",
        },
        "store_1",
        "ord_1",
      ),
    ).toBe(false);
  });

  it("rejects attachment metadata for another order or bucket", () => {
    expect(
      isOrderAttachmentStorageScoped(
        {
          ...scopedOrderAttachment,
          order_id: "ord_2",
          storage_path: "store_1/ord_2/photo.jpg",
        },
        "store_1",
        "ord_1",
      ),
    ).toBe(false);
    expect(
      isOrderAttachmentStorageScoped(
        {
          ...scopedOrderAttachment,
          storage_bucket: "public",
        },
        "store_1",
        "ord_1",
      ),
    ).toBe(false);
  });
});

describe("order repository role projection", () => {
  it("keeps full order fields for owner", () => {
    const projected = projectOrderListItemForActor(order(), actor("owner"));

    expect(projected.customer_phone).toBe("+39 333 000 0000");
    expect(projected.quotation_amount).toBe(120);
    expect(projected.device_unlock_value).toBe("1234");
    expect(projected.supplier_id).toBe("supplier_1");
    expect(projected.finance_redacted).toBeUndefined();
  });

  it("redacts finance, contact, supplier, and unlock fields for technician list rows", () => {
    const projected = projectOrderListItemForActor(order(), actor("technician"));

    expect(projected.customer_phone).toBe("***0000");
    expect(projected.contact_phones).toEqual(["***0000"]);
    expect(projected.quotation_amount).toBe(0);
    expect(projected.deposit_amount).toBe(0);
    expect(projected.balance_amount).toBe(0);
    expect(projected.fault_prices).toEqual([]);
    expect(projected.device_unlock_method).toBeUndefined();
    expect(projected.device_unlock_value).toBeUndefined();
    expect(projected.supplier_id).toBeUndefined();
    expect(projected.supplier_name).toBeUndefined();
    expect(projected.finance_redacted).toBe(true);
    expect(projected.customer_contact_redacted).toBe(true);
    expect(projected.sensitive_redacted).toBe(true);
  });

  it("redacts detail customer contact, messages, event payloads, and attachment links", () => {
    const projected = projectOrderDetailForActor(detail(), actor("viewer"));

    expect(projected.customer?.phone_e164).toBe("***0000");
    expect(projected.customer?.email).toBeUndefined();
    expect(projected.customer?.notes).toBeUndefined();
    expect(projected.messages).toEqual([]);
    expect(projected.events[0]?.payload).toEqual({});
    expect(projected.attachments[0]).toMatchObject({
      public_url: undefined,
      signed_url: undefined,
      storage_path: "",
    });
  });
});

function actor(role: NonNullable<AuditActor["storeRole"]>): AuditActor {
  return {
    id: `staff_${role}`,
    displayName: String(role),
    role,
    storeRole: role,
    storeId: "store_1",
  };
}

function order(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: "order_1",
    public_no: "R2026001",
    order_type: "quick_repair",
    status: "new",
    customer_id: "customer_1",
    device_id: "device_1",
    issue_description: "Screen cracked",
    diagnosis_result: "Replace screen",
    quotation_amount: 120,
    deposit_amount: 20,
    balance_amount: 100,
    currency_code: "EUR",
    is_paid: false,
    approval_status: "pending",
    technician_name: "Marco",
    supplier_id: "supplier_1",
    parts_supplier_id: "supplier_1",
    contact_phones: ["+39 333 000 0000"],
    fault_prices: [{ name: "Screen", price: 120 }],
    device_unlock_method: "pin",
    device_unlock_value: "1234",
    customer_signature: "signature-data",
    created_at: "2026-07-09T10:00:00.000Z",
    updated_at: "2026-07-09T10:00:00.000Z",
    customer_name: "Cliente",
    customer_phone: "+39 333 000 0000",
    device_label: "Apple iPhone 13",
    device_imei: "490154203237518",
    supplier_name: "Alessio",
    supplier_color: "#2563eb",
    approval_overdue: false,
    pickup_overdue: false,
    ...overrides,
  };
}

function detail(): OrderDetail {
  return {
    order: order(),
    customer: {
      id: "customer_1",
      name: "Cliente",
      phone_e164: "+39 333 000 0000",
      phone_raw: "+39 333 000 0000",
      contact_phones: ["+39 333 000 0000"],
      consent_marketing: true,
      consent_sms: true,
      email: "cliente@example.com",
      notes: "private note",
      marketing_notes: "marketing note",
    },
    device: {
      id: "device_1",
      customer_id: "customer_1",
      brand: "Apple",
      model: "iPhone 13",
      serial_or_imei: "490154203237518",
    },
    supplier: {
      id: "supplier_1",
      name: "Alessio Parts",
      short_name: "Alessio",
      color: "#2563eb",
    },
    parts_supplier: {
      id: "supplier_1",
      name: "Alessio Parts",
      short_name: "Alessio",
      color: "#2563eb",
    },
    events: [
      {
        id: "event_1",
        order_id: "order_1",
        event_type: "payment",
        payload: { amount: 20 },
        operator_name: "Owner",
        created_at: "2026-07-09T10:00:00.000Z",
      },
    ],
    messages: [
      {
        id: "message_1",
        order_id: "order_1",
        channel: "whatsapp",
        message_body: "private message",
        status: "sent",
        sent_at: "2026-07-09T10:00:00.000Z",
      },
    ],
    attachments: [
      {
        id: "attachment_1",
        store_id: "store_1",
        order_id: "order_1",
        kind: "signature",
        file_name: "signature.png",
        mime_type: "image/png",
        file_size: 100,
        storage_bucket: "repairdesk-order-attachments",
        storage_path: "store_1/order_1/signature.png",
        public_url: "https://example.com/public.png",
        signed_url: "https://example.com/signed.png",
        created_at: "2026-07-09T10:00:00.000Z",
        updated_at: "2026-07-09T10:00:00.000Z",
      },
    ],
  };
}
