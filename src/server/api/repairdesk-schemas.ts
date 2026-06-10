import { z } from "zod";

import type { ApprovalStatus, RepairOrderStatus, RepairOrderType } from "@/lib/mock/enums";
import type {
  CreateOrderInput,
  CustomerCreateInput,
  CustomerDeviceInput,
  CustomerFollowupInput,
  CustomerListFilters,
  CustomerMessageInput,
  CustomerUpdateInput,
  OrderListFilters,
  OrderWhatsappTemplateKind,
  PatchOrderFinanceInput,
  PatchOrderInput,
  UpdateOrderInput,
} from "@/lib/repairdesk/api";

const optionalText = z.string().optional();
const repairOrderStatusSchema = z.string().min(1) as z.ZodType<RepairOrderStatus>;
const repairOrderTypeSchema = z.string().min(1) as z.ZodType<RepairOrderType>;
const approvalStatusSchema = z.string().min(1) as z.ZodType<ApprovalStatus>;
const orderWhatsappTemplateKindSchema = z.enum([
  "approval_request",
  "pickup_ready",
  "unfixed_pickup",
  "parts_update",
  "repair_status",
  "cancelled",
  "completed",
]) satisfies z.ZodType<OrderWhatsappTemplateKind>;

export const idBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
});

export const customerIdBodySchema = z.object({
  customerId: z.string().min(1, "缺少 customerId"),
});

export const orderListFiltersSchema = z
  .object({
    search: optionalText,
    statuses: z.array(repairOrderStatusSchema).optional(),
    types: z.array(repairOrderTypeSchema).optional(),
    technicians: z.array(z.string()).optional(),
    supplierIds: z.array(z.string()).optional(),
    paid: z.enum(["all", "paid", "unpaid"]).optional(),
    overdue: z.enum(["approval", "pickup", "any"]).optional(),
  })
  .passthrough() satisfies z.ZodType<OrderListFilters>;

export const orderListPageInputSchema = orderListFiltersSchema.extend({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const customerListFiltersSchema = z
  .object({
    search: optionalText,
    tagIds: z.array(z.string()).optional(),
    marketing: z.enum(["all", "allowed", "blocked"]).optional(),
    followup: z.enum(["all", "due", "overdue"]).optional(),
  })
  .passthrough() satisfies z.ZodType<CustomerListFilters>;

export const faultPriceItemSchema = z.object({
  name: z.string(),
  price: z.coerce.number(),
  currency_code: z.literal("EUR").optional(),
  note: optionalText,
});

export const createOrderSchema = z
  .object({
    customer_id: optionalText,
    device_id: optionalText,
    customer_name: optionalText,
    customer_phone: optionalText,
    device_brand: optionalText,
    device_model: optionalText,
    device_imei: optionalText,
    device_notes: optionalText,
    order_type: repairOrderTypeSchema,
    status: repairOrderStatusSchema,
    issue_description: z.string(),
    technician_name: z.string(),
    internal_tag: optionalText,
    accessory_notes: optionalText,
    warranty_text: optionalText,
    fault_prices: z.array(faultPriceItemSchema),
    deposit_amount: z.coerce.number().optional(),
  })
  .passthrough() satisfies z.ZodType<CreateOrderInput>;

export const updateOrderInputSchema = z
  .object({
    customer_name: z.string(),
    customer_phone: z.string(),
    device_brand: z.string(),
    device_model: z.string(),
    device_imei: optionalText,
    device_notes: optionalText,
    issue_description: z.string(),
    diagnosis_result: optionalText,
    technician_name: z.string(),
    internal_tag: optionalText,
    accessory_notes: optionalText,
    warranty_text: optionalText,
    fault_prices: z.array(faultPriceItemSchema),
    deposit_amount: z.coerce.number().optional(),
  })
  .passthrough() satisfies z.ZodType<UpdateOrderInput>;

export const updateOrderBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  input: updateOrderInputSchema,
});

export const patchOrderChangesSchema = z
  .object({
    customer_name: optionalText,
    customer_phone: optionalText,
    device_brand: optionalText,
    device_model: optionalText,
    device_imei: optionalText,
    device_notes: optionalText,
    issue_description: optionalText,
    diagnosis_result: optionalText,
    technician_name: optionalText,
    accessory_notes: optionalText,
    warranty_text: optionalText,
  })
  .strict();

export const patchOrderInputSchema = z
  .object({
    expected_updated_at: z.string().min(1, "缺少版本时间"),
    changes: patchOrderChangesSchema.refine((changes) => Object.keys(changes).length > 0, {
      message: "没有可保存的字段",
    }),
  })
  .strict() satisfies z.ZodType<PatchOrderInput>;

export const patchOrderFinanceInputSchema = z
  .object({
    expected_updated_at: z.string().min(1, "缺少版本时间"),
    fault_prices: z.array(faultPriceItemSchema),
    deposit_amount: z.coerce.number().optional(),
  })
  .strict() satisfies z.ZodType<PatchOrderFinanceInput>;

export const patchOrderBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  input: patchOrderInputSchema,
});

export const patchOrderFinanceBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  input: patchOrderFinanceInputSchema,
});

export const transitionOrderBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  to: repairOrderStatusSchema,
  reason: optionalText,
});

export const batchTransitionBodySchema = z.object({
  ids: z.array(z.string().min(1)),
  to: repairOrderStatusSchema,
});

export const paymentBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  amount: z.coerce.number(),
  method: optionalText,
});

export const notificationBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  body: z.string(),
  channel: z.enum(["whatsapp", "sms"]).default("whatsapp"),
});

export const whatsappNotificationBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  body: z.string(),
  template_kind: orderWhatsappTemplateKindSchema,
  transition_to: repairOrderStatusSchema.optional(),
});

export const approvalRequestBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  body: z.string(),
});

export const customerSearchBodySchema = z.object({
  q: z.string().default(""),
  limit: z.coerce.number().int().positive().max(50).default(6),
});

const customerInputBaseSchema = z
  .object({
    name: z.string(),
    phone_e164: z.string(),
    email: optionalText,
    contact_phones: z.array(z.string()).optional(),
    consent_marketing: z.boolean().optional(),
    consent_sms: z.boolean().optional(),
    preferred_channel: z.enum(["whatsapp", "sms"]).optional(),
    language: z.enum(["it", "zh", "en"]).optional(),
    notes: optionalText,
    marketing_notes: optionalText,
    blacklisted: z.boolean().optional(),
  })
  .passthrough();

export const customerCreateBodySchema = z.object({
  input: customerInputBaseSchema satisfies z.ZodType<CustomerCreateInput>,
});

export const customerUpdateBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  input: customerInputBaseSchema satisfies z.ZodType<CustomerUpdateInput>,
});

export const customerDeviceInputSchema = z
  .object({
    id: optionalText,
    brand: z.string(),
    model: z.string(),
    serial_or_imei: optionalText,
    device_notes: optionalText,
  })
  .passthrough() satisfies z.ZodType<CustomerDeviceInput>;

export const customerDeviceUpsertBodySchema = z.object({
  customerId: z.string().min(1, "缺少 customerId"),
  input: customerDeviceInputSchema,
});

export const customerDeviceDeleteBodySchema = z.object({
  customerId: z.string().min(1, "缺少 customerId"),
  deviceId: z.string().min(1, "缺少 deviceId"),
});

export const customerTagsUpdateBodySchema = z.object({
  customerId: z.string().min(1, "缺少 customerId"),
  tagIds: z.array(z.string()),
});

export const customerFollowupInputSchema = z
  .object({
    order_id: optionalText,
    title: z.string(),
    note: optionalText,
    due_at: z.string(),
    owner_name: optionalText,
  })
  .passthrough() satisfies z.ZodType<CustomerFollowupInput>;

export const customerFollowupCreateBodySchema = z.object({
  customerId: z.string().min(1, "缺少 customerId"),
  input: customerFollowupInputSchema,
});

export const customerFollowupCompleteBodySchema = z.object({
  customerId: z.string().min(1, "缺少 customerId"),
  followupId: z.string().min(1, "缺少 followupId"),
});

export const customerMessageInputSchema = z
  .object({
    channel: z.enum(["whatsapp", "sms"]),
    body: z.string(),
    order_id: optionalText,
  })
  .passthrough() satisfies z.ZodType<CustomerMessageInput>;

export const customerMessageBodySchema = z.object({
  customerId: z.string().min(1, "缺少 customerId"),
  input: customerMessageInputSchema,
});

export { approvalStatusSchema };
