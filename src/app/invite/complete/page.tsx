import type { Metadata } from "next";

import { InviteRegistrationScreen } from "@/features/auth/screens/invite-registration-screen";

export const metadata: Metadata = {
  title: "完成员工邀请",
  description: "完成 RepairDesk 员工账号和店铺邀请",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function InviteCompletePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const invitationId = firstValue(params.id);
  const mode = firstValue(params.mode) === "new" ? "new" : "existing";
  return <InviteRegistrationScreen invitationId={invitationId} mode={mode} />;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
