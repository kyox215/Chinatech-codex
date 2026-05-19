import type { CustomerCreateInput } from "@/lib/repairdesk/api";

export const defaultCustomerForm: CustomerCreateInput = {
  name: "",
  phone_e164: "",
  email: "",
  contact_phones: [],
  consent_marketing: true,
  consent_sms: true,
  preferred_channel: "whatsapp",
  language: "it",
  notes: "",
  marketing_notes: "",
  blacklisted: false,
};

export function formatCustomerDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
