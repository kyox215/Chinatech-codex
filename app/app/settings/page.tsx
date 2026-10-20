import { BackendPageFrame } from "@/components/backend-page-frame";
import { SettingsPage } from "@/components/settings/settings-page";
import{backendSettingsSectionsEnabled}from'@/lib/backend/page-state';
export const metadata = { title: "门店管理" };
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <BackendPageFrame plan={{ kind: "settings",settingsQuery:{kind:tab==="finance"?"finance":tab==="staff"?"staff":tab==="suppliers"?"suppliers":tab==="printing"?"printing":tab==="orders"?"orders":"general",q:"",filter:"all",key:"",id:""} }}><SettingsPage key={tab ?? "general"} initialTab={tab} bounded={backendSettingsSectionsEnabled()}/></BackendPageFrame>;
}
