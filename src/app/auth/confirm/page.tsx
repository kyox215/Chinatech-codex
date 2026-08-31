import type { Metadata } from "next";

import { AuthConfirmScreen } from "@/features/auth/screens/auth-confirm-screen";
import { getLocalizedMetadata } from "@/shared/i18n/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    ...(await getLocalizedMetadata("auth.confirmTitle")),
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function AuthConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tokenHash = firstValue(params.token_hash);
  const type = firstValue(params.type);
  const next = firstValue(params.next);
  const valid =
    /^[a-f0-9]{64}$/i.test(tokenHash) &&
    (type === "invite" || type === "magiclink") &&
    Boolean(next);

  return <AuthConfirmScreen valid={valid} tokenHash={tokenHash} type={type} next={next} />;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
