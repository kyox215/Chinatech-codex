import { z } from "zod";

import { STORE_INVENTORY_WARRANTY_RANGE } from "@/entities/store/model/store-setting-defaults";
import type { StoreSettingsSectionUpdateRequest } from "@/lib/repairdesk/types";

const expectedStoreIdSchema = z.string().uuid("店铺上下文无效");
const expectedUpdatedAtSchema = z.string().datetime({ offset: true, message: "设置版本时间无效" });

const optionalContactSchema = z
  .string()
  .trim()
  .max(40, "联系方式不能超过 40 个字符")
  .refine(
    (value) => value === "" || (/^[0-9+().\s-]+$/.test(value) && value.length >= 3),
    "联系方式格式无效",
  );

const optionalEmailSchema = z
  .string()
  .trim()
  .max(254, "邮箱不能超过 254 个字符")
  .refine((value) => value === "" || z.string().email().safeParse(value).success, "邮箱格式无效");

const optionalPublicBaseUrlSchema = z
  .string()
  .trim()
  .max(2048, "客户门户域名不能超过 2048 个字符")
  .refine((value) => value === "" || isSafePublicBaseUrl(value), {
    message: "客户门户域名必须使用 HTTPS，或本地开发 localhost HTTP",
  });

const storeInputSchema = z
  .object({
    store_name: z.string().trim().min(1, "店铺名不能为空").max(120, "店铺名不能超过 120 个字符"),
    store_address: z.string().trim().max(500, "地址不能超过 500 个字符"),
    store_phone: optionalContactSchema,
    store_whatsapp: optionalContactSchema,
    store_email: optionalEmailSchema,
    public_base_url: optionalPublicBaseUrlSchema.optional(),
  })
  .strict();

const notificationsInputSchema = z
  .object({
    print_footer: z.string().trim().max(500, "打印页脚不能超过 500 个字符"),
    message_signature: z.string().trim().max(300, "消息签名不能超过 300 个字符"),
  })
  .strict();

const rulesInputSchema = z
  .object({
    default_order_warranty_months: z.union([
      z.literal(0),
      z.literal(3),
      z.literal(6),
      z.literal(12),
      z.literal(24),
    ]),
    default_inventory_warranty_months: z
      .number({
        required_error: "请输入库存保修月数",
        invalid_type_error: "请输入库存保修月数",
      })
      .int("库存保修月数必须是整数")
      .min(
        STORE_INVENTORY_WARRANTY_RANGE.min,
        `库存保修月数不能小于 ${STORE_INVENTORY_WARRANTY_RANGE.min}`,
      )
      .max(
        STORE_INVENTORY_WARRANTY_RANGE.max,
        `库存保修月数不能超过 ${STORE_INVENTORY_WARRANTY_RANGE.max}`,
      ),
  })
  .strict();

export const storeSettingsSectionUpdateSchema = z.discriminatedUnion("section", [
  z
    .object({
      section: z.literal("store"),
      expectedStoreId: expectedStoreIdSchema,
      expectedUpdatedAt: expectedUpdatedAtSchema,
      input: storeInputSchema,
    })
    .strict(),
  z
    .object({
      section: z.literal("notifications"),
      expectedStoreId: expectedStoreIdSchema,
      expectedUpdatedAt: expectedUpdatedAtSchema,
      input: notificationsInputSchema,
    })
    .strict(),
  z
    .object({
      section: z.literal("rules"),
      expectedStoreId: expectedStoreIdSchema,
      expectedUpdatedAt: expectedUpdatedAtSchema,
      input: rulesInputSchema,
    })
    .strict(),
]) satisfies z.ZodType<StoreSettingsSectionUpdateRequest>;

export type StoreSettingsValidationFieldErrors = Record<string, string[]>;

export function validateStoreSettingsSectionUpdateRequest(
  request: StoreSettingsSectionUpdateRequest,
):
  | { success: true; data: StoreSettingsSectionUpdateRequest }
  | { success: false; fieldErrors: StoreSettingsValidationFieldErrors } {
  const inputSchema =
    request.section === "store"
      ? storeInputSchema
      : request.section === "notifications"
        ? notificationsInputSchema
        : rulesInputSchema;
  // The client validates only user-editable input. Store scope and CAS metadata remain
  // server-authoritative and are validated again by storeSettingsSectionUpdateSchema.
  const result = z.object({ input: inputSchema }).safeParse({ input: request.input });
  if (result.success) return { success: true, data: request };
  return {
    success: false,
    fieldErrors: getStoreSettingsValidationFieldErrors(result.error),
  };
}

export function getStoreSettingsValidationFieldErrors(error: z.ZodError) {
  const fieldErrors: StoreSettingsValidationFieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "request";
    fieldErrors[path] = [...(fieldErrors[path] ?? []), issue.message];
  }
  return fieldErrors;
}

function isSafePublicBaseUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}
