import { NextResponse } from "next/server";
import { z } from "zod";

import {
  batchTransition,
  createOrder,
  getOrder,
  getOrderStats,
  getRepairDeskOptions,
  listOrders,
  listOrdersPage,
  recordPayment,
  sendApprovalRequest,
  sendNotification,
  sendWhatsappNotification,
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
  orderListPageInputSchema,
  paymentBodySchema,
  transitionOrderBodySchema,
  updateOrderBodySchema,
  whatsappNotificationBodySchema,
} from "./repairdesk-schemas";

const supabaseSource = {
  batchTransition,
  completeCustomerFollowup,
  createCustomer,
  createCustomerFollowup,
  createOrder,
  deleteCustomerDevice,
  getCustomerDevices,
  getCustomerDetail,
  getOrder,
  getOrderStats,
  getRepairDeskOptions,
  listCustomers,
  listOrders,
  listOrdersPage,
  recordPayment,
  searchCustomers,
  sendApprovalRequest,
  sendCustomerMessage,
  sendNotification,
  sendWhatsappNotification,
  setCustomerTags,
  transitionOrder,
  updateCustomer,
  updateOrder,
  upsertCustomerDevice,
};

async function source() {
  const { hasSupabaseConfig } = await import("@/server/supabase");
  if (hasSupabaseConfig()) return supabaseSource;

  const mock = await import("@/lib/mock/api");
  return {
    ...mock,
    getRepairDeskOptions: async () => ({
      suppliers: mock.suppliers,
      technicians: mock.allTechnicians,
    }),
  };
}

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
    const api = await source();
    switch (path) {
      case "order-stats":
        return ok(await api.getOrderStats());
      case "options":
        return ok(await api.getRepairDeskOptions());
      default:
        return NextResponse.json({ error: "接口不存在" }, { status: 404 });
    }
  } catch (error) {
    return fail(error);
  }
}

export async function handleRepairDeskPost(path: string, body: unknown) {
  try {
    const api = await source();
    switch (path) {
      case "orders/list":
        return ok(await api.listOrders(orderListFiltersSchema.parse(body)));
      case "orders/list-page":
        return ok(await api.listOrdersPage(orderListPageInputSchema.parse(body)));
      case "customers/list":
        return ok(await api.listCustomers(customerListFiltersSchema.parse(body)));
      case "orders/create":
        return ok(await api.createOrder(createOrderSchema.parse(body)));
      case "order/get": {
        const { id } = idBodySchema.parse(body);
        return ok(await api.getOrder(id));
      }
      case "customer/get": {
        const { id } = idBodySchema.parse(body);
        return ok(await api.getCustomerDetail(id));
      }
      case "customer/create": {
        const { input } = customerCreateBodySchema.parse(body);
        return ok(await api.createCustomer(input));
      }
      case "customer/update": {
        const { id, input } = customerUpdateBodySchema.parse(body);
        return ok(await api.updateCustomer(id, input));
      }
      case "customer/device/upsert": {
        const { customerId, input } = customerDeviceUpsertBodySchema.parse(body);
        return ok(await api.upsertCustomerDevice(customerId, input));
      }
      case "customer/device/delete": {
        const { customerId, deviceId } = customerDeviceDeleteBodySchema.parse(body);
        return ok(await api.deleteCustomerDevice(customerId, deviceId));
      }
      case "customer/tags/update": {
        const { customerId, tagIds } = customerTagsUpdateBodySchema.parse(body);
        return ok(await api.setCustomerTags(customerId, tagIds));
      }
      case "customer/followup/create": {
        const { customerId, input } = customerFollowupCreateBodySchema.parse(body);
        return ok(await api.createCustomerFollowup(customerId, input));
      }
      case "customer/followup/complete": {
        const { customerId, followupId } = customerFollowupCompleteBodySchema.parse(body);
        return ok(await api.completeCustomerFollowup(customerId, followupId));
      }
      case "customer/message": {
        const { customerId, input } = customerMessageBodySchema.parse(body);
        return ok(await api.sendCustomerMessage(customerId, input));
      }
      case "order/update": {
        const { id, input } = updateOrderBodySchema.parse(body);
        return ok(await api.updateOrder(id, input));
      }
      case "order/transition": {
        const { id, to, reason } = transitionOrderBodySchema.parse(body);
        return ok(await api.transitionOrder(id, to, { reason }));
      }
      case "order/batch-transition": {
        const { ids, to } = batchTransitionBodySchema.parse(body);
        return ok(await api.batchTransition(ids, to));
      }
      case "order/payment": {
        const { id, amount, method } = paymentBodySchema.parse(body);
        return ok(await api.recordPayment(id, amount, method));
      }
      case "order/notification": {
        const { id, body: messageBody, channel } = notificationBodySchema.parse(body);
        return ok(await api.sendNotification(id, messageBody, channel));
      }
      case "order/whatsapp-notification": {
        const {
          id,
          body: messageBody,
          template_kind,
          transition_to,
        } = whatsappNotificationBodySchema.parse(body);
        return ok(
          await api.sendWhatsappNotification(id, messageBody, template_kind, transition_to),
        );
      }
      case "order/approval-request": {
        const { id, body: messageBody } = approvalRequestBodySchema.parse(body);
        return ok(await api.sendApprovalRequest(id, messageBody));
      }
      case "customers/search": {
        const { q, limit } = customerSearchBodySchema.parse(body);
        return ok(await api.searchCustomers(q, limit));
      }
      case "customers/devices": {
        const { customerId } = customerIdBodySchema.parse(body);
        return ok(await api.getCustomerDevices(customerId));
      }
      default:
        return NextResponse.json({ error: "接口不存在" }, { status: 404 });
    }
  } catch (error) {
    return fail(error);
  }
}
