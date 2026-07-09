import { NextResponse } from "next/server";

import { PASSWORD_RECOVERY_COOKIE } from "@/features/auth/model/password-recovery";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PASSWORD_RECOVERY_COOKIE, "", {
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });
  return response;
}
