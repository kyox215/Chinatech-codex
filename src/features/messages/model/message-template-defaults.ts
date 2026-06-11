import type { MessageTemplate, StoreSettings } from "@/lib/repairdesk/types";

export type MessageTemplateSeed = Pick<
  MessageTemplate,
  | "id"
  | "domain"
  | "kind"
  | "channel"
  | "language"
  | "label"
  | "body_template"
  | "enabled"
  | "sort_order"
>;

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  id: "default",
  store_name: "ChinaTech",
  store_address: "Viale Vittorio Veneto, 7, Floridia (SR)",
  store_phone: "",
  store_whatsapp: "",
  store_email: "",
  default_order_warranty_text: "6个月",
  default_inventory_warranty_months: 12,
  print_footer: "Grazie per aver scelto ChinaTech.",
  message_signature: "ChinaTech - Viale Vittorio Veneto, 7, Floridia (SR)",
  created_at: "",
  updated_at: "",
};

export const MESSAGE_TEMPLATE_VARIABLES = [
  { name: "customer_name", label: "客户姓名" },
  { name: "order_no", label: "工单编号" },
  { name: "device_label", label: "设备" },
  { name: "fault_lines", label: "维修项目" },
  { name: "order_status", label: "工单状态" },
  { name: "quotation", label: "报价金额" },
  { name: "deposit", label: "订金" },
  { name: "balance", label: "余额" },
  { name: "balance_line", label: "余额行" },
  { name: "diagnosis", label: "检测结果" },
  { name: "diagnosis_line", label: "检测结果行" },
  { name: "order_url", label: "工单链接" },
  { name: "order_url_line", label: "工单链接行" },
  { name: "store_name", label: "店铺名" },
  { name: "store_address", label: "店铺地址" },
  { name: "message_signature", label: "消息签名" },
  { name: "latest_order_line", label: "客户最近工单行" },
  { name: "device_count", label: "客户设备数量" },
  { name: "customer_url", label: "客户链接" },
  { name: "customer_url_line", label: "客户链接行" },
] as const;

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplateSeed[] = [
  {
    id: "order_whatsapp_approval_request_it",
    domain: "order",
    kind: "approval_request",
    channel: "whatsapp",
    language: "it",
    label: "报价审批",
    enabled: true,
    sort_order: 10,
    body_template: [
      "Gentile {{customer_name}},",
      "",
      "le inviamo il preventivo per la riparazione del dispositivo {{device_label}}.",
      "Numero ordine: {{order_no}}",
      "",
      "Interventi previsti:",
      "{{fault_lines}}",
      "",
      "Totale preventivo: {{quotation}}",
      "Acconto: {{deposit}}",
      "Saldo da pagare: {{balance}}",
      "{{order_url_line}}",
      "",
      "La preghiamo di confermare se desidera procedere con la riparazione.",
      "Grazie,",
      "{{message_signature}}",
    ].join("\n"),
  },
  {
    id: "order_whatsapp_pickup_ready_it",
    domain: "order",
    kind: "pickup_ready",
    channel: "whatsapp",
    language: "it",
    label: "可取机通知",
    enabled: true,
    sort_order: 20,
    body_template: [
      "Gentile {{customer_name}},",
      "",
      "il dispositivo {{device_label}} e pronto per il ritiro.",
      "Numero ordine: {{order_no}}",
      "Stato: {{order_status}}",
      "{{balance_line}}",
      "",
      "Puo passare in negozio per il ritiro.",
      "{{message_signature}}",
    ].join("\n"),
  },
  {
    id: "order_whatsapp_unfixed_pickup_it",
    domain: "order",
    kind: "unfixed_pickup",
    channel: "whatsapp",
    language: "it",
    label: "未修取机",
    enabled: true,
    sort_order: 30,
    body_template: [
      "Gentile {{customer_name}},",
      "",
      "la diagnosi del dispositivo {{device_label}} e stata completata.",
      "Numero ordine: {{order_no}}",
      "Al momento il dispositivo non verra riparato.",
      "{{diagnosis_line}}",
      "{{balance_line}}",
      "",
      "Puo passare in negozio per il ritiro.",
      "{{message_signature}}",
    ].join("\n"),
  },
  {
    id: "order_whatsapp_parts_update_it",
    domain: "order",
    kind: "parts_update",
    channel: "whatsapp",
    language: "it",
    label: "配件进度",
    enabled: true,
    sort_order: 40,
    body_template: [
      "Gentile {{customer_name}},",
      "",
      "aggiornamento per il dispositivo {{device_label}}.",
      "Numero ordine: {{order_no}}",
      "Stato attuale: {{order_status}}",
      "",
      "{{parts_update_line}}",
      "{{message_signature}}",
    ].join("\n"),
  },
  {
    id: "order_whatsapp_repair_status_it",
    domain: "order",
    kind: "repair_status",
    channel: "whatsapp",
    language: "it",
    label: "状态更新",
    enabled: true,
    sort_order: 50,
    body_template: [
      "Gentile {{customer_name}},",
      "",
      "aggiornamento per il dispositivo {{device_label}}.",
      "Numero ordine: {{order_no}}",
      "Stato attuale: {{order_status}}",
      "{{issue_line}}",
      "{{diagnosis_line}}",
      "{{order_url_line}}",
      "",
      "Per qualsiasi domanda siamo a disposizione.",
      "{{message_signature}}",
    ].join("\n"),
  },
  {
    id: "order_whatsapp_cancelled_it",
    domain: "order",
    kind: "cancelled",
    channel: "whatsapp",
    language: "it",
    label: "取消通知",
    enabled: true,
    sort_order: 60,
    body_template: [
      "Gentile {{customer_name}},",
      "",
      "l'ordine {{order_no}} per il dispositivo {{device_label}} e stato annullato.",
      "{{cancel_reason_line}}",
      "",
      "Per qualsiasi chiarimento puo contattarci.",
      "{{message_signature}}",
    ].join("\n"),
  },
  {
    id: "order_whatsapp_completed_it",
    domain: "order",
    kind: "completed",
    channel: "whatsapp",
    language: "it",
    label: "完成确认",
    enabled: true,
    sort_order: 70,
    body_template: [
      "Gentile {{customer_name}},",
      "",
      "l'ordine {{order_no}} risulta completato.",
      "Dispositivo: {{device_label}}",
      "{{balance_line}}",
      "",
      "Grazie per aver scelto {{store_name}}.",
    ].join("\n"),
  },
  {
    id: "customer_whatsapp_general_it",
    domain: "customer",
    kind: "general",
    channel: "whatsapp",
    language: "it",
    label: "客户通用消息",
    enabled: true,
    sort_order: 100,
    body_template: [
      "Gentile {{customer_name}},",
      "",
      "la contattiamo da {{store_name}} per il servizio di assistenza.",
      "{{latest_order_line}}",
      "Dispositivi registrati: {{device_count}}",
      "{{customer_url_line}}",
      "",
      "Restiamo a disposizione per qualsiasi necessita.",
      "Grazie,",
      "{{message_signature}}",
    ].join("\n"),
  },
  {
    id: "customer_sms_general_it",
    domain: "customer",
    kind: "general",
    channel: "sms",
    language: "it",
    label: "客户短信通用",
    enabled: true,
    sort_order: 110,
    body_template:
      "{{store_name}}: Gentile {{customer_name}}, restiamo a disposizione per assistenza. {{customer_url}}",
  },
];

export function getDefaultMessageTemplate(id: string) {
  const seedId = id.includes(":") ? id.split(":").pop() || id : id;
  return DEFAULT_MESSAGE_TEMPLATES.find((template) => template.id === seedId);
}

export function findDefaultMessageTemplate(
  domain: MessageTemplateSeed["domain"],
  kind: string,
  channel: MessageTemplateSeed["channel"],
) {
  return DEFAULT_MESSAGE_TEMPLATES.find(
    (template) =>
      template.domain === domain && template.kind === kind && template.channel === channel,
  );
}

export function withStoreSettingsDefaults(settings?: Partial<StoreSettings> | null): StoreSettings {
  const now = new Date().toISOString();
  return {
    ...DEFAULT_STORE_SETTINGS,
    created_at: settings?.created_at || now,
    updated_at: settings?.updated_at || now,
    ...settings,
    id: settings?.id || DEFAULT_STORE_SETTINGS.id,
    store_id: settings?.store_id,
    default_inventory_warranty_months:
      settings?.default_inventory_warranty_months ??
      DEFAULT_STORE_SETTINGS.default_inventory_warranty_months,
  };
}

export function templateIdForStore(storeId: string | undefined, seedId: string) {
  if (!storeId || storeId === "00000000-0000-0000-0000-000000000001") return seedId;
  return `${storeId}:${seedId}`;
}
