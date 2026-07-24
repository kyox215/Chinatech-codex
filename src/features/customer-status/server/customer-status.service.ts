import { createHash, createHmac } from "node:crypto";

import type { AuditActor } from "@/lib/repairdesk/types";
import {
  CUSTOMER_STATUS_TOKEN_PATTERN,
  CUSTOMER_STATUS_LEGACY_TOKEN_PATTERN,
  getCustomerStatusStage,
  type CustomerStatusIssuedLink,
  type CustomerStatusPublicView,
} from "@/features/customer-status/model/customer-status";
import { getSupabaseAdmin } from "@/server/supabase";
import { can } from "@/server/permissions";
import { ForbiddenError } from "@/server/auth-context";
import {
  createStableCustomerStatusToken,
  getActiveCustomerStatusKeyVersion,
  parseAndVerifyStableCustomerStatusToken,
} from "@/features/customer-status/server/customer-status-token";

const CUSTOMER_STATUS_PUBLIC_ORIGIN = "https://www.chinatech.in";
const CUSTOMER_STATUS_MAX_BATCH = 50;

type DbRecord = Record<string, unknown>;

export class CustomerStatusUnavailableError extends Error {
  constructor() {
    super("customer_status_link_unavailable");
    this.name = "CustomerStatusUnavailableError";
  }
}

export class CustomerStatusDisabledError extends Error {
  constructor() {
    super("客户查询二维码功能尚未启用");
    this.name = "CustomerStatusDisabledError";
  }
}

export class CustomerStatusRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Richieste troppo frequenti. Riprova tra poco.");
    this.name = "CustomerStatusRateLimitError";
  }
}

export function isCustomerStatusQrEnabled() {
  return true;
}

export async function issueCustomerStatusLinks(
  orderIds: string[],
  actor: AuditActor,
): Promise<CustomerStatusIssuedLink[]> {
  const ids = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length || ids.length > CUSTOMER_STATUS_MAX_BATCH) {
    throw new Error(`每次只能准备 1-${CUSTOMER_STATUS_MAX_BATCH} 张客户工单`);
  }
  if (!actor.storeId || !actor.id) throw new ForbiddenError("当前没有可用店铺");
  if (ids.length > 1 && !can(actor, "order:export")) {
    throw new ForbiddenError("当前员工没有批量打印工单的权限");
  }

  const admin = getSupabaseAdmin();
  const [{ data: store, error: storeError }, { data: lifecycle, error: lifecycleError }] =
    await Promise.all([
      admin.from("stores").select("id,status").eq("id", actor.storeId).maybeSingle(),
      admin
        .from("store_lifecycles")
        .select("store_id,phase,revision")
        .eq("store_id", actor.storeId)
        .maybeSingle(),
    ]);
  fail(storeError, "读取店铺状态失败");
  fail(lifecycleError, "读取店铺生命周期失败");
  if (
    !store ||
    String(store.status) !== "active" ||
    !lifecycle ||
    lifecycle.phase !== "active" ||
    !Number.isInteger(Number(lifecycle.revision)) ||
    Number(lifecycle.revision) < 1
  ) {
    throw new ForbiddenError("当前店铺不能签发客户查询链接");
  }

  const { data: orders, error: ordersError } = await admin
    .from("repair_orders")
    .select("id,store_id,record_state,deleted_at,assignee_membership_id")
    .eq("store_id", actor.storeId)
    .in("id", ids);
  fail(ordersError, "读取待打印工单失败");
  const rows = (orders ?? []) as DbRecord[];
  const rowsById = new Map(rows.map((row) => [String(row.id), row]));
  if (rowsById.size !== ids.length) throw new ForbiddenError("部分工单不存在或不属于当前店铺");

  for (const id of ids) {
    const row = rowsById.get(id);
    if (!row) throw new ForbiddenError("工单不可用");
    const role = actor.storeRole ?? actor.role;
    const scopeSatisfied =
      role === "technician" &&
      Boolean(
        actor.activeMembershipId &&
        String(row.assignee_membership_id || "") === actor.activeMembershipId,
      );
    if (!can(actor, "order:detail", { scopeSatisfied })) {
      throw new ForbiddenError("当前员工没有查看其中一张工单的权限");
    }
  }

  const activeKeyVersion = getActiveCustomerStatusKeyVersion();
  const origin = getCustomerStatusPublicOrigin();
  const { data: ensureResult, error: ensureError } = await admin.rpc(
    "repairdesk_ensure_customer_status_identities_v2",
    {
      p_store_id: actor.storeId,
      p_order_ids: ids,
      p_key_version: activeKeyVersion,
      p_actor_id: actor.id,
      p_actor_email: actor.email ?? null,
      p_actor_name: actor.displayName,
    },
  );
  fail(ensureError, "准备固定订单二维码失败");
  const payload = (Array.isArray(ensureResult) ? ensureResult[0] : ensureResult) as DbRecord | null;
  const identities = Array.isArray(payload?.identities) ? (payload.identities as DbRecord[]) : [];
  const identitiesByOrder = new Map(identities.map((row) => [String(row.order_id), row]));
  if (identitiesByOrder.size !== ids.length) throw new Error("固定订单二维码准备结果不完整");

  return ids.map((orderId) => {
    const identity = identitiesByOrder.get(orderId);
    if (
      !identity ||
      identity.public_access_state !== "enabled" ||
      Number(identity.lifecycle_revision) !== Number(lifecycle.revision)
    ) {
      throw new Error("固定订单二维码状态无效");
    }
    const token = createStableCustomerStatusToken({
      publicId: String(identity.public_id),
      generation: Number(identity.generation),
      keyVersion: Number(identity.key_version),
    });
    return { order_id: orderId, url: `${origin}/r#${token}`, expires_at: null };
  });
}

export async function resolveCustomerStatusPublic(
  token: string,
  clientAddress: string,
): Promise<CustomerStatusPublicView> {
  if (!CUSTOMER_STATUS_TOKEN_PATTERN.test(token)) throw new CustomerStatusUnavailableError();
  await consumeCustomerStatusPublicRequestRateLimit(clientAddress);
  const live = await loadLiveLink(token);
  await consumeCustomerStatusRateLimit("token", token, 20);
  const admin = getSupabaseAdmin();

  const [storeResult, lifecycleResult, orderResult, settingsResult] = await Promise.all([
    admin.from("stores").select("id,name,status").eq("id", live.storeId).maybeSingle(),
    admin
      .from("store_lifecycles")
      .select("store_id,phase,revision")
      .eq("store_id", live.storeId)
      .maybeSingle(),
    admin
      .from("repair_orders")
      .select("id,public_no,device_id,workflow_status,status,updated_at,record_state,deleted_at")
      .eq("store_id", live.storeId)
      .eq("id", live.orderId)
      .maybeSingle(),
    admin
      .from("store_settings")
      .select("store_name,store_phone,store_whatsapp,store_email")
      .eq("store_id", live.storeId)
      .maybeSingle(),
  ]);
  fail(storeResult.error, "读取公开店铺状态失败");
  fail(lifecycleResult.error, "读取公开店铺生命周期失败");
  fail(orderResult.error, "读取公开工单状态失败");
  fail(settingsResult.error, "读取公开店铺资料失败");
  const store = storeResult.data as DbRecord | null;
  const lifecycle = lifecycleResult.data as DbRecord | null;
  const order = orderResult.data as DbRecord | null;
  const settings = settingsResult.data as DbRecord | null;
  if (
    !store ||
    store.status !== "active" ||
    !lifecycle ||
    lifecycle.phase !== "active" ||
    Number(lifecycle.revision) !== live.lifecycleRevision ||
    !order ||
    order.record_state !== "active" ||
    order.deleted_at
  ) {
    throw new CustomerStatusUnavailableError();
  }

  const [deviceResult, workflowResult] = await Promise.all([
    admin
      .from("devices")
      .select("brand,model")
      .eq("store_id", live.storeId)
      .eq("id", String(order.device_id))
      .maybeSingle(),
    admin
      .from("order_workflow_statuses")
      .select("bucket")
      .eq("store_id", live.storeId)
      .eq("code", String(order.status || ""))
      .maybeSingle(),
  ]);
  fail(deviceResult.error, "读取公开设备资料失败");
  fail(workflowResult.error, "读取公开工作流失败");
  const device = deviceResult.data as DbRecord | null;
  if (!device) throw new CustomerStatusUnavailableError();
  const stage = getCustomerStatusStage(
    String((workflowResult.data as DbRecord | null)?.bucket || ""),
    String(order.status || ""),
  );
  const deviceLabel = [String(device.brand || "").trim(), String(device.model || "").trim()]
    .filter(Boolean)
    .join(" ");

  return {
    store: {
      name: String(settings?.store_name || store.name || "RepairDesk"),
      ...optionalPublicText("phone", settings?.store_phone),
      ...optionalPublicText("whatsapp", settings?.store_whatsapp),
      ...optionalPublicText("email", settings?.store_email),
    },
    order: {
      public_no: String(order.public_no || ""),
      device: deviceLabel || "Dispositivo",
      ...stage,
      last_updated_at: String(order.updated_at),
    },
  };
}

export async function resolveCustomerStatusForStaff(token: string, actor: AuditActor) {
  const live = await loadLiveLink(token);
  if (!actor.storeId || actor.storeId !== live.storeId) throw new CustomerStatusUnavailableError();
  const admin = getSupabaseAdmin();
  const [
    { data: store, error: storeError },
    { data: lifecycle, error: lifecycleError },
    orderResult,
  ] = await Promise.all([
    admin.from("stores").select("id,status").eq("id", live.storeId).maybeSingle(),
    admin
      .from("store_lifecycles")
      .select("store_id,phase,revision")
      .eq("store_id", live.storeId)
      .maybeSingle(),
    admin
      .from("repair_orders")
      .select("id,record_state,deleted_at,assignee_membership_id")
      .eq("store_id", live.storeId)
      .eq("id", live.orderId)
      .maybeSingle(),
  ]);
  fail(storeError, "读取店铺状态失败");
  fail(lifecycleError, "读取店铺生命周期失败");
  fail(orderResult.error, "读取内部工单失败");
  const order = orderResult.data as DbRecord | null;
  if (
    !store ||
    store.status !== "active" ||
    !lifecycle ||
    lifecycle.phase !== "active" ||
    Number(lifecycle.revision) !== live.lifecycleRevision ||
    !order
  ) {
    throw new CustomerStatusUnavailableError();
  }
  const role = actor.storeRole ?? actor.role;
  const scopeSatisfied =
    role === "technician" &&
    Boolean(
      actor.activeMembershipId &&
      String(order.assignee_membership_id || "") === actor.activeMembershipId,
    );
  if (!can(actor, "order:detail", { scopeSatisfied })) {
    throw new CustomerStatusUnavailableError();
  }
  return `/orders/${encodeURIComponent(live.orderId)}?from=orders`;
}

export async function revokeCustomerStatusLinksForOrder(
  orderId: string,
  actor: AuditActor,
  reason = "manual_revoke",
) {
  if (!actor.storeId || !actor.id || !can(actor, "order:void")) {
    throw new ForbiddenError();
  }
  const safeOrderId = orderId.trim();
  const safeReason = reason.trim();
  if (!safeOrderId || !/^[a-z0-9_:-]{1,64}$/i.test(safeReason)) {
    throw new Error("客户查询链接撤销参数无效");
  }
  const { data, error } = await getSupabaseAdmin().rpc(
    "repairdesk_rotate_customer_status_identity_v2",
    {
      p_store_id: actor.storeId,
      p_order_id: safeOrderId,
      p_key_version: getActiveCustomerStatusKeyVersion(),
      p_actor_id: actor.id,
      p_actor_email: actor.email ?? null,
      p_actor_name: actor.displayName,
      p_reason: safeReason === "manual_revoke" ? "operator_reset" : safeReason,
    },
  );
  fail(error, "重置固定订单二维码失败");
  const payload = (Array.isArray(data) ? data[0] : data) as DbRecord | null;
  return { revoked_count: Number(payload?.rotated_count || 0) };
}

function getCustomerStatusPublicOrigin() {
  const configured = process.env.CUSTOMER_STATUS_PUBLIC_ORIGIN?.trim();
  if (!configured) return CUSTOMER_STATUS_PUBLIC_ORIGIN;
  const url = new URL(configured);
  const isProductionOrigin = ["https://www.chinatech.in", "https://chinatech.in"].includes(
    url.origin,
  );
  const isLocalTestOrigin =
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  if (!isProductionOrigin && !isLocalTestOrigin) {
    throw new Error("客户查询二维码域名未通过安全校验");
  }
  url.username = "";
  url.password = "";
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.origin;
}

async function loadLiveLink(token: string) {
  if (!CUSTOMER_STATUS_TOKEN_PATTERN.test(token)) throw new CustomerStatusUnavailableError();
  const stable = parseAndVerifyStableCustomerStatusToken(token);
  if (stable) {
    const { data, error } = await getSupabaseAdmin()
      .from("repair_order_customer_status_identities")
      .select(
        "order_id,store_id,public_id,generation,key_version,lifecycle_revision,public_access_state",
      )
      .eq("public_id", stable.publicId)
      .maybeSingle();
    fail(error, "解析固定订单二维码失败");
    if (
      !data ||
      data.public_access_state !== "enabled" ||
      Number(data.generation) !== stable.generation ||
      Number(data.key_version) !== stable.keyVersion
    ) {
      throw new CustomerStatusUnavailableError();
    }
    return {
      storeId: String(data.store_id),
      orderId: String(data.order_id),
      lifecycleRevision: Number(data.lifecycle_revision),
    };
  }
  if (!CUSTOMER_STATUS_LEGACY_TOKEN_PATTERN.test(token)) {
    throw new CustomerStatusUnavailableError();
  }
  const { data, error } = await getSupabaseAdmin()
    .from("repair_order_customer_status_links")
    .select("id,store_id,order_id,lifecycle_revision,expires_at,revoked_at")
    .eq("token_hash", hashCustomerStatusToken(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  fail(error, "解析客户查询链接失败");
  if (!data) throw new CustomerStatusUnavailableError();
  return {
    storeId: String(data.store_id),
    orderId: String(data.order_id),
    lifecycleRevision: Number(data.lifecycle_revision),
  };
}

async function consumeCustomerStatusRateLimit(
  kind: "ip" | "token" | "global",
  value: string,
  limit: number,
) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "repairdesk_consume_customer_status_rate_limit_v1",
    {
      p_scope_key: `${kind}:${rateLimitHmac(kind, value)}`,
      p_limit: limit,
      p_window_seconds: 300,
    },
  );
  fail(error, "客户查询频率检查失败");
  const result = (Array.isArray(data) ? data[0] : data) as DbRecord | null;
  if (result?.allowed !== true) {
    throw new CustomerStatusRateLimitError(Number(result?.retry_after_seconds || 300));
  }
}

async function consumeCustomerStatusPublicRequestRateLimit(clientAddress: string) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "repairdesk_consume_customer_status_public_request_v1",
    {
      p_ip_scope_key: `ip:${rateLimitHmac("ip", clientAddress)}`,
      p_global_scope_key: `global:${rateLimitHmac("global", "customer-status")}`,
      p_ip_limit: 60,
      p_global_limit: 3000,
      p_window_seconds: 300,
    },
  );
  fail(error, "客户查询频率检查失败");
  const result = (Array.isArray(data) ? data[0] : data) as DbRecord | null;
  if (result?.allowed !== true) {
    throw new CustomerStatusRateLimitError(Number(result?.retry_after_seconds || 300));
  }
}

function rateLimitHmac(kind: string, value: string) {
  const sourceSecret =
    process.env.CUSTOMER_STATUS_RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sourceSecret) throw new Error("客户查询频率保护未配置");
  const separatedKey = createHash("sha256")
    .update(`repairdesk-customer-status-rate-limit-v1:${sourceSecret}`)
    .digest();
  return createHmac("sha256", separatedKey).update(`${kind}:${value}`).digest("hex");
}

function hashCustomerStatusToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function optionalPublicText<Key extends "phone" | "whatsapp" | "email">(
  key: Key,
  value: unknown,
): Partial<Record<Key, string>> {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? ({ [key]: text } as Partial<Record<Key, string>>) : {};
}

function fail(error: { message?: string } | null | undefined, context: string) {
  if (error) throw new Error(`${context}：${error.message || "unknown error"}`);
}
