"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "./language-provider";

export const listPageSize = 50;
export function ListPagination({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (page: number) => void }) {
  const { t } = useLanguage();
  if (pages <= 1) return null;
  return <nav className="list-pagination" aria-label={t("列表分页")}><span role="status">{t("第 {v0} / {v1} 页 · 共 {v2} 条", { v0: page, v1: pages, v2: total })}</span><button type="button" className="button button--secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16} aria-hidden="true" />{t("上一页")}</button><button type="button" className="button button--secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>{t("下一页")}<ChevronRight size={16} aria-hidden="true" /></button></nav>;
}
