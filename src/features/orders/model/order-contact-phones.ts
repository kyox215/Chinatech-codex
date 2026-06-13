import type { OrderDetail } from "@/lib/repairdesk/types";
import { normalizePhoneRaw } from "@/shared/lib/phone";

export function getOrderContactPhoneOptions(data: OrderDetail) {
  const primary = data.order.customer_phone || data.customer?.phone_e164 || "";
  const contacts = data.customer ? data.customer.contact_phones : data.order.contact_phones;
  const result: string[] = [];
  const seen = new Set<string>();

  for (const phone of [primary, ...contacts]) {
    const trimmed = phone.trim();
    const raw = normalizePhoneRaw(trimmed);
    if (!trimmed || !raw || seen.has(raw)) continue;
    seen.add(raw);
    result.push(trimmed);
  }

  return result;
}
