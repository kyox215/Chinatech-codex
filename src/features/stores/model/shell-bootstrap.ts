import type { OnboardingStatus, StoreContext } from "@/lib/repairdesk/types";

export interface ShellBootstrap {
  onboarding: OnboardingStatus;
  storeContext: StoreContext;
  generatedAt: string;
}
