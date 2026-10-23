import type { Metadata } from "next";
import { PublicAuthPage } from "@/components/home/public-auth-page";
import { PortalPage } from "@/components/home/portal-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "我的数字空间",
  description: "把工作与生活中的常用功能，放在一个地方。维修管理与放映室，从这里进入。",
};
export default function HomePage() {
  return <PublicAuthPage><PortalPage /></PublicAuthPage>;
}
