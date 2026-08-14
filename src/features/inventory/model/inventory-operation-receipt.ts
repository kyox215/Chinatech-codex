import type {
  InventoryLifecycleCommand,
  InventoryLifecycleCommandResult,
} from "@/lib/repairdesk/types";

export type InventoryOperationReceiptKind = "confirmed" | "idempotent-replay";

export type InventoryOperationReceipt = {
  command: InventoryLifecycleCommand;
  kind: InventoryOperationReceiptKind;
  replayed: boolean;
  title: string;
  description: string;
  ledgerSemantics: string;
  nextStep: string;
};

type ReceiptCopy = Omit<InventoryOperationReceipt, "command" | "kind" | "replayed">;

const genericCopy: ReceiptCopy = {
  title: "写入已确认",
  description: "服务端已确认该命令成功；详情将以最新账本读回为准。",
  ledgerSemantics: "本次写入已确认，业务版本和投影以最新读回为准。",
  nextStep: "等待同步后查看当前业务记录。",
};

const commandCopy: Partial<Record<InventoryLifecycleCommand, ReceiptCopy>> = {
  "acquisition.save": {
    title: "入库写入已确认",
    description: "入库命令已确认成功；库存版本将以最新读回为准。",
    ledgerSemantics: "入库记录已写入，库存投影以最新读回为准。",
    nextStep: "等待同步后查看商品详情。",
  },
  "inspection.save": {
    title: "检测写入已确认",
    description: "检测命令已确认成功；设备信息以最新读回为准。",
    ledgerSemantics: "检测记录以新版本追加，库存版本以最新读回为准。",
    nextStep: "等待同步后查看商品详情。",
  },
  "reservation.create": {
    title: "预订写入已确认",
    description: "预订命令已确认成功；后续状态以最新读回为准。",
    ledgerSemantics: "预订账已建立，业务状态以最新读回为准。",
    nextStep: "等待同步后查看预订与收款工作台。",
  },
  "payment.append": {
    title: "付款记录已确认追加",
    description: "付款命令已确认成功；余额以最新账本读回为准。",
    ledgerSemantics: "付款流水以追加方式写入，余额由最新账本派生。",
    nextStep: "等待同步后查看销售与取走。",
  },
  "sale.complete": {
    title: "销售完成已确认",
    description: "销售命令已确认成功；后续投影以最新读回为准。",
    ledgerSemantics: "销售记录与库存状态转换已写入，业务状态以最新读回为准。",
    nextStep: "等待同步后查看销售与取走。",
  },
  "pickup.confirm": {
    title: "取走确认已写入",
    description: "取走命令已确认成功；保修详情以最新读回为准。",
    ledgerSemantics: "取走与保修起点记录已写入，后续投影以最新读回为准。",
    nextStep: "等待同步后查看销售记录。",
  },
  "reservation.cancel": {
    title: "预订取消已确认",
    description: "取消命令已确认成功；库存投影以最新读回为准。",
    ledgerSemantics: "预订取消事件已追加，库存投影以最新读回为准。",
    nextStep: "等待同步后查看库存。",
  },
  "warranty.adjust": {
    title: "保修调整已确认",
    description: "保修调整命令已确认成功；详情以最新读回为准。",
    ledgerSemantics: "保修版本以追加方式写入，后续投影以最新读回为准。",
    nextStep: "等待同步后查看销售记录。",
  },
  "after_sales.create": {
    title: "售后案件已确认建立",
    description: "售后登记命令已确认成功；案件投影以最新读回为准。",
    ledgerSemantics: "售后事件已追加，案件投影以最新读回为准。",
    nextStep: "等待同步后打开售后案件。",
  },
  "after_sales.update": {
    title: "售后更新已确认",
    description: "售后更新命令已确认成功；案件投影以最新读回为准。",
    ledgerSemantics: "售后状态与处理记录已追加，案件投影以最新读回为准。",
    nextStep: "等待同步后查看案件。",
  },
  "after_sales.close": {
    title: "售后关闭已确认",
    description: "售后关闭命令已确认成功；案件投影以最新读回为准。",
    ledgerSemantics: "售后关闭事件已追加，案件投影以最新读回为准。",
    nextStep: "等待同步后查看案件。",
  },
};

/**
 * Converts a successful lifecycle result into safe, structured UI copy.
 *
 * The result's identifiers, money, timestamps, and server text deliberately
 * never cross this boundary. `command` is the only source for the action
 * wording; the result code only distinguishes a fresh confirmation from an
 * idempotent replay. Failed results are not receipts.
 */
export function resolveInventoryOperationReceipt(
  command: InventoryLifecycleCommand,
  result: InventoryLifecycleCommandResult | null | undefined,
): InventoryOperationReceipt | null {
  if (!result || result.ok !== true) return null;

  const copy = commandCopy[command] ?? genericCopy;
  const replayed = result.code === "idempotent_replay";
  return {
    command,
    kind: replayed ? "idempotent-replay" : "confirmed",
    replayed,
    ...copy,
  };
}
