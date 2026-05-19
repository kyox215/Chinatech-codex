import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { OrderDetail, OrderWhatsappTemplateKind } from "@/lib/repairdesk/types";
import {
  formatEuro,
  statusItalian,
  translateFaultName,
  translatePrintableText,
} from "@/features/orders/model/order-italian";

export const orderWhatsappTemplateOptions: {
  kind: OrderWhatsappTemplateKind;
  label: string;
}[] = [
  { kind: "approval_request", label: "报价审批" },
  { kind: "pickup_ready", label: "可取机通知" },
  { kind: "unfixed_pickup", label: "未修取机" },
  { kind: "parts_update", label: "配件进度" },
  { kind: "repair_status", label: "状态更新" },
  { kind: "cancelled", label: "取消通知" },
  { kind: "completed", label: "完成确认" },
];

export function getDefaultOrderWhatsappTemplateKind(
  status: RepairOrderStatus,
): OrderWhatsappTemplateKind {
  if (status === "quoted" || status === "waiting_approval") return "approval_request";
  if (status === "repaired" || status === "notified" || status === "waiting_pickup") {
    return "pickup_ready";
  }
  if (status === "unfixed_pickup") return "unfixed_pickup";
  if (status === "parts_ordered" || status === "parts_arrived") return "parts_update";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  return "repair_status";
}

export function getOrderWhatsappTransition(
  status: RepairOrderStatus,
  kind: OrderWhatsappTemplateKind,
): RepairOrderStatus | undefined {
  if (status === "repaired" && kind === "pickup_ready") return "notified";
  return undefined;
}

export function buildWhatsAppUrl(phone: string, body: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

export function buildOrderWhatsappMessage(
  data: OrderDetail,
  kind: OrderWhatsappTemplateKind,
  orderUrl: string,
) {
  const ctx = getTemplateContext(data, orderUrl);

  const lines = (() => {
    switch (kind) {
      case "approval_request":
        return [
          `Gentile ${ctx.customerName},`,
          "",
          `le inviamo il preventivo per la riparazione del dispositivo ${ctx.deviceLabel}.`,
          `Numero ordine: ${ctx.publicNo}`,
          "",
          "Interventi previsti:",
          ctx.faultLines,
          "",
          `Totale preventivo: ${formatEuro(ctx.quotation)}`,
          `Acconto: ${formatEuro(ctx.deposit)}`,
          `Saldo da pagare: ${formatEuro(ctx.balance)}`,
          ctx.orderUrl ? `Link ordine: ${ctx.orderUrl}` : null,
          "",
          "La preghiamo di confermare se desidera procedere con la riparazione.",
          "Grazie,",
          "ChinaTech",
        ];
      case "pickup_ready":
        return [
          `Gentile ${ctx.customerName},`,
          "",
          `il dispositivo ${ctx.deviceLabel} e pronto per il ritiro.`,
          `Numero ordine: ${ctx.publicNo}`,
          `Stato: ${statusItalian[ctx.status]}`,
          ctx.balance > 0 ? `Saldo da pagare: ${formatEuro(ctx.balance)}` : "Pagamento: saldato",
          "",
          "Puo passare in negozio per il ritiro.",
          "ChinaTech - Viale Vittorio Veneto, 7, Floridia (SR)",
        ];
      case "unfixed_pickup":
        return [
          `Gentile ${ctx.customerName},`,
          "",
          `la diagnosi del dispositivo ${ctx.deviceLabel} e stata completata.`,
          `Numero ordine: ${ctx.publicNo}`,
          "Al momento il dispositivo non verra riparato.",
          ctx.diagnosis ? `Diagnosi: ${ctx.diagnosis}` : null,
          ctx.balance > 0 ? `Importo da saldare: ${formatEuro(ctx.balance)}` : null,
          "",
          "Puo passare in negozio per il ritiro.",
          "ChinaTech",
        ];
      case "parts_update":
        return [
          `Gentile ${ctx.customerName},`,
          "",
          `aggiornamento per il dispositivo ${ctx.deviceLabel}.`,
          `Numero ordine: ${ctx.publicNo}`,
          `Stato attuale: ${statusItalian[ctx.status]}`,
          "",
          ctx.status === "parts_arrived"
            ? "I ricambi sono arrivati e procederemo con la riparazione."
            : "I ricambi necessari sono stati ordinati. La informeremo appena saranno disponibili.",
          "ChinaTech",
        ];
      case "cancelled":
        return [
          `Gentile ${ctx.customerName},`,
          "",
          `l'ordine ${ctx.publicNo} per il dispositivo ${ctx.deviceLabel} e stato annullato.`,
          ctx.cancelReason ? `Motivo: ${ctx.cancelReason}` : null,
          "",
          "Per qualsiasi chiarimento puo contattarci.",
          "ChinaTech",
        ];
      case "completed":
        return [
          `Gentile ${ctx.customerName},`,
          "",
          `l'ordine ${ctx.publicNo} risulta completato.`,
          `Dispositivo: ${ctx.deviceLabel}`,
          ctx.balance > 0 ? `Saldo residuo: ${formatEuro(ctx.balance)}` : "Pagamento: saldato",
          "",
          "Grazie per aver scelto ChinaTech.",
        ];
      case "repair_status":
      default:
        return [
          `Gentile ${ctx.customerName},`,
          "",
          `aggiornamento per il dispositivo ${ctx.deviceLabel}.`,
          `Numero ordine: ${ctx.publicNo}`,
          `Stato attuale: ${statusItalian[ctx.status]}`,
          ctx.issue ? `Problema segnalato: ${ctx.issue}` : null,
          ctx.diagnosis ? `Diagnosi: ${ctx.diagnosis}` : null,
          ctx.orderUrl ? `Link ordine: ${ctx.orderUrl}` : null,
          "",
          "Per qualsiasi domanda siamo a disposizione.",
          "ChinaTech",
        ];
    }
  })();

  return lines.filter((line): line is string => line !== null).join("\n");
}

function getTemplateContext(data: OrderDetail, orderUrl: string) {
  const { order, customer, device } = data;
  const snapshot = order.device_snapshot;
  const brand = snapshot?.brand || device?.brand || "";
  const model = snapshot?.model || device?.model || "";
  const deviceLabel = `${brand} ${model}`.trim() || order.device_label || "Dispositivo";
  const faultLines = order.fault_prices.length
    ? order.fault_prices
        .map((item) => {
          const price = item.price > 0 ? `: ${formatEuro(item.price)}` : "";
          const note = item.note ? ` (${translatePrintableText(item.note)})` : "";
          return `- ${translateFaultName(item.name)}${price}${note}`;
        })
        .join("\n")
    : `- ${translatePrintableText(order.issue_description) || "Intervento da confermare"}`;

  return {
    publicNo: order.public_no,
    status: order.status,
    customerName: customer?.name || order.customer_name || "Cliente",
    deviceLabel,
    faultLines,
    issue: translatePrintableText(order.issue_description),
    diagnosis: translatePrintableText(order.diagnosis_result),
    cancelReason: translatePrintableText(order.cancel_reason),
    quotation: order.quotation_amount,
    deposit: order.deposit_amount,
    balance: order.balance_amount,
    orderUrl,
  };
}
