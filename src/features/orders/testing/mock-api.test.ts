import { describe, expect, it } from "vitest";

import type { CreateOrderInput, PatchOrderInput, UpdateOrderInput } from "@/lib/repairdesk/types";
import {
  createOrder,
  decideOrderApproval,
  getOrder,
  listOrders,
  patchOrder,
  patchOrderFinance,
  recordPayment,
  sendApprovalRequest,
  sendWhatsappNotification,
  transitionOrder,
  updateOrder,
  uploadOrderAttachment,
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

  it("records transition reasons and turns unfixed pickup reasons into diagnosis conclusions", async () => {
    const id = await createMockOrder();
    const beforePatch = await getOrder(id);
    await patchOrder(id, {
      expected_updated_at: beforePatch.order.updated_at,
      changes: { diagnosis_result: "初步检测：主板异常" },
    });
    await transitionOrder(id, "diagnosing");

    await transitionOrder(id, "unfixed_pickup", {
      reason: "维修风险过高，客户确认不继续维修并取回设备。",
    });

    const detail = await getOrder(id);
    expect(detail.order.status).toBe("unfixed_pickup");
    expect(detail.order.diagnosis_result).toContain("处理结论：维修风险过高");
    const event = detail.events.find(
      (item) => item.event_type === "status_changed" && item.payload.to === "unfixed_pickup",
    );
    expect(event?.payload).toMatchObject({
      to: "unfixed_pickup",
      reason: "维修风险过高，客户确认不继续维修并取回设备。",
    });
    expect(detail.messages).toHaveLength(0);
  });

  it("persists uploaded attachments into order detail and timeline", async () => {
    const id = await createMockOrder();

    const result = await uploadOrderAttachment(
      id,
      {
        kind: "fault_photo",
        file_name: "fault.jpg",
        mime_type: "image/jpeg",
        file_size: 4,
        data_base64: "ZmFrZQ==",
        note: "屏幕破裂照片",
      },
      { id: "staff-1", displayName: "ALESSIO", storeId: "mock-store", role: "technician" },
    );

    const detail = await getOrder(id);
    expect(detail.attachments[0]).toMatchObject({
      id: result.attachment.id,
      kind: "fault_photo",
      file_name: "fault.jpg",
      uploaded_by: "ALESSIO",
    });
    expect(detail.attachments[0].signed_url).toContain("data:image/jpeg;base64");
    expect(
      detail.events.some(
        (event) =>
          event.event_type === "note" &&
          event.payload.action === "attachment_uploaded" &&
          event.payload.attachment_id === result.attachment.id,
      ),
    ).toBe(true);
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
      "Chen",
      "+39 333 123 4567",
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
      recipient_phone: "+39 333 123 4567",
      to: "notified",
    });
    expect(result.recipient_phone).toBe("+39 333 123 4567");
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

  it("requires reasons for exception transitions", async () => {
    const id = await createMockOrder();

    await expect(transitionOrder(id, "cancelled")).rejects.toThrow("需要填写原因");
    await transitionOrder(id, "cancelled", { reason: "客户主动取消本次维修。" });

    const detail = await getOrder(id);
    expect(detail.order.status).toBe("cancelled");
    expect(detail.order.cancel_reason).toBe("客户主动取消本次维修。");
  });

  it("does not complete an unpaid order", async () => {
    const id = await createMockOrder();
    await transitionOrder(id, "diagnosing");
    await transitionOrder(id, "repairing");
    await transitionOrder(id, "repaired");

    await expect(transitionOrder(id, "completed")).rejects.toThrow("未结清尾款");
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

  it("records customer approval and moves the order into repair", async () => {
    const id = await createMockOrder();
    await transitionOrder(id, "diagnosing");
    await transitionOrder(id, "quoted");
    await sendApprovalRequest(id, "Preventivo da confermare.");

    const result = await decideOrderApproval(id, {
      decision: "approved",
      next_status: "repairing",
      reason: "客户 WhatsApp 确认同意报价。",
    });

    const detail = await getOrder(id);
    expect(result).toMatchObject({
      decision: "approved",
      to: "repairing",
      approval_flow_status: "approved",
    });
    expect(detail.order.status).toBe("repairing");
    expect(detail.order.approval_status).toBe("approved");
    expect(detail.order.approval_flow_status).toBe("approved");
    expect(
      detail.events.some(
        (event) => event.event_type === "approval_result" && event.payload.result === "approved",
      ),
    ).toBe(true);
  });

  it("requires a reason when the customer rejects the quote", async () => {
    const id = await createMockOrder();
    await transitionOrder(id, "diagnosing");
    await transitionOrder(id, "quoted");
    await sendApprovalRequest(id, "Preventivo da confermare.");

    await expect(decideOrderApproval(id, { decision: "rejected" })).rejects.toThrow("需要填写原因");

    await decideOrderApproval(id, {
      decision: "rejected",
      next_status: "unfixed_pickup",
      reason: "维修风险过高，客户确认不继续维修并取回设备。",
    });

    const detail = await getOrder(id);
    expect(detail.order.status).toBe("unfixed_pickup");
    expect(detail.order.approval_status).toBe("rejected");
    expect(detail.order.approval_flow_status).toBe("rejected");
    expect(detail.order.exception_status).toBe("returned_unfixed");
    expect(detail.order.diagnosis_result).toContain("维修风险过高");
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
        expected_updated_at: before.order.updated_at,
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

  it("uses optimistic locking for full edits and payments", async () => {
    const id = await createMockOrder();
    const before = await getOrder(id);

    await expect(
      updateOrder(
        id,
        {
          expected_updated_at: "2000-01-01T00:00:00.000Z",
          customer_name: before.order.customer_name,
          customer_phone: before.order.customer_phone,
          device_brand: "Apple",
          device_model: "iPhone",
          issue_description: before.order.issue_description,
          fault_prices: before.order.fault_prices,
          deposit_amount: before.order.deposit_amount,
        },
        "Editing Operator",
      ),
    ).rejects.toThrow("工单已被更新");

    await expect(recordPayment(id, 10, "现金", "Cashier")).rejects.toThrow("缺少工单版本时间");
    await expect(
      recordPayment(id, 10, "现金", "Cashier", "2000-01-01T00:00:00.000Z"),
    ).rejects.toThrow("工单已被更新");

    const result = await recordPayment(id, 10, "现金", "Cashier", before.order.updated_at);
    const after = await getOrder(id);
    expect(result.updated_at).toBe(after.order.updated_at);
    expect(after.order.balance_amount).toBe(before.order.balance_amount - 10);
    expect(after.order.payment_status).toBe("partial");
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
