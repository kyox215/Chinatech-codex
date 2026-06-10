import type { SelectedFault } from "@/components/orders/fault-diagnosis-picker";
import type { normalizeInitialOrderStatus } from "@/lib/mock/workflow";

export interface NewOrderFormState {
  type: "quick_repair" | "dropoff_repair";
  status: ReturnType<typeof normalizeInitialOrderStatus>;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  deviceId?: string;
  brand: string;
  model: string;
  imei: string;
  deviceNotes: string;
  issue: string;
  technician: string;
  internalTag: string;
  accessoryNotes: string;
  warrantyText: string;
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
  issue: "",
  technician: "",
  internalTag: "",
  accessoryNotes: "",
  warrantyText: "6个月",
  deposit: 0,
  faults: [],
};

export const fallbackTechnicians = ["陈师傅", "李工", "王师傅", "周工", "黄师傅"];
export const brandSuggestions = ["Apple", "Samsung", "Huawei", "Xiaomi", "OPPO", "Vivo", "Honor"];
export const warrantyOptions = ["无保修", "3个月", "6个月", "12个月"];
