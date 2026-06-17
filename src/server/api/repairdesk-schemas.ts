import { z } from "zod";

import type { ApprovalStatus, RepairOrderStatus, RepairOrderType } from "@/lib/mock/enums";
import type {
  CreateOrderInput,
  CustomerCreateInput,
  CustomerDeviceInput,
  CustomerFollowupInput,
  CustomerListFilters,
  CustomerListPageInput,
  CustomerMessageInput,
  CustomerUpdateInput,
  CreateInventoryIntakeInput,
  InventoryAttachmentUploadInput,
  InventoryItemStatus,
  InventoryListFilters,
  InventoryQualityCheckInput,
  InventoryTransactionInput,
  MessageTemplatePreviewInput,
  MessageTemplateUpdateInput,
  OnboardingDecisionInput,
  OnboardingRequestInput,
  SellInventoryItemInput,
  OrderListFilters,
  OrderWorkflowStatusCreateInput,
  OrderWorkflowStatusEnabledInput,
  OrderWorkflowStatusReorderInput,
  OrderWorkflowStatusUpdateInput,
  OrderWorkflowTransitionsUpdateInput,
  OrderApprovalDecisionInput,
  OrderAttachmentUploadInput,
  OrderWhatsappTemplateKind,
  PatchOrderFinanceInput,
  PatchOrderInput,
  StoreCreateInput,
  StoreInviteInput,
  StoreSettingsUpdateInput,
  UpdateInventoryItemInput,
  UpdateOrderInput,
} from "@/lib/repairdesk/api";

const optionalText = z.string().optional();
const repairOrderStatusSchema = z.string().min(1) as z.ZodType<RepairOrderStatus>;
const repairOrderTypeSchema = z.string().min(1) as z.ZodType<RepairOrderType>;
const approvalStatusSchema = z.string().min(1) as z.ZodType<ApprovalStatus>;
const canonicalWorkflowStatusSchema = z.enum([
  "intake",
  "diagnosis",
  "quote",
  "parts",
  "repair",
  "pickup",
  "closed",
]);
const orderExceptionStatusSchema = z.enum([
  "cancelled",
  "unrepairable",
  "returned_unfixed",
  "rework",
  "waiting_customer",
  "paused",
]);
const orderPaymentStatusSchema = z.enum(["unpaid", "partial", "paid", "refunded"]);
const orderPartsStatusSchema = z.enum([
  "not_required",
  "needed",
  "ordered",
  "arrived",
  "out_of_stock",
]);
const orderApprovalFlowStatusSchema = z.enum([
  "not_required",
  "waiting_customer",
  "approved",
  "rejected",
]);
const orderWorkflowStatusCodeSchema = z
  .string()
  .min(2, "状态代码至少 2 个字符")
  .max(48, "状态代码不能超过 48 个字符")
  .regex(/^[a-z][a-z0-9_]*$/, "状态代码只能使用小写字母、数字和下划线，并以字母开头");
const orderWorkflowToneSchema = z.enum([
  "neutral",
  "info",
  "progress",
  "warn",
  "success",
  "danger",
]);
const orderWorkflowBucketSchema = z.enum([
  "intake",
  "diagnosing",
  "quote",
  "parts",
  "repair",
  "pickup",
  "done",
  "cancelled",
  "custom",
]);
const inventoryItemStatusSchema = z.enum([
  "intake",
  "evaluating",
  "offer_made",
  "purchased",
  "data_wipe",
  "refurbishing",
  "ready_for_sale",
  "listed",
  "reserved",
  "sold",
  "cancelled",
  "returned",
  "recycled",
]) satisfies z.ZodType<InventoryItemStatus>;
const inventoryCheckStatusSchema = z.enum(["unchecked", "pass", "fail", "unknown"]);
const inventoryCosmeticGradeSchema = z.enum([
  "unknown",
  "new",
  "mint",
  "good",
  "fair",
  "poor",
  "for_parts",
]);
const inventoryFunctionalGradeSchema = z.enum([
  "untested",
  "passed",
  "needs_repair",
  "failed",
  "for_parts",
]);
const inventoryTransactionTypeSchema = z.enum([
  "buyback_payment",
  "sale_payment",
  "refund",
  "repair_cost",
  "fee",
  "adjustment",
]);
const orderWhatsappTemplateKindSchema = z.enum([
  "approval_request",
  "pickup_ready",
  "unfixed_pickup",
  "parts_update",
  "repair_status",
  "cancelled",
  "completed",
]) satisfies z.ZodType<OrderWhatsappTemplateKind>;
const orderAttachmentKindSchema = z.enum([
  "device_front",
  "device_back",
  "screen_on",
  "fault_photo",
  "signature",
  "other",
]);
const orderAttachmentMimeTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export const idBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
});

export const orderAttachmentUploadBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  input: z
    .object({
      kind: orderAttachmentKindSchema,
      file_name: z.string().trim().min(1, "文件名不能为空").max(180, "文件名不能超过 180 个字符"),
      mime_type: orderAttachmentMimeTypeSchema,
      file_size: z.coerce
        .number()
        .int()
        .positive("文件大小无效")
        .max(8 * 1024 * 1024, "附件不能超过 8MB"),
      data_base64: z.string().min(1, "缺少附件内容"),
      note: z.string().trim().max(200, "备注不能超过 200 个字符").optional(),
    })
    .strict() satisfies z.ZodType<OrderAttachmentUploadInput>,
});

export const customerIdBodySchema = z.object({
  customerId: z.string().min(1, "缺少 customerId"),
});

export const orderListFiltersSchema = z
  .object({
    search: optionalText,
    statuses: z.array(repairOrderStatusSchema).optional(),
    workflowStatuses: z.array(canonicalWorkflowStatusSchema).optional(),
    exceptionStatuses: z.array(orderExceptionStatusSchema).optional(),
    paymentStatuses: z.array(orderPaymentStatusSchema).optional(),
    partsStatuses: z.array(orderPartsStatusSchema).optional(),
    approvalFlowStatuses: z.array(orderApprovalFlowStatusSchema).optional(),
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

export const orderWorkflowStatusCreateBodySchema = z.object({
  input: z
    .object({
      code: orderWorkflowStatusCodeSchema,
      label: z.string().trim().min(1, "状态名称不能为空").max(24, "状态名称不能超过 24 个字符"),
      short_label: z.string().trim().max(8, "短标签不能超过 8 个字符").optional(),
      tone: orderWorkflowToneSchema,
      bucket: orderWorkflowBucketSchema,
      sort_order: z.coerce.number().int().optional(),
      enabled: z.boolean().optional(),
      show_in_order_filters: z.boolean().optional(),
      allowed_for_create: z.boolean().optional(),
      is_default_create_status: z.boolean().optional(),
    })
    .strict() satisfies z.ZodType<OrderWorkflowStatusCreateInput>,
});

export const orderWorkflowStatusUpdateBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  input: z
    .object({
      label: z
        .string()
        .trim()
        .min(1, "状态名称不能为空")
        .max(24, "状态名称不能超过 24 个字符")
        .optional(),
      short_label: z.string().trim().max(8, "短标签不能超过 8 个字符").optional(),
      tone: orderWorkflowToneSchema.optional(),
      bucket: orderWorkflowBucketSchema.optional(),
      sort_order: z.coerce.number().int().optional(),
      enabled: z.boolean().optional(),
      show_in_order_filters: z.boolean().optional(),
      allowed_for_create: z.boolean().optional(),
      is_default_create_status: z.boolean().optional(),
    })
    .strict() satisfies z.ZodType<OrderWorkflowStatusUpdateInput>,
});

export const orderWorkflowStatusReorderBodySchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      sort_order: z.coerce.number().int(),
    }),
  ),
}) satisfies z.ZodType<OrderWorkflowStatusReorderInput>;

export const orderWorkflowStatusEnabledBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  enabled: z.boolean(),
}) satisfies z.ZodType<OrderWorkflowStatusEnabledInput>;

export const orderWorkflowTransitionsUpdateBodySchema = z.object({
  from_status_code: repairOrderStatusSchema,
  transitions: z.array(
    z.object({
      to_status_code: repairOrderStatusSchema,
      enabled: z.boolean(),
      is_primary: z.boolean().optional(),
      sort_order: z.coerce.number().int().optional(),
    }),
  ),
}) satisfies z.ZodType<OrderWorkflowTransitionsUpdateInput>;

export const customerListFiltersSchema = z
  .object({
    search: optionalText,
    tagIds: z.array(z.string()).optional(),
    work: z.enum(["all", "active", "unpaid", "with_devices", "repeat"]).optional(),
    marketing: z.enum(["all", "allowed", "blocked"]).optional(),
    followup: z.enum(["all", "due", "overdue"]).optional(),
  })
  .passthrough() satisfies z.ZodType<CustomerListFilters>;

export const customerListPageInputSchema = customerListFiltersSchema.extend({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
}) satisfies z.ZodType<CustomerListPageInput>;

export const inventoryListFiltersSchema = z
  .object({
    search: optionalText,
    statuses: z.array(inventoryItemStatusSchema).optional(),
    sourceTypes: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    saleChannel: optionalText,
  })
  .passthrough() satisfies z.ZodType<InventoryListFilters>;

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
    internal_tag: optionalText,
    accessory_notes: optionalText,
    warranty_text: optionalText,
    warranty_months: z.coerce.number().optional(),
    warranty_change_reason: optionalText,
    fault_prices: z.array(faultPriceItemSchema),
    deposit_amount: z.coerce.number().optional(),
  })
  .strip() satisfies z.ZodType<CreateOrderInput>;

export const updateOrderInputSchema = z
  .object({
    expected_updated_at: z.string().min(1, "缺少版本时间"),
    customer_name: z.string(),
    customer_phone: z.string(),
    device_brand: z.string(),
    device_model: z.string(),
    device_imei: optionalText,
    device_notes: optionalText,
    issue_description: z.string(),
    diagnosis_result: optionalText,
    internal_tag: optionalText,
    accessory_notes: optionalText,
    warranty_text: optionalText,
    warranty_months: z.coerce.number().optional(),
    warranty_change_reason: optionalText,
    fault_prices: z.array(faultPriceItemSchema),
    deposit_amount: z.coerce.number().optional(),
  })
  .strip() satisfies z.ZodType<UpdateOrderInput>;

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
  expected_updated_at: z.string().min(1, "缺少版本时间"),
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
  recipient_phone: optionalText,
});

export const approvalRequestBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  body: z.string(),
  recipient_phone: optionalText,
});

export const approvalDecisionBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  input: z
    .object({
      decision: z.enum(["approved", "rejected"]),
      next_status: repairOrderStatusSchema.optional(),
      reason: optionalText,
    })
    .strict() satisfies z.ZodType<OrderApprovalDecisionInput>,
});

export const customerSearchBodySchema = z.object({
  q: z.string().max(80).default(""),
  limit: z.coerce.number().int().positive().max(12).default(8),
});

export const customerIntakeSearchBodySchema = z.object({
  q: z.string().max(80).default(""),
  limit: z.coerce.number().int().positive().max(12).default(8),
  deviceLimit: z.coerce.number().int().positive().max(8).default(4),
});

const customerInputBaseSchema = z
  .object({
    name: z.string(),
    phone_e164: z.string(),
    email: optionalText,
    contact_phones: z.array(z.string()).optional(),
    promote_contact_phone: optionalText,
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

export const inventoryIntakeInputSchema = z
  .object({
    customer_id: optionalText,
    customer_name: optionalText,
    customer_phone: optionalText,
    category: optionalText,
    brand: z.string().min(1, "缺少品牌"),
    model: z.string().min(1, "缺少型号"),
    color: optionalText,
    storage_capacity: optionalText,
    serial_or_imei: optionalText,
    quoted_offer: z.coerce.number().optional(),
    quote_expires_at: optionalText,
    quote_payload: z.record(z.string(), z.unknown()).optional(),
    buyback_price: z.coerce.number().optional(),
    list_price: z.coerce.number().optional(),
    deposit_amount: z.coerce.number().optional(),
    payment_method: optionalText,
    notes: optionalText,
  })
  .passthrough() satisfies z.ZodType<CreateInventoryIntakeInput>;

export const inventoryIntakeCreateBodySchema = z.object({
  input: inventoryIntakeInputSchema,
});

export const inventoryUpdateInputSchema = z
  .object({
    category: optionalText,
    brand: optionalText,
    model: optionalText,
    color: optionalText,
    storage_capacity: optionalText,
    serial_or_imei: optionalText,
    buyback_price: z.coerce.number().optional(),
    list_price: z.coerce.number().optional(),
    sale_price: z.coerce.number().optional(),
    deposit_amount: z.coerce.number().optional(),
    repair_cost_amount: z.coerce.number().optional(),
    fees_amount: z.coerce.number().optional(),
    payment_method: optionalText,
    sale_channel: optionalText,
    warranty_months: z.coerce.number().int().nonnegative().optional(),
    notes: optionalText,
  })
  .passthrough() satisfies z.ZodType<UpdateInventoryItemInput>;

export const inventoryUpdateBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  input: inventoryUpdateInputSchema,
});

export const inventoryTransitionBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  to: inventoryItemStatusSchema,
  reason: optionalText,
});

export const inventoryQualityCheckInputSchema = z
  .object({
    screen_status: inventoryCheckStatusSchema.optional(),
    touch_status: inventoryCheckStatusSchema.optional(),
    camera_status: inventoryCheckStatusSchema.optional(),
    buttons_status: inventoryCheckStatusSchema.optional(),
    ports_status: inventoryCheckStatusSchema.optional(),
    speaker_status: inventoryCheckStatusSchema.optional(),
    microphone_status: inventoryCheckStatusSchema.optional(),
    wifi_status: inventoryCheckStatusSchema.optional(),
    bluetooth_status: inventoryCheckStatusSchema.optional(),
    cellular_status: inventoryCheckStatusSchema.optional(),
    battery_health: z.coerce.number().min(0).max(100).optional(),
    cosmetic_grade: inventoryCosmeticGradeSchema.optional(),
    functional_grade: inventoryFunctionalGradeSchema.optional(),
    imei_check_status: inventoryCheckStatusSchema.optional(),
    activation_lock_status: inventoryCheckStatusSchema.optional(),
    data_wipe_status: inventoryCheckStatusSchema.optional(),
    notes: optionalText,
  })
  .passthrough() satisfies z.ZodType<InventoryQualityCheckInput>;

export const inventoryQualityCheckBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  input: inventoryQualityCheckInputSchema,
});

const inventoryAttachmentKindSchema = z.enum([
  "device_photo",
  "id_front",
  "id_back",
  "signature",
  "invoice_photo",
  "box_photo",
  "other",
]);

const attachmentMimeTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export const inventoryAttachmentUploadInputSchema = z
  .object({
    kind: inventoryAttachmentKindSchema,
    file_name: z.string().min(1).max(180),
    mime_type: attachmentMimeTypeSchema,
    file_size: z.coerce
      .number()
      .int()
      .min(1)
      .max(8 * 1024 * 1024),
    data_base64: z.string().min(1),
    note: optionalText,
  })
  .strict() satisfies z.ZodType<InventoryAttachmentUploadInput>;

export const inventoryAttachmentUploadBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  input: inventoryAttachmentUploadInputSchema,
});

export const inventoryTransactionInputSchema = z
  .object({
    transaction_type: inventoryTransactionTypeSchema,
    amount: z.coerce.number().nonnegative(),
    method: optionalText,
    note: optionalText,
  })
  .passthrough() satisfies z.ZodType<InventoryTransactionInput>;

export const inventoryTransactionBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  input: inventoryTransactionInputSchema,
});

export const inventorySellInputSchema = z
  .object({
    buyer_customer_id: optionalText,
    buyer_name: optionalText,
    buyer_phone: optionalText,
    sale_price: z.coerce.number().nonnegative(),
    deposit_amount: z.coerce.number().nonnegative().optional(),
    payment_method: optionalText,
    sale_channel: optionalText,
    warranty_months: z.coerce.number().int().nonnegative().optional(),
    sold_at: optionalText,
    notes: optionalText,
  })
  .passthrough() satisfies z.ZodType<SellInventoryItemInput>;

export const inventorySellBodySchema = z.object({
  id: z.string().min(1, "缺少 id"),
  input: inventorySellInputSchema,
});

export const electronicsCsvImportBodySchema = z.object({
  csvContent: z.string().min(1, "缺少 CSV 内容"),
});

export const storeSettingsUpdateInputSchema = z
  .object({
    store_name: optionalText,
    store_address: optionalText,
    store_phone: optionalText,
    store_whatsapp: optionalText,
    store_email: optionalText,
    default_order_warranty_text: optionalText,
    default_order_warranty_months: z.coerce.number().int().nonnegative().optional(),
    default_inventory_warranty_months: z.coerce.number().int().nonnegative().optional(),
    print_footer: optionalText,
    message_signature: optionalText,
  })
  .passthrough() satisfies z.ZodType<StoreSettingsUpdateInput>;

export const storeSettingsUpdateBodySchema = z.object({
  input: storeSettingsUpdateInputSchema,
});

export const storeCreateInputSchema = z
  .object({
    name: z.string().min(2, "店铺名称至少需要 2 个字符").max(80, "店铺名称不能超过 80 个字符"),
    timezone: optionalText,
    currency_code: z.literal("EUR").optional(),
  })
  .passthrough() satisfies z.ZodType<StoreCreateInput>;

export const storeCreateBodySchema = z.object({
  input: storeCreateInputSchema,
});

export const storeSwitchBodySchema = z.object({
  storeId: z.string().uuid("店铺 id 不正确"),
});

export const storeInviteInputSchema = z
  .object({
    email: z.string().email("邮箱格式不正确"),
    role: z.enum(["manager", "technician", "sales", "viewer"]),
  })
  .passthrough() satisfies z.ZodType<StoreInviteInput>;

export const storeInviteBodySchema = z.object({
  input: storeInviteInputSchema,
});

export const onboardingRequestInputSchema = z
  .object({
    request_type: z.enum(["create_store", "join_store"]),
    desired_store_name: optionalText,
    target_store_id: optionalText,
    requested_role: z.enum(["manager", "technician", "sales", "viewer"]).optional(),
  })
  .passthrough()
  .superRefine((input, ctx) => {
    if (input.request_type === "create_store" && !input.desired_store_name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["desired_store_name"],
        message: "请填写要创建的店铺名称",
      });
    }
    if (input.request_type === "join_store" && !input.target_store_id?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target_store_id"],
        message: "请选择要加入的店铺",
      });
    }
  }) satisfies z.ZodType<OnboardingRequestInput>;

export const onboardingRequestBodySchema = z.object({
  input: onboardingRequestInputSchema,
});

export const onboardingDecisionBodySchema = z
  .object({
    id: z.string().uuid("申请 id 不正确"),
    note: optionalText,
  })
  .passthrough() satisfies z.ZodType<OnboardingDecisionInput>;

export const messageTemplateUpdateInputSchema = z
  .object({
    label: optionalText,
    body_template: optionalText,
    enabled: z.boolean().optional(),
  })
  .passthrough() satisfies z.ZodType<MessageTemplateUpdateInput>;

export const messageTemplateUpdateBodySchema = z.object({
  id: z.string().min(1, "缺少模板 id"),
  input: messageTemplateUpdateInputSchema,
});

export const messageTemplateResetBodySchema = z.object({
  id: z.string().min(1, "缺少模板 id"),
});

export const messageTemplatePreviewBodySchema = z
  .object({
    templateId: optionalText,
    bodyTemplate: optionalText,
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough() satisfies z.ZodType<MessageTemplatePreviewInput>;

export { approvalStatusSchema, inventoryItemStatusSchema };
