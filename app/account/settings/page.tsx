import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountBrand, AccountHeading } from "@/components/account/account-heading";
import { AccountSettings } from "@/components/account/account-settings";
import { getAuthStatus } from "@/lib/server/auth-status";
import { AuthStatusUnavailable } from "@/components/auth/auth-status-unavailable";
import { AuthFrame } from "@/components/auth/auth-frame";
import { isSupabaseMode } from "@/lib/supabase/config";
import styles from "@/components/account/account-settings.module.css";

export const metadata: Metadata = { title: "账号设置", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountSettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  if (!isSupabaseMode()) redirect("/login");
  const status = await getAuthStatus();
  if (status.state === "unavailable") return <AuthFrame><AuthStatusUnavailable /></AuthFrame>;
  if (status.state !== "account" && status.state !== "workspace") redirect("/login");
  const { notice } = await searchParams;
  return <div className={styles.page}>
    <AccountBrand />
    <main className={styles.main}>
      <AccountHeading />
      <AccountSettings notice={notice ?? ""} />
    </main>
  </div>;
}
