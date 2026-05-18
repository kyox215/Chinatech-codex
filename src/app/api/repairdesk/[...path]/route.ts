import { NextResponse, type NextRequest } from "next/server";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import {
  batchTransition,
  createOrder,
  getCustomerDevices,
  getOrder,
  getOrderStats,
  getRepairDeskOptions,
  listOrders,
  recordPayment,
  searchCustomers,
  sendApprovalRequest,
  sendNotification,
  transitionOrder,
  updateOrder,
  type CreateOrderInput,
  type OrderListFilters,
  type UpdateOrderInput,
} from "@/lib/repairdesk/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

function ok(data: unknown) {
  return NextResponse.json({ data });
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "请求处理失败";
  return NextResponse.json({ error: message }, { status: 400 });
}

async function readJson(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => ({}));
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const path = (await context.params).path?.join("/") ?? "";
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

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const path = (await context.params).path?.join("/") ?? "";
    const body = (await readJson(request)) as Record<string, unknown>;

    switch (path) {
      case "orders/list":
        return ok(await listOrders(body as OrderListFilters));
      case "orders/create":
        return ok(await createOrder(body as unknown as CreateOrderInput));
      case "order/get":
        return ok(await getOrder(String(body.id ?? "")));
      case "order/update":
        return ok(
          await updateOrder(
            String(body.id ?? ""),
            (body.input ?? {}) as unknown as UpdateOrderInput,
          ),
        );
      case "order/transition":
        return ok(
          await transitionOrder(String(body.id ?? ""), body.to as RepairOrderStatus, {
            reason: typeof body.reason === "string" ? body.reason : undefined,
          }),
        );
      case "order/batch-transition":
        return ok(
          await batchTransition((body.ids ?? []) as string[], body.to as RepairOrderStatus),
        );
      case "order/payment":
        return ok(
          await recordPayment(
            String(body.id ?? ""),
            Number(body.amount ?? 0),
            typeof body.method === "string" ? body.method : undefined,
          ),
        );
      case "order/notification":
        return ok(
          await sendNotification(
            String(body.id ?? ""),
            String(body.body ?? ""),
            body.channel === "sms" ? "sms" : "whatsapp",
          ),
        );
      case "order/approval-request":
        return ok(await sendApprovalRequest(String(body.id ?? ""), String(body.body ?? "")));
      case "customers/search":
        return ok(await searchCustomers(String(body.q ?? ""), Number(body.limit ?? 6)));
      case "customers/devices":
        return ok(await getCustomerDevices(String(body.customerId ?? "")));
      default:
        return NextResponse.json({ error: "接口不存在" }, { status: 404 });
    }
  } catch (error) {
    return fail(error);
  }
}
