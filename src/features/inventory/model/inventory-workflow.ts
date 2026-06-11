import type {
  InventoryItem,
  InventoryItemStatus,
  InventoryTransaction,
} from "@/lib/repairdesk/types";

export const inventoryItemStatuses = [
  "intake",
  "evaluating",
  "offer_made",
  "purchased",
  "data_wipe",
  "refurbishing",
  "ready_for_sale",
  "listed",
  "reserved",
  "sold",
  "cancelled",
  "returned",
  "recycled",
] as const satisfies readonly InventoryItemStatus[];

export const inventoryStatusMeta: Record<
  InventoryItemStatus,
  { label: string; shortLabel: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }
> = {
  intake: { label: "收机登记", shortLabel: "收机", tone: "neutral" },
  evaluating: { label: "检测估价", shortLabel: "检测", tone: "info" },
  offer_made: { label: "已报价", shortLabel: "报价", tone: "warning" },
  purchased: { label: "已回收", shortLabel: "回收", tone: "success" },
  data_wipe: { label: "资料清除", shortLabel: "清除", tone: "warning" },
  refurbishing: { label: "整备中", shortLabel: "整备", tone: "info" },
  ready_for_sale: { label: "待上架", shortLabel: "待售", tone: "success" },
  listed: { label: "售卖中", shortLabel: "上架", tone: "success" },
  reserved: { label: "已预订", shortLabel: "预订", tone: "warning" },
  sold: { label: "已售", shortLabel: "已售", tone: "success" },
  cancelled: { label: "已取消", shortLabel: "取消", tone: "danger" },
  returned: { label: "售后退回", shortLabel: "退回", tone: "danger" },
  recycled: { label: "回收处理", shortLabel: "处理", tone: "neutral" },
};

const statusTransitions: Record<InventoryItemStatus, InventoryItemStatus[]> = {
  intake: ["evaluating", "cancelled", "recycled"],
  evaluating: ["offer_made", "purchased", "cancelled", "recycled"],
  offer_made: ["purchased", "evaluating", "cancelled"],
  purchased: ["data_wipe", "refurbishing", "ready_for_sale", "recycled", "cancelled"],
  data_wipe: ["refurbishing", "ready_for_sale", "recycled"],
  refurbishing: ["ready_for_sale", "listed", "recycled"],
  ready_for_sale: ["listed", "reserved", "sold", "recycled"],
  listed: ["reserved", "sold", "returned", "recycled"],
  reserved: ["listed", "sold", "cancelled"],
  sold: ["returned"],
  returned: ["refurbishing", "listed", "recycled"],
  recycled: [],
  cancelled: [],
};

export function getInventoryNextStatuses(status: InventoryItemStatus) {
  return statusTransitions[status] ?? [];
}

export function canTransitionInventoryItem(from: InventoryItemStatus, to: InventoryItemStatus) {
  return from === to || getInventoryNextStatuses(from).includes(to);
}

export function validateInventoryTransition(from: InventoryItemStatus, to: InventoryItemStatus) {
  if (canTransitionInventoryItem(from, to)) return;
  throw new Error(
    `库存状态不能从 ${inventoryStatusMeta[from].label} 流转到 ${inventoryStatusMeta[to].label}`,
  );
}

export function getInventoryProfit(
  item: Pick<InventoryItem, "sale_price" | "buyback_price" | "repair_cost_amount" | "fees_amount">,
  transactions: Pick<InventoryTransaction, "transaction_type" | "amount">[] = [],
) {
  const refunds = transactions
    .filter((transaction) => transaction.transaction_type === "refund")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const extraRepairCosts = transactions
    .filter((transaction) => transaction.transaction_type === "repair_cost")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const extraFees = transactions
    .filter((transaction) => transaction.transaction_type === "fee")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return roundMoney(
    item.sale_price -
      item.buyback_price -
      item.repair_cost_amount -
      item.fees_amount -
      refunds -
      extraRepairCosts -
      extraFees,
  );
}

export function isInventoryPipelineStatus(status: InventoryItemStatus) {
  return ![
    "ready_for_sale",
    "listed",
    "reserved",
    "sold",
    "cancelled",
    "returned",
    "recycled",
  ].includes(status);
}

export function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
