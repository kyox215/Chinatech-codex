import {
  normalizeKioskSessionCreateInput,
  normalizeKioskSubmission,
} from "@/features/kiosk/model/kiosk-session";
import { decorate, orders } from "@/lib/mock/state";
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

function readDeviceByToken(token: string) {
  const deviceId = mockTokens.get(token.trim());
  const device = deviceId ? mockDevices.find((item) => item.id === deviceId) : undefined;
  if (!device || device.status !== "active") throw new Error("iPad 未绑定或已撤销");
  return device;
}

function readMockOrderSummary(orderId?: string) {
  const order = orderId ? orders.find((item) => item.id === orderId) : undefined;
  return order ? decorate(order) : undefined;
}
