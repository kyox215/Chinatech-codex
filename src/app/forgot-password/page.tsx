import type { Metadata } from "next";
import { Suspense } from "react";

import { ForgotPasswordScreen } from "@/features/auth/screens/forgot-password-screen";

export const metadata: Metadata = {
  title: "找回密码 | RepairDesk",
  description: "通过账号邮箱发送 RepairDesk 密码重置邮件。",
};

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-sm text-muted-foreground">正在加载找回密码...</div>}
    >
      <ForgotPasswordScreen />
    </Suspense>
  );
}
