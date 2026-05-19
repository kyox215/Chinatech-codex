import { NextResponse } from "next/server";
import { z } from "zod";

import {
  batchTransition,
  createOrder,
  getOrder,
  getOrderStats,
  getRepairDeskOptions,
  listOrders,
  recordPayment,
  sendApprovalRequest,
  sendNotification,
  transitionOrder,
  updateOrder,
} from "@/features/orders/server/order.service";
import {
  completeCustomerFollowup,
  createCustomer,
  createCustomerFollowup,
  deleteCustomerDevice,
  getCustomerDevices,
  getCustomerDetail,
  listCustomers,
  searchCustomers,
  sendCustomerMessage,
  setCustomerTags,
  updateCustomer,
  upsertCustomerDevice,
} from "@/features/customers/server/customer.service";
import {
  approvalRequestBodySchema,
  batchTransitionBodySchema,
  createOrderSchema,
  customerCreateBodySchema,
  customerDeviceDeleteBodySchema,
  customerDeviceUpsertBodySchema,
  customerFollowupCompleteBodySchema,
  customerFollowupCreateBodySchema,
  customerIdBodySchema,
  customerListFiltersSchema,
  customerMessageBodySchema,
  customerSearchBodySchema,
  customerTagsUpdateBodySchema,
  customerUpdateBodySchema,
  idBodySchema,
  notificationBodySchema,
  orderListFiltersSchema,
  paymentBodySchema,
  transitionOrderBodySchema,
  updateOrderBodySchema,
} from "./repairdesk-schemas";

function ok(data: unknown) {
  return NextResponse.json({ data });
}

function fail(error: unknown) {
  const message =
    error instanceof z.ZodError
      ? `请求参数错误：${error.issues.map((issue) => issue.message).join("，")}`
      : error instanceof Error
        ? error.message
        : "请求处理失败";

  return NextResponse.json({ error: message }, { status: 400 });
}

export async function handleRepairDeskGet(path: string) {
  try {
    switch (path) {
      case "order-stats":
        return ok(await getOrderStats());
      case "options":
        return ok(await getRepairDeskOptions());
      default:
        return NextResponse.json({ error: "接口不存在" }, { status: 404 });
    }
  } catch (error) {
    return fail(error);
  }
}

export async function handleRepairDeskPost(path: string, body: unknown) {
  try {
    switch (path) {
      case "orders/list":
        return ok(await listOrders(orderListFiltersSchema.parse(body)));
      case "customers/list":
        return ok(await listCustomers(customerListFiltersSchema.parse(body)));
      case "orders/create":
        return ok(await createOrder(createOrderSchema.parse(body)));
      case "order/get": {
        const { id } = idBodySchema.parse(body);
        return ok(await getOrder(id));
      }
      case "customer/get": {
        const { id } = idBodySchema.parse(body);
        return ok(await getCustomerDetail(id));
      }
      case "customer/create": {
        const { input } = customerCreateBodySchema.parse(body);
        return ok(await createCustomer(input));
      }
      case "customer/update": {
        const { id, input } = customerUpdateBodySchema.parse(body);
        return ok(await updateCustomer(id, input));
      }
      case "customer/device/upsert": {
        const { customerId, input } = customerDeviceUpsertBodySchema.parse(body);
        return ok(await upsertCustomerDevice(customerId, input));
      }
      case "customer/device/delete": {
        const { customerId, deviceId } = customerDeviceDeleteBodySchema.parse(body);
        return ok(await deleteCustomerDevice(customerId, deviceId));
      }
      case "customer/tags/update": {
        const { customerId, tagIds } = customerTagsUpdateBodySchema.parse(body);
        return ok(await setCustomerTags(customerId, tagIds));
      }
      case "customer/followup/create": {
        const { customerId, input } = customerFollowupCreateBodySchema.parse(body);
        return ok(await createCustomerFollowup(customerId, input));
      }
      case "customer/followup/complete": {
        const { customerId, followupId } = customerFollowupCompleteBodySchema.parse(body);
        return ok(await completeCustomerFollowup(customerId, followupId));
      }
      case "customer/message": {
        const { customerId, input } = customerMessageBodySchema.parse(body);
        return ok(await sendCustomerMessage(customerId, input));
      }
      case "order/update": {
        const { id, input } = updateOrderBodySchema.parse(body);
        return ok(await updateOrder(id, input));
      }
      case "order/transition": {
        const { id, to, reason } = transitionOrderBodySchema.parse(body);
        return ok(await transitionOrder(id, to, { reason }));
      }
      case "order/batch-transition": {
        const { ids, to } = batchTransitionBodySchema.parse(body);
        return ok(await batchTransition(ids, to));
      }
      case "order/payment": {
        const { id, amount, method } = paymentBodySchema.parse(body);
        return ok(await recordPayment(id, amount, method));
      }
      case "order/notification": {
        const { id, body: messageBody, channel } = notificationBodySchema.parse(body);
        return ok(await sendNotification(id, messageBody, channel));
      }
      case "order/approval-request": {
        const { id, body: messageBody } = approvalRequestBodySchema.parse(body);
        return ok(await sendApprovalRequest(id, messageBody));
      }
      case "customers/search": {
        const { q, limit } = customerSearchBodySchema.parse(body);
        return ok(await searchCustomers(q, limit));
      }
      case "customers/devices": {
        const { customerId } = customerIdBodySchema.parse(body);
        return ok(await getCustomerDevices(customerId));
      }
      default:
        return NextResponse.json({ error: "接口不存在" }, { status: 404 });
    }
  } catch (error) {
    return fail(error);
  }
}
