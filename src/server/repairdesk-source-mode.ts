type RepairDeskRuntimeEnv = Partial<Pick<NodeJS.ProcessEnv, "NODE_ENV" | "VERCEL_ENV">>;

export type RepairDeskSourceMode = "supabase" | "mock";

export function isRepairDeskProductionRuntime(env: RepairDeskRuntimeEnv = process.env) {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

export function resolveRepairDeskSourceMode(input: {
  hasSupabaseConfig: boolean;
  e2eAuthBypass: boolean;
  env?: RepairDeskRuntimeEnv;
}): RepairDeskSourceMode {
  if (input.hasSupabaseConfig && !input.e2eAuthBypass) return "supabase";
  if (isRepairDeskProductionRuntime(input.env)) {
    throw new Error("RepairDesk production requires Supabase config and forbids E2E auth bypass");
  }
  return "mock";
}

export function assertRepairDeskBrowserAuthMode(input: {
  hasBrowserAuthConfig: boolean;
  env?: RepairDeskRuntimeEnv;
}) {
  if (input.hasBrowserAuthConfig) return;
  if (isRepairDeskProductionRuntime(input.env)) {
    throw new Error("RepairDesk production requires Supabase browser auth config");
  }
}
