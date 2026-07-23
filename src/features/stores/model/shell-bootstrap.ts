import type { AiAssistantCapabilities } from "@/features/ai-assistant/model/contracts";
import type { OnboardingStatus, StoreContext } from "@/lib/repairdesk/types";

export interface ShellBootstrap {
  onboarding: OnboardingStatus;
  storeContext: StoreContext;
  aiCapabilities: AiAssistantCapabilities;
  generatedAt: string;
}
