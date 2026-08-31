import { OnboardingScreen } from "@/features/auth/screens/onboarding-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("auth.onboardingTitle");

export default function OnboardingPage() {
  return <OnboardingScreen />;
}
