"use client";
import { PageLoading } from "@/components/page-recovery";
import { useLanguage } from "@/components/language-provider";
export default function Loading() { const { t } = useLanguage(); return <PageLoading internal label={t("正在加载采购")} />; }
