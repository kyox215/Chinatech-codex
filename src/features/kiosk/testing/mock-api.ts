import {
  normalizeKioskReturnInput,
  normalizeKioskSessionCreateInput,
  normalizeKioskSubmission,
} from "@/features/kiosk/model/kiosk-session";
import { customers, decorate, extraEvents, orders } from "@/lib/mock/state";
import { normalizePhoneBook } from "@/shared/lib/phone";
import { uploadOrderAttachment } from "@/features/orders/testing/mock-api";
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

const mockStoreId = "00000000-0000-0000-0000-000000000001";
const mockTokens = new Map<string, string>();
const mockPairingCodes = new Map<string, string>();
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
  const now = new Date().toISOString();
  const code = "12345678";
  const device: KioskDevice = {
    id: `kiosk_device_${mockDevices.length + 1}`,
    store_id: actor?.storeId ?? mockStoreId,
    label: input.label.trim() || "客户 iPad",
    status: "pairing",
    pairing_code_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    created_at: now,
    updated_at: now,
  };
  mockDevices.unshift(device);
  mockPairingCodes.set(code, device.id);
  return { device, pairing_code: code, expires_at: device.pairing_code_expires_at ?? now };
}

export async function revokeKioskDevice(id: string): Promise<{ ok: boolean }> {
  const device = mockDevices.find((item) => item.id === id);
  if (device) {
    device.status = "revoked";
    device.updated_at = new Date().toISOString();
  }
  return { ok: true };
}

export async function listKioskSessions(actor?: AuditActor): Promise<KioskSession[]> {
  const storeId = actor?.storeId ?? mockStoreId;
  return mockSessions.filter((session) => session.store_id === storeId);
}

export async function createKioskSession(
  input: KioskSessionCreateInput,
  actor?: AuditActor,
): Promise<KioskSession> {
  const normalized = normalizeKioskSessionCreateInput(input);
  const device = mockDevices.find(
    (item) => item.id === normalized.device_id && item.status === "active",
  );
  if (!device) throw new Error("客户 iPad 未绑定或不可用");
  for (const session of mockSessions) {
    if (
      session.device_id === device.id &&
      ["queued", "active", "returned"].includes(session.status)
    ) {
      session.status = "cancelled";
      session.cancelled_at = new Date().toISOString();
    }
  }
  const order = readMockOrderSummary(normalized.order_id);
  if (
    normalized.session_type === "pickup_signature" &&
    order?.device_custody_status !== "with_shop"
  ) {
    throw new Error("只有已确认由门店保管的设备可以发起取机确认");
  }
  const now = new Date().toISOString();
  const session: KioskSession = {
    id: `kiosk_session_${mockSessions.length + 1}`,
    store_id: actor?.storeId ?? mockStoreId,
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

export async function pairKioskDevice(code: string): Promise<KioskPairResult> {
  const deviceId = mockPairingCodes.get(code.trim()) ?? "kiosk_device_demo";
  const device = mockDevices.find((item) => item.id === deviceId);
  if (!device) throw new Error("配对码无效或已过期");
  const token = device.id === "kiosk_device_demo" ? "demo-kiosk-token" : `mock-token-${device.id}`;
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
      ["queued", "active", "submitted", "returned"].includes(item.status),
  );
  device.last_seen_at = new Date().toISOString();
  if (!session) return null;
  if (session.status === "queued") session.status = "active";
  const order = readMockOrderSummary(session.order_id);
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
    store: { name: "ChinaTech" },
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
  const device = readDeviceByToken(token);
  const session = mockSessions.find(
    (item) =>
      item.device_id === device.id && ["queued", "active", "returned"].includes(item.status),
  );
  if (!session) throw new Error("当前没有可提交的 iPad 任务");
  session.status = "submitted";
  session.submission_payload = normalizeKioskSubmission(input);
  session.submission_version += 1;
  session.submitted_at = new Date().toISOString();
  session.updated_at = session.submitted_at;
  return { ok: true, session_id: session.id };
}

export async function acceptKioskSession(id: string, actor?: AuditActor): Promise<KioskSession> {
  const session = readSubmittedMockSession(id, actor);
  const order = session.order_id ? orders.find((item) => item.id === session.order_id) : undefined;
  if (session.session_type === "pickup_signature" && order?.device_custody_status !== "with_shop") {
    throw new Error("只有已确认由门店保管的设备可以确认取机交接");
  }
  const customerId = session.customer_id ?? order?.customer_id;
  if (session.customer_id && order?.customer_id && session.customer_id !== order.customer_id) {
    throw new Error("iPad 任务绑定的客户与工单不一致");
  }
  const submission = session.submission_payload ?? {};
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
    staff_return_reason: normalized.reason,
  };
  writeMockKioskEvent(session, actor, "kiosk_session_returned");
  return session;
}

function readDeviceByToken(token: string) {
  const deviceId = mockTokens.get(token.trim());
  const device = deviceId ? mockDevices.find((item) => item.id === deviceId) : undefined;
  if (!device || device.status !== "active") throw new Error("iPad 未绑定或已撤销");
  return device;
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

function readMockOrderSummary(orderId?: string) {
  const order = orderId ? orders.find((item) => item.id === orderId) : undefined;
  return order ? decorate(order) : undefined;
}
