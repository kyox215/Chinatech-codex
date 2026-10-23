import type { Metadata } from "next";
import RepairPageContent from "@/components/home/home-page";
import { PublicAuthPage } from "@/components/home/public-auth-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "手机维修管理",
  description: "管理维修工单、采购与整机业务，查看使用教程并进入工作台。",
};
export default function RepairPage() {
  return <PublicAuthPage><RepairPageContent /></PublicAuthPage>;
}
