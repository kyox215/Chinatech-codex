export const LEGACY_ORDER_DATA_TEMPLATE_VERSION = "repairdesk-order-data-v1";
export const PREVIOUS_ORDER_DATA_TEMPLATE_VERSION = "repairdesk-order-data-v2";
export const ORDER_DATA_TEMPLATE_VERSION = "repairdesk-order-data-v3";
export const ORDER_DATA_PARSER_VERSION = "1.1.0";
export const ORDER_DATA_CLEAR_VALUE = "__CLEAR__";
export const ORDER_DATA_MAX_FILE_BYTES = 4 * 1024 * 1024;
export const ORDER_DATA_MAX_ROWS = 10_000;
export const ORDER_DATA_MAX_REPAIR_ITEM_ROWS = 50_000;
export const ORDER_DATA_MAX_CELL_CHARS = 4_000;

export const orderDataColumns = [
  {
    key: "template_version",
    header: "数据版本",
    mode: "system",
    description: "固定版本，请勿修改",
  },
  {
    key: "import_action",
    header: "导入动作",
    mode: "control",
    description: "create、update 或 skip",
  },
  {
    key: "order_id",
    header: "工单ID",
    mode: "readonly",
    description: "系统工单唯一 ID；更新时保留",
  },
  {
    key: "public_no",
    header: "工单编号",
    mode: "readonly",
    description: "客户可见工单号；更新时保留",
  },
  {
    key: "source_system",
    header: "外部来源",
    mode: "control",
    description: "新建时填写来源，例如 seatable",
  },
  {
    key: "external_record_id",
    header: "外部记录ID",
    mode: "control",
    description: "新建时必须稳定且唯一",
  },
  {
    key: "expected_updated_at",
    header: "版本时间",
    mode: "readonly",
    description: "用于防止覆盖导出后发生的新修改",
  },
  {
    key: "order_type",
    header: "订单类型",
    mode: "create",
    description: "quick_repair 或 dropoff_repair",
  },
  {
    key: "device_custody_status",
    header: "设备保管枚举",
    mode: "editable",
    description: "with_shop 或 with_customer；新建留空表示历史未知，更新留空表示不修改",
  },
  {
    key: "device_custody_label",
    header: "设备保管状态",
    mode: "readonly",
    description: "人类可读状态；以设备保管枚举为准",
  },
  { key: "status", header: "状态", mode: "readonly", description: "只读；状态请在工单流程中修改" },
  { key: "workflow_status", header: "流程阶段", mode: "readonly", description: "只读" },
  { key: "exception_status", header: "异常状态", mode: "readonly", description: "只读" },
  { key: "approval_status", header: "审批结果", mode: "readonly", description: "只读" },
  { key: "approval_flow_status", header: "审批流程", mode: "readonly", description: "只读" },
  { key: "parts_status", header: "配件状态", mode: "readonly", description: "只读" },
  { key: "notify_status", header: "通知状态", mode: "readonly", description: "只读" },
  { key: "customer_name", header: "客户姓名", mode: "editable", description: "空白保留原值" },
  { key: "customer_phone", header: "客户电话", mode: "editable", description: "建议使用国际格式" },
  { key: "device_brand", header: "设备品牌", mode: "editable", description: "空白保留原值" },
  { key: "device_model", header: "设备型号", mode: "editable", description: "空白保留原值" },
  {
    key: "device_imei",
    header: "IMEI或序列号",
    mode: "clearable",
    description: "可用 __CLEAR__ 清空",
  },
  {
    key: "device_notes",
    header: "设备备注",
    mode: "clearable",
    description: "可用 __CLEAR__ 清空",
  },
  {
    key: "intake_intent_codes",
    header: "接单意图代码",
    mode: "editable",
    description: "v3 点选代码；单选，多个代码使用英文逗号分隔",
  },
  {
    key: "intake_intent_catalog_revision",
    header: "接单意图目录版本",
    mode: "editable",
    description: "与接单意图代码同时填写；空白组表示保留原值",
  },
  {
    key: "reported_symptom_codes",
    header: "客户症状代码",
    mode: "editable",
    description: "v3 点选代码；多个代码使用英文逗号分隔",
  },
  {
    key: "reported_symptom_other_note",
    header: "客户症状其他说明",
    mode: "editable",
    description: "仅代码包含 other 时填写",
  },
  {
    key: "reported_symptom_catalog_revision",
    header: "客户症状目录版本",
    mode: "editable",
    description: "与客户症状代码同时填写；空白组表示保留原值",
  },
  {
    key: "diagnostic_finding_codes",
    header: "检测发现代码",
    mode: "editable",
    description: "v3 点选代码；多个代码使用英文逗号分隔",
  },
  {
    key: "diagnostic_finding_other_note",
    header: "检测发现其他说明",
    mode: "editable",
    description: "仅代码包含 other 时填写",
  },
  {
    key: "diagnostic_finding_catalog_revision",
    header: "检测发现目录版本",
    mode: "editable",
    description: "与检测发现代码同时填写；空白组表示保留原值",
  },
  { key: "issue_description", header: "故障描述", mode: "editable", description: "新建时必填" },
  {
    key: "diagnosis_result",
    header: "诊断结果",
    mode: "clearable",
    description: "可用 __CLEAR__ 清空",
  },
  {
    key: "internal_tag",
    header: "内部标签",
    mode: "clearable",
    description: "可用 __CLEAR__ 清空",
  },
  {
    key: "accessory_notes",
    header: "随附物品",
    mode: "clearable",
    description: "可用 __CLEAR__ 清空",
  },
  {
    key: "warranty_text",
    header: "质保文本",
    mode: "clearable",
    description: "可用 __CLEAR__ 清空",
  },
  {
    key: "warranty_months",
    header: "质保月数",
    mode: "editable",
    description: "0、3、6、12 或 24",
  },
  {
    key: "deposit_amount",
    header: "定金",
    mode: "readonly",
    description: "只读；更正请在工单详情使用“更正定金”并选择原因",
  },
  {
    key: "quotation_amount",
    header: "总报价",
    mode: "readonly",
    description: "由维修项目自动计算",
  },
  {
    key: "balance_amount",
    header: "余额",
    mode: "readonly",
    description: "由总报价、定金和既有收款自动计算",
  },
  { key: "payment_status", header: "付款状态", mode: "readonly", description: "只读" },
  { key: "technician_name", header: "技师", mode: "readonly", description: "只读" },
  { key: "approval_sent_at", header: "审批发送时间", mode: "readonly", description: "只读" },
  {
    key: "approval_confirmed_at",
    header: "审批确认时间",
    mode: "readonly",
    description: "只读",
  },
  { key: "completed_at", header: "完成时间", mode: "readonly", description: "只读" },
  { key: "delivered_at", header: "交付时间", mode: "readonly", description: "只读" },
  { key: "created_at", header: "创建时间", mode: "readonly", description: "只读" },
  { key: "updated_at", header: "更新时间", mode: "readonly", description: "只读" },
] as const;

export type OrderDataColumnKey = (typeof orderDataColumns)[number]["key"];

export const orderDataHeaders = orderDataColumns.map((column) => column.header);
const structuredFactHeaders = new Set([
  "接单意图代码",
  "接单意图目录版本",
  "客户症状代码",
  "客户症状其他说明",
  "客户症状目录版本",
  "检测发现代码",
  "检测发现其他说明",
  "检测发现目录版本",
]);
export const previousOrderDataHeaders = orderDataHeaders.filter(
  (header) => !structuredFactHeaders.has(header),
);
export const legacyOrderDataHeaders = previousOrderDataHeaders.filter(
  (header) => header !== "设备保管枚举" && header !== "设备保管状态",
);

export const repairItemColumns = [
  { key: "order_id", header: "工单ID" },
  { key: "public_no", header: "工单编号" },
  { key: "source_system", header: "外部来源" },
  { key: "external_record_id", header: "外部记录ID" },
  { key: "line_id", header: "项目行ID" },
  { key: "catalog_key", header: "项目目录代码" },
  { key: "sequence", header: "项目序号" },
  { key: "name", header: "项目名称" },
  { key: "price", header: "金额" },
  { key: "note", header: "备注" },
] as const;

export const repairItemHeaders = repairItemColumns.map((column) => column.header);
export const previousRepairItemHeaders = repairItemHeaders.filter(
  (header) => header !== "项目行ID" && header !== "项目目录代码",
);

export const operationHistoryColumns = [
  { key: "order_id", header: "工单ID" },
  { key: "public_no", header: "工单编号" },
  { key: "event_type", header: "操作类型" },
  { key: "operator_name", header: "操作人" },
  { key: "created_at", header: "操作时间" },
  { key: "summary", header: "操作摘要" },
] as const;
export const operationHistoryHeaders = operationHistoryColumns.map((column) => column.header);

export const allowedOrderDataSheetNames = new Set([
  "工单",
  "维修项目",
  "字段说明",
  "枚举值",
  "示例",
  "操作历史",
  "_元数据",
]);

export const editableOrderDataKeys = new Set<OrderDataColumnKey>([
  "order_type",
  "device_custody_status",
  "customer_name",
  "customer_phone",
  "device_brand",
  "device_model",
  "device_imei",
  "device_notes",
  "intake_intent_codes",
  "intake_intent_catalog_revision",
  "reported_symptom_codes",
  "reported_symptom_other_note",
  "reported_symptom_catalog_revision",
  "diagnostic_finding_codes",
  "diagnostic_finding_other_note",
  "diagnostic_finding_catalog_revision",
  "issue_description",
  "diagnosis_result",
  "internal_tag",
  "accessory_notes",
  "warranty_text",
  "warranty_months",
]);

export const clearableOrderDataKeys = new Set<OrderDataColumnKey>([
  "device_imei",
  "device_notes",
  "diagnosis_result",
  "internal_tag",
  "accessory_notes",
  "warranty_text",
]);
