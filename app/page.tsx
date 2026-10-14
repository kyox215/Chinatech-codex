import HomePageContent from "@/components/home/home-page";
import { AuthStatusProvider } from "@/components/auth-status-provider";
import { getPublicAuthBootstrap } from "@/lib/server/auth-status";

export const dynamic = "force-dynamic";
export default async function HomePage() { const initial = await getPublicAuthBootstrap(); return <AuthStatusProvider initial={initial.status} initialChecking={initial.checking}><HomePageContent /></AuthStatusProvider>; }
