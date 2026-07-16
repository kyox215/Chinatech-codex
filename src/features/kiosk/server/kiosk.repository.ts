import { Buffer } from "node:buffer";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  normalizeKioskReturnInput,
  normalizeKioskSessionCreateInput,
  normalizeKioskSubmission,
} from "@/features/kiosk/model/kiosk-session";
import { getSupabaseAdmin } from "@/server/supabase";
import {
  ORDER_SELECT,
  decorate,
  fail,
  failStorageOperation,
  maybeString,
  money,
  operatorNameFromActor,
  requireStoreIdFromActor,
  requiredString,
  stringArray,
  type DbRecord,
} from "@/server/repairdesk-shared";
import { normalizePhoneBook, normalizePhoneRaw } from "@/shared/lib/phone";
import type {
  AuditActor,
  KioskDevice,
  KioskDevicePairingInput,
  KioskDevicePairingResult,
  KioskPairResult,
  KioskPublicSession,
  KioskSession,
  KioskSessionCreateInput,
  KioskSessionReturnInput,
  KioskSessionSubmitInput,
} from "@/lib/repairdesk/types";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

const PAIRING_CODE_TTL_MINUTES = 15;
const SESSION_DEFAULT_TTL_MINUTES = 30;
const ORDER_ATTACHMENT_BUCKET = "repairdesk-order-attachments";
const KIOSK_SIGNATURE_MAX_BYTES = 8 * 1024 * 1024;

interface NormalizedKioskSubmission {
  customer_name?: string;
  customer_phone?: string;
  backup_phone?: string;
  preferred_channel?: "whatsapp" | "sms";
  language?: "it" | "zh" | "en";
  confirmation_checked: boolean;
  has_signature: boolean;
  signature_data_url?: string;
  note?: string;
}

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
  if (order?.record_state === "voided" || order?.deleted_at) {
    throw new Error("该工单记录已作废，只能查看历史证据");
  }
  if (
    normalized.session_type === "pickup_signature" &&
    order?.device_custody_status !== "with_shop"
  ) {
    throw new Error("只有已确认由门店保管的设备可以发起取机确认");
  }
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

export async function acceptKioskSession(id: string, actor?: AuditActor): Promise<KioskSession> {
  const storeId = requireStoreIdFromActor(actor);
  const operatorName = operatorNameFromActor(actor);
  const sessionId = id.trim();
  if (!sessionId) throw new Error("缺少 iPad 任务");

  const supabase = getSupabaseAdmin();
  const session = await readSubmittedSession(supabase, storeId, sessionId);
  const submission = submissionFromPayload(session.submission_payload);
  const now = new Date().toISOString();
  const order = session.order_id
    ? await readOrderReviewTarget(supabase, storeId, session.order_id)
    : undefined;
  if (session.session_type === "pickup_signature" && order?.device_custody_status !== "with_shop") {
    throw new Error("只有已确认由门店保管的设备可以确认取机交接");
  }
  const customerId = session.customer_id ?? order?.customer_id;

  if (session.customer_id && order?.customer_id && session.customer_id !== order.customer_id) {
    throw new Error("iPad 任务绑定的客户与工单不一致");
  }

  if (session.session_type === "pickup_signature" && order) {
    await assertPickupCustodyUnchanged(supabase, storeId, order.id, order.updated_at);
  }

  if (customerId) {
    await applyKioskCustomerSubmission(supabase, {
      storeId,
      customerId,
      orderId: order?.id,
      submission,
      now,
    });
  } else if (hasContactSubmission(submission)) {
    throw new Error("该 iPad 提交未绑定客户，暂不能直接写入客户档案");
  }

  const signatureAttachment =
    session.order_id && submission.signature_data_url
      ? await persistKioskSignatureAttachment(supabase, {
          storeId,
          orderId: session.order_id,
          session,
          submission,
          operatorName,
          now,
        })
      : undefined;

  if (session.session_type === "pickup_signature" && order) {
    await assertPickupCustodyUnchanged(supabase, storeId, order.id, order.updated_at);
  }

  const { data, error } = await supabase
    .from("customer_kiosk_sessions")
    .update({
      status: "accepted",
      submission_payload: acceptedSubmissionPayload(
        session.submission_payload,
        signatureAttachment,
      ),
      accepted_by: operatorName,
      accepted_at: now,
      updated_at: now,
    })
    .eq("store_id", storeId)
    .eq("id", session.id)
    .eq("status", "submitted")
    .select("*, device:store_kiosk_devices(*)")
    .maybeSingle();
  fail(error, "接受 iPad 提交失败");
  if (!data) throw new Error("iPad 任务已被处理，请刷新后再试");

  if (session.order_id) {
    await writeKioskOrderEvent(supabase, {
      storeId,
      orderId: session.order_id,
      operatorName,
      action: "kiosk_session_accepted",
      payload: {
        ...kioskReviewEventPayload(session, submission),
        ...(signatureAttachment ? { signature_attachment_id: signatureAttachment.id } : {}),
      },
    });
  }

  return sessionFromRow(data as DbRecord);
}

export async function returnKioskSession(
  input: KioskSessionReturnInput,
  actor?: AuditActor,
): Promise<KioskSession> {
  const storeId = requireStoreIdFromActor(actor);
  const operatorName = operatorNameFromActor(actor);
  const normalized = normalizeKioskReturnInput(input);
  const supabase = getSupabaseAdmin();
  const session = await readSubmittedSession(supabase, storeId, normalized.id);
  const submission = submissionFromPayload(session.submission_payload);
  const now = new Date().toISOString();
  const nextSubmissionPayload = {
    ...(session.submission_payload ?? {}),
    staff_return_reason: normalized.reason,
  };

  const { data, error } = await supabase
    .from("customer_kiosk_sessions")
    .update({
      status: "returned",
      submission_payload: nextSubmissionPayload,
      returned_at: now,
      updated_at: now,
    })
    .eq("store_id", storeId)
    .eq("id", session.id)
    .eq("status", "submitted")
    .select("*, device:store_kiosk_devices(*)")
    .maybeSingle();
  fail(error, "退回 iPad 提交失败");
  if (!data) throw new Error("iPad 任务已被处理，请刷新后再试");

  if (session.order_id) {
    await writeKioskOrderEvent(supabase, {
      storeId,
      orderId: session.order_id,
      operatorName,
      action: "kiosk_session_returned",
      payload: {
        ...kioskReviewEventPayload(session, submission),
        reason_provided: true,
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

async function readSubmittedSession(
  supabase: SupabaseAdmin,
  storeId: string,
  id: string,
): Promise<KioskSession> {
  const { data, error } = await supabase
    .from("customer_kiosk_sessions")
    .select("*, device:store_kiosk_devices(*)")
    .eq("store_id", storeId)
    .eq("id", id)
    .eq("status", "submitted")
    .maybeSingle();
  fail(error, "读取 iPad 提交失败");
  if (!data) throw new Error("没有可审核的 iPad 提交");
  return sessionFromRow(data as DbRecord);
}

async function readOrderReviewTarget(supabase: SupabaseAdmin, storeId: string, orderId: string) {
  const { data, error } = await supabase
    .from("repair_orders")
    .select("id,customer_id,contact_phones,device_custody_status,updated_at")
    .eq("store_id", storeId)
    .eq("id", orderId)
    .maybeSingle();
  fail(error, "读取 iPad 审核工单失败");
  if (!data) throw new Error("工单不存在或不属于当前店铺");
  const row = data as DbRecord;
  return {
    id: requiredString(row.id),
    customer_id: requiredString(row.customer_id),
    contact_phones: stringArray(row.contact_phones),
    updated_at: requiredString(row.updated_at),
    device_custody_status:
      row.device_custody_status === "with_shop" || row.device_custody_status === "with_customer"
        ? row.device_custody_status
        : null,
  };
}

async function assertPickupCustodyUnchanged(
  supabase: SupabaseAdmin,
  storeId: string,
  orderId: string,
  expectedUpdatedAt: string,
) {
  const latest = await readOrderReviewTarget(supabase, storeId, orderId);
  if (latest.device_custody_status !== "with_shop" || latest.updated_at !== expectedUpdatedAt) {
    throw new Error("工单或设备保管状态已更新，请刷新后重新确认取机交接");
  }
}

async function applyKioskCustomerSubmission(
  supabase: SupabaseAdmin,
  input: {
    storeId: string;
    customerId: string;
    orderId?: string;
    submission: NormalizedKioskSubmission;
    now: string;
  },
) {
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,phone_e164,phone_raw,contact_phones,preferred_channel,language")
    .eq("store_id", input.storeId)
    .eq("id", input.customerId)
    .maybeSingle();
  fail(error, "读取 iPad 审核客户失败");
  if (!data) throw new Error("客户不存在或不属于当前店铺");

  const row = data as DbRecord;
  const existingPhones = stringArray(row.contact_phones);
  const customerUpdate: DbRecord = {};
  const orderUpdate: DbRecord = {};

  if (input.submission.customer_name) {
    customerUpdate.name = input.submission.customer_name;
  }
  if (input.submission.preferred_channel) {
    customerUpdate.preferred_channel = input.submission.preferred_channel;
  }
  if (input.submission.language) {
    customerUpdate.language = input.submission.language;
  }

  if (input.submission.customer_phone || input.submission.backup_phone) {
    const phoneBook = normalizePhoneBook(
      input.submission.customer_phone || requiredString(row.phone_e164),
      [
        ...(input.submission.backup_phone ? [input.submission.backup_phone] : []),
        ...existingPhones,
      ],
    );
    if (!phoneBook.primaryRaw) throw new Error("手机号格式不正确");
    await assertKioskCustomerPhonesAvailable(
      supabase,
      input.storeId,
      input.customerId,
      phoneBook.primaryRaw,
      phoneBook.contacts,
    );
    customerUpdate.phone_e164 = phoneBook.primary;
    customerUpdate.phone_raw = phoneBook.primaryRaw;
    customerUpdate.contact_phones = phoneBook.contacts;
    orderUpdate.contact_phones = phoneBook.contacts;
  }

  if (Object.keys(customerUpdate).length > 0) {
    const { error: updateError } = await supabase
      .from("customers")
      .update({ ...customerUpdate, updated_at: input.now })
      .eq("store_id", input.storeId)
      .eq("id", input.customerId);
    fail(updateError, "更新 iPad 审核客户失败");
  }

  if (input.orderId && Object.keys(orderUpdate).length > 0) {
    const { error: orderError } = await supabase
      .from("repair_orders")
      .update({ ...orderUpdate, updated_at: input.now })
      .eq("store_id", input.storeId)
      .eq("id", input.orderId)
      .eq("customer_id", input.customerId);
    fail(orderError, "更新 iPad 审核工单失败");
  }
}

async function assertKioskCustomerPhonesAvailable(
  supabase: SupabaseAdmin,
  storeId: string,
  customerId: string,
  primaryRaw: string,
  contactPhones: string[],
) {
  const raws = Array.from(
    new Set([
      primaryRaw,
      ...contactPhones.map((phone) => normalizePhoneRaw(phone)).filter(Boolean),
    ]),
  );
  if (raws.length === 0) return;
  const { data, error } = await supabase
    .from("customers")
    .select("id,phone_raw")
    .eq("store_id", storeId)
    .in("phone_raw", raws);
  fail(error, "检查 iPad 审核手机号失败");
  const conflicts = ((data ?? []) as DbRecord[]).filter(
    (row) => requiredString(row.id) !== customerId,
  );
  if (conflicts.length === 0) return;
  if (conflicts.some((row) => requiredString(row.phone_raw) === primaryRaw)) {
    throw new Error("该手机号已存在客户档案");
  }
  throw new Error("备用号码已属于其他客户档案，请先确认客户资料");
}

function submissionFromPayload(
  payload: Record<string, unknown> | undefined,
): NormalizedKioskSubmission {
  const source = payload ?? {};
  return {
    customer_name: maybeString(source.customer_name),
    customer_phone: maybeString(source.customer_phone),
    backup_phone: maybeString(source.backup_phone),
    preferred_channel:
      source.preferred_channel === "sms" || source.preferred_channel === "whatsapp"
        ? source.preferred_channel
        : undefined,
    language:
      source.language === "zh" || source.language === "en" || source.language === "it"
        ? source.language
        : undefined,
    confirmation_checked: source.confirmation_checked === true,
    has_signature: Boolean(
      maybeString(source.signature_data_url) ||
      maybeString(source.signature_attachment_id) ||
      source.has_signature === true,
    ),
    signature_data_url: maybeString(source.signature_data_url),
    note: maybeString(source.note),
  };
}

function hasContactSubmission(submission: NormalizedKioskSubmission) {
  return Boolean(
    submission.customer_name ||
    submission.customer_phone ||
    submission.backup_phone ||
    submission.preferred_channel ||
    submission.language,
  );
}

function kioskReviewEventPayload(
  session: KioskSession,
  submission: NormalizedKioskSubmission,
): Record<string, unknown> {
  return {
    session_id: session.id,
    device_id: session.device_id,
    session_type: session.session_type,
    submission_version: session.submission_version,
    has_customer_name: Boolean(submission.customer_name),
    has_customer_phone: Boolean(submission.customer_phone),
    has_backup_phone: Boolean(submission.backup_phone),
    has_signature: submission.has_signature,
    confirmation_checked: submission.confirmation_checked,
    has_note: Boolean(submission.note),
  };
}

function acceptedSubmissionPayload(
  payload: Record<string, unknown> | undefined,
  signatureAttachment?: { id: string },
): Record<string, unknown> {
  const next = { ...(payload ?? {}) };
  if (signatureAttachment) {
    delete next.signature_data_url;
    next.has_signature = true;
    next.signature_attachment_id = signatureAttachment.id;
  }
  return next;
}

async function persistKioskSignatureAttachment(
  supabase: SupabaseAdmin,
  input: {
    storeId: string;
    orderId: string;
    session: KioskSession;
    submission: NormalizedKioskSubmission;
    operatorName: string;
    now: string;
  },
): Promise<{ id: string; mime_type: string; file_size: number }> {
  if (!input.submission.signature_data_url) throw new Error("缺少客户签名");
  const parsed = parseKioskSignatureDataUrl(input.submission.signature_data_url);
  const attachmentId = randomUUID();
  const fileName = `kiosk-signature-${input.session.id}-v${input.session.submission_version}.${parsed.extension}`;
  const storagePath = `${input.storeId}/${input.orderId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(ORDER_ATTACHMENT_BUCKET)
    .upload(storagePath, parsed.bytes, {
      contentType: parsed.mimeType,
      upsert: false,
    });
  failStorageOperation(uploadError, "上传 iPad 签名失败", ORDER_ATTACHMENT_BUCKET);

  const row = {
    id: attachmentId,
    store_id: input.storeId,
    order_id: input.orderId,
    kind: "signature",
    file_name: fileName,
    mime_type: parsed.mimeType,
    file_size: parsed.bytes.byteLength,
    storage_bucket: ORDER_ATTACHMENT_BUCKET,
    storage_path: storagePath,
    note: "iPad pickup/customer signature",
    uploaded_by: input.operatorName,
    created_at: input.now,
    updated_at: input.now,
  };

  const { error: insertError } = await supabase.from("order_attachments").insert(row);
  if (insertError) {
    await supabase.storage
      .from(ORDER_ATTACHMENT_BUCKET)
      .remove([storagePath])
      .catch(() => undefined);
    fail(insertError, "保存 iPad 签名附件失败");
  }

  const { error: orderError } = await supabase
    .from("repair_orders")
    .update({ customer_signature: `order_attachment:${attachmentId}`, updated_at: input.now })
    .eq("store_id", input.storeId)
    .eq("id", input.orderId);
  fail(orderError, "更新工单签名状态失败");

  await writeKioskOrderEvent(supabase, {
    storeId: input.storeId,
    orderId: input.orderId,
    operatorName: input.operatorName,
    action: "kiosk_signature_saved",
    payload: {
      session_id: input.session.id,
      session_type: input.session.session_type,
      attachment_id: attachmentId,
      mime_type: parsed.mimeType,
      file_size: parsed.bytes.byteLength,
    },
  });

  return { id: attachmentId, mime_type: parsed.mimeType, file_size: parsed.bytes.byteLength };
}

function parseKioskSignatureDataUrl(dataUrl: string) {
  const match = /^data:image\/(png|jpeg|webp);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) throw new Error("签名图片格式无效");
  const subtype = match[1]!.toLowerCase();
  const base64 = match[2]!.replace(/\s+/g, "");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.byteLength === 0) throw new Error("签名图片为空");
  if (bytes.byteLength > KIOSK_SIGNATURE_MAX_BYTES) throw new Error("签名图片不能超过 8MB");
  const mimeType = `image/${subtype === "jpeg" ? "jpeg" : subtype}`;
  assertKioskSignatureMagicBytes(bytes, mimeType);
  return {
    bytes,
    mimeType,
    extension: subtype === "jpeg" ? "jpg" : subtype,
  };
}

function assertKioskSignatureMagicBytes(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg" && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return;
  }
  if (
    mimeType === "image/png" &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return;
  }
  if (
    mimeType === "image/webp" &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return;
  }
  throw new Error("签名图片内容与文件类型不匹配");
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
    record_state: order.record_state,
    deleted_at: order.deleted_at,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    device_label: order.device_label,
    balance_amount: money(order.balance_amount),
    device_custody_status: order.device_custody_status,
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
