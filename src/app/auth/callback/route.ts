import { NextResponse } from "next/server";

import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_COOKIE_MAX_AGE_SECONDS,
} from "@/features/auth/model/password-recovery";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL(next, url.origin));
      if (next === "/reset-password") {
        response.cookies.set(PASSWORD_RECOVERY_COOKIE, "1", {
          httpOnly: true,
          maxAge: PASSWORD_RECOVERY_COOKIE_MAX_AGE_SECONDS,
          path: "/",
          sameSite: "lax",
          secure: url.protocol === "https:",
        });
      }
      return response;
    }
  }

  const errorUrl = new URL(next === "/reset-password" ? "/forgot-password" : "/login", url.origin);
  errorUrl.searchParams.set("auth_error", "callback");
  return NextResponse.redirect(errorUrl);
}

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
