import { SettingsPage } from "@/components/settings/settings-page";
export const metadata = { title: "门店管理" };
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <SettingsPage key={tab ?? "general"} initialTab={tab} />;
}
