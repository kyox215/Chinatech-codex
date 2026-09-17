import type { OrderDetail, PatchOrderChanges } from "@/lib/repairdesk/types";
import { normalizePhoneRaw, uniqueContactPhones } from "@/shared/lib/phone";

/** Keep the submitted primary and backup fields independent; never merge stored numbers. */
export function normalizeOrderContactChanges(
  changes: Pick<PatchOrderChanges, "customer_phone" | "contact_phones">,
) {
  const result: { phone_e164?: string; phone_raw?: string; contact_phones?: string[] } = {};
  const normalize = (value: string) => {
    const phone = value.trim();
    const raw = normalizePhoneRaw(phone);
    if (!/^[+\d][\d\s().-]*$/.test(phone) || raw.length < 7 || raw.length > 15) {
      throw new Error("主号或备用号码格式不正确；每个输入只能填写一个号码");
    }
    return phone;
  };
  if (changes.customer_phone !== undefined) {
    result.phone_e164 = normalize(changes.customer_phone);
    result.phone_raw = normalizePhoneRaw(result.phone_e164);
  }
  if (changes.contact_phones !== undefined) {
    if (!Array.isArray(changes.contact_phones) || changes.contact_phones.length > 20) {
      throw new Error("备用号码最多支持 20 个");
    }
    result.contact_phones = uniqueContactPhones(
      result.phone_e164 ?? "",
      changes.contact_phones.map(normalize),
    );
  }
  return result;
}

export function getOrderContactPhoneOptions(data: OrderDetail) {
  const primary = data.customer?.phone_e164 ?? data.order.customer_phone ?? "";
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
