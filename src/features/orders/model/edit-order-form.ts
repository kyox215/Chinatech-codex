import type { OrderDetail, UpdateOrderInput } from "@/lib/repairdesk/api";
import { parseWarrantyMonths, formatWarrantyText } from "@/features/orders/model/order-warranty";

export function buildEditForm(data: OrderDetail, defaultWarrantyMonths = 6): UpdateOrderInput {
  const { order, customer, device } = data;
  const snapshot = order.device_snapshot;
  const primaryPhone = customer?.phone_e164 ?? order.customer_phone;
  const backupPhones = customer?.contact_phones ?? order.contact_phones;
  const warrantyMonths =
    typeof order.warranty_months === "number"
      ? order.warranty_months
      : parseWarrantyMonths(order.warranty_text, defaultWarrantyMonths);
  return {
    expected_updated_at: order.updated_at,
    customer_name: customer?.name ?? order.customer_name,
    customer_phone: [primaryPhone, ...backupPhones].filter(Boolean).join(" / "),
    device_brand: snapshot?.brand ?? device?.brand ?? "",
    device_model: snapshot?.model ?? device?.model ?? "",
    device_imei: snapshot?.serial_or_imei ?? order.device_imei ?? device?.serial_or_imei,
    device_notes: snapshot?.device_notes ?? device?.device_notes ?? "",
    issue_description: order.issue_description,
    diagnosis_result: order.diagnosis_result ?? "",
    internal_tag: order.internal_tag ?? "",
    accessory_notes: order.accessory_notes ?? "",
    warranty_text: order.warranty_text ?? formatWarrantyText(warrantyMonths),
    warranty_months: warrantyMonths,
    warranty_change_reason: order.warranty_change_reason ?? "",
    fault_prices: order.fault_prices.length ? order.fault_prices : [{ name: "", price: 0 }],
    deposit_amount: order.deposit_amount,
  };
}

export function inferOrderPaidAmount(order: OrderDetail["order"]) {
  return Math.max(0, order.quotation_amount - order.deposit_amount - order.balance_amount);
}
