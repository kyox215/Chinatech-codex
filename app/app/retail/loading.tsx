"use client";
import { useLanguage } from "@/components/language-provider";

export default function RetailLoading() { const { t } = useLanguage(); return <div className="module-page" role="status" aria-label={t("正在加载整机商品")}><div className="module-skeleton module-skeleton--heading" /><div className="module-skeleton module-skeleton--cards" /><div className="module-skeleton module-skeleton--list" /></div>; }
