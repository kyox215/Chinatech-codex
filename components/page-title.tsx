"use client";

import { useLanguage } from "@/components/language-provider";
import Link from "next/link";
import { createContext, useContext } from "react";
import { ArrowLeft, Menu } from "lucide-react";
export const AppNavigationContext = createContext<{ isMobile: boolean; expanded: boolean; toggle: () => void } | null>(null);
export function SidebarToggle() {
  const { t } = useLanguage();
  const navigation = useContext(AppNavigationContext);
  if (!navigation || !navigation.isMobile) return null;
  return <button type="button" className="icon-button page-menu-button" onClick={navigation.toggle} aria-label={t("打开菜单")} aria-expanded={navigation.expanded} aria-controls="app-sidebar" title={t("打开菜单")}><Menu size={20} /></button>;
}
type PageTitleProps = {
  title: string;
  backHref?: string;
  backLabel?: string;
  backScroll?: boolean;
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
};

export function PageTitle({ title, backHref, backLabel = "返回列表", backScroll, badge, subtitle, children }: PageTitleProps) {
  const { t } = useLanguage();
  const returnLabel = /^(返回|Back|Torna)/.test(backLabel) ? t(backLabel) : t("返回{v0}", { v0: t(backLabel) });
  return <div className="module-title">
    <SidebarToggle />
    {backHref ? <Link className="icon-button page-back-button" href={backHref} scroll={backScroll} title={returnLabel} aria-label={returnLabel}><ArrowLeft size={20} aria-hidden="true" /></Link> : null}
    <div className="module-title__content">
      <div className="module-title__line"><h2>{title}</h2>{badge}</div>
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </div>
  </div>;
}
