import type { Metadata } from "next";

import { ResetPasswordScreen } from "@/features/auth/screens/reset-password-screen";

export const metadata: Metadata = {
  title: "设置新密码 | RepairDesk",
  description: "通过邮件恢复会话设置新的 RepairDesk 账号密码。",
};

export default function ResetPasswordPage() {
  return <ResetPasswordScreen />;
}
