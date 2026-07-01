import type { SelectedFault } from "@/components/orders/fault-diagnosis-picker";
import type { RepairOrderStatus } from "@/lib/mock/enums";
import type { DeviceUnlockInput } from "@/lib/repairdesk/types";

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
  deviceUnlock: DeviceUnlockInput;
  issue: string;
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
  deviceUnlock: { method: "none" },
  issue: "",
  internalTag: "",
  accessoryNotes: "",
  warrantyText: "6个月",
  warrantyMonths: 6,
  warrantyChangeReason: "",
  deposit: 0,
  faults: [],
};

export const brandSuggestions = ["Apple", "Samsung", "Huawei", "Xiaomi", "OPPO", "Vivo", "Honor"];
