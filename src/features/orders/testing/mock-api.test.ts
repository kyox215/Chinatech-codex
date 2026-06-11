import { describe, expect, it } from "vitest";

import type { CreateOrderInput, PatchOrderInput, UpdateOrderInput } from "@/lib/repairdesk/types";
import {
  createOrder,
  getOrder,
  listOrders,
  patchOrder,
  patchOrderFinance,
  sendApprovalRequest,
  sendWhatsappNotification,
  transitionOrder,
  updateOrder,
} from "./mock-api";

let seq = 0;

async function createMockOrder(input: Partial<CreateOrderInput> = {}, operator = "Chen") {
  seq += 1;
  const result = await createOrder(
    {
      customer_name: `Cliente Test ${seq}`,
      customer_phone: `+39333000${String(seq).padStart(4, "0")}`,
      device_brand: "Apple",
      device_model: `iPhone Test ${seq}`,
      device_imei: `TESTIMEI${seq}`,
      order_type: "quick_repair",
      status: "new",
      issue_description: "屏幕碎裂",
      fault_prices: [{ name: "屏幕", price: 120, note: "原厂 品质" }],
      deposit_amount: 20,
      ...input,
    },
    operator,
  );
  return result.id;
}

describe("mock order WhatsApp notification workflow", () => {
  it("does not create customer messages for normal status transitions", async () => {
    const id = await createMockOrder();
    const before = await getOrder(id);

    await transitionOrder(id, "diagnosing");

    const after = await getOrder(id);
    expect(after.order.status).toBe("diagnosing");
    expect(after.messages).toHaveLength(before.messages.length);
  });

  it("moves repaired orders to notified after pickup WhatsApp is sent", async () => {
    const id = await createMockOrder();
    await transitionOrder(id, "diagnosing");
    await transitionOrder(id, "repairing");
    await transitionOrder(id, "repaired");

    const result = await sendWhatsappNotification(
      id,
      "Il dispositivo e pronto.",
      "pickup_ready",
      "notified",
    );

    const detail = await getOrder(id);
    expect(result.statusChanged).toBe(true);
    expect(result.to).toBe("notified");
    expect(detail.order.status).toBe("notified");
    const message = detail.messages.find((item) => item.id === result.id);
    expect(message).toMatchObject({
      channel: "whatsapp",
      message_body: "Il dispositivo e pronto.",
    });
    const event = detail.events.find(
      (item) => item.event_type === "message_sent" && item.payload.message_id === result.id,
    );
    expect(event?.payload).toMatchObject({
      template_kind: "pickup_ready",
      to: "notified",
    });
  });

  it("rejects invalid notification-driven transitions before writing a message", async () => {
    const id = await createMockOrder();

    await expect(
      sendWhatsappNotification(id, "Messaggio non valido", "pickup_ready", "completed"),
    ).rejects.toThrow("不能直接流转");

    const detail = await getOrder(id);
    expect(detail.order.status).toBe("new");
    expect(detail.messages.some((message) => message.message_body === "Messaggio non valido")).toBe(
      false,
    );
  });

  it("moves quoted orders to waiting approval through approval WhatsApp", async () => {
    const id = await createMockOrder();
    await transitionOrder(id, "diagnosing");
    await transitionOrder(id, "quoted");

    const result = await sendApprovalRequest(id, "Preventivo da confermare.");

    const detail = await getOrder(id);
    expect(result.statusChanged).toBe(true);
    expect(result.to).toBe("waiting_approval");
    expect(detail.order.status).toBe("waiting_approval");
    const event = detail.events.find(
      (item) => item.event_type === "approval_sent" && item.payload.message_id === result.id,
    );
    expect(event?.payload).toMatchObject({
      template_kind: "approval_request",
      to: "waiting_approval",
    });
  });
});

describe("mock order inline editing workflow", () => {
  it("assigns technician from the creator account and ignores client spoofing", async () => {
    const id = await createMockOrder(
      { technician_name: "Spoofed Tech" } as Partial<CreateOrderInput> & {
        technician_name: string;
      },
      "ALESSIO",
    );

    const detail = await getOrder(id);
    expect(detail.order.technician_name).toBe("ALESSIO");
  });

  it("stores backup phones from multi-phone order creation and finds them in search", async () => {
    const id = await createMockOrder({
      customer_phone: "+39 366 100 200 / +39 366 300 400",
    });

    const detail = await getOrder(id);
    expect(detail.customer?.phone_e164).toBe("+39 366 100 200");
    expect(detail.order.customer_phone).toBe("+39 366 100 200");
    expect(detail.order.contact_phones).toEqual(["+39 366 300 400"]);

    const matches = await listOrders({ search: "+39 366 300 400" });
    expect(matches.some((order) => order.id === id)).toBe(true);
  });

  it("patches ordinary fields and rejects stale versions", async () => {
    const id = await createMockOrder();
    const before = await getOrder(id);

    const result = await patchOrder(id, {
      expected_updated_at: before.order.updated_at,
      changes: {
        customer_name: "Cliente Aggiornato",
        device_model: "iPhone Inline",
        accessory_notes: "SIM card",
      },
    });

    const after = await getOrder(id);
    expect(result.updated_at).toBe(after.order.updated_at);
    expect(after.order.customer_name).toBe("Cliente Aggiornato");
    expect(after.order.device_label).toContain("iPhone Inline");
    expect(after.order.accessory_notes).toBe("SIM card");
    const patchEvent = after.events.find((event) => event.payload.action === "order_patched");
    expect(patchEvent?.payload).toMatchObject({
      action: "order_patched",
    });

    await expect(
      patchOrder(id, {
        expected_updated_at: "2000-01-01T00:00:00.000Z",
        changes: { issue_description: "旧页面覆盖" },
      }),
    ).rejects.toThrow("工单已被更新");
  });

  it("rejects technician changes through inline patching", async () => {
    const id = await createMockOrder({}, "Original Tech");
    const before = await getOrder(id);

    await expect(
      patchOrder(id, {
        expected_updated_at: before.order.updated_at,
        changes: { technician_name: "Other Tech" } as unknown as PatchOrderInput["changes"],
      }),
    ).rejects.toThrow("不可通过快速编辑修改");

    const after = await getOrder(id);
    expect(after.order.technician_name).toBe("Original Tech");
  });

  it("does not change technician during full order edits", async () => {
    const id = await createMockOrder({}, "Original Tech");
    const before = await getOrder(id);

    await updateOrder(
      id,
      {
        customer_name: "Cliente Editato",
        customer_phone: before.order.customer_phone,
        device_brand: "Samsung",
        device_model: "A54",
        device_imei: before.order.device_imei,
        issue_description: "Display rotto",
        diagnosis_result: "Display da sostituire",
        accessory_notes: "SIM card",
        warranty_text: "6个月",
        fault_prices: [{ name: "Display", price: 140 }],
        deposit_amount: 20,
        technician_name: "Other Tech",
      } as UpdateOrderInput & { technician_name: string },
      "Editing Operator",
    );

    const after = await getOrder(id);
    expect(after.order.customer_name).toBe("Cliente Editato");
    expect(after.order.technician_name).toBe("Original Tech");
  });

  it("updates finance only through the finance patch flow", async () => {
    const id = await createMockOrder();
    const before = await getOrder(id);

    await patchOrderFinance(id, {
      expected_updated_at: before.order.updated_at,
      fault_prices: [
        { name: "屏幕", price: 100 },
        { name: "电池", price: 50 },
      ],
      deposit_amount: 30,
    });

    const after = await getOrder(id);
    expect(after.order.quotation_amount).toBe(150);
    expect(after.order.deposit_amount).toBe(30);
    expect(after.order.balance_amount).toBe(120);
    expect(after.order.is_paid).toBe(false);
    const financeEvent = after.events.find(
      (event) => event.payload.action === "order_finance_updated",
    );
    expect(financeEvent?.payload).toMatchObject({
      action: "order_finance_updated",
      quotation_amount: 150,
      deposit_amount: 30,
      balance_amount: 120,
    });
  });
});
