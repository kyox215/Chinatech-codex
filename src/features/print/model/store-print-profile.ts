import type { StoreSettings } from "@/lib/repairdesk/types";

export interface StorePrintProfile {
  storeName: string;
  storeAddress: string;
  storeContactLine: string;
  storeSummaryLine: string;
  printFooter: string;
  privacyNote: string;
  canOutput: boolean;
  blockReason?: string;
  warnings: string[];
}

const DEFAULT_STORE_PRINT_PROFILE: StorePrintProfile = {
  storeName: "RepairDesk",
  storeAddress: "",
  storeContactLine: "",
  storeSummaryLine: "",
  printFooter: "Documento generato da RepairDesk.",
  privacyNote: "I dati personali sono trattati secondo la normativa vigente.",
  canOutput: true,
  warnings: [],
};

export function buildStorePrintProfile(
  settings?: Partial<StoreSettings> | null,
  activeStore?: { id?: string; name?: string } | null,
): StorePrintProfile {
  const activeStoreId = cleanText(activeStore?.id);
  const settingsStoreId = cleanText(settings?.store_id);
  const settingsBelongToActiveStore = Boolean(
    settings && activeStoreId && settingsStoreId && settingsStoreId === activeStoreId,
  );
  const safeSettings = settingsBelongToActiveStore ? settings : undefined;
  const storeName =
    cleanText(safeSettings?.store_name) ||
    cleanText(activeStore?.name) ||
    DEFAULT_STORE_PRINT_PROFILE.storeName;
  const storeAddress = cleanText(safeSettings?.store_address);
  const storeContactLine = [
    formatContact("Tel", safeSettings?.store_phone),
    formatContact("WhatsApp", safeSettings?.store_whatsapp),
    cleanText(safeSettings?.store_email),
  ]
    .filter(Boolean)
    .join(" · ");
  const storeSummaryLine = [storeAddress, storeContactLine].filter(Boolean).join(" · ");

  return {
    storeName,
    storeAddress,
    storeContactLine,
    storeSummaryLine,
    printFooter: cleanText(safeSettings?.print_footer) || DEFAULT_STORE_PRINT_PROFILE.printFooter,
    privacyNote: DEFAULT_STORE_PRINT_PROFILE.privacyNote,
    canOutput: true,
    warnings:
      settings && !settingsBelongToActiveStore
        ? ["店铺设置无法确认属于当前店铺，本次打印已省略设置中的店铺资料"]
        : [],
  };
}

function cleanText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function formatContact(label: string, value?: string | null) {
  const normalized = cleanText(value);
  return normalized ? `${label}: ${normalized}` : "";
}
