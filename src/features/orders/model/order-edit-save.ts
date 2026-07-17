import { buildOrderPatchChanges } from "@/features/orders/model/order-edit-diff";
import {
  createFinanceDraftState,
  normalizeFinanceDraft,
} from "@/features/orders/model/order-finance-draft";
import type {
  OrderCapabilities,
  PatchOrderChanges,
  PatchOrderResult,
  UpdateOrderInput,
} from "@/lib/repairdesk/types";

export type OrderEditSaveStep = "routine" | "finance";

export interface OrderEditSavePlan {
  routineChanges: PatchOrderChanges;
  financeChange: {
    faultPrices: UpdateOrderInput["fault_prices"];
    depositAmount: number;
  } | null;
  steps: OrderEditSaveStep[];
}

interface BuildOrderEditSavePlanInput {
  baseline: UpdateOrderInput;
  draft: UpdateOrderInput;
  capabilities: Pick<OrderCapabilities, "canEditIntake" | "canEditRepair" | "canAdjustFinance">;
}

interface ExecuteOrderEditSavePlanInput {
  plan: OrderEditSavePlan;
  expectedUpdatedAt: string;
  saveRoutine: (expectedUpdatedAt: string, changes: PatchOrderChanges) => Promise<PatchOrderResult>;
  saveFinance: (
    expectedUpdatedAt: string,
    change: NonNullable<OrderEditSavePlan["financeChange"]>,
  ) => Promise<PatchOrderResult>;
}

export interface OrderEditSaveResult {
  completedSteps: OrderEditSaveStep[];
  updatedAt: string;
}

export class OrderEditSaveExecutionError extends Error {
  readonly failedStep: OrderEditSaveStep;
  readonly completedSteps: OrderEditSaveStep[];
  readonly latestUpdatedAt: string;
  readonly reason: unknown;

  constructor({
    failedStep,
    completedSteps,
    latestUpdatedAt,
    reason,
  }: {
    failedStep: OrderEditSaveStep;
    completedSteps: OrderEditSaveStep[];
    latestUpdatedAt: string;
    reason: unknown;
  }) {
    super(reason instanceof Error ? reason.message : "保存失败，请稍后重试。");
    this.name = "OrderEditSaveExecutionError";
    this.failedStep = failedStep;
    this.completedSteps = completedSteps;
    this.latestUpdatedAt = latestUpdatedAt;
    this.reason = reason;
  }
}

export function buildOrderEditSavePlan({
  baseline,
  draft,
  capabilities,
}: BuildOrderEditSavePlanInput): OrderEditSavePlan {
  const routineChanges = buildOrderPatchChanges(baseline, draft, capabilities);
  const baselineFinance = normalizeOrderEditFinance(baseline);
  const draftFinance = normalizeOrderEditFinance(draft);
  const financeChanged = financeSignature(baselineFinance) !== financeSignature(draftFinance);

  if (financeChanged && !capabilities.canAdjustFinance) {
    throw new Error("当前账号没有调整报价的权限");
  }

  const financeChange = financeChanged
    ? {
        faultPrices: draftFinance.faultPrices,
        depositAmount: draftFinance.depositAmount,
      }
    : null;
  const steps: OrderEditSaveStep[] = [];
  if (Object.keys(routineChanges).length > 0) steps.push("routine");
  if (financeChange) steps.push("finance");

  return { routineChanges, financeChange, steps };
}

export async function executeOrderEditSavePlan({
  plan,
  expectedUpdatedAt,
  saveRoutine,
  saveFinance,
}: ExecuteOrderEditSavePlanInput): Promise<OrderEditSaveResult> {
  if (plan.steps.length === 0) throw new Error("没有可保存的修改");

  let latestUpdatedAt = expectedUpdatedAt;
  const completedSteps: OrderEditSaveStep[] = [];

  for (const step of plan.steps) {
    try {
      const result =
        step === "routine"
          ? await saveRoutine(latestUpdatedAt, plan.routineChanges)
          : await saveFinance(latestUpdatedAt, requireFinanceChange(plan));
      latestUpdatedAt = result.updated_at;
      completedSteps.push(step);
    } catch (reason) {
      throw new OrderEditSaveExecutionError({
        failedStep: step,
        completedSteps: [...completedSteps],
        latestUpdatedAt,
        reason,
      });
    }
  }

  return { completedSteps, updatedAt: latestUpdatedAt };
}

export function advanceOrderEditBaseline({
  baseline,
  plan,
  completedSteps,
  updatedAt,
}: {
  baseline: UpdateOrderInput;
  plan: OrderEditSavePlan;
  completedSteps: OrderEditSaveStep[];
  updatedAt: string;
}): UpdateOrderInput {
  const next: UpdateOrderInput = { ...baseline, expected_updated_at: updatedAt };

  if (completedSteps.includes("routine")) {
    Object.assign(next, plan.routineChanges);
  }
  if (completedSteps.includes("finance") && plan.financeChange) {
    next.fault_prices = plan.financeChange.faultPrices;
    next.deposit_amount = plan.financeChange.depositAmount;
  }

  return next;
}

function normalizeOrderEditFinance(input: UpdateOrderInput) {
  const normalized = normalizeFinanceDraft(
    createFinanceDraftState(input.fault_prices, input.deposit_amount ?? 0),
    0,
  );
  return {
    faultPrices: normalized.faultPrices,
    depositAmount: normalized.deposit,
  };
}

function financeSignature(change: ReturnType<typeof normalizeOrderEditFinance>) {
  return JSON.stringify(change);
}

function requireFinanceChange(plan: OrderEditSavePlan) {
  if (!plan.financeChange) throw new Error("报价保存计划缺少报价修改");
  return plan.financeChange;
}
