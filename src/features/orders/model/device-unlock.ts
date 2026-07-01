import type { DeviceUnlockInput, DeviceUnlockMethod, RepairOrder } from "@/lib/repairdesk/types";

export const DEVICE_UNLOCK_METHOD_LABELS: Record<DeviceUnlockMethod, string> = {
  text: "文字密码",
  pin: "PIN",
  pattern: "图案",
};

export type NormalizedDeviceUnlock = {
  method: DeviceUnlockMethod | null;
  value: string | null;
  pattern: number[] | null;
};

export function isDeviceUnlockMethod(value: unknown): value is DeviceUnlockMethod {
  return value === "text" || value === "pin" || value === "pattern";
}

export function normalizeDeviceUnlockInput(
  input?: DeviceUnlockInput | null,
): NormalizedDeviceUnlock {
  if (!input || input.method === "none") {
    return { method: null, value: null, pattern: null };
  }

  if (input.method === "text") {
    const value = input.value.trim();
    if (!value) throw new Error("手机密码不能为空");
    if (value.length > 80) throw new Error("手机密码最多 80 个字符");
    return { method: "text", value, pattern: null };
  }

  if (input.method === "pin") {
    const value = input.value.trim();
    if (!/^\d{1,16}$/.test(value)) {
      throw new Error("数字 PIN 只能包含 1-16 位数字");
    }
    return { method: "pin", value, pattern: null };
  }

  const pattern = normalizeUnlockPattern(input.pattern);
  return { method: "pattern", value: null, pattern };
}

export function normalizeUnlockPattern(pattern: readonly number[]) {
  const points = pattern.map((point) => Number(point));
  const unique = new Set(points);
  if (points.length < 4 || points.length > 9) {
    throw new Error("图案密码需要连接 4-9 个点");
  }
  if (unique.size !== points.length) {
    throw new Error("图案密码不能重复连接同一个点");
  }
  if (points.some((point) => !Number.isInteger(point) || point < 1 || point > 9)) {
    throw new Error("图案密码点位必须在 1-9 之间");
  }
  return points;
}

export function deviceUnlockInputFromOrder(order: RepairOrder): DeviceUnlockInput {
  if (order.device_unlock_method === "text") {
    return { method: "text", value: order.device_unlock_value ?? "" };
  }
  if (order.device_unlock_method === "pin") {
    return { method: "pin", value: order.device_unlock_value ?? "" };
  }
  if (order.device_unlock_method === "pattern") {
    return { method: "pattern", pattern: order.device_unlock_pattern ?? [] };
  }
  return { method: "none" };
}

export function getDeviceUnlockLabel(method?: DeviceUnlockMethod | null) {
  return method ? `已留${DEVICE_UNLOCK_METHOD_LABELS[method]}` : "未留手机密码";
}

export function hasDeviceUnlock(order: Pick<RepairOrder, "device_unlock_method">) {
  return isDeviceUnlockMethod(order.device_unlock_method);
}
