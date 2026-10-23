"use client";

import { useLanguage } from "@/components/language-provider";
import { NavigationLink as Link } from "@/components/navigation-link";
import { Box, Wrench } from "lucide-react";

type BrandProps = {
  compact?: boolean;
  href?: string;
  inverse?: boolean;
  purpose?: "repair" | "personal";
  appearance?: "hub";
  className?: string;
};

export function Brand({ compact = false, href = "/", inverse = false, purpose = "repair", appearance, className = "" }: BrandProps) {
  const { t } = useLanguage();
  return (
    <Link className={`brand${inverse ? " brand--inverse" : ""} ${className}`} href={href} aria-label={appearance === "hub" ? t("kyox215 Hub 首页") : t("ChinaTech 首页")} icon={<span className="brand__mark" aria-hidden="true">
        {appearance === "hub" ? <Box size={21} strokeWidth={1.8} /> : <Wrench size={18} strokeWidth={2.3} />}
      </span>}>
      <span className={compact ? "brand__copy brand__copy--compact" : "brand__copy"}>
        <strong>{appearance === "hub" ? t("kyox215 Hub") : "ChinaTech"}</strong>
        <small>{t(purpose === "personal" ? "工作 · 生活" : "维修 · 采购 · 整机")}</small>
      </span>
    </Link>
  );
}
