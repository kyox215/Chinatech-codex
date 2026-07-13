import { isRepairDeskProductionRuntime } from "@/server/repairdesk-source-mode";

type KioskReviewRuntimeEnv = Partial<
  Pick<NodeJS.ProcessEnv, "NODE_ENV" | "VERCEL_ENV" | "REPAIRDESK_KIOSK_REVIEW_WRITES_ENABLED">
>;

export function assertKioskReviewWriteEnabled(env: KioskReviewRuntimeEnv = process.env) {
  if (!isRepairDeskProductionRuntime(env)) return;
  if (env.REPAIRDESK_KIOSK_REVIEW_WRITES_ENABLED === "1") return;
  throw new Error("客户 iPad 审核写入暂未启用，请联系店主完成安全发布门禁");
}
