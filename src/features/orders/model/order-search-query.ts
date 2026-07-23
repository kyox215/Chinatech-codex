export type OrderSearchQueryKind = "empty" | "public_no" | "phone" | "serial" | "text";

const PHONE_QUERY_PATTERN = /^[+\d\s().-]+$/;
const PUBLIC_NO_PATTERN = /^(?:R|RO|ORD)[-_]?\d{4,}$/i;
const SERIAL_QUERY_PATTERN = /^[A-Z0-9][A-Z0-9._/-]{5,}$/i;

export function classifyOrderSearchQuery(value: string | null | undefined): OrderSearchQueryKind {
  const query = value?.trim() ?? "";
  if (!query) return "empty";

  const compact = query.replace(/\s+/g, "");
  if (PUBLIC_NO_PATTERN.test(compact)) return "public_no";

  if (PHONE_QUERY_PATTERN.test(query)) {
    const digits = query.replace(/\D/g, "");
    return digits.length >= 6 ? "phone" : "text";
  }

  if (SERIAL_QUERY_PATTERN.test(compact) && /[A-Z]/i.test(compact) && /\d/.test(compact)) {
    return "serial";
  }

  return "text";
}

export function canRunExactArchiveOrderSearch(value: string | null | undefined) {
  const kind = classifyOrderSearchQuery(value);
  return kind === "public_no" || kind === "phone" || kind === "serial";
}
