import { z } from "zod";

import type { SupplierInput } from "@/lib/repairdesk/types";

function optionalTrimmed(max: number, message: string) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max, message).optional(),
  );
}

const optionalSupplierEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .trim()
    .email("供应商邮箱格式不正确")
    .max(254, "供应商邮箱不能超过 254 个字符")
    .optional(),
);

const optionalSupplierWebsite = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .trim()
    .url("供应商网站必须是完整的 http 或 https 地址")
    .max(500, "供应商网站不能超过 500 个字符")
    .refine((value) => !value || /^https?:\/\//i.test(value), "供应商网站只允许 http 或 https")
    .optional(),
);

export const supplierInputSchema = z
  .object({
    name: z.string().trim().min(1, "供应商名称不能为空").max(120, "供应商名称不能超过 120 个字符"),
    short_name: optionalTrimmed(32, "供应商简称不能超过 32 个字符"),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "供应商颜色格式不正确")
      .optional(),
    contact_name: optionalTrimmed(120, "联系人不能超过 120 个字符"),
    phone: optionalTrimmed(40, "供应商电话不能超过 40 个字符"),
    email: optionalSupplierEmail,
    website: optionalSupplierWebsite,
    notes: optionalTrimmed(2000, "供应商备注不能超过 2000 个字符"),
  })
  .strict();

export type SupplierInputField = keyof SupplierInput;

export function validateSupplierInput(
  input: SupplierInput,
):
  | { success: true; data: SupplierInput; errors: Partial<Record<SupplierInputField, string>> }
  | { success: false; errors: Partial<Record<SupplierInputField, string>> } {
  const result = supplierInputSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data, errors: {} };
  const errors: Partial<Record<SupplierInputField, string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field as SupplierInputField] = issue.message;
    }
  }
  return { success: false, errors };
}
