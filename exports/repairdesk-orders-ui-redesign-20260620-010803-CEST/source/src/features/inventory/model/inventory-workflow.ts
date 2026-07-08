import type {
  InventoryItem,
  InventoryListItem,
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

export type InventoryListViewKey =
  | "all"
  | "pipeline"
  | "sale"
  | "reserved"
  | "sold"
  | "attention"
  | "closed";

export interface InventoryListView {
  key: InventoryListViewKey;
  label: string;
  shortLabel: string;
  count: number;
}

export type InventoryPrimaryActionTone = "neutral" | "info" | "warning" | "success" | "danger";
export type InventoryPrimaryActionKind = "check" | "transition" | "sell" | "update" | "view";

export interface InventoryPrimaryAction {
  label: string;
  detail: string;
  actionLabel: string;
  actionKind: InventoryPrimaryActionKind;
  tone: InventoryPrimaryActionTone;
  nextStatus?: InventoryItemStatus;
}

const inventoryListViewMeta: Record<InventoryListViewKey, { label: string; shortLabel: string }> = {
  all: { label: "全部", shortLabel: "全" },
  pipeline: { label: "流转中", shortLabel: "流" },
  sale: { label: "可售", shortLabel: "售" },
  reserved: { label: "预留", shortLabel: "预" },
  sold: { label: "已售", shortLabel: "已" },
  attention: { label: "需处理", shortLabel: "警" },
  closed: { label: "结束", shortLabel: "结" },
};

const statusTransitions: Record<InventoryItemStatus, InventoryItemStatus[]> = {
  intake: ["evaluating", "offer_made", "cancelled", "recycled"],
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

export function getInventoryListViewLabel(view: InventoryListViewKey) {
  return inventoryListViewMeta[view].label;
}

export function getInventoryListViewStatuses(view: InventoryListViewKey) {
  const statuses: Record<InventoryListViewKey, InventoryItemStatus[] | undefined> = {
    all: undefined,
    pipeline: inventoryItemStatuses.filter(isInventoryPipelineStatus),
    sale: ["ready_for_sale", "listed"],
    reserved: ["reserved"],
    sold: ["sold"],
    attention: undefined,
    closed: ["cancelled", "returned", "recycled"],
  };

  return statuses[view];
}

export function isInventoryAttentionItem(
  item: Pick<
    InventoryListItem,
    | "status"
    | "cosmetic_grade"
    | "functional_grade"
    | "imei_check_status"
    | "activation_lock_status"
    | "data_wipe_status"
  >,
) {
  return (
    ["returned", "cancelled"].includes(item.status) ||
    ["poor", "for_parts"].includes(item.cosmetic_grade) ||
    ["needs_repair", "failed", "for_parts"].includes(item.functional_grade) ||
    item.imei_check_status === "fail" ||
    item.activation_lock_status === "fail" ||
    (["ready_for_sale", "listed", "reserved", "sold"].includes(item.status) &&
      item.data_wipe_status !== "pass")
  );
}

export function filterInventoryItemsByView(
  items: readonly InventoryListItem[],
  view: InventoryListViewKey,
) {
  if (view === "all") return [...items];
  if (view === "attention") return items.filter(isInventoryAttentionItem);

  const statuses = getInventoryListViewStatuses(view);
  if (!statuses) return [...items];
  return items.filter((item) => statuses.includes(item.status));
}

export function buildInventoryListViews(items: readonly InventoryListItem[]): InventoryListView[] {
  return (Object.keys(inventoryListViewMeta) as InventoryListViewKey[]).map((key) => ({
    key,
    label: inventoryListViewMeta[key].label,
    shortLabel: inventoryListViewMeta[key].shortLabel,
    count: filterInventoryItemsByView(items, key).length,
  }));
}

export function getInventoryPrimaryAction(
  item: Pick<
    InventoryListItem,
    | "status"
    | "source_type"
    | "cosmetic_grade"
    | "functional_grade"
    | "imei_check_status"
    | "activation_lock_status"
    | "data_wipe_status"
    | "list_price"
    | "sale_price"
  >,
): InventoryPrimaryAction {
  if (item.imei_check_status === "fail") {
    return {
      label: "复核 IMEI",
      detail: "IMEI / 序列号检查未通过，先复核来源和录入信息。",
      actionLabel: "登记检测",
      actionKind: "check",
      tone: "danger",
      nextStatus: "evaluating",
    };
  }

  if (item.activation_lock_status === "fail") {
    return {
      label: "处理账号锁",
      detail: "账号锁 / Find My 未关闭，不能上架或成交。",
      actionLabel: "登记检测",
      actionKind: "check",
      tone: "danger",
      nextStatus: "evaluating",
    };
  }

  if (
    ["ready_for_sale", "listed", "reserved", "sold"].includes(item.status) &&
    item.data_wipe_status !== "pass"
  ) {
    return {
      label: "先清除资料",
      detail: "可售或已售设备必须先完成资料清除记录。",
      actionLabel: "登记检测",
      actionKind: "check",
      tone: "warning",
      nextStatus: "data_wipe",
    };
  }

  if (
    ["poor", "for_parts"].includes(item.cosmetic_grade) ||
    ["needs_repair", "failed", "for_parts"].includes(item.functional_grade)
  ) {
    return {
      label: "评估维修成本",
      detail: "设备成色或功能异常，先确认整备成本和是否拆件处理。",
      actionLabel: "登记检测",
      actionKind: "check",
      tone: "warning",
      nextStatus: "refurbishing",
    };
  }

  if (item.status === "intake") {
    return {
      label: "补齐入库检测",
      detail:
        item.source_type === "buyback"
          ? "来自回收报价，先完成检测和资料确认。"
          : "先登记检测、价格和客户来源。",
      actionLabel: "登记检测",
      actionKind: "check",
      tone: "info",
      nextStatus: "evaluating",
    };
  }

  if (item.status === "evaluating") {
    const unchecked = [
      item.imei_check_status !== "pass" ? "IMEI" : "",
      item.activation_lock_status !== "pass" ? "账号锁" : "",
    ].filter(Boolean);
    return {
      label: unchecked.length ? "补齐关键检测" : "确认回收报价",
      detail: unchecked.length
        ? `还缺 ${unchecked.join("、")} 检测`
        : "检测已进入尾声，可确认回收价或推进到成交。",
      actionLabel: unchecked.length ? "登记检测" : "推进状态",
      actionKind: unchecked.length ? "check" : "transition",
      tone: unchecked.length ? "warning" : "info",
      nextStatus: unchecked.length ? "evaluating" : "offer_made",
    };
  }

  if (item.status === "offer_made") {
    return {
      label: "等待客户确认",
      detail: "报价已给出，客户同意后推进为已回收。",
      actionLabel: "推进状态",
      actionKind: "transition",
      tone: "warning",
      nextStatus: "purchased",
    };
  }

  if (item.status === "purchased") {
    return item.data_wipe_status === "pass"
      ? {
          label: "进入整备",
          detail: "已回收且资料清除完成，可以整备或待上架。",
          actionLabel: "推进状态",
          actionKind: "transition",
          tone: "success",
          nextStatus: "refurbishing",
        }
      : {
          label: "资料清除",
          detail: "成交后先完成资料清除，再进入整备。",
          actionLabel: "登记检测",
          actionKind: "check",
          tone: "warning",
          nextStatus: "data_wipe",
        };
  }

  if (item.status === "data_wipe") {
    return {
      label: "整备设备",
      detail: "资料清除阶段完成后，继续整备、翻新或待上架。",
      actionLabel: "推进状态",
      actionKind: "transition",
      tone: "info",
      nextStatus: "refurbishing",
    };
  }

  if (item.status === "refurbishing") {
    return {
      label: "准备上架",
      detail:
        item.list_price > 0 ? "整备后可推进到待上架或直接上架。" : "先补齐挂牌价，再进入待售。",
      actionLabel: item.list_price > 0 ? "推进状态" : "补价格",
      actionKind: item.list_price > 0 ? "transition" : "update",
      tone: item.list_price > 0 ? "info" : "warning",
      nextStatus: "ready_for_sale",
    };
  }

  if (item.status === "ready_for_sale") {
    return {
      label: "上架售卖",
      detail: "设备已可售，下一步挂牌或直接售出。",
      actionLabel: "推进状态",
      actionKind: "transition",
      tone: "success",
      nextStatus: "listed",
    };
  }

  if (item.status === "listed") {
    return {
      label: "跟进销售",
      detail: "设备正在售卖中，可预留客户或登记售出。",
      actionLabel: "登记售出",
      actionKind: "sell",
      tone: "success",
      nextStatus: "sold",
    };
  }

  if (item.status === "reserved") {
    return {
      label: "确认售出",
      detail: "已有预留，确认客户取机和付款后登记售出。",
      actionLabel: "登记售出",
      actionKind: "sell",
      tone: "warning",
      nextStatus: "sold",
    };
  }

  if (item.status === "sold") {
    return {
      label: "已售出",
      detail:
        item.sale_price > 0
          ? "流程已完成，仅需处理售后退回。"
          : "已售状态缺少成交价，建议复核流水。",
      actionLabel: "查看记录",
      actionKind: "view",
      tone: item.sale_price > 0 ? "success" : "warning",
      nextStatus: "returned",
    };
  }

  if (item.status === "returned") {
    return {
      label: "退回复检",
      detail: "售后退回设备需重新检测，再决定整备、上架或拆件。",
      actionLabel: "登记检测",
      actionKind: "check",
      tone: "warning",
      nextStatus: "refurbishing",
    };
  }

  if (item.status === "cancelled") {
    return {
      label: "已取消",
      detail: "流程已取消，保留历史记录。",
      actionLabel: "查看记录",
      actionKind: "view",
      tone: "neutral",
    };
  }

  return {
    label: "已处理",
    detail: "库存记录已结束，可查看历史。",
    actionLabel: "查看记录",
    actionKind: "view",
    tone: "neutral",
  };
}

export function inventoryNextActionLabel(
  itemOrStatus: InventoryItemStatus | Parameters<typeof getInventoryPrimaryAction>[0],
) {
  if (typeof itemOrStatus !== "string") {
    const action = getInventoryPrimaryAction(itemOrStatus);
    return `下一步：${action.label}`;
  }

  const labels: Record<InventoryItemStatus, string> = {
    intake: "下一步：登记检测 / 生成报价",
    evaluating: "下一步：生成报价或确认回收",
    offer_made: "下一步：客户确认回收",
    purchased: "下一步：资料清除或整备",
    data_wipe: "下一步：整备 / 待上架",
    refurbishing: "下一步：待上架或上架",
    ready_for_sale: "下一步：上架或直接售出",
    listed: "下一步：预订 / 售出",
    reserved: "下一步：确认售出",
    sold: "已售出：仅处理售后退回",
    cancelled: "流程已取消",
    returned: "下一步：重新整备",
    recycled: "流程已结束",
  };

  return labels[itemOrStatus];
}

export function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
