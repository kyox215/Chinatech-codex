export type RepairStatus =
  | "diagnosis"
  | "awaiting_quote"
  | "awaiting_parts"
  | "repairing"
  | "testing"
  | "ready"
  | "awaiting_reply"
  | "collected_unpaid"
  | "outsourced"
  | "ready_notified"
  | "completed"
  | "cancelled";


export const repairStatusOptions: Array<{ value: RepairStatus; label: string }> = [
  { value: "awaiting_reply", label: "久等 未答复" },
  { value: "collected_unpaid", label: "欠款 已拿走" },
  { value: "outsourced", label: "寄修" },
  { value: "diagnosis", label: "待检测" },
  { value: "awaiting_quote", label: "待确认" },
  { value: "awaiting_parts", label: "待配件" },
  { value: "repairing", label: "维修中" },
  { value: "testing", label: "待测试" },
  { value: "ready", label: "待取机" },
  { value: "ready_notified", label: "修好已通知" },
  { value: "completed", label: "维修结束" },
  { value: "cancelled", label: "作废" },
];
