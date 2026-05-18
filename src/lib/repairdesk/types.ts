import type { ApprovalStatus, RepairOrderStatus, RepairOrderType } from "@/lib/mock/enums";
import type { CurrencyCode } from "@/lib/money";

export interface Customer {
  id: string;
  name: string;
  phone_e164: string;
  phone_raw: string;
  contact_phones: string[];
  consent_marketing: boolean;
  consent_sms: boolean;
  email?: string;
  preferred_channel?: "whatsapp" | "sms";
  language?: "it" | "zh" | "en";
  notes?: string;
  marketing_notes?: string;
  last_contacted_at?: string;
  blacklisted_at?: string;
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
  currency_code?: CurrencyCode;
  note?: string;
}

export interface DeviceSnapshot {
  brand: string;
  model: string;
  serial_or_imei: string;
  device_notes?: string;
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
  currency_code: CurrencyCode;
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
  device_snapshot?: DeviceSnapshot;
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

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface CustomerInteraction {
  id: string;
  customer_id: string;
  order_id?: string;
  channel: "whatsapp" | "sms";
  direction: "outbound" | "inbound" | "note";
  message_body: string;
  status: "sent" | "delivered" | "read" | "failed";
  operator_name: string;
  created_at: string;
}

export interface CustomerFollowup {
  id: string;
  customer_id: string;
  order_id?: string;
  title: string;
  note?: string;
  due_at: string;
  owner_name?: string;
  status: "open" | "done" | "cancelled";
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerListFilters {
  search?: string;
  tagIds?: string[];
  marketing?: "all" | "allowed" | "blocked";
  followup?: "all" | "due" | "overdue";
}

export interface CustomerListItem extends Customer {
  tags: CustomerTag[];
  device_count: number;
  order_count: number;
  total_spent: number;
  unpaid_amount: number;
  last_order_at?: string;
  next_followup_at?: string;
  latest_device_label?: string;
  device_search_text?: string;
}

export interface CustomerStats {
  total: number;
  repeat: number;
  dueFollowups: number;
  marketable: number;
}

export interface CustomerListResult {
  customers: CustomerListItem[];
  tags: CustomerTag[];
  stats: CustomerStats;
}

export interface CustomerDetail {
  customer: Customer;
  devices: Device[];
  orders: OrderListItem[];
  tags: CustomerTag[];
  interactions: CustomerInteraction[];
  followups: CustomerFollowup[];
  stats: {
    order_count: number;
    total_spent: number;
    unpaid_amount: number;
    device_count: number;
    last_order_at?: string;
    next_followup_at?: string;
  };
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
  warranty_text?: string;
  fault_prices: FaultPriceItem[];
  deposit_amount?: number;
}

export interface UpdateOrderInput {
  customer_name: string;
  customer_phone: string;
  device_brand: string;
  device_model: string;
  device_imei?: string;
  device_notes?: string;
  issue_description: string;
  diagnosis_result?: string;
  technician_name: string;
  internal_tag?: string;
  warranty_text?: string;
  fault_prices: FaultPriceItem[];
  deposit_amount?: number;
}

export interface CustomerUpdateInput {
  name: string;
  phone_e164: string;
  email?: string;
  contact_phones?: string[];
  consent_marketing?: boolean;
  consent_sms?: boolean;
  preferred_channel?: "whatsapp" | "sms";
  language?: "it" | "zh" | "en";
  notes?: string;
  marketing_notes?: string;
  blacklisted?: boolean;
}

export type CustomerCreateInput = CustomerUpdateInput;

export interface CustomerDeviceInput {
  id?: string;
  brand: string;
  model: string;
  serial_or_imei?: string;
  device_notes?: string;
}

export interface CustomerFollowupInput {
  order_id?: string;
  title: string;
  note?: string;
  due_at: string;
  owner_name?: string;
}

export interface CustomerMessageInput {
  channel: "whatsapp" | "sms";
  body: string;
  order_id?: string;
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
