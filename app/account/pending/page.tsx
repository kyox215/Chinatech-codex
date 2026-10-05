import { redirect } from "next/navigation";
import { PendingAccountContent } from "@/components/auth/pending-account-content";
import { isSupabaseMode } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerAccess } from "@/lib/backend/context";

export const dynamic = "force-dynamic";
export default async function PendingAccountPage() {
  if (!isSupabaseMode()) redirect("/login");
  let active=false;
  try {active=Boolean(await getServerAccess());} catch { /* Await verification or a working database. */ }
  if(active) redirect("/app/dashboard");
  let verified = false; let unavailable = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    verified = !error && Boolean(data.user?.email_confirmed_at);
  } catch { unavailable = true; }
  return <PendingAccountContent unavailable={unavailable} verified={verified} />;
}
