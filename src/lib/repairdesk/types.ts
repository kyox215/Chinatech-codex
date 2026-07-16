import type {
  ApprovalStatus,
  RepairOrderStatus,
  RepairOrderType,
  StatusTone,
} from "@/lib/mock/enums";
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

export interface CustomerHistoryDeviceCandidate {
  id: string;
  customer_id: string;
  source: "customer_device" | "order_history";
  device_id?: string;
  brand: string;
  model: string;
  serial_or_imei: string;
  device_notes?: string;
  last_seen_at?: string;
  order_id?: string;
  order_public_no?: string;
}

export interface CustomerIntakeCandidate {
  customer: Customer;
  exactMatch: boolean;
  historyDevices: CustomerHistoryDeviceCandidate[];
}

export interface Supplier {
  id: string;
  name: string;
  short_name: string;
  color: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
  archived_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupplierInput {
  name: string;
  short_name?: string;
  color?: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
}

export type StorePermissionAction =
  | "supplier:read"
  | "supplier:assign"
  | "supplier:manage"
  | "order:archive_browse"
  | "finance:aggregate_read"
  | "finance:profit_read";

export type OrderWorkflowStatusCode =
  | "intake"
  | "diagnosis"
  | "quote"
  | "parts"
  | "repair"
  | "pickup"
  | "closed";

export type OrderExceptionStatus =
  | "cancelled"
  | "unrepairable"
  | "returned_unfixed"
  | "rework"
  | "waiting_customer"
  | "paused";

export type OrderPaymentStatus = "unpaid" | "partial" | "paid" | "refunded";

export type OrderApprovalFlowStatus = "not_required" | "waiting_customer" | "approved" | "rejected";

export type OrderPartsStatus = "not_required" | "needed" | "ordered" | "arrived" | "out_of_stock";

export type OrderNotifyStatus = "not_sent" | "sent" | "contacted";

export type OrderWorkflowBucket =
  | "intake"
  | "diagnosing"
  | "quote"
  | "parts"
  | "repair"
  | "pickup"
  | "done"
  | "cancelled"
  | "custom";

export type OrderWorkflowTone = StatusTone;

export interface OrderWorkflowStatus {
  id: string;
  store_id: string;
  code: RepairOrderStatus;
  label: string;
  short_label: string;
  tone: OrderWorkflowTone;
  bucket: OrderWorkflowBucket;
  sort_order: number;
  enabled: boolean;
  show_in_order_filters: boolean;
  allowed_for_create: boolean;
  is_default_create_status: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderWorkflowTransition {
  id: string;
  store_id: string;
  from_status_code: RepairOrderStatus;
  to_status_code: RepairOrderStatus;
  is_primary: boolean;
  sort_order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderWorkflow {
  statuses: OrderWorkflowStatus[];
  transitions: OrderWorkflowTransition[];
}

export interface OrderWorkflowStatusCreateInput {
  code: string;
  label: string;
  short_label?: string;
  tone: OrderWorkflowTone;
  bucket: OrderWorkflowBucket;
  sort_order?: number;
  enabled?: boolean;
  show_in_order_filters?: boolean;
  allowed_for_create?: boolean;
  is_default_create_status?: boolean;
}

export interface OrderWorkflowStatusUpdateInput {
  label?: string;
  short_label?: string;
  tone?: OrderWorkflowTone;
  bucket?: OrderWorkflowBucket;
  sort_order?: number;
  enabled?: boolean;
  show_in_order_filters?: boolean;
  allowed_for_create?: boolean;
  is_default_create_status?: boolean;
}

export interface OrderWorkflowStatusReorderInput {
  items: { id: string; sort_order: number }[];
}

export interface OrderWorkflowStatusEnabledInput {
  id: string;
  enabled: boolean;
}

export interface OrderWorkflowTransitionsUpdateInput {
  from_status_code: RepairOrderStatus;
  transitions: {
    to_status_code: RepairOrderStatus;
    enabled: boolean;
    is_primary?: boolean;
    sort_order?: number;
  }[];
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

export type DeviceUnlockMethod = "text" | "pin" | "pattern";

export type DeviceUnlockInput =
  | { method: "none" }
  | { method: "text"; value: string }
  | { method: "pin"; value: string }
  | { method: "pattern"; pattern: number[] };

export interface RepairOrder {
  id: string;
  public_no: string;
  order_type: RepairOrderType;
  status: RepairOrderStatus;
  legacy_status?: RepairOrderStatus;
  workflow_status?: OrderWorkflowStatusCode;
  exception_status?: OrderExceptionStatus;
  payment_status?: OrderPaymentStatus;
  approval_flow_status?: OrderApprovalFlowStatus;
  parts_status?: OrderPartsStatus;
  notify_status?: OrderNotifyStatus;
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
  assignee_membership_id?: string;
  internal_tag?: string;
  accessory_notes?: string;
  warranty_text?: string;
  warranty_months?: number;
  warranty_change_reason?: string;
  warranty_changed_by?: string;
  warranty_changed_at?: string;
  completed_at?: string;
  delivered_at?: string;
  pause_reason?: string;
  cancel_reason?: string;
  supplier_id?: string;
  parts_supplier_id?: string;
  original_order_id?: string;
  contact_phones: string[];
  fault_prices: FaultPriceItem[];
  device_snapshot?: DeviceSnapshot;
  device_unlock_method?: DeviceUnlockMethod;
  device_unlock_value?: string;
  device_unlock_pattern?: number[];
  customer_signature?: string;
  finance_redacted?: boolean;
  customer_contact_redacted?: boolean;
  sensitive_redacted?: boolean;
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

export type OrderAttachmentKind =
  | "device_front"
  | "device_back"
  | "screen_on"
  | "fault_photo"
  | "signature"
  | "other";

export interface OrderAttachment {
  id: string;
  store_id: string;
  order_id: string;
  kind: OrderAttachmentKind;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_bucket: string;
  storage_path: string;
  public_url?: string;
  signed_url?: string;
  note?: string;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderAttachmentUploadInput {
  kind: OrderAttachmentKind;
  file_name: string;
  mime_type: string;
  file_size: number;
  data_base64: string;
  note?: string;
}

export interface OrderAttachmentUploadResult {
  attachment: OrderAttachment;
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
  recipient_phone?: string;
  statusChanged: boolean;
  from?: RepairOrderStatus;
  to?: RepairOrderStatus;
}

export interface OrderApprovalDecisionInput {
  decision: "approved" | "rejected";
  next_status?: RepairOrderStatus;
  reason?: string;
}

export interface OrderApprovalDecisionResult {
  ok: boolean;
  decision: "approved" | "rejected";
  from: RepairOrderStatus;
  to: RepairOrderStatus;
  approval_flow_status: OrderApprovalFlowStatus;
}

export interface OrderListFilters {
  search?: string;
  view?: OrderListView;
  statuses?: RepairOrderStatus[];
  workflowStatuses?: OrderWorkflowStatusCode[];
  queueGroups?: OrderQueueGroup[];
  exceptionStatuses?: OrderExceptionStatus[];
  paymentStatuses?: OrderPaymentStatus[];
  partsStatuses?: OrderPartsStatus[];
  approvalFlowStatuses?: OrderApprovalFlowStatus[];
  types?: RepairOrderType[];
  technicians?: string[];
  supplierIds?: string[];
  paid?: "all" | "paid" | "unpaid";
  overdue?: "approval" | "pickup" | "any";
}

export type OrderListView = "active" | "archive" | "all";
export type OrderQueueGroup =
  | "processing"
  | "ordered"
  | "arrived"
  | "arrived_notified"
  | "repaired"
  | "repaired_notified";
export type OrderResultGroup = OrderQueueGroup | "completed" | "cancelled";

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
  workflowCounts: Record<OrderWorkflowStatusCode | "all", number>;
  queueCounts: Record<OrderQueueGroup | "all", number>;
  resultGroupCounts: Record<OrderResultGroup, number>;
}

export type OrderQueueSummaryInput = OrderListPageInput;

export interface OrderQueueSummary {
  list: OrderListResult;
  workflow: OrderWorkflow;
  options: RepairDeskOptions;
  partialErrors?: {
    workflow?: string;
    options?: string;
  };
}

export interface OrderStats {
  total: number;
  today: number;
  inProgress: number;
  unpaid: number;
  approvalOverdue: number;
  pickupOverdue: number;
}

export type OrderDataImportMode = "update_only" | "create_and_update";
export type OrderDataImportAction = "create" | "update" | "skip";
export type OrderDataImportRowStatus =
  | "ready"
  | "invalid"
  | "applied"
  | "conflict"
  | "failed"
  | "skipped";

export interface OrderDataImportIssue {
  code: string;
  message: string;
  field?: string;
}

export interface OrderDataImportPreviewRow {
  rowNumber: number;
  action: OrderDataImportAction;
  status: OrderDataImportRowStatus;
  orderId?: string;
  publicNo?: string;
  changedFields: string[];
  warnings: OrderDataImportIssue[];
  errors: OrderDataImportIssue[];
}

export interface OrderDataImportPreview {
  batchId: string;
  storeId: string;
  templateVersion: string;
  mode: OrderDataImportMode;
  expiresAt: string;
  summary: {
    total: number;
    ready: number;
    create: number;
    update: number;
    invalid: number;
    skipped: number;
  };
  rows: OrderDataImportPreviewRow[];
}

export interface OrderDataImportApplyResult {
  batchId: string;
  status: "applied" | "partial";
  applied: number;
  conflicts: number;
  failed: number;
  skipped: number;
  rows?: {
    rowNumber: number;
    status: "applied" | "conflict" | "failed" | "skipped";
    errors: OrderDataImportIssue[];
  }[];
}

export interface DashboardSummaryInput {
  limit?: number;
}

export type DashboardPriorityCoverage = "store" | "assigned";
export type DashboardPriorityTier = "overdue" | "ready" | "active" | "waiting";
export type DashboardPriorityReasonCode =
  | "approval_overdue"
  | "pickup_overdue"
  | "rework"
  | "repaired_ready"
  | "parts_arrived"
  | "workflow_action_ready"
  | "waiting_customer"
  | "waiting_parts"
  | "external_repair"
  | "waiting_pickup"
  | "paused"
  | "unrepairable"
  | "other_active";
export type DashboardPriorityAssigneeState = "assigned" | "unassigned" | "unavailable";

export interface DashboardPriorityItem {
  rank: number;
  orderId: string;
  publicNo: string;
  customerName: string;
  deviceLabel: string;
  tier: DashboardPriorityTier;
  reasonCode: DashboardPriorityReasonCode;
  reasonLabel: string;
  reasonDescription: string;
  currentStep: string;
  nextStep: string;
  assigneeLabel: string;
  assigneeState: DashboardPriorityAssigneeState;
  isMine: boolean;
  isOverdue: boolean;
  isActionable: boolean;
  updatedAt: string;
  action: {
    kind: "open_task";
    label: string;
    href: string;
  };
  detailHref: string;
}

export interface DashboardSummary {
  coverage: DashboardPriorityCoverage;
  policyVersion: "dashboard-priority-v1";
  generatedAt: string;
  totalCandidates: number;
  hasMore: boolean;
  counts: {
    overdue: number;
    ready: number;
    active: number;
    waiting: number;
  };
  items: DashboardPriorityItem[];
}

export interface OrderDetail {
  order: OrderListItem;
  customer?: Customer;
  device?: Device;
  supplier?: Supplier;
  parts_supplier?: Supplier;
  events: OrderEvent[];
  messages: MessageLog[];
  attachments: OrderAttachment[];
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
  work?: "all" | "active" | "unpaid" | "with_devices" | "repeat";
  marketing?: "all" | "allowed" | "blocked";
  followup?: "all" | "due" | "overdue";
}

export interface CustomerListPageInput extends CustomerListFilters {
  page?: number;
  pageSize?: number;
}

export interface CustomerListItem extends Customer {
  tags: CustomerTag[];
  device_count: number;
  order_count: number;
  active_order_count: number;
  total_spent?: number;
  unpaid_amount?: number;
  finance_redacted?: boolean;
  last_order_at?: string;
  next_followup_at?: string;
  latest_device_label?: string;
  device_search_text?: string;
}

export interface CustomerStats {
  total: number;
  repeat: number;
  activeRepairs: number;
  unpaid: number;
  withDevices: number;
  dueFollowups: number;
  marketable: number;
}

export interface CustomerListResult {
  customers: CustomerListItem[];
  tags: CustomerTag[];
  stats: CustomerStats;
}

export interface CustomerListPageResult {
  items: CustomerListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
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
    total_spent?: number;
    unpaid_amount?: number;
    finance_redacted?: boolean;
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
  internal_tag?: string;
  accessory_notes?: string;
  device_unlock?: DeviceUnlockInput;
  warranty_text?: string;
  warranty_months?: number;
  warranty_change_reason?: string;
  fault_prices: FaultPriceItem[];
  deposit_amount?: number;
  assignee_membership_id?: string;
}

export interface UpdateOrderInput {
  expected_updated_at: string;
  customer_name: string;
  customer_phone: string;
  device_brand: string;
  device_model: string;
  device_imei?: string;
  device_notes?: string;
  issue_description: string;
  diagnosis_result?: string;
  internal_tag?: string;
  accessory_notes?: string;
  device_unlock?: DeviceUnlockInput;
  warranty_text?: string;
  warranty_months?: number;
  warranty_change_reason?: string;
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
  accessory_notes?: string;
  device_unlock?: DeviceUnlockInput;
  warranty_text?: string;
  parts_supplier_id?: string | null;
  assignee_membership_id?: string | null;
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
  assigneeOptions?: OrderAssigneeOption[];
  permissions: {
    canReadSuppliers: boolean;
    canAssignSuppliers: boolean;
    canManageSuppliers: boolean;
    canReadInventory?: boolean;
    canSearchOrderArchive?: boolean;
    canBrowseOrderArchive?: boolean;
    canReadOrderFinance?: boolean;
    canReadAggregateFinance?: boolean;
    canReadProfit?: boolean;
    canExportOrders?: boolean;
    canBatchTransitionOrders?: boolean;
    canAssignOrders?: boolean;
  };
}

export interface OrderAssigneeOption {
  id: string;
  display_name: string;
  role: StoreRole;
}

export interface BatchTransitionResult {
  ok: boolean;
  count: number;
  failures: { id: string; reason: string }[];
}

export interface PaymentResult {
  ok: boolean;
  code?: "recorded" | "idempotent_replay";
  payment_id?: string;
  balance: number;
  is_paid: boolean;
  updated_at?: string;
}

export type StaffRole = "owner" | "manager" | "technician" | "sales" | "viewer";
export type StaffStatus = "active" | "inactive";
export type StoreRole = StaffRole;
export type StoreStatus = "active" | "suspended" | "deleted";
export type StorePlan = "starter" | "pro" | "enterprise";
export type StoreMembershipStatus = "active" | "invited" | "inactive";
export type PlatformAdminStatus = "active" | "inactive";
export type OnboardingRequestType = "create_store" | "join_store";
export type OnboardingRequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type OnboardingReviewScope = "platform" | "store";
export type ApprovedStoreRole = Exclude<StoreRole, "owner">;

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
  permission_grants?: StorePermissionAction[];
  created_at: string;
  updated_at: string;
}

export interface StoreInvitation {
  id: string;
  store_id?: string;
  store_name?: string;
  email: string;
  role: StoreRole;
  status: StoreMembershipStatus;
  invited_by?: string;
  accepted_at?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface StoreInviteLink {
  id: string;
  store_id?: string;
  store_name?: string;
  label?: string;
  role: StoreRole;
  status: StoreMembershipStatus;
  expires_at: string;
  max_uses?: number;
  used_count: number;
  created_by?: string;
  revoked_by?: string;
  revoked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StoreMembersResult {
  members: StoreMember[];
  invitations: StoreInvitation[];
  invite_links?: StoreInviteLink[];
}

export interface StoreInviteInput {
  email: string;
  role: Exclude<StoreRole, "owner">;
}

export interface StoreMemberRoleUpdateInput {
  id: string;
  role: Exclude<StoreRole, "owner">;
}

export interface StoreMemberDecisionInput {
  id: string;
}

export interface StoreMemberPermissionUpdateInput {
  id: string;
  permissions: StorePermissionAction[];
}

export interface StoreInviteLinkCreateInput {
  label?: string;
  role: Exclude<StoreRole, "owner">;
  expires_in_days?: number;
  max_uses?: number;
}

export interface StoreInviteLinkCreateResult {
  link: StoreInviteLink;
  code: string;
}

export interface StoreInvitationDecisionInput {
  id: string;
}

export interface StoreInviteLinkDecisionInput {
  id: string;
}

export interface StoreInviteLinkRedeemInput {
  code: string;
}

export interface ActorStoreMembership {
  id: string;
  membershipId?: string;
  name: string;
  slug: string;
  role: StoreRole;
  status: StoreMembershipStatus;
}

export interface StoreContext {
  activeStore?: ActorStoreMembership;
  stores: ActorStoreMembership[];
  permissions?: {
    canReadSuppliers: boolean;
    canAssignSuppliers: boolean;
    canManageSuppliers: boolean;
    canReadInventory?: boolean;
    canManageOrderData?: boolean;
    canApplyOrderData?: boolean;
    canSearchOrderArchive?: boolean;
    canBrowseOrderArchive?: boolean;
    canReadOrderFinance?: boolean;
    canReadAggregateFinance?: boolean;
    canReadProfit?: boolean;
    canExportOrders?: boolean;
  };
}

export interface StoreCreateInput {
  name: string;
  timezone?: string;
  currency_code?: CurrencyCode;
}

export interface PlatformAdmin {
  user_id: string;
  email: string;
  display_name?: string;
  status: PlatformAdminStatus;
  created_at: string;
  updated_at: string;
}

export interface OnboardingStoreOption {
  id: string;
  name: string;
  slug: string;
}

export interface OnboardingRequest {
  id: string;
  requester_user_id: string;
  email: string;
  display_name?: string;
  request_type: OnboardingRequestType;
  desired_store_name?: string;
  target_store_id?: string;
  target_store_name?: string;
  target_owner_email?: string;
  request_note?: string;
  review_scope: OnboardingReviewScope;
  requested_role: StoreRole;
  approved_role?: ApprovedStoreRole;
  status: OnboardingRequestStatus;
  reviewed_by?: string;
  reviewed_by_membership_id?: string;
  reviewed_at?: string;
  decision_note?: string;
  resulting_store_id?: string;
  created_at: string;
  updated_at: string;
}

export interface OnboardingStatus {
  userId?: string;
  email?: string;
  emailVerified?: boolean;
  displayName: string;
  phoneE164?: string | null;
  phoneVerifiedAt?: string | null;
  isPlatformAdmin: boolean;
  activeStore?: ActorStoreMembership;
  stores: ActorStoreMembership[];
  requests: OnboardingRequest[];
  invitations?: StoreInvitation[];
  availableStores: OnboardingStoreOption[];
}

export interface AccountProfileUpdateInput {
  display_name: string;
  phone_e164?: string | null;
}

export interface OnboardingRequestInput {
  request_type: OnboardingRequestType;
  desired_store_name?: string;
  target_store_id?: string;
  target_owner_email?: string;
  note?: string;
  requested_role?: Exclude<StoreRole, "owner">;
}

export interface OnboardingDecisionInput {
  id: string;
  note?: string;
  target_store_id?: string;
  approved_role?: ApprovedStoreRole;
}

export interface StaffProfile {
  id: string;
  email: string;
  display_name: string;
  phone_e164?: string | null;
  phone_verified_at?: string | null;
  role: StaffRole;
  status: StaffStatus;
  created_at: string;
  updated_at: string;
}

export interface AuditActor {
  id?: string;
  email?: string;
  emailVerified?: boolean;
  displayName: string;
  phoneE164?: string | null;
  phoneVerifiedAt?: string | null;
  role?: StaffRole;
  isPlatformAdmin?: boolean;
  storeId?: string;
  storeName?: string;
  storeRole?: StoreRole;
  activeMembershipId?: string;
  permissionGrants?: StorePermissionAction[];
  stores?: ActorStoreMembership[];
  activeStoreExplicit?: boolean;
  requestIpHash?: string;
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
  finance_redacted?: boolean;
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
  sourceTypes?: string[];
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
  buybackCost?: number;
  listedValue?: number;
  realizedProfit?: number;
  finance_redacted?: boolean;
}

export interface InventorySummary {
  list: InventoryListResult;
  stats: InventoryStats;
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

export type InventoryAttachmentKind =
  | "device_photo"
  | "id_front"
  | "id_back"
  | "signature"
  | "invoice_photo"
  | "box_photo"
  | "other";

export interface InventoryAttachment {
  id: string;
  store_id: string;
  item_id: string;
  kind: InventoryAttachmentKind;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_bucket: string;
  storage_path: string;
  public_url?: string;
  signed_url?: string;
  note?: string;
  uploaded_by?: string;
  sensitivity?: "internal" | "restricted";
  evidence_status?: "staged" | "bound" | "rejected" | "deleted";
  sha256?: string;
  agreement_hash?: string;
  agreement_id?: string;
  staging_expires_at?: string;
  retention_until?: string;
  legal_hold_until?: string;
  bound_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryAttachmentUploadInput {
  kind: InventoryAttachmentKind;
  file_name: string;
  mime_type: string;
  file_size: number;
  data_base64: string;
  note?: string;
  agreement_hash?: string;
}

export interface InventoryAttachmentUploadResult {
  attachment: InventoryAttachment;
}

export interface InventoryAttachmentAccessResult {
  attachment_id: string;
  signed_url: string;
  expires_at: string;
}

export type BuybackDocumentType =
  | "id_card"
  | "passport"
  | "residence_permit"
  | "driver_license"
  | "other";

export interface BuybackFinalizeInput {
  expected_updated_at: string;
  idempotency_key: string;
  item_patch: UpdateInventoryItemInput;
  quality_check: InventoryQualityCheckInput;
  agreement_snapshot: Record<string, unknown>;
  agreement_hash: string;
  agreement_version: string;
  privacy_notice_version: string;
  language: string;
  document_type: BuybackDocumentType;
  document_no_last4: string;
  signature_attachment_id: string;
  evidence_attachment_ids: string[];
  payment_method?: string;
}

export interface BuybackFinalizeResult {
  ok: true;
  code: "finalized" | "idempotent_replay";
  item_id: string;
  agreement_id: string;
  payment_id: string;
  updated_at: string;
}

export interface InventoryDetail {
  item: InventoryListItem;
  customer?: Customer;
  buyer?: Customer;
  checks: InventoryQualityCheck[];
  transactions: InventoryTransaction[];
  events: InventoryEvent[];
  attachments: InventoryAttachment[];
}

export interface CreateInventoryIntakeInput {
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  source_type?: string;
  initial_status?: InventoryItemStatus;
  category?: string;
  brand: string;
  model: string;
  color?: string;
  storage_capacity?: string;
  serial_or_imei?: string;
  quoted_offer?: number;
  quote_expires_at?: string;
  quote_payload?: Record<string, unknown>;
  buyback_price?: number;
  list_price?: number;
  repair_cost_amount?: number;
  deposit_amount?: number;
  payment_method?: string;
  warranty_months?: number;
  notes?: string;
}

export interface UpdateInventoryItemInput {
  customer_name?: string;
  customer_phone?: string;
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
  quote_payload?: Record<string, unknown>;
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
  expected_updated_at?: string;
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
  warranty_terms_snapshot?: string[];
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
  default_order_warranty_months: number;
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
  default_order_warranty_months?: number;
  default_inventory_warranty_months?: number;
  print_footer?: string;
  message_signature?: string;
}

export type KioskDeviceStatus = "pairing" | "active" | "suspended" | "revoked";
export type KioskSessionType = "intake_contact" | "order_contact_signature" | "pickup_signature";
export type KioskSessionStatus =
  | "queued"
  | "active"
  | "submitted"
  | "accepted"
  | "returned"
  | "cancelled"
  | "expired";

export interface KioskDevice {
  id: string;
  store_id: string;
  label: string;
  status: KioskDeviceStatus;
  last_seen_at?: string;
  paired_at?: string;
  pairing_code_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface KioskDevicePairingInput {
  label: string;
}

export interface KioskDevicePairingResult {
  device: KioskDevice;
  pairing_code: string;
  expires_at: string;
}

export interface KioskSession {
  id: string;
  store_id: string;
  device_id: string;
  order_id?: string;
  customer_id?: string;
  session_type: KioskSessionType;
  status: KioskSessionStatus;
  request_payload: Record<string, unknown>;
  submission_payload?: Record<string, unknown>;
  submission_version: number;
  expires_at: string;
  submitted_at?: string;
  accepted_at?: string;
  cancelled_at?: string;
  returned_at?: string;
  created_at: string;
  updated_at: string;
  device?: KioskDevice;
}

export interface KioskSessionCreateInput {
  device_id: string;
  session_type: KioskSessionType;
  order_id?: string;
  customer_id?: string;
  request_payload?: Record<string, unknown>;
  expires_in_minutes?: number;
}

export interface KioskSessionSubmitInput {
  customer_name?: string;
  customer_phone?: string;
  backup_phone?: string;
  preferred_channel?: "whatsapp" | "sms";
  language?: "it" | "zh" | "en";
  confirmation_checked?: boolean;
  signature_data_url?: string;
  note?: string;
}

export interface KioskSessionReturnInput {
  id: string;
  reason: string;
}

export interface KioskPublicSession {
  session: Pick<
    KioskSession,
    "id" | "session_type" | "status" | "request_payload" | "expires_at" | "submitted_at"
  >;
  device: Pick<KioskDevice, "id" | "label" | "status">;
  store: {
    name: string;
  };
  order?: {
    id: string;
    public_no: string;
    customer_name?: string;
    customer_phone?: string;
    device_label?: string;
    balance_amount?: number;
    status?: RepairOrderStatus;
  };
}

export interface KioskPairResult {
  token: string;
  device: KioskDevice;
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
