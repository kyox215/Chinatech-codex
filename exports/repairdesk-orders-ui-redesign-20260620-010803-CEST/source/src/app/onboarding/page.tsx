import type { Metadata } from "next";

import { OnboardingScreen } from "@/features/auth/screens/onboarding-screen";

export const metadata: Metadata = {
  title: "账号开通",
  description: "提交 RepairDesk 店铺访问申请",
};

export default function OnboardingPage() {
  return <OnboardingScreen />;
}
