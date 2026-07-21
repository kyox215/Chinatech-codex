import type { SelectedFault } from "@/components/orders/fault-diagnosis-picker";
import { createOrderLineId } from "@/entities/order/model/order-line-identity";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { DeviceCustodyStatus, DeviceUnlockInput } from "@/lib/repairdesk/types";

import type { IssueCaptureMode } from "./order-diagnosis-quote";
import { ORDER_FACT_CATALOG_REVISION } from "./order-fact-catalog";

export interface NewOrderFormState {
  type: "quick_repair" | "dropoff_repair";
  status: RepairOrderStatus;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  deviceId?: string;
  brand: string;
  model: string;
  imei: string;
  deviceNotes: string;
  deviceCustodyStatus: DeviceCustodyStatus | null;
  deviceUnlock: DeviceUnlockInput;
  issueCaptureMode: IssueCaptureMode;
  issue: string;
  reportedSymptomCodes: string[];
  reportedSymptomOtherNote: string;
  reportedSymptomCatalogRevision: string;
  internalTag: string;
  accessoryNotes: string;
  warrantyText: string;
  warrantyMonths: number;
  warrantyChangeReason: string;
  deposit: number;
  faults: SelectedFault[];
}

export const initialNewOrderForm: NewOrderFormState = {
  type: "quick_repair",
  status: "new",
  customerName: "",
  customerPhone: "",
  brand: "",
  model: "",
  imei: "",
  deviceNotes: "",
  deviceCustodyStatus: null,
  deviceUnlock: { method: "none" },
  issueCaptureMode: "reported",
  issue: "",
  reportedSymptomCodes: [],
  reportedSymptomOtherNote: "",
  reportedSymptomCatalogRevision: ORDER_FACT_CATALOG_REVISION,
  internalTag: "",
  accessoryNotes: "",
  warrantyText: "6个月",
  warrantyMonths: 6,
  warrantyChangeReason: "",
  deposit: 0,
  faults: [],
};

export function createCustomFaultForNewOrder(): SelectedFault {
  return {
    line_id: createOrderLineId(),
    key: `custom:${Date.now()}`,
    categoryKey: "custom",
    categoryLabel: "自定义",
    name: "",
    price: 0,
    note: "Intervento personalizzato",
  };
}

type CustomerNameSource = {
  name?: string | null;
  phone_e164?: string | null;
  phone_raw?: string | null;
};

export function customerNameForNewOrder(source: CustomerNameSource) {
  const name = source.name?.trim() ?? "";
  if (!name) return "";
  return isGeneratedPhoneCustomerName(name, [source.phone_e164, source.phone_raw]) ? "" : name;
}

export function customerLabelForNewOrder(source: CustomerNameSource) {
  return (
    customerNameForNewOrder(source) ||
    source.phone_e164?.trim() ||
    source.phone_raw?.trim() ||
    "该客户"
  );
}

export function customerNameValueForCreateOrder(
  form: Pick<NewOrderFormState, "customerName" | "customerPhone">,
) {
  const name = form.customerName.trim();
  if (!name) return undefined;
  return isGeneratedPhoneCustomerName(name, [form.customerPhone]) ? undefined : name;
}

function isGeneratedPhoneCustomerName(
  name: string,
  phoneCandidates: Array<string | null | undefined>,
) {
  const compactName = name.trim().replace(/\s+/g, "");
  if (!compactName.startsWith("客户")) return false;

  const suffixDigits = digitsOnly(compactName.slice("客户".length));
  if (!suffixDigits) return false;

  return phoneCandidates.some((phone) => {
    const phoneDigits = digitsOnly(phone);
    return (
      Boolean(phoneDigits) &&
      (suffixDigits === phoneDigits ||
        suffixDigits.endsWith(phoneDigits) ||
        phoneDigits.endsWith(suffixDigits))
    );
  });
}

function digitsOnly(value?: string | null) {
  return String(value ?? "").replace(/\D/g, "");
}

export const brandSuggestions = ["Apple", "Samsung", "Huawei", "Xiaomi", "OPPO", "Vivo", "Honor"];

export const appleDeviceModelSuggestions = [
  "iPhone 17e",
  "iPhone 17 Pro Max",
  "iPhone 17 Pro",
  "iPhone 17",
  "iPhone Air",
  "iPhone 16e",
  "iPhone 16 Pro Max",
  "iPhone 16 Pro",
  "iPhone 16 Plus",
  "iPhone 16",
  "iPhone 15 Pro Max",
  "iPhone 15 Pro",
  "iPhone 15 Plus",
  "iPhone 15",
  "iPhone 14 Pro Max",
  "iPhone 14 Pro",
  "iPhone 14 Plus",
  "iPhone 14",
  "iPhone SE 2022",
  "iPhone 13 Pro Max",
  "iPhone 13 Pro",
  "iPhone 13",
  "iPhone 13 mini",
  "iPhone 12 Pro Max",
  "iPhone 12 Pro",
  "iPhone 12",
  "iPhone 12 mini",
  "iPhone SE 2020",
  "iPhone 11 Pro Max",
  "iPhone 11 Pro",
  "iPhone 11",
  "iPhone XS Max",
  "iPhone XS",
  "iPhone XR",
  "iPhone X",
  "iPhone 8 Plus",
  "iPhone 8",
  "iPhone 7 Plus",
  "iPhone 7",
  "iPhone SE 2016",
  "iPhone 6s Plus",
  "iPhone 6s",
  "iPhone 6 Plus",
  "iPhone 6",
  "iPhone 5s",
  "iPhone 5c",
  "iPhone 5",
  "iPhone 4s",
  "iPhone 4",
  "iPhone 3GS",
  "iPhone 3G",
  "iPhone (1st generation)",
];

export function deviceModelSuggestionsForBrand(brand: string) {
  return isAppleBrandInput(brand) ? appleDeviceModelSuggestions : [];
}

export function isAppleDeviceModelSuggestion(model: string) {
  const normalized = model.trim().toLowerCase();
  return appleDeviceModelSuggestions.some((suggestion) => suggestion.toLowerCase() === normalized);
}

function isAppleBrandInput(brand: string) {
  const normalized = brand.trim().toLowerCase();
  return !normalized || normalized === "apple" || normalized === "苹果" || normalized === "iphone";
}
