"use client";
import { NavigationLink as Link } from "@/components/navigation-link";
import { SearchX } from "lucide-react";
import { useLanguage } from "@/components/language-provider";

export default function NotFound() {
  const { t } = useLanguage();
  return <main className="page-state"><section className="panel module-empty">
    <SearchX size={32} aria-hidden="true" />
    <h1>{t("没有找到此页面")}</h1>
    <p>{t("地址可能有误，请返回首页继续。")}</p>
    <Link className="button button--primary" href="/">{t("返回首页")}</Link>
  </section></main>;
}
