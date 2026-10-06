"use client";
import { useLanguage } from "@/components/language-provider";
import { ShieldAlert } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { useStaff } from "./use-staff";
export function AccessPanel() {
  const { t, systemText } = useLanguage(); const staff=useStaff();return <main className="module-page"><header className="module-heading"><PageTitle title={t("访问权限")} /></header><section className="panel module-empty"><ShieldAlert size={28}/><strong>{staff.ready ? t("当前账号无法访问此页面") : t("正在核对账号权限…")}</strong><p>{systemText(staff.error) || t("请在账号菜单核对当前身份，员工权限由门店管理者分配。")}</p></section></main>; }
