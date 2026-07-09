import type { Metadata } from "next";

import { AccountCenterScreen } from "@/features/account/screens/account-center-screen";

export const metadata: Metadata = {
  title: "个人中心 | RepairDesk",
  description: "查看账号资料、修改密码和绑定联系手机号。",
};

export default function AccountPage() {
  return <AccountCenterScreen />;
}
