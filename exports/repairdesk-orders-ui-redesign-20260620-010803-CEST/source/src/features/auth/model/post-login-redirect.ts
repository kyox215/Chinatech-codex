import type { OnboardingStatus } from "@/lib/repairdesk/types";

export function resolvePostLoginPath(status: OnboardingStatus | null | undefined, next = "/") {
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (status?.activeStore) {
    if (safeNext === "/onboarding") return "/";
    if (safeNext.startsWith("/platform") && !status.isPlatformAdmin) return "/";
    return safeNext;
  }

  if (status?.isPlatformAdmin) return "/platform";
  return "/onboarding";
}
