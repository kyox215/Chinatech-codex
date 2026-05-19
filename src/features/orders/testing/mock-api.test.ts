import { describe, expect, it } from "vitest";

import type { CreateOrderInput } from "@/lib/repairdesk/types";
import {
  createOrder,
  getOrder,
  sendApprovalRequest,
  sendWhatsappNotification,
  transitionOrder,
} from "./mock-api";

let seq = 0;

async function createMockOrder(input: Partial<CreateOrderInput> = {}) {
  seq += 1;
  const result = await createOrder({
    customer_name: `Cliente Test ${seq}`,
    customer_phone: `+39333000${String(seq).padStart(4, "0")}`,
    device_brand: "Apple",
    device_model: `iPhone Test ${seq}`,
    device_imei: `TESTIMEI${seq}`,
    order_type: "quick_repair",
    status: "new",
    issue_description: "屏幕碎裂",
    technician_name: "Chen",
    fault_prices: [{ name: "屏幕", price: 120, note: "原厂 品质" }],
    deposit_amount: 20,
    ...input,
  });
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
