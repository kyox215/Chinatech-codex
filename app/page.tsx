import HomePageContent from "@/components/home/home-page";
import { AuthStatusProvider } from "@/components/auth-status-provider";
import { getAuthStatus } from "@/lib/server/auth-status";

export const dynamic = "force-dynamic";
export default async function HomePage() { return <AuthStatusProvider initial={await getAuthStatus()}><HomePageContent /></AuthStatusProvider>; }
