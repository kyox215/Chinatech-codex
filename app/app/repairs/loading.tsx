"use client";
import { useLanguage } from "@/components/language-provider";

export default function RepairsLoading() {
  const { t } = useLanguage();
  return (
    <main className="module-page" aria-label={t("正在加载维修工单")}>
      <div className="module-skeleton module-skeleton--heading" />
      <div className="module-skeleton module-skeleton--cards" />
      <div className="module-skeleton module-skeleton--list" />
    </main>
  );
}
