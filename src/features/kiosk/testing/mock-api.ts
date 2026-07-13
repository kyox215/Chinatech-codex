import {
  assertKioskSubmissionRequirements,
  normalizeKioskReturnInput,
  normalizeKioskSessionCreateInput,
  normalizeKioskSubmission,
  publicKioskSubmissionDraft,
} from "@/features/kiosk/model/kiosk-session";
import {
  kioskDeviceUnauthorizedError,
  kioskPairingInvalidError,
  kioskSessionConflictError,
} from "@/features/kiosk/model/kiosk-public-error";
import { customers, decorate, extraEvents, orders } from "@/lib/mock/state";
import { normalizePhoneBook } from "@/shared/lib/phone";
import { uploadOrderAttachment } from "@/features/orders/testing/mock-api";
import type {
  AuditActor,
  KioskDevice,
  KioskDevicePairClaimResult,
  KioskDevicePairingInput,
  KioskDevicePairingResult,
  KioskPublicSession,
  KioskSession,
  KioskSessionCreateInput,
  KioskSessionReturnInput,
  KioskSessionSubmitInput,
} from "@/lib/repairdesk/types";

const mockStoreId = "00000000-0000-0000-0000-000000000001";
const mockTokens = new Map<string, string>();
const mockPairingCodes = new Map<string, { deviceId: string; expiresAt: string }>();
const mockStoreNames = new Map([[mockStoreId, "ChinaTech"]]);
const mockDevices: KioskDevice[] = [
  {
    id: "kiosk_device_demo",
    store_id: mockStoreId,
    label: "前台 iPad",
    status: "active",
    paired_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
const mockSessions: KioskSession[] = [];

mockTokens.set("demo-kiosk-token", "kiosk_device_demo");

export async function listKioskDevices(actor?: AuditActor): Promise<KioskDevice[]> {
  const storeId = actor?.storeId ?? mockStoreId;
  return mockDevices.filter((device) => device.store_id === storeId);
}

export async function createKioskDevicePairing(
  input: KioskDevicePairingInput,
  actor?: AuditActor,
): Promise<KioskDevicePairingResult> {
  const label = input.label.trim().replace(/\s+/g, " ");
  if (!label) throw new Error("请输入 iPad 名称");
  if (label.length > 80) throw new Error("iPad 名称过长");
  const now = new Date().toISOString();
  const code = `MOCK${String(12_345_678 + mockDevices.length).padStart(8, "0")}`;
  const storeId = actor?.storeId ?? mockStoreId;
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const device: KioskDevice = {
    id: `kiosk_device_${mockDevices.length + 1}`,
    store_id: storeId,
    label,
    status: "pairing",
    pairing_code_expires_at: expiresAt,
    created_at: now,
    updated_at: now,
  };
  mockDevices.unshift(device);
  mockPairingCodes.set(code, { deviceId: device.id, expiresAt });
  if (actor?.storeName) mockStoreNames.set(storeId, actor.storeName);
  return { device, pairing_code: code, expires_at: expiresAt };
}

export async function revokeKioskDevice(id: string, actor?: AuditActor): Promise<{ ok: boolean }> {
  const storeId = actor?.storeId ?? mockStoreId;
  const device = mockDevices.find(
    (item) => item.id === id && item.store_id === storeId && item.status !== "revoked",
  );
  if (!device) throw new Error("客户 iPad 不存在、不属于当前店铺或已撤销");
  device.status = "revoked";
  device.pairing_code_expires_at = undefined;
  device.updated_at = new Date().toISOString();
  for (const [token, deviceId] of mockTokens) {
    if (deviceId === device.id) mockTokens.delete(token);
  }
  for (const [code, pairing] of mockPairingCodes) {
    if (pairing.deviceId === device.id) mockPairingCodes.delete(code);
  }
  return { ok: true };
}

export async function listKioskSessions(actor?: AuditActor): Promise<KioskSession[]> {
  const storeId = actor?.storeId ?? mockStoreId;
  return mockSessions
    .filter((session) => session.store_id === storeId)
    .map((session) => safeStaffKioskSession(session));
}

export async function createKioskSession(
  input: KioskSessionCreateInput,
  actor?: AuditActor,
): Promise<KioskSession> {
  const normalized = normalizeKioskSessionCreateInput(input);
  const storeId = actor?.storeId ?? mockStoreId;
  const device = mockDevices.find(
    (item) =>
      item.id === normalized.device_id && item.store_id === storeId && item.status === "active",
  );
  if (!device) throw new Error("客户 iPad 未绑定或不可用");
  const order = readMockOrderSummary(normalized.order_id, storeId);
  assertMockKioskSessionCreateScope(actor, order);
  if (
    normalized.session_type === "pickup_signature" &&
    order?.device_custody_status !== "with_shop"
  ) {
    throw new Error("只有已确认由门店保管的设备可以发起取机确认");
  }
  if (normalized.customer_id && storeId !== mockStoreId) {
    throw new Error("客户不存在或不属于当前店铺");
  }
  if (
    order?.customer_id &&
    normalized.customer_id &&
    order.customer_id !== normalized.customer_id
  ) {
    throw new Error("iPad 任务绑定的客户与工单不一致");
  }
  for (const session of mockSessions) {
    if (
      session.device_id === device.id &&
      ["queued", "active", "returned"].includes(session.status)
    ) {
      session.status = "cancelled";
      session.cancelled_at = new Date().toISOString();
    }
  }
  const now = new Date().toISOString();
  const session: KioskSession = {
    id: `kiosk_session_${mockSessions.length + 1}`,
    store_id: storeId,
    device_id: device.id,
    order_id: normalized.order_id,
    customer_id: normalized.customer_id,
    session_type: normalized.session_type,
    status: "queued",
    request_payload: {
      ...normalized.request_payload,
      ...(order
        ? {
            order_public_no: order.public_no,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            device_label: order.device_label,
            balance_amount: order.balance_amount,
          }
        : {}),
    },
    submission_version: 0,
    expires_at: new Date(Date.now() + normalized.expires_in_minutes * 60_000).toISOString(),
    created_at: now,
    updated_at: now,
    device,
  };
  mockSessions.unshift(session);
  return session;
}

export async function pairKioskDevice(code: string): Promise<KioskDevicePairClaimResult> {
  const cleanCode = code.trim();
  const pairing = mockPairingCodes.get(cleanCode);
  if (!pairing || new Date(pairing.expiresAt).getTime() <= Date.now()) {
    mockPairingCodes.delete(cleanCode);
    throw kioskPairingInvalidError();
  }
  const device = mockDevices.find(
    (item) => item.id === pairing.deviceId && item.status === "pairing",
  );
  if (!device) throw kioskPairingInvalidError();
  mockPairingCodes.delete(cleanCode);
  const token = `mock-token-${device.id}-${Date.now()}`;
  mockTokens.set(token, device.id);
  device.status = "active";
  device.paired_at = new Date().toISOString();
  device.last_seen_at = new Date().toISOString();
  device.updated_at = new Date().toISOString();
  return { token, device };
}

export async function getKioskPublicSession(token: string): Promise<KioskPublicSession | null> {
  const device = readDeviceByToken(token);
  const session = mockSessions.find(
    (item) =>
      item.device_id === device.id &&
      item.store_id === device.store_id &&
      ["queued", "active", "submitted", "returned"].includes(item.status),
  );
  device.last_seen_at = new Date().toISOString();
  if (!session) return null;
  if (session.status === "queued") session.status = "active";
  const order = readMockOrderSummary(session.order_id, session.store_id);
  return {
    session: {
      session_type: session.session_type,
      status: session.status,
      submission_version: session.submission_version,
      expires_at: session.expires_at,
      submitted_at: session.submitted_at,
      ...(session.status === "returned"
        ? {
            correction_message: publicCorrectionMessage(session.submission_payload),
            submission_draft: publicKioskSubmissionDraft(session.submission_payload),
          }
        : {}),
    },
    device: { label: device.label, status: device.status },
    store: { name: mockStoreNames.get(device.store_id) ?? "Negozio" },
    order: order
      ? {
          public_no: order.public_no,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          device_label: order.device_label,
        }
      : undefined,
  };
}

export async function submitKioskPublicSession(
  token: string,
  input: KioskSessionSubmitInput,
): Promise<{ ok: boolean; session_id: string; store_id: string }> {
  const device = readDeviceByToken(token);
  const session = mockSessions.find(
    (item) =>
      item.device_id === device.id &&
      item.store_id === device.store_id &&
      ["queued", "active", "returned"].includes(item.status) &&
      new Date(item.expires_at).getTime() > Date.now(),
  );
  if (!session) throw new Error("当前没有可提交的 iPad 任务");
  const expectedVersion = session.submission_version;
  const submission = normalizeKioskSubmission(input);
  assertKioskSubmissionRequirements(session.session_type, submission);
  if (
    session.submission_version !== expectedVersion ||
    !["queued", "active", "returned"].includes(session.status)
  ) {
    throw kioskSessionConflictError();
  }
  session.status = "submitted";
  session.submission_payload = submission;
  session.submission_version += 1;
  session.submitted_at = new Date().toISOString();
  session.updated_at = session.submitted_at;
  return { ok: true, session_id: session.id, store_id: device.store_id };
}

export async function acceptKioskSession(id: string, actor?: AuditActor): Promise<KioskSession> {
  const session = readSubmittedMockSession(id, actor);
  if (session.store_id !== mockStoreId && (session.order_id || session.customer_id)) {
    throw new Error("工单或客户不存在或不属于当前店铺");
  }
  const order = session.order_id ? orders.find((item) => item.id === session.order_id) : undefined;
  if (session.session_type === "pickup_signature" && order?.device_custody_status !== "with_shop") {
    throw new Error("只有已确认由门店保管的设备可以确认取机交接");
  }
  const customerId = session.customer_id ?? order?.customer_id;
  if (session.customer_id && order?.customer_id && session.customer_id !== order.customer_id) {
    throw new Error("iPad 任务绑定的客户与工单不一致");
  }
  const submission = session.submission_payload ?? {};
  assertKioskSubmissionRequirements(session.session_type, submission);
  const hasContactSubmission = Boolean(
    submission.customer_name ||
    submission.customer_phone ||
    submission.backup_phone ||
    submission.preferred_channel ||
    submission.language,
  );

  if (customerId) {
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) throw new Error("客户不存在或不属于当前店铺");
    if (typeof submission.customer_name === "string" && submission.customer_name.trim()) {
      customer.name = submission.customer_name.trim();
    }
    if (submission.preferred_channel === "sms" || submission.preferred_channel === "whatsapp") {
      customer.preferred_channel = submission.preferred_channel;
    }
    if (
      submission.language === "zh" ||
      submission.language === "en" ||
      submission.language === "it"
    ) {
      customer.language = submission.language;
    }
    if (
      typeof submission.customer_phone === "string" ||
      typeof submission.backup_phone === "string"
    ) {
      const phoneBook = normalizePhoneBook(
        typeof submission.customer_phone === "string" && submission.customer_phone.trim()
          ? submission.customer_phone
          : customer.phone_e164,
        [
          ...(typeof submission.backup_phone === "string" && submission.backup_phone.trim()
            ? [submission.backup_phone]
            : []),
          ...customer.contact_phones,
        ],
      );
      if (!phoneBook.primaryRaw) throw new Error("手机号格式不正确");
      customer.phone_e164 = phoneBook.primary;
      customer.phone_raw = phoneBook.primaryRaw;
      customer.contact_phones = phoneBook.contacts;
      if (order) order.contact_phones = phoneBook.contacts;
    }
  } else if (hasContactSubmission) {
    throw new Error("该 iPad 提交未绑定客户，暂不能直接写入客户档案");
  }

  if (order && typeof submission.signature_data_url === "string" && submission.signature_data_url) {
    const signature = signatureUploadFromDataUrl(submission.signature_data_url);
    const result = await uploadOrderAttachment(
      order.id,
      {
        kind: "signature",
        file_name: `kiosk-signature-${session.id}.png`,
        mime_type: signature.mime_type,
        file_size: signature.file_size,
        data_base64: signature.data_base64,
        note: "iPad pickup/customer signature",
      },
      actor,
    );
    order.customer_signature = `order_attachment:${result.attachment.id}`;
    session.submission_payload = {
      ...submission,
      signature_data_url: undefined,
      has_signature: true,
      signature_attachment_id: result.attachment.id,
    };
    delete session.submission_payload.signature_data_url;
  }

  const now = new Date().toISOString();
  session.status = "accepted";
  session.accepted_at = now;
  session.updated_at = now;
  writeMockKioskEvent(session, actor, "kiosk_session_accepted");
  return session;
}

export async function returnKioskSession(
  input: KioskSessionReturnInput,
  actor?: AuditActor,
): Promise<KioskSession> {
  const normalized = normalizeKioskReturnInput(input);
  const session = readSubmittedMockSession(normalized.id, actor);
  const now = new Date().toISOString();
  session.status = "returned";
  session.returned_at = now;
  session.updated_at = now;
  session.submission_payload = {
    ...(session.submission_payload ?? {}),
    customer_return_reason: normalized.reason,
  };
  writeMockKioskEvent(session, actor, "kiosk_session_returned");
  return session;
}

function readDeviceByToken(token: string) {
  const deviceId = mockTokens.get(token.trim());
  const device = deviceId ? mockDevices.find((item) => item.id === deviceId) : undefined;
  if (!device || device.status !== "active") throw kioskDeviceUnauthorizedError();
  return device;
}

function publicCorrectionMessage(payload: Record<string, unknown> | undefined) {
  const value = payload?.customer_return_reason;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : undefined;
}

function safeStaffKioskSession(session: KioskSession): KioskSession {
  const submission = { ...(session.submission_payload ?? {}) };
  if (typeof submission.signature_data_url === "string") {
    delete submission.signature_data_url;
    submission.has_signature = true;
  }
  return {
    ...session,
    request_payload: { ...session.request_payload },
    submission_payload: submission,
    device: session.device ? { ...session.device } : undefined,
  };
}

function readSubmittedMockSession(id: string, actor?: AuditActor) {
  const storeId = actor?.storeId ?? mockStoreId;
  const session = mockSessions.find(
    (item) => item.id === id.trim() && item.store_id === storeId && item.status === "submitted",
  );
  if (!session) throw new Error("没有可审核的 iPad 提交");
  return session;
}

function writeMockKioskEvent(
  session: KioskSession,
  actor: AuditActor | undefined,
  action: "kiosk_session_accepted" | "kiosk_session_returned",
) {
  if (!session.order_id) return;
  const submission = session.submission_payload ?? {};
  extraEvents.push({
    id: `mock_kiosk_event_${Date.now()}_${extraEvents.length + 1}`,
    order_id: session.order_id,
    event_type: "note",
    payload: {
      action,
      session_id: session.id,
      device_id: session.device_id,
      session_type: session.session_type,
      submission_version: session.submission_version,
      has_customer_name: Boolean(submission.customer_name),
      has_customer_phone: Boolean(submission.customer_phone),
      has_backup_phone: Boolean(submission.backup_phone),
      has_signature: Boolean(
        submission.signature_data_url ||
        submission.has_signature ||
        submission.signature_attachment_id,
      ),
      confirmation_checked: submission.confirmation_checked === true,
      has_note: Boolean(submission.note),
      ...(action === "kiosk_session_returned" ? { reason_provided: true } : {}),
    },
    operator_name: actor?.displayName ?? actor?.email ?? "前台",
    created_at: new Date().toISOString(),
  });
}

function signatureUploadFromDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) throw new Error("签名图片格式无效");
  const dataBase64 = match[2]!.replace(/\s+/g, "");
  return {
    mime_type: match[1]!.toLowerCase(),
    data_base64: dataBase64,
    file_size: base64ByteLength(dataBase64),
  };
}

function base64ByteLength(value: string) {
  const clean = value.replace(/\s+/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

function readMockOrderSummary(orderId?: string, storeId = mockStoreId) {
  if (orderId && storeId !== mockStoreId) throw new Error("工单不存在或不属于当前店铺");
  const order = orderId ? orders.find((item) => item.id === orderId) : undefined;
  return order ? decorate(order) : undefined;
}

function assertMockKioskSessionCreateScope(
  actor: AuditActor | undefined,
  order: { assignee_membership_id?: string | null } | undefined,
) {
  if (!actor) return;
  const role = actor.storeRole ?? actor.role;
  if (role === "viewer") throw new Error("当前员工没有权限执行此操作");
  if (role !== "technician") return;
  if (!actor.activeMembershipId || order?.assignee_membership_id !== actor.activeMembershipId) {
    throw new Error("当前工单未分配给你");
  }
}
