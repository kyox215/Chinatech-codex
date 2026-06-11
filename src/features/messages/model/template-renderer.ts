import type {
  CustomerDetail,
  MessageTemplate,
  MessageTemplateChannel,
  MessageTemplateDomain,
  OrderDetail,
  OrderWhatsappTemplateKind,
  StoreSettings,
} from "@/lib/repairdesk/types";
import {
  formatEuro,
  statusItalian,
  translateFaultName,
  translatePrintableText,
} from "@/features/orders/model/order-italian";
import { DEFAULT_STORE_SETTINGS, withStoreSettingsDefaults } from "./message-template-defaults";

export type TemplateContext = Record<string, string | number | boolean | null | undefined>;

const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function extractTemplateVariables(bodyTemplate: string) {
  return Array.from(
    new Set(Array.from(bodyTemplate.matchAll(TEMPLATE_VARIABLE_PATTERN)).map((match) => match[1])),
  ).sort((left, right) => left.localeCompare(right));
}

export function renderTemplate(bodyTemplate: string, context: TemplateContext = {}) {
  const rendered = bodyTemplate.replace(TEMPLATE_VARIABLE_PATTERN, (_, variable: string) => {
    const value = context[variable];
    if (value === null || value === undefined) return "";
    return String(value);
  });

  return rendered
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function findEnabledTemplate(
  templates: MessageTemplate[] | undefined,
  domain: MessageTemplateDomain,
  kind: string,
  channel: MessageTemplateChannel,
) {
  return templates?.find(
    (template) =>
      template.enabled &&
      template.domain === domain &&
      template.kind === kind &&
      template.channel === channel,
  );
}

export function renderOrderTemplateMessage({
  data,
  kind,
  orderUrl,
  templates,
  storeSettings,
}: {
  data: OrderDetail;
  kind: OrderWhatsappTemplateKind;
  orderUrl: string;
  templates?: MessageTemplate[];
  storeSettings?: Partial<StoreSettings> | null;
}) {
  const template = findEnabledTemplate(templates, "order", kind, "whatsapp");
  if (!template) return undefined;
  return renderTemplate(
    template.body_template,
    buildOrderTemplateContext(data, orderUrl, storeSettings),
  );
}

export function renderCustomerTemplateMessage({
  data,
  appOrigin,
  channel,
  templates,
  storeSettings,
}: {
  data: CustomerDetail;
  appOrigin: string;
  channel: MessageTemplateChannel;
  templates?: MessageTemplate[];
  storeSettings?: Partial<StoreSettings> | null;
}) {
  const template = findEnabledTemplate(templates, "customer", "general", channel);
  if (!template) return undefined;
  return renderTemplate(
    template.body_template,
    buildCustomerTemplateContext(data, appOrigin, storeSettings),
  );
}

export function buildStoreTemplateContext(settings?: Partial<StoreSettings> | null) {
  const store = withStoreSettingsDefaults(settings);
  return {
    store_name: store.store_name,
    store_address: store.store_address,
    store_phone: store.store_phone,
    store_whatsapp: store.store_whatsapp,
    store_email: store.store_email,
    message_signature: store.message_signature,
    print_footer: store.print_footer,
    default_order_warranty_text: store.default_order_warranty_text,
    default_order_warranty_months: String(store.default_order_warranty_months),
    default_inventory_warranty_months: String(store.default_inventory_warranty_months),
  };
}

export function buildOrderTemplateContext(
  data: OrderDetail,
  orderUrl: string,
  storeSettings?: Partial<StoreSettings> | null,
): TemplateContext {
  const { order, customer, device } = data;
  const snapshot = order.device_snapshot;
  const brand = snapshot?.brand || device?.brand || "";
  const model = snapshot?.model || device?.model || "";
  const deviceLabel = `${brand} ${model}`.trim() || order.device_label || "Dispositivo";
  const diagnosis = translatePrintableText(order.diagnosis_result);
  const issue = translatePrintableText(order.issue_description);
  const cancelReason = translatePrintableText(order.cancel_reason);
  const faultLines = order.fault_prices.length
    ? order.fault_prices
        .map((item) => {
          const price = item.price > 0 ? `: ${formatEuro(item.price)}` : "";
          const note = item.note ? ` (${translatePrintableText(item.note)})` : "";
          return `- ${translateFaultName(item.name)}${price}${note}`;
        })
        .join("\n")
    : `- ${issue || "Intervento da confermare"}`;
  const balanceLine =
    order.balance_amount > 0
      ? `Saldo da pagare: ${formatEuro(order.balance_amount)}`
      : "Pagamento: saldato";
  const partsUpdateLine =
    order.status === "parts_arrived"
      ? "I ricambi sono arrivati e procederemo con la riparazione."
      : "I ricambi necessari sono stati ordinati. La informeremo appena saranno disponibili.";

  return {
    ...buildStoreTemplateContext(storeSettings ?? DEFAULT_STORE_SETTINGS),
    customer_name: customer?.name || order.customer_name || "Cliente",
    order_no: order.public_no,
    device_label: deviceLabel,
    fault_lines: faultLines,
    order_status: statusItalian[order.status] ?? order.status,
    quotation: formatEuro(order.quotation_amount),
    deposit: formatEuro(order.deposit_amount),
    balance: formatEuro(order.balance_amount),
    balance_line: balanceLine,
    issue,
    issue_line: issue ? `Problema segnalato: ${issue}` : "",
    diagnosis,
    diagnosis_line: diagnosis ? `Diagnosi: ${diagnosis}` : "",
    cancel_reason: cancelReason,
    cancel_reason_line: cancelReason ? `Motivo: ${cancelReason}` : "",
    order_url: orderUrl,
    order_url_line: orderUrl ? `Link ordine: ${orderUrl}` : "",
    parts_update_line: partsUpdateLine,
  };
}

export function buildCustomerTemplateContext(
  data: CustomerDetail,
  appOrigin: string,
  storeSettings?: Partial<StoreSettings> | null,
): TemplateContext {
  const { customer, orders, stats } = data;
  const latest = orders[0];
  const customerUrl = appOrigin ? `${appOrigin}/customers/${customer.id}` : "";

  return {
    ...buildStoreTemplateContext(storeSettings ?? DEFAULT_STORE_SETTINGS),
    customer_name: customer.name || "Cliente",
    latest_order_no: latest?.public_no ?? "",
    latest_device_label: latest?.device_label ?? "",
    latest_order_line: latest ? `Ultimo ordine: ${latest.public_no} - ${latest.device_label}` : "",
    device_count: String(stats.device_count),
    customer_url: customerUrl,
    customer_url_line: customerUrl ? `Area assistenza: ${customerUrl}` : "",
  };
}

export function createPreviewTemplateContext(storeSettings?: Partial<StoreSettings> | null) {
  return {
    ...buildStoreTemplateContext(storeSettings),
    customer_name: "Mario Rossi",
    order_no: "RD-2406-001",
    device_label: "iPhone 13 128GB",
    fault_lines: "- Schermo: EUR 89,00\n- Batteria: EUR 49,00",
    order_status: "Riparato",
    quotation: "EUR 138,00",
    deposit: "EUR 30,00",
    balance: "EUR 108,00",
    balance_line: "Saldo da pagare: EUR 108,00",
    issue: "Schermo rotto",
    issue_line: "Problema segnalato: Schermo rotto",
    diagnosis: "Display danneggiato, batteria sotto soglia",
    diagnosis_line: "Diagnosi: Display danneggiato, batteria sotto soglia",
    cancel_reason: "",
    cancel_reason_line: "",
    order_url: "https://repairdesk.local/orders/demo",
    order_url_line: "Link ordine: https://repairdesk.local/orders/demo",
    parts_update_line: "I ricambi sono arrivati e procederemo con la riparazione.",
    latest_order_no: "RD-2406-001",
    latest_device_label: "iPhone 13 128GB",
    latest_order_line: "Ultimo ordine: RD-2406-001 - iPhone 13 128GB",
    device_count: "2",
    customer_url: "https://repairdesk.local/customers/demo",
    customer_url_line: "Area assistenza: https://repairdesk.local/customers/demo",
  };
}
