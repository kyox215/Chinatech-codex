"use client";
import { PageRecovery } from "@/components/page-recovery";
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <PageRecovery retry={retry} internal />;
}
