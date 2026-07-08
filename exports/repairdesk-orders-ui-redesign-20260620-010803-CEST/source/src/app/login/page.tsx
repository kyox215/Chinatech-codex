import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginScreen } from "@/features/auth/screens/login-screen";

export const metadata: Metadata = {
  title: "登录",
  description: "RepairDesk 员工邮箱登录",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">正在加载登录...</div>}>
      <LoginScreen />
    </Suspense>
  );
}
