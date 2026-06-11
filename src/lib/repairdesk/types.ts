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
  accessory_notes?: string;
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

export type OrderWhatsappTemplateKind =
  | "approval_request"
  | "pickup_ready"
  | "unfixed_pickup"
  | "parts_update"
  | "repair_status"
  | "cancelled"
  | "completed";

export interface WhatsappNotificationResult {
  ok: boolean;
  id: string;
  channel: "whatsapp";
  body: string;
  template_kind: OrderWhatsappTemplateKind;
  statusChanged: boolean;
  from?: RepairOrderStatus;
  to?: RepairOrderStatus;
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

export interface OrderListPageInput extends OrderListFilters {
  page?: number;
  pageSize?: number;
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

export interface OrderListResult {
  items: OrderListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
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
  accessory_notes?: string;
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
  accessory_notes?: string;
  warranty_text?: string;
  fault_prices: FaultPriceItem[];
  deposit_amount?: number;
}

export interface PatchOrderChanges {
  customer_name?: string;
  customer_phone?: string;
  device_brand?: string;
  device_model?: string;
  device_imei?: string;
  device_notes?: string;
  issue_description?: string;
  diagnosis_result?: string;
  technician_name?: string;
  accessory_notes?: string;
  warranty_text?: string;
}

export interface PatchOrderInput {
  expected_updated_at: string;
  changes: PatchOrderChanges;
}

export interface PatchOrderFinanceInput {
  expected_updated_at: string;
  fault_prices: FaultPriceItem[];
  deposit_amount?: number;
}

export interface PatchOrderResult {
  ok: boolean;
  updated_at: string;
}

export interface CustomerUpdateInput {
  name: string;
  phone_e164: string;
  email?: string;
  contact_phones?: string[];
  promote_contact_phone?: string;
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

export type StaffRole = "owner" | "manager" | "technician" | "sales" | "viewer";
export type StaffStatus = "active" | "inactive";
export type StoreRole = StaffRole;
export type StoreStatus = "active" | "suspended" | "deleted";
export type StorePlan = "starter" | "pro" | "enterprise";
export type StoreMembershipStatus = "active" | "invited" | "inactive";

export interface Store {
  id: string;
  name: string;
  slug: string;
  owner_user_id?: string;
  status: StoreStatus;
  plan: StorePlan;
  timezone: string;
  currency_code: CurrencyCode;
  created_at: string;
  updated_at: string;
}

export interface StoreMembership {
  id: string;
  store_id: string;
  user_id: string;
  email: string;
  display_name?: string;
  role: StoreRole;
  status: StoreMembershipStatus;
  created_at: string;
  updated_at: string;
}

export interface StoreMember {
  id: string;
  user_id: string;
  email: string;
  display_name?: string;
  role: StoreRole;
  status: StoreMembershipStatus;
  created_at: string;
  updated_at: string;
}

export interface StoreInvitation {
  id: string;
  email: string;
  role: StoreRole;
  status: StoreMembershipStatus;
  invited_by?: string;
  accepted_at?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface StoreMembersResult {
  members: StoreMember[];
  invitations: StoreInvitation[];
}

export interface StoreInviteInput {
  email: string;
  role: Exclude<StoreRole, "owner">;
}

export interface ActorStoreMembership {
  id: string;
  name: string;
  slug: string;
  role: StoreRole;
  status: StoreMembershipStatus;
}

export interface StoreContext {
  activeStore?: ActorStoreMembership;
  stores: ActorStoreMembership[];
}

export interface StoreCreateInput {
  name: string;
  timezone?: string;
  currency_code?: CurrencyCode;
}

export interface StaffProfile {
  id: string;
  email: string;
  display_name: string;
  role: StaffRole;
  status: StaffStatus;
  created_at: string;
  updated_at: string;
}

export interface AuditActor {
  id?: string;
  email?: string;
  displayName: string;
  role?: StaffRole;
  storeId?: string;
  storeName?: string;
  storeRole?: StoreRole;
  stores?: ActorStoreMembership[];
  isSystem?: boolean;
}

export interface AuditLogEntry {
  id: string;
  actor_id?: string;
  actor_email?: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_data?: Record<string, unknown>;
  after_data?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type InventoryItemStatus =
  | "intake"
  | "evaluating"
  | "offer_made"
  | "purchased"
  | "data_wipe"
  | "refurbishing"
  | "ready_for_sale"
  | "listed"
  | "reserved"
  | "sold"
  | "cancelled"
  | "returned"
  | "recycled";

export type InventoryCosmeticGrade =
  | "unknown"
  | "new"
  | "mint"
  | "good"
  | "fair"
  | "poor"
  | "for_parts";

export type InventoryFunctionalGrade =
  | "untested"
  | "passed"
  | "needs_repair"
  | "failed"
  | "for_parts";

export type InventoryCheckStatus = "unchecked" | "pass" | "fail" | "unknown";

export type InventoryTransactionType =
  | "buyback_payment"
  | "sale_payment"
  | "refund"
  | "repair_cost"
  | "fee"
  | "adjustment";

export interface InventoryItem {
  id: string;
  public_no: string;
  status: InventoryItemStatus;
  source_type: string;
  source_ref?: string;
  legacy_source?: string;
  customer_id?: string;
  buyer_customer_id?: string;
  category: string;
  brand: string;
  model: string;
  color?: string;
  storage_capacity?: string;
  serial_or_imei?: string;
  imei_check_status: InventoryCheckStatus;
  activation_lock_status: InventoryCheckStatus;
  data_wipe_status: InventoryCheckStatus;
  cosmetic_grade: InventoryCosmeticGrade;
  functional_grade: InventoryFunctionalGrade;
  battery_health?: number;
  buyback_price: number;
  list_price: number;
  sale_price: number;
  deposit_amount: number;
  repair_cost_amount: number;
  fees_amount: number;
  currency_code: CurrencyCode;
  payment_method?: string;
  sale_channel?: string;
  warranty_months: number;
  warranty_until?: string;
  purchased_at?: string;
  listed_at?: string;
  sold_at?: string;
  returned_at?: string;
  recycled_at?: string;
  cancelled_at?: string;
  notes?: string;
  legacy_payload: Record<string, unknown>;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryListItem extends InventoryItem {
  customer_name?: string;
  customer_phone?: string;
  buyer_name?: string;
  buyer_phone?: string;
  item_label: string;
  profit: number;
}

export interface InventoryListFilters {
  search?: string;
  statuses?: InventoryItemStatus[];
  categories?: string[];
  saleChannel?: string;
}

export interface InventoryListResult {
  items: InventoryListItem[];
  total: number;
}

export interface InventoryStats {
  total: number;
  inPipeline: number;
  readyOrListed: number;
  reserved: number;
  sold: number;
  buybackCost: number;
  listedValue: number;
  realizedProfit: number;
}

export interface InventoryQualityCheck {
  id: string;
  item_id: string;
  screen_status: InventoryCheckStatus;
  touch_status: InventoryCheckStatus;
  camera_status: InventoryCheckStatus;
  buttons_status: InventoryCheckStatus;
  ports_status: InventoryCheckStatus;
  speaker_status: InventoryCheckStatus;
  microphone_status: InventoryCheckStatus;
  wifi_status: InventoryCheckStatus;
  bluetooth_status: InventoryCheckStatus;
  cellular_status: InventoryCheckStatus;
  battery_health?: number;
  cosmetic_grade: InventoryCosmeticGrade;
  functional_grade: InventoryFunctionalGrade;
  imei_check_status: InventoryCheckStatus;
  activation_lock_status: InventoryCheckStatus;
  data_wipe_status: InventoryCheckStatus;
  notes?: string;
  checked_by?: string;
  checked_at: string;
  created_at: string;
}

export interface InventoryTransaction {
  id: string;
  item_id: string;
  transaction_type: InventoryTransactionType;
  amount: number;
  currency_code: CurrencyCode;
  method?: string;
  note?: string;
  actor_id?: string;
  created_at: string;
}

export interface InventoryEvent {
  id: string;
  item_id: string;
  event_type: string;
  from_status?: InventoryItemStatus;
  to_status?: InventoryItemStatus;
  payload: Record<string, unknown>;
  operator_user_id?: string;
  operator_name: string;
  operator_email?: string;
  created_at: string;
}

export interface InventoryDetail {
  item: InventoryListItem;
  customer?: Customer;
  buyer?: Customer;
  checks: InventoryQualityCheck[];
  transactions: InventoryTransaction[];
  events: InventoryEvent[];
}

export interface CreateInventoryIntakeInput {
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  category?: string;
  brand: string;
  model: string;
  color?: string;
  storage_capacity?: string;
  serial_or_imei?: string;
  buyback_price?: number;
  list_price?: number;
  deposit_amount?: number;
  payment_method?: string;
  notes?: string;
}

export interface UpdateInventoryItemInput {
  category?: string;
  brand?: string;
  model?: string;
  color?: string;
  storage_capacity?: string;
  serial_or_imei?: string;
  buyback_price?: number;
  list_price?: number;
  sale_price?: number;
  deposit_amount?: number;
  repair_cost_amount?: number;
  fees_amount?: number;
  payment_method?: string;
  sale_channel?: string;
  warranty_months?: number;
  notes?: string;
}

export interface InventoryTransitionInput {
  to: InventoryItemStatus;
  reason?: string;
}

export interface InventoryQualityCheckInput {
  screen_status?: InventoryCheckStatus;
  touch_status?: InventoryCheckStatus;
  camera_status?: InventoryCheckStatus;
  buttons_status?: InventoryCheckStatus;
  ports_status?: InventoryCheckStatus;
  speaker_status?: InventoryCheckStatus;
  microphone_status?: InventoryCheckStatus;
  wifi_status?: InventoryCheckStatus;
  bluetooth_status?: InventoryCheckStatus;
  cellular_status?: InventoryCheckStatus;
  battery_health?: number;
  cosmetic_grade?: InventoryCosmeticGrade;
  functional_grade?: InventoryFunctionalGrade;
  imei_check_status?: InventoryCheckStatus;
  activation_lock_status?: InventoryCheckStatus;
  data_wipe_status?: InventoryCheckStatus;
  notes?: string;
}

export interface InventoryTransactionInput {
  transaction_type: InventoryTransactionType;
  amount: number;
  method?: string;
  note?: string;
}

export interface SellInventoryItemInput {
  buyer_customer_id?: string;
  buyer_name?: string;
  buyer_phone?: string;
  sale_price: number;
  deposit_amount?: number;
  payment_method?: string;
  sale_channel?: string;
  warranty_months?: number;
  sold_at?: string;
  notes?: string;
}

export interface ElectronicsImportWarning {
  row: number;
  field: string;
  message: string;
  value?: string;
}

export interface ElectronicsImportReport {
  totalRows: number;
  importedRows: number;
  itemCount: number;
  customerCount: number;
  transactionCount: number;
  eventCount: number;
  totalBuyback: number;
  totalListPrice: number;
  totalSalePrice: number;
  warnings: ElectronicsImportWarning[];
}

export interface ElectronicsImportPreview {
  items: Record<string, unknown>[];
  customers: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  events: Record<string, unknown>[];
  report: ElectronicsImportReport;
}

export type MessageTemplateDomain = "order" | "customer";
export type MessageTemplateChannel = "whatsapp" | "sms";
export type MessageTemplateLanguage = "it" | "zh" | "en";

export interface StoreSettings {
  id: string;
  store_id?: string;
  store_name: string;
  store_address: string;
  store_phone: string;
  store_whatsapp: string;
  store_email: string;
  default_order_warranty_text: string;
  default_inventory_warranty_months: number;
  print_footer: string;
  message_signature: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface StoreSettingsUpdateInput {
  store_name?: string;
  store_address?: string;
  store_phone?: string;
  store_whatsapp?: string;
  store_email?: string;
  default_order_warranty_text?: string;
  default_inventory_warranty_months?: number;
  print_footer?: string;
  message_signature?: string;
}

export interface MessageTemplate {
  id: string;
  store_id?: string;
  domain: MessageTemplateDomain;
  kind: string;
  channel: MessageTemplateChannel;
  language: MessageTemplateLanguage;
  label: string;
  body_template: string;
  enabled: boolean;
  sort_order: number;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplateUpdateInput {
  label?: string;
  body_template?: string;
  enabled?: boolean;
}

export interface MessageTemplatePreviewInput {
  templateId?: string;
  bodyTemplate?: string;
  context?: Record<string, unknown>;
}

export interface MessageTemplatePreviewResult {
  body: string;
  variables: string[];
}
