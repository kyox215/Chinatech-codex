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

export type CustomerIntakePhoneMatchMode = "progressive" | "exact";

export type CustomerIntakePhoneMatchKind =
  | "exact_primary"
  | "exact_alternate"
  | "prefix_primary"
  | "partial_primary"
  | "partial_alternate";

export type CustomerIntakeNameMatchKind = "exact" | "prefix" | "contains" | "none";

export type CustomerIntakeSearchInput =
  | {
      q?: string;
      phone?: never;
      name?: never;
      phoneMatchMode?: never;
      limit?: number;
      deviceLimit?: number;
    }
  | {
      q?: never;
      phone?: string;
      name?: string;
      phoneMatchMode?: CustomerIntakePhoneMatchMode;
      limit?: number;
      deviceLimit?: number;
    };

export type CustomerIntakeNewCustomerPolicy =
  | "allowed"
  | "requires_shared_phone_confirmation"
  | "blocked_missing_name"
  | "blocked_exact_duplicate";

export interface CustomerIntakeCandidate {
  customer: Customer;
  exactMatch: boolean;
  phoneMatchKind?: CustomerIntakePhoneMatchKind;
  nameMatchKind?: CustomerIntakeNameMatchKind;
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
  | "finance:profit_read"
  | "finance:cost_manage"
  | "finance:cost_export"
  | "finance:cost_backfill_preview"
  | "inventory:cost_allocate";

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
  line_id?: string;
  catalog_key?: string;
  name: string;
  price: number;
  currency_code?: CurrencyCode;
  note?: string;
}

export type OrderCostInputMode = "default" | "manual" | "blank";

export interface CreateOrderCostInput {
  line_id: string;
  catalog_key?: string;
  mode: OrderCostInputMode;
  amount?: number;
}

export type OrderLineCostSource =
  | "store_default"
  | "manual"
  | "manual_blank"
  | "historical_unknown"
  | "purchase_lot"
  | "supplier_document"
  | "backfill_estimate";

export type OrderLineCostEvidenceStatus = "unknown" | "estimated" | "confirmed" | "reconciled";

export interface InternalCostCurrencySnapshot {
  original_amount: number;
  original_currency_code: string;
  fx_rate_to_eur: number;
  fx_rate_at?: string;
  fx_rate_source?: string;
}

export interface OrderLineCostItem {
  line_id: string;
  catalog_key?: string;
  name: string;
  cost_amount: number | null;
  source: OrderLineCostSource;
  evidence_status?: OrderLineCostEvidenceStatus;
  currency_snapshot?: InternalCostCurrencySnapshot;
  source_reference_type?: string;
  source_reference_id?: string;
}

export interface OrderLineCostsResult {
  order_id: string;
  version: number;
  currency_code: CurrencyCode;
  items: OrderLineCostItem[];
  unidentified_line_count: number;
}

export type OrderLineCostRevisionKind =
  | "migration_snapshot"
  | "created"
  | "corrected"
  | "activated"
  | "deactivated"
  | "allocated"
  | "reversed"
  | "backfill_applied"
  | "backfill_reverted"
  | "reconciled";

export interface OrderLineCostRevisionItem {
  id: string;
  line_id: string;
  projection_revision: number;
  change_kind: OrderLineCostRevisionKind;
  catalog_key?: string;
  cost_amount: number | null;
  source: OrderLineCostSource;
  evidence_status: OrderLineCostEvidenceStatus;
  is_active: boolean;
  currency_snapshot?: InternalCostCurrencySnapshot;
  source_reference_type?: string;
  source_reference_id?: string;
  reason?: string;
  created_at: string;
}

export interface OrderCostHistoryResult {
  order_id: string;
  items: OrderLineCostRevisionItem[];
}

export interface ProfitPeriodSummary {
  order_count: number;
  eligible_order_count: number;
  quote_amount: number;
  known_cost_amount: number;
  exact_margin_amount: number;
  exact_order_count: number;
  incomplete_order_count: number;
  estimated_order_count: number;
  negative_margin_order_count: number;
}

export interface ProfitCenterSummary {
  expected: ProfitPeriodSummary;
  completed: ProfitPeriodSummary;
  data_quality: {
    unknown_line_count: number;
    refunded_order_count: number;
    rework_order_count: number;
  };
  collection_reference: {
    amount: number;
    entry_count: number;
    non_eur_entry_count: number;
  };
}

export interface ProfitTrendPoint {
  date: string;
  expected_order_count: number;
  expected_quote_amount: number;
  expected_known_cost_amount: number;
  expected_exact_margin_amount: number;
  expected_incomplete_order_count: number;
  completed_order_count: number;
  completed_quote_amount: number;
  completed_known_cost_amount: number;
  completed_exact_margin_amount: number;
  completed_incomplete_order_count: number;
}

export interface ProfitOrderDrilldownItem {
  order_id: string;
  public_no: string;
  status: string;
  exception_status?: string;
  payment_status: OrderPaymentStatus;
  created_at: string;
  completed_at?: string;
  delivered_at?: string;
  quote_amount: number;
  known_cost_amount: number;
  quote_gross_margin: number | null;
  quote_gross_margin_percent: number | null;
  quote_line_count: number;
  unknown_cost_line_count: number;
  estimated_cost_line_count: number;
  confirmed_cost_line_count: number;
  cost_completeness: "incomplete" | "estimated" | "confirmed";
  is_refunded: boolean;
  is_rework: boolean;
  currency_costs?: ProfitCostCurrencyDrilldownItem[];
}

export interface ProfitCostCurrencyDrilldownItem {
  line_id: string;
  line_name: string;
  cost_amount_eur: number;
  original_amount: number;
  original_currency_code: CostCurrencyCode;
  fx_rate_to_eur: number;
  fx_rate_at?: string;
  fx_rate_source?: "store_base" | "owner_manual";
  cost_source: string;
  evidence_status: string;
}

export interface ProfitCenterResult {
  timezone: string;
  start_date: string;
  end_date: string;
  definition: "final_quote_operational_gross_margin";
  summary: ProfitCenterSummary;
  trend: ProfitTrendPoint[];
  orders: ProfitOrderDrilldownItem[];
  breakdowns?: ProfitBreakdowns;
}

export interface ProfitCenterInput {
  start_date: string;
  end_date: string;
}

export interface CostExportInput extends ProfitCenterInput {
  expected_store_id: string;
  statuses?: string[];
  sources?: string[];
  limit?: number;
}

export interface CostExportRow {
  order_public_no: string;
  order_created_date: string;
  order_status: string;
  line_id: string;
  catalog_key?: string;
  line_name: string;
  quote_amount_eur: number;
  cost_amount_eur: number | null;
  cost_source: string;
  evidence_status: string;
  original_amount: number | null;
  original_currency_code?: string;
  fx_rate_to_eur: number | null;
  fx_rate_at?: string;
  fx_rate_source?: string;
  supplier_name?: string;
  margin_amount_eur: number | null;
}

export type CostBackfillRunState =
  | "draft"
  | "previewed"
  | "applying"
  | "applied"
  | "partially_applied"
  | "reverting"
  | "reverted"
  | "revert_partial"
  | "rejected";

export type CostBackfillCandidateStatus =
  | "previewed"
  | "applied"
  | "skipped_conflict"
  | "failed"
  | "reverted"
  | "revert_conflict";

export interface CostBackfillCandidate {
  id: string;
  order_id: string;
  line_ordinal: number;
  planned_line_id: string;
  line_id_was_missing: boolean;
  catalog_key?: string;
  line_name: string;
  proposed_cost_amount: number | null;
  proposed_source: "historical_unknown" | "backfill_estimate";
  proposed_evidence_status: "unknown" | "estimated";
  status: CostBackfillCandidateStatus;
  error_code?: string;
  applied_projection_revision?: number;
  applied_at?: string;
  reverted_at?: string;
}

export interface CostBackfillRunSummary {
  id: string;
  state: CostBackfillRunState;
  start_date: string;
  end_date: string;
  fixture_hash: string;
  candidate_count: number;
  estimated_count: number;
  unknown_count: number;
  applied_count: number;
  conflict_count: number;
  failed_count: number;
  reverted_count: number;
  revert_conflict_count: number;
  created_at: string;
  applied_at?: string;
  reverted_at?: string;
}

export interface CostBackfillRun extends CostBackfillRunSummary {
  store_id: string;
  max_candidates: number;
  candidates: CostBackfillCandidate[];
}

export interface CostBackfillRunsResult {
  runs: CostBackfillRunSummary[];
  selected?: CostBackfillRun;
}

export interface PreviewCostBackfillInput {
  expected_store_id: string;
  start_date: string;
  end_date: string;
  max_candidates: number;
  idempotency_key: string;
}

export interface ApplyCostBackfillInput {
  expected_store_id: string;
  run_id: string;
  expected_fixture_hash: string;
  batch_size: number;
  idempotency_key: string;
}

export interface RevertCostBackfillInput {
  expected_store_id: string;
  run_id: string;
  batch_size: number;
  idempotency_key: string;
}

export interface ProfitBreakdownItem {
  key: string;
  label: string;
  order_count: number;
  line_count: number;
  quote_amount: number;
  known_cost_amount: number;
  exact_margin_amount: number;
  exact_line_count: number;
  incomplete_line_count: number;
}

export interface ProfitBreakdowns {
  categories: ProfitBreakdownItem[];
  suppliers: ProfitBreakdownItem[];
}

export interface PartCatalogItem {
  id: string;
  sku: string;
  name: string;
  catalog_key?: string;
  compatible_models: string[];
  active: boolean;
  weighted_average_unit_cost_eur: number | null;
  available_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface PartPurchaseLot {
  id: string;
  part_item_id: string;
  part_sku: string;
  part_name: string;
  catalog_key?: string;
  supplier_id?: string;
  supplier_name?: string;
  lot_code: string;
  supplier_document_ref?: string;
  received_quantity: number;
  available_quantity: number;
  original_unit_cost: number;
  original_currency_code: string;
  fx_rate_to_eur: number;
  fx_rate_at: string;
  fx_rate_source: string;
  fx_rate_revision?: number;
  unit_cost_eur: number;
  evidence_status: "confirmed" | "reconciled";
  received_at: string;
}

export type CostCurrencyCode = "EUR" | "USD" | "GBP" | "CNY" | "CHF";

export interface CostCurrencyRate {
  currency_code: CostCurrencyCode;
  enabled: boolean;
  rate_to_eur: number | null;
  rate_at?: string;
  rate_source?: "store_base" | "owner_manual";
  revision: number;
  stale: boolean;
}

export interface CostCurrencySettingsResult {
  version: number;
  items: CostCurrencyRate[];
}

export interface UpdateCostCurrencySettingsInput {
  expected_store_id: string;
  expected_version: number;
  items: Array<{
    currency_code: CostCurrencyCode;
    enabled: boolean;
    rate_to_eur: number | null;
    rate_at?: string;
  }>;
}

export interface OrderPartAllocation {
  id: string;
  order_id: string;
  line_id: string;
  lot_id: string;
  part_item_id: string;
  supplier_id?: string;
  quantity: number;
  part_sku: string;
  part_name: string;
  supplier_name?: string;
  unit_cost_eur: number;
  total_cost_eur: number;
  state: "allocated" | "released";
  allocated_at: string;
  released_at?: string;
  release_reason?: string;
}

export interface PartsProcurementResult {
  items: PartCatalogItem[];
  lots: PartPurchaseLot[];
  suppliers: Array<{ id: string; name: string }>;
  allocations: OrderPartAllocation[];
}

export interface CreatePartCatalogItemInput {
  expected_store_id: string;
  sku: string;
  name: string;
  catalog_key?: string;
  compatible_models: string[];
  idempotency_key: string;
}

export interface ReceivePartLotInput {
  expected_store_id: string;
  part_item_id: string;
  supplier_id?: string;
  lot_code: string;
  supplier_document_ref?: string;
  quantity: number;
  original_unit_cost: number;
  original_currency_code: CostCurrencyCode;
  fx_rate_to_eur?: number;
  fx_rate_at?: string;
  fx_rate_source?: string;
  idempotency_key: string;
}

export interface ReceivePartLotResult {
  id: string;
  replayed: boolean;
  unit_cost_eur?: number;
  fx_rate_to_eur?: number;
  fx_rate_at?: string;
  fx_rate_source?: string;
  fx_rate_revision?: number;
}

export interface AllocateOrderPartInput {
  expected_store_id: string;
  line_id: string;
  lot_id: string;
  quantity: number;
  idempotency_key: string;
}

export interface ReleaseOrderPartInput {
  expected_store_id: string;
  allocation_id: string;
  reason: string;
  idempotency_key: string;
}

export interface UpdateOrderLineCostInput {
  line_id: string;
  mode: Exclude<OrderCostInputMode, "default">;
  amount?: number;
}

export interface UpdateOrderLineCostsRequest {
  expected_store_id: string;
  expected_version: number;
  items: UpdateOrderLineCostInput[];
}

export interface StoreFaultCostDefaultItem {
  catalog_key: string;
  catalog_name: string;
  default_cost_amount: number | null;
}

export interface StoreFaultCostDefaultsResult {
  version: number;
  currency_code: CurrencyCode;
  items: StoreFaultCostDefaultItem[];
}

export interface UpdateStoreFaultCostDefaultsRequest {
  expected_store_id: string;
  expected_version: number;
  items: StoreFaultCostDefaultItem[];
}

export type QuotePriceExceptionKind = "free" | "warranty" | "diagnostic_only";

export interface QuotePriceException {
  kind: QuotePriceExceptionKind;
  reason: string;
}

export interface DeviceSnapshot {
  brand: string;
  model: string;
  serial_or_imei: string;
  device_notes?: string;
}

export type DeviceUnlockMethod = "text" | "pin" | "pattern";

export type DeviceCustodyStatus = "with_shop" | "with_customer";

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
  workflow_bucket?: OrderWorkflowBucket;
  customer_id: string;
  customer_name_snapshot?: string;
  customer_phone_snapshot?: string;
  customer_identity_snapshot_source?:
    | "created"
    | "selected"
    | "shared_phone"
    | "backfilled_current_profile";
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
  device_custody_status: DeviceCustodyStatus | null;
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
  record_state?: "active" | "voided";
  voided_at?: string;
  voided_by?: string;
  void_reason?: string;
  deleted_at?: string;
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

export interface PublishOrderQuoteInput {
  expected_updated_at: string;
  idempotency_key: string;
  diagnosis_result: string;
  fault_prices: FaultPriceItem[];
  price_exception?: QuotePriceException;
}

export interface PublishOrderQuoteResult {
  ok: true;
  code: "published" | "idempotent_replay" | "already_published";
  quote_event_id: string;
  updated_at: string;
  quotation_amount: number;
  deposit_amount: number;
  paid_amount: number;
  balance_amount: number;
  is_paid: boolean;
  payment_status: OrderPaymentStatus;
  status: RepairOrderStatus;
  approval_status: ApprovalStatus;
  approval_flow_status: OrderApprovalFlowStatus;
  approval_reset: boolean;
  replayed: boolean;
}

export interface ConfirmOrderQuoteSentInput {
  expected_updated_at: string;
  idempotency_key: string;
  quote_event_id: string;
  message_body: string;
}

export interface ConfirmOrderQuoteSentResult {
  ok: true;
  code: "confirmed" | "idempotent_replay";
  message_id: string;
  quote_event_id: string;
  updated_at: string;
  from: RepairOrderStatus;
  to: RepairOrderStatus;
  replayed: boolean;
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
  searchScope?: "current" | "archive_exact";
  deviceSearch?: string;
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
  financialReview?: "amount_anomaly";
  dateField?: OrderQueryDateField;
  dateFrom?: string;
  dateTo?: string;
  dateTimeZone?: string;
  repairServiceGroups?: OrderRepairServiceGroup[];
  completedOnly?: boolean;
  sortDateField?: OrderQueryDateField;
}

export type OrderQueryDateField = "created_at" | "updated_at" | "completed_at";

export type OrderRepairServiceGroup =
  | "display"
  | "battery"
  | "charging"
  | "camera"
  | "liquid"
  | "mainboard"
  | "system"
  | "back-cover"
  | "face"
  | "speaker"
  | "microphone"
  | "button";

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

export type OrderDataBatchKind = "template" | "order_export" | "customer_stats" | "import";
export type OrderDataBatchStatus =
  | "building"
  | "completed"
  | "previewed"
  | "applying"
  | "applied"
  | "partial"
  | "failed"
  | "expired"
  | "rolled_back"
  | "rollback_partial";

export interface OrderDataBatchSummary {
  id: string;
  storeId: string;
  kind: OrderDataBatchKind;
  mode?: OrderDataImportMode;
  status: OrderDataBatchStatus;
  actorDisplayName?: string;
  createdAt: string;
  previewedAt?: string;
  appliedAt?: string;
  expiresAt: string;
  summary: {
    total?: number;
    ready?: number;
    create?: number;
    update?: number;
    invalid?: number;
    skipped?: number;
    rows?: number;
    applied?: number;
    conflicts?: number;
    failed?: number;
  };
}

export interface OrderDataBatchHistory {
  storeId: string;
  items: OrderDataBatchSummary[];
  hasMore: boolean;
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
  latest_quote_event_id?: string;
  latest_quote_published_at?: string;
  capabilities?: OrderCapabilities;
}

export type OrderCapabilityKey =
  | "editIntake"
  | "editRepair"
  | "adjustFinance"
  | "prepareQuote"
  | "sendQuote"
  | "collectPayment"
  | "transition"
  | "confirmCancelledReturn"
  | "correct"
  | "reopen"
  | "void";

export interface OrderCapabilities {
  canEditIntake: boolean;
  canEditRepair: boolean;
  canAdjustFinance: boolean;
  canPrepareQuote: boolean;
  canSendQuote: boolean;
  canCollectPayment: boolean;
  canTransition: boolean;
  canConfirmCancelledReturn: boolean;
  canCreateKioskSession: boolean;
  canCorrect: boolean;
  canReopen: boolean;
  canVoid: boolean;
  canReadInternalCosts?: boolean;
  canManageInternalCosts?: boolean;
  canAllocatePartsCosts?: boolean;
  blockedReasons?: Partial<Record<OrderCapabilityKey, string>>;
  reopenTargets?: Array<{ code: RepairOrderStatus; label: string }>;
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
  /** All historical orders, including cancelled orders. */
  order_count: number;
  /** Orders that remain valid for operational and financial aggregation. */
  valid_order_count?: number;
  active_order_count: number;
  lifetime_quoted_amount?: number;
  outstanding_amount?: number;
  /** @deprecated Compatibility alias for lifetime_quoted_amount. */
  total_spent?: number;
  /** @deprecated Compatibility alias for outstanding_amount. */
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
  financeRedacted?: boolean;
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
    /** All historical orders, including cancelled orders. */
    order_count: number;
    valid_order_count?: number;
    active_order_count?: number;
    lifetime_quoted_amount?: number;
    outstanding_amount?: number;
    /** @deprecated Compatibility alias for lifetime_quoted_amount. */
    total_spent?: number;
    /** @deprecated Compatibility alias for outstanding_amount. */
    unpaid_amount?: number;
    finance_redacted?: boolean;
    device_count: number;
    last_order_at?: string;
    next_followup_at?: string;
  };
}

export type CustomerIdentityResolution =
  | { mode: "auto" }
  | { mode: "use_existing"; customer_id: string; conflict_token: string }
  | {
      mode: "create_distinct_shared_phone";
      conflict_token: string;
      reason: "family" | "business" | "other";
    };

export interface CreateOrderInput {
  expected_store_id?: string;
  operation_id?: string;
  customer_id?: string;
  device_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_identity_resolution?: CustomerIdentityResolution;
  device_brand?: string;
  device_model?: string;
  device_imei?: string;
  device_notes?: string;
  order_type: RepairOrderType;
  status: RepairOrderStatus;
  issue_description: string;
  internal_tag?: string;
  accessory_notes?: string;
  device_custody_status?: DeviceCustodyStatus;
  device_unlock?: DeviceUnlockInput;
  warranty_text?: string;
  warranty_months?: number;
  warranty_change_reason?: string;
  fault_prices: FaultPriceItem[];
  cost_inputs?: CreateOrderCostInput[];
  deposit_amount?: number;
  assignee_membership_id?: string;
}

export type OrderCreateOperationStatus = { status: "pending" } | { status: "created"; id: string };

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
  internal_tag?: string;
  accessory_notes?: string;
  device_unlock?: DeviceUnlockInput;
  warranty_text?: string;
  warranty_months?: number;
  warranty_change_reason?: string;
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

export interface CorrectTerminalOrderInput {
  expected_updated_at: string;
  idempotency_key: string;
  reason: string;
  changes: Pick<
    PatchOrderChanges,
    | "issue_description"
    | "diagnosis_result"
    | "internal_tag"
    | "accessory_notes"
    | "warranty_text"
    | "warranty_months"
    | "warranty_change_reason"
  >;
}

export interface ReopenOrderInput {
  expected_updated_at: string;
  idempotency_key: string;
  reason: string;
  to_status: RepairOrderStatus;
}

export interface VoidOrderInput {
  expected_updated_at: string;
  idempotency_key: string;
  reason: string;
  confirm_public_no: string;
}

export interface OrderTerminalOperationResult {
  ok: boolean;
  code: "recorded" | "idempotent_replay";
  operation_id: string;
  order_id: string;
  status: RepairOrderStatus;
  record_state: "active" | "voided";
  updated_at: string;
  replayed: boolean;
}

export interface UpdateOrderCustodyInput {
  expected_updated_at: string;
  device_custody_status: DeviceCustodyStatus;
  idempotency_key: string;
  reason?: string;
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
  recipient_phone?: string;
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
    canCreateInventory?: boolean;
    canUpdateInventory?: boolean;
    canSellInventory?: boolean;
    inventoryV2UiEnabled?: boolean;
    inventoryV2CommandsEnabled?: boolean;
    inventoryProductsUiEnabled?: boolean;
    inventoryProductQuickCreateEnabled?: boolean;
    inventoryLifecycleUiEnabled?: boolean;
    canSearchOrderArchive?: boolean;
    canBrowseOrderArchive?: boolean;
    canReadOrderFinance?: boolean;
    canReadAggregateFinance?: boolean;
    canReadProfit?: boolean;
    canReadRepairProfitReports?: boolean;
    canExportRepairCosts?: boolean;
    canPreviewCostBackfill?: boolean;
    canApplyCostBackfill?: boolean;
    canAllocatePartsCosts?: boolean;
    canAllocateInventoryCosts?: boolean;
    canReadCostCurrencies?: boolean;
    canManageCostCurrencies?: boolean;
    canPrintSingleOrders?: boolean;
    canBatchPrintOrders?: boolean;
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
export type StoreInvitationEmailDeliveryStatus = "not_requested" | "pending" | "sent" | "failed";
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
  management?: StoreMemberManagement;
  created_at: string;
  updated_at: string;
}

export interface StoreMemberManagement {
  allowed_roles: ApprovedStoreRole[];
  can_update_role: boolean;
  can_update_permissions: boolean;
  can_disable: boolean;
  can_restore: boolean;
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
  email_delivery_status?: StoreInvitationEmailDeliveryStatus;
  last_email_delivery_attempt_at?: string;
  last_email_delivered_at?: string;
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
  link: StoreInviteLink & { store_id: string };
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
  lifecycle?: StoreLifecycleState;
  isPrimaryOwner?: boolean;
  lifecycleAccess?: StoreLifecycleCapability;
}

export type OrderDataAccessCode =
  | "available"
  | "available_export_only"
  | "feature_disabled"
  | "store_context_required"
  | "owner_role_required"
  | "primary_owner_required"
  | "store_unavailable";

export interface OrderDataAccessCapability {
  code: OrderDataAccessCode;
  can_export: boolean;
  can_apply: boolean;
}

export type StoreLifecyclePhase =
  | "active"
  | "closing"
  | "archived"
  | "purge_scheduled"
  | "purging"
  | "purge_failed"
  | "purged";

export interface StoreLifecycleState {
  store_id: string;
  phase: StoreLifecyclePhase;
  revision: number;
  close_requested_at?: string;
  access_cutoff_at?: string;
  archive_eligible_at?: string;
  archived_at?: string;
  purge_after?: string;
  retention_until?: string;
  legal_hold_until?: string;
}

export type StoreLifecycleBlockerCode =
  | "open_orders"
  | "unsettled_balance"
  | "device_in_custody"
  | "pending_offline_writes"
  | "open_kiosk_sessions"
  | "pending_invitations"
  | "retention_hold"
  | "legal_hold"
  | "storage_manifest_unavailable";

export interface StoreLifecycleBlocker {
  code: StoreLifecycleBlockerCode;
  count?: number;
  amount?: number;
}

export interface StoreLifecyclePreflight {
  id: string;
  store_id: string;
  store_name: string;
  lifecycle: StoreLifecycleState;
  state: "eligible" | "blocked";
  counts: Record<string, number>;
  blockers: StoreLifecycleBlocker[];
  automatic_effects?: {
    pending_invitations: number;
    open_kiosk_sessions: number;
  };
  snapshot_hash: string;
  expires_at: string;
}

export interface StoreLifecycleMutationInput {
  expectedStoreId: string;
  expectedRevision: number;
  operationId: string;
  reauthChallengeId: string;
}

export type StoreLifecycleChallengeKind =
  | "rename"
  | "request_close"
  | "restore"
  | "schedule_purge"
  | "request_purge"
  | "confirm_purge";

export interface StoreLifecycleChallengeInput {
  expectedStoreId: string;
  expectedRevision: number;
  operationKind: StoreLifecycleChallengeKind;
  preflightSnapshotHash?: string;
}

export interface StoreLifecycleChallengeResult {
  id: string;
  store_id: string;
  operation_kind: StoreLifecycleChallengeKind;
  lifecycle_revision: number;
  assurance_level: "aal2";
  expires_at: string;
}

export interface StoreRenameInput extends StoreLifecycleMutationInput {
  name: string;
  syncCustomerFacingName: boolean;
}

export interface StoreCloseInput extends StoreLifecycleMutationInput {
  preflightSnapshotHash: string;
  confirmationStoreName: string;
  confirmationStoreIdSuffix: string;
  reasonCode: string;
}

export type StoreRestoreInput = StoreLifecycleMutationInput;

export interface StorePurgeScheduleInput extends StoreLifecycleMutationInput {
  preflightSnapshotHash: string;
  exportJobId: string;
  approvalRefHash: string;
  purgeAfter: string;
}

export type StorePurgeRequestState =
  | "cooling"
  | "preparing_export"
  | "ready_for_confirmation"
  | "scheduled"
  | "cancelled"
  | "purging"
  | "failed"
  | "completed";

export interface StorePurgeRequest {
  request_id: string;
  store_id: string;
  state: StorePurgeRequestState;
  requested_at: string;
  cooling_until: string;
  export_job_id: string;
  export_state?: "pending" | "exporting" | "completed" | "restore_verified" | "failed";
  purge_job_id?: string;
  purge_after?: string;
  destructive_step_started?: boolean;
  cancelled_at?: string;
  failure_code?: string;
}

export interface StorePurgeRequestInput {
  expectedStoreId: string;
  expectedRevision: number;
  reauthChallengeId: string;
  preflightSnapshotHash: string;
  confirmationStoreName: string;
  confirmationStoreIdSuffix: string;
}

export interface StorePurgeCancelInput {
  expectedStoreId: string;
  requestId: string;
}

export interface StorePurgeConfirmInput extends StorePurgeRequestInput {
  requestId: string;
}

export interface StoreLifecycleMutationResult {
  operation_id: string;
  replayed: boolean;
  lifecycle: StoreLifecycleState;
  store?: ActorStoreMembership;
  next_active_store_id?: string;
  active_store_cleared?: boolean;
}

export type StoreLifecycleAvailabilityCode =
  | "available"
  | "feature_disabled"
  | "store_context_required"
  | "primary_owner_required"
  | "mfa_required"
  | "migration_unavailable"
  | "enforcement_unhealthy"
  | "store_unavailable";

export interface StoreLifecycleActionCapability {
  allowed: boolean;
  code: StoreLifecycleAvailabilityCode;
}

export interface StoreLifecycleCapability {
  store_id?: string;
  check: StoreLifecycleActionCapability;
  rename: StoreLifecycleActionCapability;
  close: StoreLifecycleActionCapability;
  restore: StoreLifecycleActionCapability;
  purge: StoreLifecycleActionCapability;
}

export interface StoreLifecycleOperationStatus {
  operation_id: string;
  store_id: string;
  kind?: "rename" | "request_close" | "restore";
  state: "missing" | "running" | "completed" | "failed";
  lifecycle?: StoreLifecycleState;
  result_revision?: number;
  next_active_store_id?: string;
  active_store_cleared?: boolean;
}

export interface StoreExportTableManifest {
  table_name: string;
  row_count: number;
  content_sha256: string;
}

export interface StoreStorageObjectManifest {
  bucket: string;
  path: string;
  size: number;
  content_sha256: string;
  metadata_sha256: string;
}

export interface StoreExportManifest {
  store_id: string;
  schema_version: string;
  app_version: string;
  database_tables: StoreExportTableManifest[];
  storage_objects: StoreStorageObjectManifest[];
  database_manifest_sha256: string;
  storage_manifest_sha256: string;
  artifact_sha256: string;
}

export interface StoreExportPrepareInput {
  expectedStoreId: string;
  preflightSnapshotHash: string;
  schemaVersion: string;
  appVersion: string;
}

export interface StoreExportPrepareResult {
  export_job_id: string;
  store_id: string;
  state: "pending";
}

export interface StoreRestoreProof {
  store_id: string;
  export_job_id: string;
  verified: boolean;
  table_mismatches: string[];
  storage_mismatches: string[];
  proof_sha256: string;
  verified_at: string;
}

export interface StoreContext {
  customerStatusQrEnabled?: boolean;
  activeStore?: ActorStoreMembership;
  stores: ActorStoreMembership[];
  recoveryStores?: ActorStoreMembership[];
  activeStoreExplicit?: boolean;
  lifecycleAccess?: StoreLifecycleCapability;
  orderDataAccess?: OrderDataAccessCapability;
  lifecycle?: StoreLifecycleState;
  permissions?: {
    canReadSuppliers: boolean;
    canAssignSuppliers: boolean;
    canManageSuppliers: boolean;
    canReadInventory?: boolean;
    canCreateInventory?: boolean;
    canUpdateInventory?: boolean;
    canSellInventory?: boolean;
    inventoryV2UiEnabled?: boolean;
    inventoryV2CommandsEnabled?: boolean;
    inventoryProductsUiEnabled?: boolean;
    inventoryProductQuickCreateEnabled?: boolean;
    inventoryLifecycleUiEnabled?: boolean;
    canManageOrderData?: boolean;
    canApplyOrderData?: boolean;
    canSearchOrderArchive?: boolean;
    canBrowseOrderArchive?: boolean;
    canReadOrderFinance?: boolean;
    canReadAggregateFinance?: boolean;
    canReadProfit?: boolean;
    canReadRepairProfitReports?: boolean;
    canExportRepairCosts?: boolean;
    canPreviewCostBackfill?: boolean;
    canApplyCostBackfill?: boolean;
    canAllocatePartsCosts?: boolean;
    canAllocateInventoryCosts?: boolean;
    canReadCostCurrencies?: boolean;
    canManageCostCurrencies?: boolean;
    can_manage_order_costs?: boolean;
    canExportOrders?: boolean;
    canReadStoreSettings?: boolean;
    canUpdateStoreSettings?: boolean;
    canConfigureWorkflow?: boolean;
    canReadMessageTemplates?: boolean;
    canUpdateMessageTemplates?: boolean;
    canListMembers?: boolean;
    canInviteMembers?: boolean;
    memberInviteRoles?: ApprovedStoreRole[];
    canManageMembers?: boolean;
    canRevokeMembers?: boolean;
    canGrantManager?: boolean;
    canReviewAccessRequests?: boolean;
    canManageKioskDevices?: boolean;
    canReviewKioskSessions?: boolean;
    canViewAudit?: boolean;
    canReadMemos?: boolean;
    canCreateMemos?: boolean;
    canManageMemos?: boolean;
  };
}

export interface StoreCreateInput {
  request_id: string;
  name: string;
  address?: string;
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
  recoveryStores?: ActorStoreMembership[];
  activeStoreExplicit?: boolean;
  requestIpHash?: string;
  authAssuranceLevel?: "aal1" | "aal2";
  recentAuthAt?: string;
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
  identifier_kind?: "imei1" | "serial";
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

export type InventoryProductCategory = "phone" | "tablet" | "computer" | "game_console" | "other";

export type InventoryProductDisplayStatus =
  | "in_stock"
  | "reserved"
  | "sold"
  | "removed"
  | "returned";

/**
 * A minimized, server-owned lifecycle read model for inventory list/detail UI.
 * It is deliberately separate from the legacy inventory status so existing
 * clients can continue reading `status` while the projection rolls out.
 */
export type InventoryLifecycleProjectionMode = "exact" | "compatible" | "unavailable";

export type InventoryLifecycleProjectionStatus =
  | "processing"
  | "in_stock"
  | "reserved"
  | "sold_pending_pickup"
  | "delivered"
  | "after_sales"
  | "removed";

export type InventoryLifecycleProjectionConfidence = "high" | "medium" | "low";

export type InventoryAfterSalesStatus =
  | "open"
  | "in_progress"
  | "waiting_customer"
  | "returned"
  | "closed";

export interface InventoryLifecycleProjection {
  mode: InventoryLifecycleProjectionMode;
  status: InventoryLifecycleProjectionStatus;
  confidence: InventoryLifecycleProjectionConfidence;
  needs_review: boolean;
  /** Aggregate only; individual payment rows are never exposed by the list. */
  balance?: number;
  reservation_expires_at?: string;
  expected_pickup_at?: string;
  actual_pickup_at?: string;
  warranty_ends_at?: string;
  after_sales_status?: InventoryAfterSalesStatus;
  allowed_actions: InventoryLifecycleCommand[];
}

export interface InventoryLifecycleProjectionCounts {
  processing?: number;
  in_stock?: number;
  reserved?: number;
  sold_pending_pickup?: number;
  delivered?: number;
  after_sales?: number;
  removed?: number;
  /** Omitted when there is no unknown/failed projection; never rendered as 0. */
  unknown?: number;
}

export interface InventoryLifecycleBatchProjection {
  mode: InventoryLifecycleProjectionMode;
  counts: InventoryLifecycleProjectionCounts;
}

export interface InventoryProductListFilters {
  search?: string;
  statuses?: InventoryProductDisplayStatus[];
  categories?: InventoryProductCategory[];
  brands?: string[];
  locations?: string[];
}

export interface InventoryProductListItem {
  id: string;
  sku: string;
  category: InventoryProductCategory;
  brand: string;
  model: string;
  /** Optional catalog/display color; no cost or identifier data is included. */
  color?: string;
  specification?: string;
  masked_identifier?: string;
  status: InventoryProductDisplayStatus;
  /** Raw lifecycle source retained while the legacy display status is compatible. */
  legacy_status?: InventoryItemStatus;
  location?: string;
  list_price?: number;
  currency_code: CurrencyCode;
  updated_at: string;
  /** Same-origin authenticated thumbnail handle. Storage metadata is never returned. */
  thumbnail_url?: string;
  /** Optional lifecycle projection; legacy status/statuses remain available for compatibility. */
  lifecycle?: InventoryLifecycleProjection;
}

export interface InventoryProductListResult {
  items: InventoryProductListItem[];
  total: number;
  facets: {
    brands: string[];
    locations: string[];
  };
  lifecycle_projection?: InventoryLifecycleBatchProjection;
}

export interface InventoryProductDetail extends InventoryProductListItem {
  color?: string;
  ram_capacity?: string;
  storage_capacity?: string;
  gtin?: string;
  condition?: string;
  specifications?: Record<string, string>;
  identifiers: InventoryProductIdentifierSummary[];
  identifier_kind?: InventoryProductIdentifierKind;
  serial_or_imei?: string;
  cost_amount?: number;
  warranty_months?: number;
  notes?: string;
  created_at: string;
  version: number;
  finance_redacted?: boolean;
}

export type InventoryProductIdentifierKind = "imei1" | "imei2" | "serial" | "eid";
export type InventoryProductIdentifierSource = "manual" | "scan" | "ai_confirmed";

export interface InventoryProductIdentifierInput {
  kind: InventoryProductIdentifierKind;
  value: string;
  source: InventoryProductIdentifierSource;
  primary?: boolean;
}

export interface InventoryProductIdentifierSummary {
  kind: InventoryProductIdentifierKind;
  masked_value: string;
  primary: boolean;
}

export interface InventoryProductIdentifierEditValue {
  kind: InventoryProductIdentifierKind;
  value: string;
  source: InventoryProductIdentifierSource;
  primary: boolean;
}

export interface InventoryProductEditData extends Omit<InventoryProductDetail, "identifiers"> {
  identifiers: InventoryProductIdentifierEditValue[];
}

export interface CreateInventoryProductInput {
  idempotency_key: string;
  category: InventoryProductCategory;
  brand: string;
  model: string;
  color?: string;
  ram_capacity?: string;
  storage_capacity?: string;
  gtin?: string;
  condition?: string;
  specifications?: Record<string, string>;
  identifiers?: InventoryProductIdentifierInput[];
  /** @deprecated Kept for clients that have not moved to identifiers[]. */
  identifier_kind?: "imei1" | "serial";
  /** @deprecated Kept for clients that have not moved to identifiers[]. */
  serial_or_imei?: string;
  list_price?: number;
  cost_amount?: number;
  location?: string;
  warranty_months?: number;
  notes?: string;
}

export interface UpdateInventoryProductInput {
  idempotency_key: string;
  expected_version: number;
  category: InventoryProductCategory;
  brand: string;
  model: string;
  color?: string;
  ram_capacity?: string;
  storage_capacity?: string;
  gtin?: string;
  condition?: string;
  specifications?: Record<string, string>;
  identifiers: InventoryProductIdentifierInput[];
  list_price?: number;
  cost_amount?: number;
  location?: string;
  warranty_months?: number;
  notes?: string;
}

export interface UpdateInventoryProductResult {
  ok: true;
  code: "updated" | "idempotent_replay";
  id: string;
  version: number;
  updated_at: string;
}

export interface CreateInventoryProductResult {
  ok: true;
  code: "created" | "idempotent_replay";
  id: string;
  sku: string;
  created_at: string;
}

export type InventoryLifecycleCommand =
  | "acquisition.save"
  | "inspection.save"
  | "reservation.create"
  | "payment.append"
  | "sale.complete"
  | "pickup.confirm"
  | "reservation.cancel"
  | "warranty.adjust"
  | "after_sales.create"
  | "after_sales.update"
  | "after_sales.close";

export interface InventoryLifecycleCommandInput {
  command: InventoryLifecycleCommand;
  idempotency_key: string;
  payload: Record<string, unknown>;
}

export interface InventoryLifecycleCommandResult {
  ok: boolean;
  code: string;
  sale_order_id?: string;
  stock_unit_id?: string;
  case_id?: string;
  payment_id?: string;
  inventory_item_id?: string;
  balance?: number;
  expires_at?: string;
  actual_pickup_at?: string;
  sold_at?: string;
  starts_at?: string;
  ends_at?: string;
  version_no?: number;
  version?: number;
  order_version?: number;
  unit_version?: number;
  case_version?: number;
  warranty_version?: number;
  status?: string;
}

export interface InventoryLifecycleListSummary {
  item_id: string;
  stock_unit_id: string;
  sku: string;
  business_status:
    | "in_stock"
    | "reserved"
    | "sold_pending_pickup"
    | "delivered"
    | "after_sales"
    | "removed";
  reservation_expires_at?: string;
  expected_pickup_at?: string;
  actual_pickup_at?: string;
  warranty_ends_at?: string;
  unit_version?: number;
  order_version?: number;
  case_version?: number;
  warranty_version?: number;
  after_sales_status?: "open" | "in_progress" | "waiting_customer" | "returned" | "closed";
  sale_order_id?: string;
  status?: "reserved" | "sold" | "cancelled";
  agreed_price?: number;
  signed_paid_amount?: number;
  balance?: number;
  reserved_at?: string;
  sold_at?: string;
  allowed_actions: InventoryLifecycleCommand[];
  projection?: InventoryLifecycleProjection;
  inspection?: {
    battery_health: number | null;
    face_id_status: "not_tested" | "normal" | "abnormal" | "not_applicable";
    touch_id_status: "not_tested" | "normal" | "abnormal" | "not_applicable";
    true_tone_status: "not_tested" | "normal" | "abnormal" | "not_applicable";
    activation_lock_status: "not_tested" | "normal" | "abnormal" | "not_applicable";
    data_wipe_status: "not_tested" | "normal" | "abnormal" | "not_applicable";
    imei_status: "not_tested" | "normal" | "abnormal" | "not_applicable";
    inspected_at: string;
  };
  commercial_warranty?: {
    version_no: number;
    basis: "legal" | "commercial";
    months: number;
    starts_at?: string;
    ends_at?: string;
  };
  after_sales?: InventoryLifecycleAfterSalesSummary;
}

export interface InventoryLifecycleSaleDetail extends InventoryLifecycleListSummary {
  sale_order_id: string;
  inventory_item_id: string;
  status: "reserved" | "sold" | "cancelled";
  agreed_price: number;
  signed_paid_amount: number;
  balance: number;
  payments: Array<{
    kind: "deposit" | "balance" | "payment" | "refund" | "reversal";
    amount: number;
    method: "cash" | "card" | "bancomat" | "transfer" | "other";
    occurred_at: string;
  }>;
}

export interface InventoryLifecycleAfterSalesSummary {
  case_id: string;
  sale_order_id: string;
  inventory_item_id: string;
  status: "open" | "in_progress" | "waiting_customer" | "returned" | "closed";
  coverage_decision?: "pending" | "covered" | "not_covered";
  received_at: string;
  version: number;
}

export interface InventoryLifecycleAfterSalesQueueItem {
  case_id: string;
  sale_order_id: string;
  inventory_item_id: string;
  stock_unit_id: string;
  sku: string;
  status: "open" | "in_progress" | "waiting_customer" | "returned" | "closed";
  issue_summary: string;
  coverage_decision?: "pending" | "covered" | "not_covered";
  received_at: string;
  returned_at?: string;
  version: number;
  order_version: number;
  allowed_actions: InventoryLifecycleCommand[];
  allowed_next_statuses?: InventoryAfterSalesStatus[];
}

export interface InventoryLifecycleAfterSalesCaseDetail extends InventoryLifecycleAfterSalesQueueItem {
  diagnosis?: string;
  closed_at?: string;
  sale?: InventoryLifecycleSaleDetail;
  events: Array<{
    event_type: string;
    from_status?: string;
    to_status?: string;
    occurred_at: string;
  }>;
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

export type BuybackQuoteOutcome = "accepted" | "deferred" | "rejected";

export interface BuybackQuoteDeductionInput {
  code: string;
  label: string;
  amount: number;
}

export interface BuybackQuoteSnapshotInput {
  reference_low: number;
  reference_high: number;
  final_offer: number;
  deductions: BuybackQuoteDeductionInput[];
  manual_adjustment_reason?: string;
  risk_level: "low" | "medium" | "high";
  hard_block: boolean;
  expires_at: string;
}

export interface CreateBuybackQuoteInput {
  record_id: string;
  idempotency_key: string;
  customer_id?: string;
  device: {
    brand: string;
    model: string;
    color?: string;
    storage_capacity?: string;
    serial_or_imei?: string;
    battery_health?: number;
  };
  quote: BuybackQuoteSnapshotInput;
}

export interface ReviseBuybackQuoteInput {
  expected_updated_at: string;
  idempotency_key: string;
  quote: BuybackQuoteSnapshotInput;
  change_reason: string;
}

export interface RecordBuybackQuoteResponseInput {
  expected_updated_at: string;
  idempotency_key: string;
  quote_revision_id: string;
  outcome: BuybackQuoteOutcome;
  reason_code?: string;
  note?: string;
}

export interface BuybackQuoteCommandResult {
  ok: true;
  code: "created" | "revised" | "response_recorded" | "idempotent_replay";
  item_id: string;
  quote_revision_id: string;
  response_id?: string;
  updated_at: string;
}

export interface BuybackQuoteHistoryEntry {
  id: string;
  revision_no: number;
  kind: "initial" | "reprice";
  quote: BuybackQuoteSnapshotInput;
  change_reason?: string;
  actor_name: string;
  created_at: string;
}

export interface BuybackQuoteResponseEntry {
  id: string;
  quote_revision_id: string;
  outcome: BuybackQuoteOutcome;
  reason_code?: string;
  note?: string;
  channel: "staff_recorded_verbal";
  actor_name: string;
  created_at: string;
}

export interface BuybackQuoteHistoryResult {
  revisions: BuybackQuoteHistoryEntry[];
  responses: BuybackQuoteResponseEntry[];
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

export type InventoryV2WorkflowOperation = "inspect" | "transition" | "update_commercials";

export interface InventoryV2CommercialPatch {
  cost_amount?: number;
  list_price?: number;
  repair_cost_amount?: number;
  fees_amount?: number;
  warranty_months?: number;
  location?: string | null;
  notes?: string | null;
}

export interface ApplyInventoryWorkflowV2Input {
  expected_updated_at: string;
  idempotency_key: string;
  operation: InventoryV2WorkflowOperation;
  target_status?: Extract<
    InventoryItemStatus,
    "intake" | "evaluating" | "refurbishing" | "ready_for_sale" | "listed"
  >;
  inspection?: Omit<InventoryQualityCheckInput, "expected_updated_at">;
  commercial_patch?: InventoryV2CommercialPatch;
  reason?: string;
}

export interface ApplyInventoryWorkflowV2Result {
  ok: true;
  code: "applied" | "idempotent_replay";
  workflow_command_id: string;
  item_id: string;
  stock_unit_id: string;
  previous_status: InventoryItemStatus;
  status: InventoryItemStatus;
  item_updated_at: string;
  unit_version: number;
  quality_check_id?: string;
  applied_at: string;
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

export type InventoryV2FiscalStatus = "not_required" | "pending" | "recorded";

export interface InventoryV2WarrantySnapshot {
  version: string;
  language: "it" | "zh" | "en";
  terms: string[];
  disclosed_defects?: string[];
}

export interface CompleteInventorySaleV2Input {
  expected_updated_at: string;
  idempotency_key: string;
  buyer_customer_id?: string;
  sale_price: number;
  payment_amount: number;
  payment_method: string;
  sale_channel: string;
  warranty_months: number;
  warranty_snapshot: InventoryV2WarrantySnapshot;
  fiscal_status: InventoryV2FiscalStatus;
  fiscal_reference?: string;
  sold_at: string;
}

export interface CompleteInventorySaleV2Result {
  ok: true;
  code: "completed" | "idempotent_replay";
  sale_id: string;
  payment_id: string;
  item_id: string;
  updated_at: string;
  fiscal_status: InventoryV2FiscalStatus;
}

export type InventoryV2IntakeSource = "supplier_purchase" | "repair_resale" | "manual_stock";
export type InventoryV2StandardizationStatus = "standard" | "unstandardized" | "needs_review";
export type InventoryV2IdentifierKind = "imei1" | "imei2" | "serial" | "eid" | "ean" | "sku";
export type InventoryV2IdentifierSource = "manual" | "scan" | "ai_confirmed";

export interface InventoryV2IdentifierInput {
  kind: InventoryV2IdentifierKind;
  value: string;
  slot?: number;
  source: InventoryV2IdentifierSource;
  primary: boolean;
}

export interface CreateInventoryUnitV2Input {
  idempotency_key: string;
  source_type: InventoryV2IntakeSource;
  customer_id?: string;
  supplier_id?: string;
  category: string;
  brand: string;
  model: string;
  ram_capacity?: string;
  storage_capacity?: string;
  color?: string;
  identifiers: InventoryV2IdentifierInput[];
  cost_amount: number;
  list_price: number;
  warranty_months: number;
  location?: string;
  notes?: string;
  standardization_status: InventoryV2StandardizationStatus;
  created_at: string;
}

export interface CreateInventoryUnitV2Result {
  ok: true;
  code: "created" | "idempotent_replay";
  item_id: string;
  stock_unit_id: string;
  created_at: string;
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
export type NewOrderEntryMode = "simple" | "professional";

export interface StoreSettings {
  id: string;
  store_id?: string;
  store_name: string;
  store_address: string;
  store_phone: string;
  store_whatsapp: string;
  store_email: string;
  public_base_url?: string;
  default_order_warranty_text: string;
  default_order_warranty_months: number;
  default_inventory_warranty_months: number;
  new_order_entry_mode?: NewOrderEntryMode;
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
  public_base_url?: string;
  default_order_warranty_text?: string;
  default_order_warranty_months?: number;
  default_inventory_warranty_months?: number;
  new_order_entry_mode?: NewOrderEntryMode;
  print_footer?: string;
  message_signature?: string;
}

export type StoreSettingsSection = "store" | "notifications" | "rules";

export interface StoreSettingsStoreSectionInput {
  store_name: string;
  store_address: string;
  store_phone: string;
  store_whatsapp: string;
  store_email: string;
  public_base_url?: string;
}

export interface StoreSettingsNotificationsSectionInput {
  print_footer: string;
  message_signature: string;
}

export interface StoreSettingsRulesSectionInput {
  default_order_warranty_months: 0 | 3 | 6 | 12 | 24;
  default_inventory_warranty_months: number;
  new_order_entry_mode?: NewOrderEntryMode;
}

interface StoreSettingsSectionUpdateBase {
  expectedStoreId: string;
  expectedUpdatedAt: string;
}

export type StoreSettingsSectionUpdateRequest =
  | (StoreSettingsSectionUpdateBase & {
      section: "store";
      input: StoreSettingsStoreSectionInput;
    })
  | (StoreSettingsSectionUpdateBase & {
      section: "notifications";
      input: StoreSettingsNotificationsSectionInput;
    })
  | (StoreSettingsSectionUpdateBase & {
      section: "rules";
      input: StoreSettingsRulesSectionInput;
    });

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

export type KioskAvailableDevice = Pick<KioskDevice, "id" | "label" | "status">;

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

export interface KioskSessionReviewInput {
  id: string;
  expected_submission_version: number;
}

export interface KioskSessionReturnInput {
  id: string;
  expected_submission_version: number;
  reason: string;
}

export interface KioskPublicSession {
  session: Pick<
    KioskSession,
    "session_type" | "status" | "submission_version" | "expires_at" | "submitted_at"
  > & {
    correction_message?: string;
    submission_draft?: Omit<KioskSessionSubmitInput, "signature_data_url"> & {
      has_signature?: boolean;
    };
  };
  device: Pick<KioskDevice, "label" | "status">;
  store: {
    name: string;
  };
  order?: {
    public_no: string;
    customer_name?: string;
    customer_phone?: string;
    device_label?: string;
  };
}

export interface KioskPairResult {
  token: string;
  device: Pick<KioskDevice, "label" | "status">;
}

export interface KioskDevicePairClaimResult {
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
