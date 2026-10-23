import type { Metadata } from "next";
import { PublicAuthPage } from "@/components/home/public-auth-page";
import { PortalPage } from "@/components/home/portal-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "我的数字空间",
  description: "把工作、生活与开源应用放在一个地方。维修管理、放映室与电流脉动，从这里进入。",
};
export default function HomePage() {
  return <PublicAuthPage><PortalPage /></PublicAuthPage>;
}
