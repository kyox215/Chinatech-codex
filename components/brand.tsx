"use client";

import { useLanguage } from "@/components/language-provider";
import Link from "next/link";
import { Wrench } from "lucide-react";

type BrandProps = {
  compact?: boolean;
  href?: string;
  inverse?: boolean;
};

export function Brand({ compact = false, href = "/", inverse = false }: BrandProps) {
  const { t } = useLanguage();
  return (
    <Link className={`brand${inverse ? " brand--inverse" : ""}`} href={href} aria-label={t("ChinaTech 首页")}>
      <span className="brand__mark" aria-hidden="true">
        <Wrench size={18} strokeWidth={2.3} />
      </span>
      <span className={compact ? "brand__copy brand__copy--compact" : "brand__copy"}>
        <strong>ChinaTech</strong>
        <small>{t("维修 · 采购 · 整机")}</small>
      </span>
    </Link>
  );
}
