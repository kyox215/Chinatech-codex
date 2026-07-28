import { describe, expect, it } from "vitest";

import type { CreateOrderInput, PatchOrderInput, UpdateOrderInput } from "@/lib/repairdesk/types";
import { orders as mockOrders } from "@/lib/mock/state";
import { createMockSupplier, resetMockSuppliers } from "@/features/suppliers/testing/mock-api";
import {
  confirmCancelledOrderReturn,
  correctTerminalOrder,
  createOrderWorkflowStatus,
  createOrder,
  decideOrderApproval,
  getOrder,
  listOrderWorkflow,
  listOrders,
  listOrdersPage,
  patchOrder,
  patchOrderFinance,
  publishOrderQuote,
  confirmOrderQuoteSent,
  recordPayment,
  sendNotification,
  sendApprovalRequest,
  sendWhatsappNotification,
  transitionOrder,
  updateOrder,
  updateOrderCustody,
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

describe("mock atomic diagnosis quote workflow", () => {
  it("rejects an initial status that requires custody while the customer keeps the device", async () => {
    await expect(
      createMockOrder({
        status: "diagnosing",
        device_custody_status: "with_customer",
        issue_description: "",
        fault_prices: [{ name: "检测项目", price: 80 }],
        deposit_amount: 20,
      }),
    ).rejects.toThrow("客户持有设备时不能使用需要门店保管设备的初始状态");
  });

  it("publishes an opaque quote revision, replays safely and confirms manual WhatsApp sending", async () => {
    const id = await createMockOrder({
      issue_description: "客户暂时无法确认具体故障，需检测。",
      fault_prices: [],
      deposit_amount: 0,
    });
    const before = await getOrder(id);
    const input = {
      expected_updated_at: before.order.updated_at,
      idempotency_key: crypto.randomUUID(),
      diagnosis_result: "检测确认电池健康度过低",
      fault_prices: [{ name: "更换电池", price: 59, currency_code: "EUR" as const }],
    };
    const published = await publishOrderQuote(id, input);
    expect(published).toMatchObject({
      code: "published",
      quotation_amount: 59,
      status: "quoted",
      replayed: false,
    });
    expect(published.quote_event_id).toMatch(/^[0-9a-f-]{36}$/i);

    const replay = await publishOrderQuote(id, input);
    expect(replay).toMatchObject({
      code: "idempotent_replay",
      quote_event_id: published.quote_event_id,
      replayed: true,
    });

    const confirmed = await confirmOrderQuoteSent(id, {
      expected_updated_at: published.updated_at,
      idempotency_key: crypto.randomUUID(),
      quote_event_id: published.quote_event_id,
      message_body: "Preventivo pronto: €59",
    });
    expect(confirmed).toMatchObject({
      code: "confirmed",
      quote_event_id: published.quote_event_id,
      from: "quoted",
      to: "waiting_approval",
    });
    const after = await getOrder(id);
    expect(after.order.status).toBe("waiting_approval");
    expect(after.order.approval_flow_status).toBe("waiting_customer");
    expect(after.messages[0]).toMatchObject({
      id: confirmed.message_id,
      message_body: "Preventivo pronto: €59",
      status: "sent",
    });
  });

  it("rejects a quote below already received money and an outdated notification revision", async () => {
    const id = await createMockOrder({
      fault_prices: [{ name: "初始检测", price: 120 }],
      deposit_amount: 20,
    });
    const before = await getOrder(id);
    await expect(
      publishOrderQuote(id, {
        expected_updated_at: before.order.updated_at,
        idempotency_key: crypto.randomUUID(),
        diagnosis_result: "检测完成",
        fault_prices: [{ name: "折价维修", price: 10 }],
      }),
    ).rejects.toThrow("已经收取");

    const first = await publishOrderQuote(id, {
      expected_updated_at: before.order.updated_at,
      idempotency_key: crypto.randomUUID(),
      diagnosis_result: "检测完成",
      fault_prices: [{ name: "维修", price: 120 }],
    });
    const changed = await patchOrder(id, {
      expected_updated_at: first.updated_at,
      changes: { diagnosis_result: "检测结论已更新" },
    });
    await expect(
      confirmOrderQuoteSent(id, {
        expected_updated_at: changed.updated_at,
        idempotency_key: crypto.randomUUID(),
        quote_event_id: first.quote_event_id,
        message_body: "Preventivo pronto",
      }),
    ).rejects.toThrow("报价内容已变化");
  });
});

describe("mock order WhatsApp notification workflow", () => {
  it("rejects customer notifications after an order is voided", async () => {
    const id = await createMockOrder();
    const row = mockOrders.find((item) => item.id === id);
    if (!row) throw new Error("fixture order missing");
    row.record_state = "voided";
    row.deleted_at = "2026-07-16T20:00:00.000Z";

    await expect(sendNotification(id, "Test message")).rejects.toThrow("已作废");
    await expect(sendWhatsappNotification(id, "Test WhatsApp", "repair_status")).rejects.toThrow(
      "已作废",
    );
  });

  it("binds workflow snapshots to the requesting active store", async () => {
    const workflow = await listOrderWorkflow({
      id: "staff-store-scope",
      displayName: "Store owner",
      role: "owner",
      storeRole: "owner",
      storeId: "store-scope-1",
    });

    expect(workflow.statuses.every((status) => status.store_id === "store-scope-1")).toBe(true);
    expect(
      workflow.transitions.every((transition) => transition.store_id === "store-scope-1"),
    ).toBe(true);
  });

  it("creates a non-empty public order number for new orders", async () => {
    const id = await createMockOrder();
    const detail = await getOrder(id);

    expect(detail.order.public_no).toMatch(/^R\d+$/);
  });

  it("enforces assigned-order scope and kiosk capability in mock detail reads", async () => {
    const id = await createMockOrder();
    const row = mockOrders.find((item) => item.id === id);
    if (!row) throw new Error("fixture order missing");
    row.assignee_membership_id = "membership_assigned";

    const assignedTechnician = {
      id: "staff_assigned",
      displayName: "Assigned technician",
      role: "technician" as const,
      storeRole: "technician" as const,
      storeId: "00000000-0000-0000-0000-000000000001",
      activeMembershipId: "membership_assigned",
    };
    const otherTechnician = {
      ...assignedTechnician,
      id: "staff_other",
      activeMembershipId: "membership_other",
    };

    await expect(getOrder(id, assignedTechnician)).resolves.toMatchObject({
      capabilities: { canCreateKioskSession: true },
    });
    await expect(getOrder(id, otherTechnician)).rejects.toThrow("当前工单未分配给你");

    row.record_state = "voided";
    await expect(getOrder(id, assignedTechnician)).resolves.toMatchObject({
      capabilities: { canCreateKioskSession: false },
    });
  });

  it("derives custom terminal behavior from the workflow registry", async () => {
    const doneCode = `custom_done_${seq + 1}`;
    await createOrderWorkflowStatus({
      code: doneCode,
      label: "自定义完成",
      short_label: "完成",
      tone: "success",
      bucket: "done",
      enabled: true,
      show_in_order_filters: true,
      allowed_for_create: true,
    });
    const completedId = await createMockOrder({
      status: doneCode,
      device_custody_status: "with_customer",
    });
    const completedRow = mockOrders.find((item) => item.id === completedId);
    if (!completedRow) throw new Error("fixture order missing");
    completedRow.workflow_status = "repair";

    const completed = await getOrder(completedId);
    expect(completed.order.workflow_bucket).toBe("done");
    expect(completed.capabilities).toMatchObject({
      canTransition: false,
      canCorrect: true,
      canReopen: true,
    });
    await expect(
      correctTerminalOrder(completedId, {
        expected_updated_at: completed.order.updated_at,
        idempotency_key: crypto.randomUUID(),
        reason: "custom terminal correction",
        changes: { diagnosis_result: "custom terminal confirmed" },
      }),
    ).resolves.toMatchObject({ code: "recorded" });

    const cancelledCode = `custom_cancelled_${seq + 1}`;
    await createOrderWorkflowStatus({
      code: cancelledCode,
      label: "自定义取消",
      short_label: "取消",
      tone: "danger",
      bucket: "cancelled",
      enabled: true,
      show_in_order_filters: true,
      allowed_for_create: true,
    });
    const cancelledId = await createMockOrder({
      status: cancelledCode,
      device_custody_status: "with_shop",
    });
    const cancelled = await getOrder(cancelledId);
    expect(cancelled.capabilities.canConfirmCancelledReturn).toBe(true);
    await expect(
      confirmCancelledOrderReturn(cancelledId, {
        expectedUpdatedAt: cancelled.order.updated_at,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).resolves.toMatchObject({ alreadyConfirmed: false });
  });

  it("sorts order cards by simplified progress from 1 to 5", async () => {
    const marker = `SortFlowAlpha${"x".repeat(seq + 1)}`;
    const intakeId = await createMockOrder({ customer_name: `${marker} intake` });
    const quoteId = await createMockOrder({
      customer_name: `${marker} quote`,
      status: "diagnosing",
    });
    const repairId = await createMockOrder({ customer_name: `${marker} repair` });
    await transitionOrder(repairId, "mail_in_progress", { reason: "外修检测" });
    const pickupId = await createMockOrder({ customer_name: `${marker} pickup` });
    await transitionOrder(pickupId, "waiting_pickup");
    const closedId = await createMockOrder({
      customer_name: `${marker} closed`,
      deposit_amount: 120,
    });
    await transitionOrder(closedId, "completed");

    const matches = await listOrders({ search: marker, view: "all" });

    expect(matches.map((order) => order.id)).toEqual([
      intakeId,
      quoteId,
      repairId,
      pickupId,
      closedId,
    ]);
    expect(matches.map((order) => order.workflow_status)).toEqual([
      "intake",
      "diagnosis",
      "repair",
      "pickup",
      "closed",
    ]);
  });

  it("keeps terminal mock orders in history and counts only nonterminal pending work", async () => {
    const technician = `QueueVisibility${"x".repeat(seq + 1)}`;
    const activeId = await createMockOrder({}, technician);
    const completedId = await createMockOrder({}, technician);
    const cancelledId = await createMockOrder({}, technician);
    await transitionOrder(activeId, "repaired");
    await transitionOrder(completedId, "completed");
    await transitionOrder(cancelledId, "cancelled", { reason: "测试作废" });

    const active = await listOrdersPage({ technicians: [technician], pageSize: 10 });
    const history = await listOrdersPage({
      view: "archive",
      technicians: [technician],
      pageSize: 10,
    });
    const unpaidHistory = await listOrdersPage({
      view: "archive",
      technicians: [technician],
      paid: "unpaid",
      pageSize: 10,
    });

    expect(active.items.map((order) => order.id)).toEqual([activeId]);
    expect(active.total).toBe(1);
    expect(active.queueCounts).toMatchObject({ all: 1, repaired: 1 });
    expect(active.resultGroupCounts).toMatchObject({ repaired: 1, completed: 0, cancelled: 0 });
    expect(history.items.map((order) => order.id).sort()).toEqual(
      [completedId, cancelledId].sort(),
    );
    expect(history.resultGroupCounts).toMatchObject({ completed: 1, cancelled: 1 });
    expect(unpaidHistory.items.some((order) => order.id === cancelledId)).toBe(false);

    const completedNo = (await getOrder(completedId)).order.public_no;
    const groupedHistorySearch = await listOrdersPage({
      search: completedNo,
      queueGroups: ["processing"],
      pageSize: 10,
    });
    expect(groupedHistorySearch.items).toEqual([]);
  });

  it("creates an intake timeline event for new mock orders", async () => {
    const id = await createMockOrder({ order_type: "dropoff_repair" }, "ALESSIO");

    const detail = await getOrder(id);
    const createdEvent = detail.events.find((event) => event.event_type === "created");

    expect(createdEvent).toBeDefined();
    expect(createdEvent?.payload).toMatchObject({
      type: "dropoff_repair",
      warranty_months: 6,
    });
    expect(createdEvent?.operator_name).toBe("ALESSIO");
  });

  it("does not create customer messages for normal status transitions", async () => {
    const id = await createMockOrder();
    const before = await getOrder(id);

    await transitionOrder(id, "diagnosing");

    const after = await getOrder(id);
    expect(after.order.status).toBe("diagnosing");
    expect(after.messages).toHaveLength(before.messages.length);
  });

  it("allows manual transitions to any enabled order status and records the timeline", async () => {
    const id = await createMockOrder();

    await transitionOrder(id, "parts_arrived");

    const detail = await getOrder(id);
    expect(detail.order.status).toBe("parts_arrived");
    const event = detail.events.find(
      (item) => item.event_type === "status_changed" && item.payload.to === "parts_arrived",
    );
    expect(event?.payload).toMatchObject({
      from: "new",
      to: "parts_arrived",
    });
  });

  it("rejects canonical workflow group names as transition targets", async () => {
    const id = await createMockOrder();

    await expect(
      transitionOrder(id, "quote" as Parameters<typeof transitionOrder>[1]),
    ).rejects.toThrow("不能使用主流程分组");

    const detail = await getOrder(id);
    expect(detail.order.status).toBe("new");
  });

  it("rejects unmapped custom statuses for both new orders and real transitions", async () => {
    const code = `waiting_vendor_${seq + 1}`;
    await createOrderWorkflowStatus({
      code,
      label: "等待供应商",
      short_label: "等供货",
      tone: "warn",
      bucket: "custom",
      enabled: true,
      show_in_order_filters: true,
      allowed_for_create: true,
    });
    const id = await createMockOrder();

    await expect(transitionOrder(id, code)).rejects.toThrow("尚未绑定主流程阶段");
    await expect(createMockOrder({ status: code })).rejects.toThrow("尚未绑定主流程阶段");
    await expect(
      sendWhatsappNotification(id, "Stato personalizzato", "pickup_ready", code),
    ).rejects.toThrow("尚未绑定主流程阶段");

    const detail = await getOrder(id);
    expect(detail.order.status).toBe("new");
    expect(detail.order.completed_at).toBeUndefined();
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
      {
        id: "staff-1",
        displayName: "ALESSIO",
        storeId: "00000000-0000-0000-0000-000000000001",
        role: "technician",
      },
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

  it("marks mock orders as notified after generic notification", async () => {
    const id = await createMockOrder();

    const result = await sendNotification(id, "Messaggio al cliente.");

    const detail = await getOrder(id);
    expect(result.ok).toBe(true);
    expect(detail.order.notify_status).toBe("sent");
    expect(
      detail.messages.some((message) => message.message_body === "Messaggio al cliente."),
    ).toBe(true);
  });

  it("rejects invalid notification-driven transitions before writing a message", async () => {
    const id = await createMockOrder();

    await expect(
      sendWhatsappNotification(id, "Messaggio non valido", "pickup_ready", "completed"),
    ).rejects.toThrow("必须使用专用状态操作");

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
    expect(detail.order.delivered_at).toBeUndefined();

    const returned = await confirmCancelledOrderReturn(id, {
      expectedUpdatedAt: detail.order.updated_at,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(returned.alreadyConfirmed).toBe(false);
    const afterReturn = await getOrder(id);
    expect(afterReturn.order.status).toBe("cancelled");
    expect(afterReturn.order.delivered_at).toBeDefined();
  });

  it("supports external repair handoff after an in-house repair attempt", async () => {
    const id = await createMockOrder({
      fault_prices: [{ name: "主板维修", price: 180, note: "外修报价" }],
      deposit_amount: 0,
    });

    await transitionOrder(id, "diagnosing");
    await transitionOrder(id, "repairing");
    await expect(transitionOrder(id, "mail_in_progress")).rejects.toThrow("需要填写原因");
    await transitionOrder(id, "mail_in_progress", {
      reason: "店内已尝试维修但未修复，需转外修继续检测和维修。",
    });

    const mailed = await getOrder(id);
    expect(mailed.order.status).toBe("mail_in_progress");
    expect(mailed.order.workflow_status).toBe("repair");
    const mailEvent = mailed.events.find(
      (event) => event.event_type === "status_changed" && event.payload.to === "mail_in_progress",
    );
    expect(mailEvent?.payload).toMatchObject({
      to: "mail_in_progress",
      reason: "店内已尝试维修但未修复，需转外修继续检测和维修。",
    });

    await transitionOrder(id, "repaired");
    const repaired = await getOrder(id);
    expect(repaired.order.status).toBe("repaired");
  });

  it("records handover without erasing an unpaid balance", async () => {
    const id = await createMockOrder();
    await transitionOrder(id, "diagnosing");
    await transitionOrder(id, "repairing");
    await transitionOrder(id, "repaired");

    await transitionOrder(id, "completed");

    const detail = await getOrder(id);
    expect(detail.order.status).toBe("completed");
    expect(detail.order.balance_amount).toBe(100);
    expect(detail.order.is_paid).toBe(false);
    expect(detail.order.payment_status).not.toBe("paid");
    expect(detail.order.delivered_at).toBeDefined();
  });

  it("does not hide contradictory payment evidence during completion", async () => {
    const id = await createMockOrder();
    await transitionOrder(id, "diagnosing");
    await transitionOrder(id, "repairing");
    await transitionOrder(id, "repaired");
    const raw = mockOrders.find((order) => order.id === id);
    expect(raw).toBeDefined();
    raw!.balance_amount = 0;
    raw!.is_paid = false;
    raw!.payment_status = "unpaid";

    await transitionOrder(id, "completed");

    const detail = await getOrder(id);
    expect(detail.order.status).toBe("completed");
    expect(detail.order.balance_amount).toBe(0);
    expect(detail.order.is_paid).toBe(false);
    expect(detail.order.payment_status).toBe("unpaid");
    expect(detail.order.completed_at).toBeDefined();
    expect(detail.order.delivered_at).toBeDefined();
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

  it("blocks approval requests outside quote stages", async () => {
    const id = await createMockOrder();

    await expect(sendApprovalRequest(id, "Preventivo fuori fase.")).rejects.toThrow(
      "只有报价或待审批阶段可以发送客户审批",
    );

    const detail = await getOrder(id);
    expect(detail.order.status).toBe("new");
    expect(detail.order.approval_flow_status).not.toBe("waiting_customer");
    expect(
      detail.messages.some((message) => message.message_body === "Preventivo fuori fase."),
    ).toBe(false);
  });

  it("blocks direct exits from quote stages without approval decision", async () => {
    const id = await createMockOrder();
    await transitionOrder(id, "diagnosing");
    await transitionOrder(id, "quoted");

    await expect(transitionOrder(id, "repairing")).rejects.toThrow("必须通过审批处理");
    await expect(transitionOrder(id, "cancelled", { reason: "客户不再维修。" })).rejects.toThrow(
      "必须通过审批处理",
    );

    const quotedDetail = await getOrder(id);
    expect(quotedDetail.order.status).toBe("quoted");
    expect(quotedDetail.order.approval_status).toBe("pending");

    await sendApprovalRequest(id, "Preventivo da confermare.");

    await expect(transitionOrder(id, "parts_ordered")).rejects.toThrow("必须通过审批处理");
    await expect(transitionOrder(id, "cancelled", { reason: "客户拒绝报价。" })).rejects.toThrow(
      "必须通过审批处理",
    );

    const waitingDetail = await getOrder(id);
    expect(waitingDetail.order.status).toBe("waiting_approval");
    expect(waitingDetail.order.approval_flow_status).toBe("waiting_customer");
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

  it("records customer approval and moves the order into parts ordering", async () => {
    const id = await createMockOrder();
    await transitionOrder(id, "diagnosing");
    await transitionOrder(id, "quoted");
    await sendApprovalRequest(id, "Preventivo da confermare.");

    const result = await decideOrderApproval(id, {
      decision: "approved",
      next_status: "parts_ordered",
      reason: "客户同意报价，需要等待订件。",
    });

    const detail = await getOrder(id);
    expect(result).toMatchObject({
      decision: "approved",
      to: "parts_ordered",
      approval_flow_status: "approved",
    });
    expect(detail.order.status).toBe("parts_ordered");
    expect(detail.order.workflow_status).toBe("parts");
    expect(detail.order.parts_status).toBe("ordered");
    expect(detail.order.approval_status).toBe("approved");
  });

  it("records customer approval and moves the order into external repair", async () => {
    const id = await createMockOrder({
      fault_prices: [{ name: "主板维修", price: 180, note: "外修报价" }],
      deposit_amount: 0,
    });
    await transitionOrder(id, "diagnosing");
    await transitionOrder(id, "quoted");
    await sendApprovalRequest(id, "Preventivo scheda madre da confermare.");

    const result = await decideOrderApproval(id, {
      decision: "approved",
      next_status: "mail_in_progress",
      reason: "客户同意主板外修报价。",
    });

    const detail = await getOrder(id);
    expect(result).toMatchObject({
      decision: "approved",
      to: "mail_in_progress",
      approval_flow_status: "approved",
    });
    expect(detail.order.status).toBe("mail_in_progress");
    expect(detail.order.workflow_status).toBe("repair");
    expect(detail.order.approval_status).toBe("approved");
  });

  it("records direct quoted approval and moves the order into parts ordering", async () => {
    const id = await createMockOrder();
    await transitionOrder(id, "diagnosing");
    await transitionOrder(id, "quoted");

    const result = await decideOrderApproval(id, {
      decision: "approved",
      next_status: "parts_ordered",
      reason: "客户在柜台确认同意报价，需要订件。",
    });

    const detail = await getOrder(id);
    expect(result).toMatchObject({
      decision: "approved",
      to: "parts_ordered",
      approval_flow_status: "approved",
    });
    expect(detail.order.status).toBe("parts_ordered");
    expect(detail.order.workflow_status).toBe("parts");
    expect(detail.order.parts_status).toBe("ordered");
    expect(
      detail.events.some(
        (event) =>
          event.event_type === "approval_result" &&
          event.payload.result === "approved" &&
          event.payload.to === "parts_ordered",
      ),
    ).toBe(true);
  });

  it("rejects approval decisions with invalid next status targets", async () => {
    const id = await createMockOrder();
    await transitionOrder(id, "diagnosing");
    await transitionOrder(id, "quoted");
    await sendApprovalRequest(id, "Preventivo da confermare.");

    await expect(
      decideOrderApproval(id, {
        decision: "approved",
        next_status: "completed" as Parameters<typeof decideOrderApproval>[1]["next_status"],
      }),
    ).rejects.toThrow("客户同意后只能进入维修、订件或寄修流程");

    await expect(
      decideOrderApproval(id, {
        decision: "rejected",
        next_status: "repairing" as Parameters<typeof decideOrderApproval>[1]["next_status"],
        reason: "客户拒绝报价。",
      }),
    ).rejects.toThrow("客户拒绝后只能进入未修取机或取消流程");

    const detail = await getOrder(id);
    expect(detail.order.status).toBe("waiting_approval");
    expect(detail.order.approval_flow_status).toBe("waiting_customer");
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

  it("records rejected approval and cancels the order with a reason", async () => {
    const id = await createMockOrder();
    await transitionOrder(id, "diagnosing");
    await transitionOrder(id, "quoted");
    await sendApprovalRequest(id, "Preventivo da confermare.");

    const result = await decideOrderApproval(id, {
      decision: "rejected",
      next_status: "cancelled",
      reason: "客户拒绝报价并取消维修。",
    });

    const detail = await getOrder(id);
    expect(result).toMatchObject({
      decision: "rejected",
      to: "cancelled",
      approval_flow_status: "rejected",
    });
    expect(detail.order.status).toBe("cancelled");
    expect(detail.order.exception_status).toBe("cancelled");
    expect(detail.order.cancel_reason).toBe("客户拒绝报价并取消维修。");
    expect(detail.order.approval_status).toBe("rejected");
  });
});

describe("mock order inline editing workflow", () => {
  it("creates both custody states explicitly while retaining customer-held unlock credentials", async () => {
    const id = await createMockOrder({
      device_custody_status: "with_customer",
      device_unlock: { method: "pin", value: "001258" },
    });
    const detail = await getOrder(id);

    expect(detail.order.device_custody_status).toBe("with_customer");
    expect(detail.order.delivered_at).toBeUndefined();
    expect(detail.order.device_unlock_method).toBe("pin");
    expect(detail.order.device_unlock_value).toBe("001258");
    expect(detail.events.find((event) => event.event_type === "created")?.payload).toMatchObject({
      device_custody_status: "with_customer",
    });
    await expect(transitionOrder(id, "diagnosing")).rejects.toThrow("设备当前未留店");
  });

  it("records return and receive as versioned custody events while clearing current-cycle delivery", async () => {
    const id = await createMockOrder({
      device_custody_status: "with_shop",
      device_unlock: { method: "pin", value: "001258" },
    });
    const created = await getOrder(id);
    const createdUpdatedAt = created.order.updated_at;

    const returned = await updateOrderCustody(id, {
      expected_updated_at: createdUpdatedAt,
      device_custody_status: "with_customer",
      idempotency_key: "00000000-0000-4000-8000-000000000701",
    });
    const afterReturn = await getOrder(id);
    expect(afterReturn.order.delivered_at).toBeDefined();
    expect(afterReturn.order.device_unlock_method).toBe("pin");
    expect(afterReturn.order.device_unlock_value).toBe("001258");

    const replay = await updateOrderCustody(id, {
      expected_updated_at: createdUpdatedAt,
      device_custody_status: "with_customer",
      idempotency_key: "00000000-0000-4000-8000-000000000701",
    });
    expect(replay.updated_at).toBe(returned.updated_at);

    await expect(
      updateOrderCustody(id, {
        expected_updated_at: new Date(Date.parse(createdUpdatedAt) - 1_000).toISOString(),
        device_custody_status: "with_shop",
        idempotency_key: "00000000-0000-4000-8000-000000000702",
      }),
    ).rejects.toThrow("工单已被更新");

    await updateOrderCustody(id, {
      expected_updated_at: afterReturn.order.updated_at,
      device_custody_status: "with_shop",
      idempotency_key: "00000000-0000-4000-8000-000000000703",
    });
    const received = await getOrder(id);
    expect(received.order.device_custody_status).toBe("with_shop");
    expect(received.order.delivered_at).toBeUndefined();
    expect(
      received.events.find((event) => event.payload.action === "device_custody_changed")?.payload,
    ).toMatchObject({
      from: "with_customer",
      to: "with_shop",
      prior_delivery_recorded: true,
    });
  });

  it("does not hand a shop-held device back while a physical repair stage is active", async () => {
    const id = await createMockOrder({ device_custody_status: "with_shop" });
    const row = mockOrders.find((item) => item.id === id);
    if (!row) throw new Error("fixture order missing");
    row.status = "repairing";
    row.workflow_status = "repair";
    const current = await getOrder(id);

    await expect(
      updateOrderCustody(id, {
        expected_updated_at: current.order.updated_at,
        device_custody_status: "with_customer",
        idempotency_key: "00000000-0000-4000-8000-000000000710",
      }),
    ).rejects.toThrow("当前流程需要设备留在门店");
  });

  it("uses the dedicated return flow for exception-only cancellation", async () => {
    const id = await createMockOrder({ device_custody_status: "with_shop" });
    const row = mockOrders.find((item) => item.id === id);
    if (!row) throw new Error("fixture order missing");
    row.status = "new";
    row.exception_status = "cancelled";
    row.workflow_status = "closed";
    const current = await getOrder(id);
    const owner = {
      displayName: "Owner",
      role: "owner" as const,
      storeRole: "owner" as const,
      storeId: "store_1",
    };

    await expect(
      updateOrderCustody(
        id,
        {
          expected_updated_at: current.order.updated_at,
          device_custody_status: "with_customer",
          idempotency_key: "00000000-0000-4000-8000-000000000711",
          reason: "取消后退还",
        },
        owner,
      ),
    ).rejects.toThrow("请使用“确认设备已退还”");

    await expect(
      confirmCancelledOrderReturn(id, {
        expectedUpdatedAt: current.order.updated_at,
        idempotencyKey: "00000000-0000-4000-8000-000000000712",
        operator: owner,
      }),
    ).resolves.toMatchObject({ ok: true, alreadyConfirmed: false });
  });

  it("distinguishes delivered completion from never-received administrative closure", async () => {
    const shopId = await createMockOrder({ device_custody_status: "with_shop" });
    await transitionOrder(shopId, "completed", {
      idempotencyKey: "00000000-0000-4000-8000-000000000704",
    });
    const delivered = await getOrder(shopId);
    expect(delivered.order.completed_at).toBeDefined();
    expect(delivered.order.delivered_at).toBeDefined();
    expect(delivered.order.device_custody_status).toBe("with_customer");
    expect(
      delivered.events.find((event) => event.payload.custody_outcome === "delivered")?.payload,
    ).toMatchObject({ custody_outcome: "delivered" });

    const customerId = await createMockOrder({ device_custody_status: "with_customer" });
    await transitionOrder(customerId, "completed", {
      idempotencyKey: "00000000-0000-4000-8000-000000000705",
    });
    const neverReceived = await getOrder(customerId);
    expect(neverReceived.order.completed_at).toBeDefined();
    expect(neverReceived.order.delivered_at).toBeUndefined();
    expect(
      neverReceived.events.find((event) => event.payload.custody_outcome === "never_received")
        ?.payload,
    ).toMatchObject({ custody_outcome: "never_received" });
    await expect(
      updateOrderCustody(
        customerId,
        {
          expected_updated_at: neverReceived.order.updated_at,
          device_custody_status: "with_shop",
          idempotency_key: "00000000-0000-4000-8000-000000000709",
          reason: "历史修正",
        },
        { displayName: "Owner", role: "owner", storeRole: "owner", storeId: "store_1" },
      ),
    ).rejects.toThrow("请先按返修流程重开");
  });

  it("cancels never-received devices without inventing a return", async () => {
    const id = await createMockOrder({ device_custody_status: "with_customer" });
    await transitionOrder(id, "cancelled", {
      reason: "客户不再继续维修",
      idempotencyKey: "00000000-0000-4000-8000-000000000706",
    });
    const cancelled = await getOrder(id);

    expect(cancelled.order.delivered_at).toBeUndefined();
    expect(
      cancelled.events.find((event) => event.payload.custody_outcome === "never_received")?.payload,
    ).toMatchObject({ custody_outcome: "never_received" });
    await expect(
      confirmCancelledOrderReturn(id, {
        expectedUpdatedAt: cancelled.order.updated_at,
        idempotencyKey: "00000000-0000-4000-8000-000000000707",
      }),
    ).rejects.toThrow("无需确认退还");
  });

  it("allows unlock writes on legacy orders while retaining explicit custody confirmation", async () => {
    const id = await createMockOrder({ device_custody_status: "with_shop" });
    const row = mockOrders.find((item) => item.id === id);
    if (!row) throw new Error("fixture order missing");
    row.device_custody_status = null;
    const before = await getOrder(id);

    await patchOrder(id, {
      expected_updated_at: before.order.updated_at,
      changes: { device_unlock: { method: "pin", value: "001258" } },
    });
    const after = await getOrder(id);
    expect(after.order.device_custody_status).toBeNull();
    expect(after.order.device_unlock_method).toBe("pin");
    expect(after.order.device_unlock_value).toBe("001258");
  });

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

  it("keeps customer name blank when a new order is created without one", async () => {
    const id = await createMockOrder({
      customer_name: undefined,
      customer_phone: "+39 333 571 9865",
    });

    const detail = await getOrder(id);
    expect(detail.customer?.name).toBe("");
    expect(detail.order.customer_name).toBe("");
  });

  it("replaces backup phones during full order edits", async () => {
    const id = await createMockOrder({
      customer_phone: "+39 366 120 230 / +39 366 320 430",
    });
    const before = await getOrder(id);

    await updateOrder(id, {
      expected_updated_at: before.order.updated_at,
      customer_name: before.order.customer_name,
      customer_phone: "+39 366 120 230 / +39 366 520 630",
      device_brand: before.order.device_snapshot?.brand ?? "Apple",
      device_model: before.order.device_snapshot?.model ?? "iPhone",
      device_imei: before.order.device_imei,
      issue_description: before.order.issue_description,
      diagnosis_result: before.order.diagnosis_result,
      accessory_notes: before.order.accessory_notes,
      warranty_text: before.order.warranty_text,
      warranty_months: before.order.warranty_months,
      warranty_change_reason: before.order.warranty_change_reason,
      fault_prices: before.order.fault_prices,
      deposit_amount: before.order.deposit_amount,
    });

    const after = await getOrder(id);
    expect(after.order.customer_phone).toBe("+39 366 120 230");
    expect(after.order.contact_phones).toEqual(["+39 366 520 630"]);
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

  it("patches IMEI only without overwriting linked customer, device, unlock, or order fields", async () => {
    const id = await createMockOrder({
      device_imei: "ORIGINAL-IMEI-001",
      accessory_notes: "SIM卡、手机壳",
      device_unlock: { method: "pin", value: "001258" },
      warranty_text: "12个月",
      warranty_months: 12,
      warranty_change_reason: "店铺默认",
      fault_prices: [
        { name: "屏幕", price: 120, note: "原厂 品质" },
        { name: "电池", price: 45, note: "标准" },
      ],
      deposit_amount: 35,
    });
    const created = await getOrder(id);
    await patchOrder(id, {
      expected_updated_at: created.order.updated_at,
      changes: { diagnosis_result: "检测完成，等待客户确认。" },
    });
    const before = await getOrder(id);

    const result = await patchOrder(id, {
      expected_updated_at: before.order.updated_at,
      changes: { device_imei: "356938035643809" },
    });
    const after = await getOrder(id);

    expect(result.updated_at).toBe(after.order.updated_at);
    expect(after.order.device_snapshot?.serial_or_imei).toBe("356938035643809");
    expect(after.order.customer_id).toBe(before.order.customer_id);
    expect(after.order.device_id).toBe(before.order.device_id);
    expect(after.order.customer_name).toBe(before.order.customer_name);
    expect(after.order.customer_phone).toBe(before.order.customer_phone);
    expect(after.order.contact_phones).toEqual(before.order.contact_phones);
    expect(after.order.device_snapshot?.brand).toBe(before.order.device_snapshot?.brand);
    expect(after.order.device_snapshot?.model).toBe(before.order.device_snapshot?.model);
    expect(after.order.device_snapshot?.device_notes).toBe(
      before.order.device_snapshot?.device_notes,
    );
    expect(after.order.device_unlock_method).toBe("pin");
    expect(after.order.device_unlock_value).toBe("001258");
    expect(after.order.issue_description).toBe(before.order.issue_description);
    expect(after.order.diagnosis_result).toBe(before.order.diagnosis_result);
    expect(after.order.accessory_notes).toBe(before.order.accessory_notes);
    expect(after.order.warranty_text).toBe(before.order.warranty_text);
    expect(after.order.warranty_months).toBe(before.order.warranty_months);
    expect(after.order.warranty_change_reason).toBe(before.order.warranty_change_reason);
    expect(after.order.fault_prices).toEqual(before.order.fault_prices);
    expect(after.order.deposit_amount).toBe(before.order.deposit_amount);
  });

  it("rejects blank IMEI inline patches so order snapshots cannot revive stale device IMEI", async () => {
    const id = await createMockOrder({ device_imei: "ORIGINAL-IMEI-002" });
    const before = await getOrder(id);

    await expect(
      patchOrder(id, {
        expected_updated_at: before.order.updated_at,
        changes: { device_imei: "   " },
      }),
    ).rejects.toThrow("IMEI / 序列号不能为空");

    const after = await getOrder(id);
    expect(after.order.updated_at).toBe(before.order.updated_at);
    expect(after.order.device_snapshot?.serial_or_imei).toBe(
      before.order.device_snapshot?.serial_or_imei,
    );
  });

  it("persists device unlock metadata and keeps list/event payloads redacted", async () => {
    const id = await createMockOrder({
      device_unlock: { method: "pin", value: "001258" },
    });
    const created = await getOrder(id);

    expect(created.order.device_unlock_method).toBe("pin");
    expect(created.order.device_unlock_value).toBe("001258");
    expect(
      JSON.stringify(created.events.find((event) => event.event_type === "created")),
    ).not.toContain("001258");

    await updateOrder(id, {
      expected_updated_at: created.order.updated_at,
      customer_name: created.order.customer_name,
      customer_phone: created.order.customer_phone,
      device_brand: created.order.device_snapshot?.brand ?? "Apple",
      device_model: created.order.device_snapshot?.model ?? "iPhone",
      device_imei: created.order.device_imei,
      issue_description: created.order.issue_description,
      diagnosis_result: created.order.diagnosis_result,
      accessory_notes: created.order.accessory_notes,
      device_unlock: { method: "pattern", pattern: [1, 2, 5, 9, 8, 7, 4, 6, 3] },
      warranty_text: created.order.warranty_text,
      warranty_months: created.order.warranty_months,
      warranty_change_reason: created.order.warranty_change_reason,
      fault_prices: created.order.fault_prices,
      deposit_amount: created.order.deposit_amount,
    });

    const updated = await getOrder(id);
    expect(updated.order.device_unlock_method).toBe("pattern");
    expect(updated.order.device_unlock_pattern).toEqual([1, 2, 5, 9, 8, 7, 4, 6, 3]);
    expect(
      JSON.stringify(updated.events.find((event) => event.payload.action === "order_updated")),
    ).not.toContain("1,2,5,9,8,7,4,6,3");

    await expect(
      updateOrder(id, {
        expected_updated_at: updated.order.updated_at,
        customer_name: updated.order.customer_name,
        customer_phone: updated.order.customer_phone,
        device_brand: updated.order.device_snapshot?.brand ?? "Apple",
        device_model: updated.order.device_snapshot?.model ?? "iPhone",
        device_imei: updated.order.device_imei,
        issue_description: updated.order.issue_description,
        diagnosis_result: updated.order.diagnosis_result,
        accessory_notes: updated.order.accessory_notes,
        device_unlock: { method: "pattern", pattern: [1, 2, 1, 5] },
        warranty_text: updated.order.warranty_text,
        warranty_months: updated.order.warranty_months,
        warranty_change_reason: updated.order.warranty_change_reason,
        fault_prices: updated.order.fault_prices,
        deposit_amount: updated.order.deposit_amount,
      }),
    ).rejects.toThrow("不能重复");

    await patchOrder(id, {
      expected_updated_at: updated.order.updated_at,
      changes: { device_unlock: { method: "none" } },
    });
    const cleared = await getOrder(id);
    expect(cleared.order.device_unlock_method).toBeUndefined();

    const relisted = await createMockOrder({
      device_unlock: { method: "text", value: "secret-word" },
    });
    const relistedDetail = await getOrder(relisted);
    const page = await listOrdersPage({ search: relistedDetail.order.public_no, pageSize: 10 });
    expect(page.items[0]?.device_unlock_method).toBe("text");
    expect(page.items[0]?.device_unlock_value).toBeUndefined();
    expect(page.items[0]?.device_unlock_pattern).toBeUndefined();
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

  it("patches parts supplier without changing order status", async () => {
    resetMockSuppliers();
    const id = await createMockOrder({}, "Original Tech");
    const before = await getOrder(id);
    const supplier = createMockSupplier({
      name: "UTOPYA",
      short_name: "UTO",
      color: "#16a34a",
    });

    await patchOrder(id, {
      expected_updated_at: before.order.updated_at,
      changes: { parts_supplier_id: supplier.id },
    });

    const marked = await getOrder(id);
    expect(marked.order.parts_supplier_id).toBe(supplier.id);
    expect(marked.order.status).toBe(before.order.status);

    await patchOrder(id, {
      expected_updated_at: marked.order.updated_at,
      changes: { parts_supplier_id: null },
    });

    const cleared = await getOrder(id);
    expect(cleared.order.parts_supplier_id).toBeUndefined();
    expect(cleared.order.status).toBe(before.order.status);
  });

  it("rejects unknown parts suppliers through inline patching", async () => {
    const id = await createMockOrder({}, "Original Tech");
    const before = await getOrder(id);

    await expect(
      patchOrder(id, {
        expected_updated_at: before.order.updated_at,
        changes: { parts_supplier_id: "missing-supplier" },
      }),
    ).rejects.toThrow("配件供应商不存在");
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

    await expect(
      recordPayment(id, 10, "现金", "Cashier", undefined, "00000000-0000-4000-8000-000000000201"),
    ).rejects.toThrow("缺少工单版本时间");
    await expect(
      recordPayment(
        id,
        10,
        "现金",
        "Cashier",
        "2000-01-01T00:00:00.000Z",
        "00000000-0000-4000-8000-000000000202",
      ),
    ).rejects.toThrow("工单已被更新");

    const result = await recordPayment(
      id,
      10,
      "现金",
      "Cashier",
      before.order.updated_at,
      "00000000-0000-4000-8000-000000000203",
    );
    const after = await getOrder(id);
    expect(result.updated_at).toBe(after.order.updated_at);
    expect(after.order.balance_amount).toBe(before.order.balance_amount - 10);
    expect(after.order.payment_status).toBe("partial");

    const replay = await recordPayment(
      id,
      10,
      "现金",
      "Cashier",
      before.order.updated_at,
      "00000000-0000-4000-8000-000000000203",
    );
    expect(replay.code).toBe("idempotent_replay");
    expect((await getOrder(id)).order.balance_amount).toBe(after.order.balance_amount);
  });

  it("keeps a cancelled order balance as history and rejects a forged payment", async () => {
    const id = await createMockOrder({ deposit_amount: 50 });
    await transitionOrder(id, "cancelled", { reason: "客户取消维修" });
    const cancelled = await getOrder(id);

    await expect(
      recordPayment(
        id,
        10,
        "现金",
        "Cashier",
        cancelled.order.updated_at,
        "00000000-0000-4000-8000-000000000204",
      ),
    ).rejects.toThrow("已取消工单不能登记收款");

    const after = await getOrder(id);
    expect(after.order.balance_amount).toBe(cancelled.order.balance_amount);
    expect(after.events.filter((event) => event.event_type === "payment")).toHaveLength(0);
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

  it("invalidates previous customer approval when finance changes", async () => {
    const id = await createMockOrder();
    await transitionOrder(id, "diagnosing");
    await transitionOrder(id, "quoted");
    await sendApprovalRequest(id, "Preventivo da confermare.");
    await decideOrderApproval(id, { decision: "approved", next_status: "repairing" });
    const approved = await getOrder(id);
    expect(approved.order.status).toBe("repairing");
    expect(approved.order.approval_status).toBe("approved");
    expect(approved.order.approval_confirmed_at).toBeDefined();

    await patchOrderFinance(id, {
      expected_updated_at: approved.order.updated_at,
      fault_prices: [{ name: "屏幕", price: 180 }],
      deposit_amount: 20,
    });

    const after = await getOrder(id);
    expect(after.order.status).toBe("quoted");
    expect(after.order.workflow_status).toBe("quote");
    expect(after.order.approval_status).toBe("pending");
    expect(after.order.approval_flow_status).toBe("not_required");
    expect(after.order.approval_confirmed_at).toBeUndefined();
    expect(after.order.approval_sent_at).toBeUndefined();
    const financeEvent = after.events.find(
      (event) => event.payload.action === "order_finance_updated",
    );
    expect(financeEvent?.payload).toMatchObject({
      action: "order_finance_updated",
      approval_reset: true,
    });

    await sendApprovalRequest(id, "Preventivo aggiornato da confermare.");
    const waiting = await getOrder(id);
    expect(waiting.order.status).toBe("waiting_approval");
    expect(waiting.order.approval_flow_status).toBe("waiting_customer");
  });

  it("rejects an unmapped custom default when the requested status is unknown", async () => {
    const code = `custom_default_${seq + 1}`;
    await createOrderWorkflowStatus({
      code,
      label: "未映射默认状态",
      short_label: "未映射",
      tone: "warn",
      bucket: "custom",
      enabled: true,
      show_in_order_filters: true,
      allowed_for_create: true,
      is_default_create_status: true,
    });

    await expect(
      createMockOrder({ status: "missing_registry_status" as CreateOrderInput["status"] }),
    ).rejects.toThrow("尚未绑定主流程阶段");
  });
});
