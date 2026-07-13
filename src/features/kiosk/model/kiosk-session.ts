import type {
  KioskSessionReturnInput,
  KioskSessionCreateInput,
  KioskSessionSubmitInput,
  KioskSessionType,
} from "@/lib/repairdesk/types";

export const kioskSessionTypes: KioskSessionType[] = [
  "intake_contact",
  "order_contact_signature",
  "pickup_signature",
];

export function isKioskSessionType(value: unknown): value is KioskSessionType {
  return typeof value === "string" && kioskSessionTypes.includes(value as KioskSessionType);
}

export function normalizeKioskSessionCreateInput(input: KioskSessionCreateInput) {
  if (!input.device_id?.trim()) throw new Error("请选择客户 iPad");
  if (!isKioskSessionType(input.session_type)) throw new Error("客户 iPad 任务类型无效");
  if (input.session_type === "pickup_signature" && !input.order_id?.trim()) {
    throw new Error("取机签名任务必须绑定工单");
  }
  const expiresInMinutes = Math.min(Math.max(input.expires_in_minutes ?? 30, 5), 240);
  return {
    device_id: input.device_id.trim(),
    session_type: input.session_type,
    order_id: input.order_id?.trim() || undefined,
    customer_id: input.customer_id?.trim() || undefined,
    request_payload: sanitizeKioskPayload(input.request_payload),
    expires_in_minutes: expiresInMinutes,
  };
}

export function normalizeKioskSubmission(input: KioskSessionSubmitInput) {
  const customerName = input.customer_name?.trim().replace(/\s+/g, " ");
  const customerPhone = input.customer_phone?.trim();
  const backupPhone = input.backup_phone?.trim();
  const note = input.note?.trim();
  const signature = input.signature_data_url?.trim();

  if (customerName && customerName.length > 120) throw new Error("姓名过长");
  if (customerPhone && customerPhone.length > 40) throw new Error("手机号过长");
  if (backupPhone && backupPhone.length > 40) throw new Error("备用电话过长");
  if (note && note.length > 500) throw new Error("备注过长");
  if (signature && !/^data:image\/(png|jpeg|webp);base64,/i.test(signature)) {
    throw new Error("签名图片格式无效");
  }
  if (input.confirmation_checked !== true) throw new Error("请先确认客户资料");

  return {
    ...(customerName ? { customer_name: customerName } : {}),
    ...(customerPhone ? { customer_phone: customerPhone } : {}),
    ...(backupPhone ? { backup_phone: backupPhone } : {}),
    ...(input.preferred_channel ? { preferred_channel: input.preferred_channel } : {}),
    ...(input.language ? { language: input.language } : {}),
    confirmation_checked: input.confirmation_checked === true,
    ...(signature ? { signature_data_url: signature } : {}),
    ...(note ? { note } : {}),
  };
}

export function assertKioskSubmissionRequirements(
  sessionType: KioskSessionType,
  submission: Pick<
    KioskSessionSubmitInput,
    "customer_name" | "customer_phone" | "confirmation_checked"
  >,
) {
  if (submission.confirmation_checked !== true) throw new Error("请先确认客户资料");
  if (sessionType === "pickup_signature") return;
  if (!submission.customer_name?.trim()) throw new Error("请输入客户姓名");
  if (!submission.customer_phone?.trim()) throw new Error("请输入客户电话");
}

export function normalizeKioskReturnInput(input: KioskSessionReturnInput) {
  const id = input.id?.trim();
  const reason = input.reason?.trim().replace(/\s+/g, " ");
  if (!id) throw new Error("缺少 iPad 任务");
  if (!reason) throw new Error("请输入退回原因");
  if (reason.length > 240) throw new Error("退回原因过长");
  return { id, reason };
}

export function sanitizeKioskPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = (value as Record<string, unknown>).source;
  if (typeof source !== "string") return {};
  const normalized = source.trim();
  if (!normalized || normalized.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(normalized)) return {};
  return { source: normalized };
}

export function publicKioskSubmissionDraft(
  payload: Record<string, unknown> | undefined,
): KioskPublicSessionDraft | undefined {
  if (!payload) return undefined;
  const draft: KioskPublicSessionDraft = {};
  assignShortString(draft, "customer_name", payload.customer_name, 120);
  assignShortString(draft, "customer_phone", payload.customer_phone, 40);
  assignShortString(draft, "backup_phone", payload.backup_phone, 40);
  assignShortString(draft, "note", payload.note, 500);
  if (payload.preferred_channel === "whatsapp" || payload.preferred_channel === "sms") {
    draft.preferred_channel = payload.preferred_channel;
  }
  if (payload.language === "it" || payload.language === "zh" || payload.language === "en") {
    draft.language = payload.language;
  }
  draft.confirmation_checked = payload.confirmation_checked === true;
  draft.has_signature =
    payload.has_signature === true ||
    (typeof payload.signature_data_url === "string" && payload.signature_data_url.length > 0) ||
    (typeof payload.signature_attachment_id === "string" &&
      payload.signature_attachment_id.length > 0);
  return Object.keys(draft).length ? draft : undefined;
}

type KioskPublicSessionDraft = Omit<KioskSessionSubmitInput, "signature_data_url"> & {
  has_signature?: boolean;
};

function assignShortString(
  target: KioskPublicSessionDraft,
  key: "customer_name" | "customer_phone" | "backup_phone" | "note",
  value: unknown,
  maxLength: number,
) {
  if (typeof value !== "string") return;
  const normalized = value.trim();
  if (normalized) target[key] = normalized.slice(0, maxLength);
}
