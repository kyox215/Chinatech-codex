import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { ProcurementProvider } from "@/components/procurement/procurement-provider";
import { RetailProvider } from "@/components/retail/retail-provider";
import { isPreviewLoginAvailable, PREVIEW_SESSION_COOKIE, PREVIEW_SESSION_VALUE } from "@/lib/preview-auth";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  if (!isPreviewLoginAvailable() || cookieStore.get(PREVIEW_SESSION_COOKIE)?.value !== PREVIEW_SESSION_VALUE) {
    redirect("/login");
  }
  return <ProcurementProvider><RetailProvider><AppShell>{children}</AppShell></RetailProvider></ProcurementProvider>;
}
