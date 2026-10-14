"use client";
import { useLanguage } from "@/components/language-provider";
import { PageLoading } from "@/components/page-recovery";
export default function Loading() { const { t } = useLanguage(); return <PageLoading label={t("正在读取账号…")} />; }
