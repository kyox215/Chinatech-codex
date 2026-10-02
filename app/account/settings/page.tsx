import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { PageTitle } from "@/components/page-title";
import { AccountSettings } from "@/components/account/account-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseMode } from "@/lib/supabase/config";
import styles from "@/components/account/account-settings.module.css";

export const metadata: Metadata = { title: "账号设置", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountSettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  if (!isSupabaseMode()) redirect("/login");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email_confirmed_at) redirect("/login");
  const { notice } = await searchParams;
  return <div className={styles.page}>
    <header className={styles.brand}><Brand href="/account/pending" /></header>
    <main className={styles.main}>
      <header className={`module-heading ${styles.heading}`}><PageTitle title="账号设置" backHref="/account/pending" backLabel="工作台" subtitle="管理登录邮箱、手机号与第三方账号" /></header>
      <AccountSettings notice={notice ?? ""} />
    </main>
  </div>;
}
