"use client";
import { useLanguage } from "@/components/language-provider";
import { ShieldAlert } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { useStaff } from "./use-staff";
import { usePathname } from "next/navigation";
import { ReadPending } from "@/components/page-recovery";
export function AccessPanel() {
  const { t, systemText } = useLanguage();
  const staff=useStaff();
  const pathname=usePathname();
  const title=pathname.startsWith("/app/repairs")?"维修工单":pathname.startsWith("/app/retail")?"整机商品":pathname.startsWith("/app/procurement")?"采购到货":pathname.startsWith("/app/customer-devices")?"客户设备":pathname.startsWith("/app/customers")?"客户管理":pathname.startsWith("/app/settings")?"门店设置":pathname.startsWith("/app/catalog")?"设备目录":"工作台";
  return <main className="module-page"><header className="module-heading"><PageTitle title={t(staff.ready?"访问权限":title)} /></header>{!staff.ready?<ReadPending label="正在核对账号权限…" />:<section className="panel module-empty"><ShieldAlert size={28}/><strong>{t("当前账号无法访问此页面")}</strong><p>{systemText(staff.error) || t("请在账号菜单核对当前身份，员工权限由门店管理者分配。")}</p></section>}</main>;
}
