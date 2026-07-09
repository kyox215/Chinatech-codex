import type { StoreSettings } from "@/lib/repairdesk/types";

export interface StorePrintProfile {
  storeName: string;
  storeAddress: string;
  storeContactLine: string;
  storeSummaryLine: string;
  printFooter: string;
  privacyNote: string;
}

const DEFAULT_STORE_PRINT_PROFILE: StorePrintProfile = {
  storeName: "ChinaTech",
  storeAddress: "Viale Vittorio Veneto, 7, Floridia (SR)",
  storeContactLine: "",
  storeSummaryLine: "Viale Vittorio Veneto, 7, Floridia (SR)",
  printFooter: "Grazie per aver scelto ChinaTech.",
  privacyNote: "I dati personali sono trattati secondo la normativa vigente.",
};

export function buildStorePrintProfile(
  settings?: Partial<StoreSettings> | null,
): StorePrintProfile {
  const storeName = cleanText(settings?.store_name) || DEFAULT_STORE_PRINT_PROFILE.storeName;
  const storeAddress =
    cleanText(settings?.store_address) || DEFAULT_STORE_PRINT_PROFILE.storeAddress;
  const storeContactLine = [
    formatContact("Tel", settings?.store_phone),
    formatContact("WhatsApp", settings?.store_whatsapp),
    cleanText(settings?.store_email),
  ]
    .filter(Boolean)
    .join(" · ");
  const storeSummaryLine = [storeAddress, storeContactLine].filter(Boolean).join(" · ");
  const printFooter = cleanText(settings?.print_footer) || `Grazie per aver scelto ${storeName}.`;

  return {
    storeName,
    storeAddress,
    storeContactLine,
    storeSummaryLine,
    printFooter,
    privacyNote: DEFAULT_STORE_PRINT_PROFILE.privacyNote,
  };
}

function formatContact(label: string, value?: string) {
  const normalized = cleanText(value);
  return normalized ? `${label}: ${normalized}` : "";
}

function cleanText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}
