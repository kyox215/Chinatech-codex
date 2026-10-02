"use client";
import { ShieldAlert } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { useStaff } from "./use-staff";
export function AccessPanel() { const staff=useStaff();return <main className="module-page"><header className="module-heading"><PageTitle title="访问权限" /></header><section className="panel module-empty"><ShieldAlert size={28}/><strong>{staff.ready ? "当前账号无法访问此页面" : "正在核对预览身份…"}</strong><p>{staff.error || "请在账号菜单核对当前预览身份，员工权限由门店管理者分配。"}</p></section></main>; }
