import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  normalizeKioskSessionCreateInput,
  normalizeKioskSubmission,
} from "@/features/kiosk/model/kiosk-session";
import { getSupabaseAdmin } from "@/server/supabase";
import {
  ORDER_SELECT,
  decorate,
  fail,
  maybeString,
  money,
  operatorNameFromActor,
  requireStoreIdFromActor,
  requiredString,
  type DbRecord,
} from "@/server/repairdesk-shared";
import type {
  AuditActor,
  KioskDevice,
  KioskDevicePairingInput,
  KioskDevicePairingResult,
  KioskPairResult,
  KioskPublicSession,
  KioskSession,
  KioskSessionCreateInput,
  KioskSessionSubmitInput,
} from "@/lib/repairdesk/types";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

const PAIRING_CODE_TTL_MINUTES = 15;
const SESSION_DEFAULT_TTL_MINUTES = 30;

export async function listKioskDevices(actor?: AuditActor): Promise<KioskDevice[]> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("store_kiosk_devices")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  fail(error, "读取客户 iPad 设备失败");
  return ((data ?? []) as DbRecord[]).map(deviceFromRow);
}

export async function createKioskDevicePairing(
  input: KioskDevicePairingInput,
  actor?: AuditActor,
): Promise<KioskDevicePairingResult> {
  const storeId = requireStoreIdFromActor(actor);
  const operatorName = operatorNameFromActor(actor);
  const label = input.label.trim().replace(/\s+/g, " ");
  if (!label) throw new Error("请输入 iPad 名称");
  if (label.length > 80) throw new Error("iPad 名称过长");

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const code = createPairingCode();
  const expiresAt = addMinutes(now, PAIRING_CODE_TTL_MINUTES).toISOString();
  const row = {
    id: randomUUID(),
    store_id: storeId,
    label,
    status: "pairing",
    pairing_code_hash: hashSecret(code),
    pairing_code_expires_at: expiresAt,
    paired_by: operatorName,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const { data, error } = await supabase
    .from("store_kiosk_devices")
    .insert(row)
    .select("*")
    .single();
  fail(error, "生成 iPad 配对码失败");

  return {
    device: deviceFromRow(data as DbRecord),
    pairing_code: code,
    expires_at: expiresAt,
  };
}

export async function revokeKioskDevice(id: string, actor?: AuditActor): Promise<{ ok: boolean }> {
  const storeId = requireStoreIdFromActor(actor);
  const operatorName = operatorNameFromActor(actor);
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("store_kiosk_devices")
    .update({
      status: "revoked",
      device_token_hash: null,
      revoked_by: operatorName,
      revoked_at: now,
      updated_at: now,
    })
    .eq("store_id", storeId)
    .eq("id", id);
  fail(error, "撤销客户 iPad 失败");
  return { ok: true };
}

export async function listKioskSessions(actor?: AuditActor): Promise<KioskSession[]> {
  const storeId = requireStoreIdFromActor(actor);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("customer_kiosk_sessions")
    .select("*, device:store_kiosk_devices(*)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(30);
  fail(error, "读取客户 iPad 任务失败");
  return ((data ?? []) as DbRecord[]).map(sessionFromRow);
}

export async function createKioskSession(
  input: KioskSessionCreateInput,
  actor?: AuditActor,
): Promise<KioskSession> {
  const storeId = requireStoreIdFromActor(actor);
  const operatorName = operatorNameFromActor(actor);
  const normalized = normalizeKioskSessionCreateInput({
    ...input,
    expires_in_minutes: input.expires_in_minutes ?? SESSION_DEFAULT_TTL_MINUTES,
  });
  const supabase = getSupabaseAdmin();

  const device = await readActiveDevice(supabase, storeId, normalized.device_id);
  const order = normalized.order_id
    ? await readOrderSummary(supabase, storeId, normalized.order_id)
    : undefined;
  const now = new Date();
  const expiresAt = addMinutes(now, normalized.expires_in_minutes).toISOString();

  const { error: cancelError } = await supabase
    .from("customer_kiosk_sessions")
    .update({
      status: "cancelled",
      cancelled_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("store_id", storeId)
    .eq("device_id", device.id)
    .in("status", ["queued", "active", "returned"]);
  fail(cancelError, "取消旧 iPad 任务失败");

  const requestPayload = {
    ...normalized.request_payload,
    ...(order
      ? {
          order_public_no: order.public_no,
          device_label: order.device_label,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          balance_amount: order.balance_amount,
        }
      : {}),
  };
  const row = {
    id: randomUUID(),
    store_id: storeId,
    device_id: device.id,
    order_id: normalized.order_id ?? null,
    customer_id: normalized.customer_id ?? null,
    session_type: normalized.session_type,
    status: "queued",
    request_payload: requestPayload,
    submission_version: 0,
    expires_at: expiresAt,
    requested_by: operatorName,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const { data, error } = await supabase
    .from("customer_kiosk_sessions")
    .insert(row)
    .select("*, device:store_kiosk_devices(*)")
    .single();
  fail(error, "创建客户 iPad 任务失败");

  if (order) {
    await writeKioskOrderEvent(supabase, {
      storeId,
      orderId: order.id,
      operatorName,
      action: "kiosk_session_requested",
      payload: {
        session_id: row.id,
        device_id: device.id,
        session_type: normalized.session_type,
      },
    });
  }

  return sessionFromRow(data as DbRecord);
}

export async function pairKioskDevice(code: string): Promise<KioskPairResult> {
  const cleanCode = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (cleanCode.length < 6) throw new Error("配对码无效");
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("store_kiosk_devices")
    .select("*")
    .eq("pairing_code_hash", hashSecret(cleanCode))
    .in("status", ["pairing", "active"])
    .gt("pairing_code_expires_at", now)
    .maybeSingle();
  fail(error, "读取 iPad 配对码失败");
  if (!data) throw new Error("配对码无效或已过期");

  const token = createDeviceToken();
  const { data: updated, error: updateError } = await supabase
    .from("store_kiosk_devices")
    .update({
      status: "active",
      device_token_hash: hashSecret(token),
      pairing_code_hash: null,
      pairing_code_expires_at: null,
      paired_at: now,
      last_seen_at: now,
      updated_at: now,
    })
    .eq("id", requiredString((data as DbRecord).id))
    .select("*")
    .single();
  fail(updateError, "保存 iPad 配对状态失败");
  return { token, device: deviceFromRow(updated as DbRecord) };
}

export async function getKioskPublicSession(token: string): Promise<KioskPublicSession | null> {
  const supabase = getSupabaseAdmin();
  const device = await readDeviceByToken(supabase, token);
  await touchDevice(supabase, device.id);
  await expireOldSessions(supabase, device.store_id);

  const { data, error } = await supabase
    .from("customer_kiosk_sessions")
    .select("*")
    .eq("store_id", device.store_id)
    .eq("device_id", device.id)
    .in("status", ["queued", "active", "returned", "submitted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(error, "读取 iPad 当前任务失败");
  if (!data) return null;

  let session = sessionFromRow(data as DbRecord);
  if (session.status === "queued") {
    const now = new Date().toISOString();
    const { data: activated, error: activateError } = await supabase
      .from("customer_kiosk_sessions")
      .update({ status: "active", updated_at: now })
      .eq("id", session.id)
      .select("*")
      .single();
    fail(activateError, "打开 iPad 任务失败");
    session = sessionFromRow(activated as DbRecord);
  }

  const order = session.order_id
    ? await readOrderSummary(supabase, device.store_id, session.order_id)
    : undefined;
  const storeName = await readStoreName(supabase, device.store_id);

  return {
    session: {
      id: session.id,
      session_type: session.session_type,
      status: session.status,
      request_payload: session.request_payload,
      expires_at: session.expires_at,
      submitted_at: session.submitted_at,
    },
    device: { id: device.id, label: device.label, status: device.status },
    store: { name: storeName },
    order: order
      ? {
          id: order.id,
          public_no: order.public_no,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          device_label: order.device_label,
          balance_amount: order.balance_amount,
          status: order.status,
        }
      : undefined,
  };
}

export async function submitKioskPublicSession(
  token: string,
  input: KioskSessionSubmitInput,
): Promise<{ ok: boolean; session_id: string }> {
  const supabase = getSupabaseAdmin();
  const device = await readDeviceByToken(supabase, token);
  const submission = normalizeKioskSubmission(input);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("customer_kiosk_sessions")
    .select("*")
    .eq("store_id", device.store_id)
    .eq("device_id", device.id)
    .in("status", ["queued", "active", "returned"])
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(error, "读取 iPad 提交任务失败");
  if (!data) throw new Error("当前没有可提交的 iPad 任务");

  const session = sessionFromRow(data as DbRecord);
  const { error: updateError } = await supabase
    .from("customer_kiosk_sessions")
    .update({
      status: "submitted",
      submission_payload: submission,
      submission_version: session.submission_version + 1,
      submitted_at: now,
      updated_at: now,
    })
    .eq("store_id", device.store_id)
    .eq("id", session.id);
  fail(updateError, "提交 iPad 表单失败");

  if (session.order_id) {
    await writeKioskOrderEvent(supabase, {
      storeId: device.store_id,
      orderId: session.order_id,
      operatorName: device.label,
      action: "kiosk_session_submitted",
      payload: {
        session_id: session.id,
        device_id: device.id,
        session_type: session.session_type,
        has_signature: Boolean(submission.signature_data_url),
        confirmation_checked: submission.confirmation_checked === true,
      },
    });
  }

  return { ok: true, session_id: session.id };
}

async function readActiveDevice(supabase: SupabaseAdmin, storeId: string, id: string) {
  const { data, error } = await supabase
    .from("store_kiosk_devices")
    .select("*")
    .eq("store_id", storeId)
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();
  fail(error, "读取客户 iPad 失败");
  if (!data) throw new Error("客户 iPad 未绑定或不可用");
  return deviceFromRow(data as DbRecord);
}

async function readDeviceByToken(supabase: SupabaseAdmin, token: string) {
  const cleanToken = token.trim();
  if (cleanToken.length < 24) throw new Error("iPad token 无效");
  const { data, error } = await supabase
    .from("store_kiosk_devices")
    .select("*")
    .eq("device_token_hash", hashSecret(cleanToken))
    .eq("status", "active")
    .maybeSingle();
  fail(error, "读取 iPad 设备失败");
  if (!data) throw new Error("iPad 未绑定或已撤销");
  return deviceFromRow(data as DbRecord);
}

async function touchDevice(supabase: SupabaseAdmin, deviceId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("store_kiosk_devices")
    .update({ last_seen_at: now, updated_at: now })
    .eq("id", deviceId);
  fail(error, "更新 iPad 在线状态失败");
}

async function expireOldSessions(supabase: SupabaseAdmin, storeId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("customer_kiosk_sessions")
    .update({ status: "expired", updated_at: now })
    .eq("store_id", storeId)
    .in("status", ["queued", "active", "returned"])
    .lte("expires_at", now);
  fail(error, "更新过期 iPad 任务失败");
}

async function readOrderSummary(supabase: SupabaseAdmin, storeId: string, orderId: string) {
  const { data, error } = await supabase
    .from("repair_orders")
    .select(ORDER_SELECT)
    .eq("store_id", storeId)
    .eq("id", orderId)
    .maybeSingle();
  fail(error, "读取工单摘要失败");
  if (!data) throw new Error("工单不存在或不属于当前店铺");
  const order = decorate(data as DbRecord);
  return {
    id: order.id,
    public_no: order.public_no,
    status: order.status,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    device_label: order.device_label,
    balance_amount: money(order.balance_amount),
  };
}

async function readStoreName(supabase: SupabaseAdmin, storeId: string) {
  const { data } = await supabase
    .from("store_settings")
    .select("store_name")
    .eq("store_id", storeId)
    .maybeSingle();
  return maybeString((data as DbRecord | null)?.store_name) || "ChinaTech";
}

async function writeKioskOrderEvent(
  supabase: SupabaseAdmin,
  input: {
    storeId: string;
    orderId: string;
    operatorName: string;
    action: string;
    payload: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("order_events").insert({
    id: randomUUID(),
    store_id: input.storeId,
    order_id: input.orderId,
    event_type: "note",
    payload: { action: input.action, ...input.payload },
    operator_name: input.operatorName,
    created_at: new Date().toISOString(),
  });
  fail(error, "写入 iPad 任务时间线失败");
}

function deviceFromRow(row: DbRecord): KioskDevice {
  return {
    id: requiredString(row.id),
    store_id: requiredString(row.store_id),
    label: requiredString(row.label) || "客户 iPad",
    status: normalizeDeviceStatus(row.status),
    last_seen_at: maybeString(row.last_seen_at),
    paired_at: maybeString(row.paired_at),
    pairing_code_expires_at: maybeString(row.pairing_code_expires_at),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
  };
}

function sessionFromRow(row: DbRecord): KioskSession {
  const deviceRow = row.device && typeof row.device === "object" ? (row.device as DbRecord) : null;
  return {
    id: requiredString(row.id),
    store_id: requiredString(row.store_id),
    device_id: requiredString(row.device_id),
    order_id: maybeString(row.order_id),
    customer_id: maybeString(row.customer_id),
    session_type:
      row.session_type === "order_contact_signature" || row.session_type === "pickup_signature"
        ? row.session_type
        : "intake_contact",
    status:
      row.status === "active" ||
      row.status === "submitted" ||
      row.status === "accepted" ||
      row.status === "returned" ||
      row.status === "cancelled" ||
      row.status === "expired"
        ? row.status
        : "queued",
    request_payload: recordFromJson(row.request_payload),
    submission_payload: recordFromJson(row.submission_payload),
    submission_version: Number(row.submission_version ?? 0),
    expires_at: requiredString(row.expires_at),
    submitted_at: maybeString(row.submitted_at),
    accepted_at: maybeString(row.accepted_at),
    cancelled_at: maybeString(row.cancelled_at),
    returned_at: maybeString(row.returned_at),
    created_at: requiredString(row.created_at),
    updated_at: requiredString(row.updated_at),
    device: deviceRow ? deviceFromRow(deviceRow) : undefined,
  };
}

function recordFromJson(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeDeviceStatus(value: unknown): KioskDevice["status"] {
  if (value === "active" || value === "suspended" || value === "revoked" || value === "pairing") {
    return value;
  }
  return "revoked";
}

function createPairingCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

function createDeviceToken() {
  return randomBytes(32).toString("base64url");
}

function hashSecret(value: string) {
  return createHash("sha256").update(value.trim()).digest("hex");
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}
