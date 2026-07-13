import { isRepairDeskE2eAuthBypassEnabled } from "@/shared/lib/e2e-auth-bypass";
import { isRepairDeskProductionRuntime } from "@/server/repairdesk-source-mode";
import { hasSupabaseConfig } from "@/server/supabase";

type KioskReviewRuntimeEnv = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | "NODE_ENV"
    | "VERCEL_ENV"
    | "REPAIRDESK_KIOSK_PRODUCTION_ENABLED"
    | "REPAIRDESK_KIOSK_REVIEW_WRITES_ENABLED"
  >
>;

interface KioskGateContext {
  hasSupabaseConfig?: boolean;
  e2eAuthBypass?: boolean;
}

function isKioskProductionEnabled(
  env: KioskReviewRuntimeEnv = process.env,
  context: KioskGateContext = {},
) {
  return (
    !requiresExplicitKioskEnable(env, context) || env.REPAIRDESK_KIOSK_PRODUCTION_ENABLED === "1"
  );
}

function assertKioskProductionEnabled(
  env: KioskReviewRuntimeEnv = process.env,
  context: KioskGateContext = {},
) {
  if (isKioskProductionEnabled(env, context)) return;
  throw new Error("客户 iPad 生产功能暂未启用，请联系店主完成安全发布门禁");
}

export function isKioskEndToEndEnabled(
  env: KioskReviewRuntimeEnv = process.env,
  context: KioskGateContext = {},
) {
  if (!isKioskProductionEnabled(env, context)) return false;
  return (
    !requiresExplicitKioskEnable(env, context) || env.REPAIRDESK_KIOSK_REVIEW_WRITES_ENABLED === "1"
  );
}

export function assertKioskEndToEndEnabled(
  env: KioskReviewRuntimeEnv = process.env,
  context: KioskGateContext = {},
) {
  assertKioskProductionEnabled(env, context);
  if (isKioskEndToEndEnabled(env, context)) return;
  throw new Error("客户 iPad 收集与审核链路暂未启用，请联系店主完成安全发布门禁");
}

export function assertKioskReviewWriteEnabled(
  env: KioskReviewRuntimeEnv = process.env,
  context: KioskGateContext = {},
) {
  assertKioskEndToEndEnabled(env, context);
}

function requiresExplicitKioskEnable(env: KioskReviewRuntimeEnv, context: KioskGateContext) {
  const configured = context.hasSupabaseConfig ?? hasSupabaseConfig();
  const bypassed = context.e2eAuthBypass ?? isRepairDeskE2eAuthBypassEnabled();
  return isRepairDeskProductionRuntime(env) || (configured && !bypassed);
}
