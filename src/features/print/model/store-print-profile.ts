import type { StoreSettings } from "@/lib/repairdesk/types";
import { resolveStoreOutputIdentity } from "@/entities/store/model/store-output-identity";

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
  storeName: "",
  storeAddress: "",
  storeContactLine: "",
  storeSummaryLine: "",
  printFooter: "",
  privacyNote: "I dati personali sono trattati secondo la normativa vigente.",
  canOutput: false,
  warnings: [],
};

export function buildStorePrintProfile(
  settings?: Partial<StoreSettings> | null,
  activeStore?: { id?: string; name?: string } | null,
): StorePrintProfile {
  const identity = resolveStoreOutputIdentity({ activeStore, settings });
  const storeName = identity.storeName;
  const storeAddress = identity.storeAddress;
  const storeContactLine = identity.contactLine;
  const storeSummaryLine = [storeAddress, storeContactLine].filter(Boolean).join(" · ");

  return {
    storeName,
    storeAddress,
    storeContactLine,
    storeSummaryLine,
    printFooter: identity.printFooter,
    privacyNote: DEFAULT_STORE_PRINT_PROFILE.privacyNote,
    canOutput: identity.canOutput,
    blockReason: identity.blockReason,
    warnings: identity.warnings,
  };
}
