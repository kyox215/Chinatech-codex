import { createBrowserClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

import {
  applyAuthCookiePersistence,
  getAuthPersistenceModeFromCookieHeader,
} from "@/features/auth/model/auth-persistence";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return getBrowserCookies();
        },
        setAll(cookiesToSet) {
          const mode = getAuthPersistenceModeFromCookieHeader(document.cookie);
          cookiesToSet.forEach(({ name, value, options }) => {
            document.cookie = serializeBrowserCookie(
              name,
              value,
              applyAuthCookiePersistence(name, options, mode),
            );
          });
        },
      },
    },
  );
}

function getBrowserCookies() {
  if (typeof document === "undefined") return [];
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...value] = part.split("=");
      return { name, value: value.join("=") };
    });
}

function serializeBrowserCookie(name: string, value: string, options: CookieOptions = {}) {
  const parts = [`${name}=${value}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.sameSite) parts.push(`SameSite=${formatSameSite(options.sameSite)}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function formatSameSite(value: CookieOptions["sameSite"]) {
  if (value === true) return "Strict";
  return String(value).toLowerCase();
}
