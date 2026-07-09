import type {
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

export function sanitizeKioskPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([key, item]) => {
      if (!/^[a-zA-Z0-9_:-]{1,64}$/.test(key)) return false;
      return (
        item === null ||
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
      );
    }),
  );
}
