import type { ApprovalStatus, RepairOrderStatus, RepairOrderType } from "@/lib/mock/enums";

export interface Customer {
  id: string;
  name: string;
  phone_e164: string;
  phone_raw: string;
  contact_phones: string[];
  consent_marketing: boolean;
  consent_sms: boolean;
  notes?: string;
}

export interface Device {
  id: string;
  customer_id: string;
  brand: string;
  model: string;
  serial_or_imei: string;
  device_notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  short_name: string;
  color: string;
}

export interface FaultPriceItem {
  name: string;
  price: number;
  note?: string;
}

export interface RepairOrder {
  id: string;
  public_no: string;
  order_type: RepairOrderType;
  status: RepairOrderStatus;
  customer_id: string;
  device_id: string;
  issue_description: string;
  diagnosis_result?: string;
  quotation_amount: number;
  deposit_amount: number;
  balance_amount: number;
  is_paid: boolean;
  approval_status: ApprovalStatus;
  approval_sent_at?: string;
  approval_confirmed_at?: string;
  technician_name: string;
  internal_tag?: string;
  warranty_text?: string;
  completed_at?: string;
  delivered_at?: string;
  pause_reason?: string;
  cancel_reason?: string;
  supplier_id?: string;
  original_order_id?: string;
  contact_phones: string[];
  fault_prices: FaultPriceItem[];
  customer_signature?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type:
    | "created"
    | "status_changed"
    | "quoted"
    | "approval_sent"
    | "approval_result"
    | "payment"
    | "note"
    | "message_sent"
    | "delivered";
  payload: Record<string, unknown>;
  operator_name: string;
  created_at: string;
}

export interface MessageLog {
  id: string;
  order_id: string;
  channel: "whatsapp" | "sms";
  message_body: string;
  status: "sent" | "delivered" | "read" | "failed";
  sent_at: string;
  opened_at?: string;
}

export interface OrderListFilters {
  search?: string;
  statuses?: RepairOrderStatus[];
  types?: RepairOrderType[];
  technicians?: string[];
  supplierIds?: string[];
  paid?: "all" | "paid" | "unpaid";
  overdue?: "approval" | "pickup" | "any";
}

export interface OrderListItem extends RepairOrder {
  customer_name: string;
  customer_phone: string;
  device_label: string;
  device_imei: string;
  supplier_name?: string;
  supplier_color?: string;
  approval_overdue: boolean;
  pickup_overdue: boolean;
}

export interface OrderStats {
  total: number;
  today: number;
  inProgress: number;
  unpaid: number;
  approvalOverdue: number;
  pickupOverdue: number;
}

export interface OrderDetail {
  order: OrderListItem;
  customer?: Customer;
  device?: Device;
  supplier?: Supplier;
  events: OrderEvent[];
  messages: MessageLog[];
}

export interface CreateOrderInput {
  customer_id?: string;
  device_id?: string;
  customer_name?: string;
  customer_phone?: string;
  device_brand?: string;
  device_model?: string;
  device_imei?: string;
  device_notes?: string;
  order_type: RepairOrderType;
  status: RepairOrderStatus;
  issue_description: string;
  technician_name: string;
  internal_tag?: string;
  fault_prices: FaultPriceItem[];
  deposit_amount?: number;
}

export interface RepairDeskOptions {
  suppliers: Supplier[];
  technicians: string[];
}

export interface BatchTransitionResult {
  ok: boolean;
  count: number;
  failures: { id: string; reason: string }[];
}

export interface PaymentResult {
  ok: boolean;
  balance: number;
  is_paid: boolean;
}
