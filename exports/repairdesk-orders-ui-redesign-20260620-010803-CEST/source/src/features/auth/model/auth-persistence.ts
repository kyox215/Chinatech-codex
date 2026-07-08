import type { CookieOptions } from "@supabase/ssr";

export const LOGIN_REMEMBER_STORAGE_KEY = "repairdesk-login-remember";
export const AUTH_PERSISTENCE_COOKIE = "repairdesk-auth-persistence";
export const DEFAULT_REMEMBER_LOGIN = true;

const PERSISTENCE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export type AuthPersistenceMode = "persistent" | "session";

interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function authPersistenceModeFromRemember(remember: boolean): AuthPersistenceMode {
  return remember ? "persistent" : "session";
}

export function parseAuthPersistenceMode(value?: string | null): AuthPersistenceMode {
  return value === "session" ? "session" : "persistent";
}

export function readRememberLoginPreference(
  storage: PreferenceStorage | undefined = getBrowserLocalStorage(),
): boolean {
  try {
    const value = storage?.getItem(LOGIN_REMEMBER_STORAGE_KEY);
    if (value === "false") return false;
    if (value === "true") return true;
    return DEFAULT_REMEMBER_LOGIN;
  } catch {
    return DEFAULT_REMEMBER_LOGIN;
  }
}

export function writeRememberLoginPreference(
  remember: boolean,
  storage: PreferenceStorage | undefined = getBrowserLocalStorage(),
) {
  try {
    storage?.setItem(LOGIN_REMEMBER_STORAGE_KEY, remember ? "true" : "false");
  } catch {
    // Browsers can block localStorage in private or restricted contexts.
  }
}

export function persistBrowserAuthPreference(remember: boolean) {
  writeRememberLoginPreference(remember);
  setBrowserAuthPersistenceCookie(authPersistenceModeFromRemember(remember));
}

export function clearBrowserAuthPersistenceCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_PERSISTENCE_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
}

export function getAuthPersistenceModeFromCookieHeader(
  cookieHeader?: string | null,
): AuthPersistenceMode {
  const value = parseCookieHeader(cookieHeader).get(AUTH_PERSISTENCE_COOKIE);
  return parseAuthPersistenceMode(value);
}

export function applyAuthCookiePersistence(
  cookieName: string,
  options: CookieOptions = {},
  mode: AuthPersistenceMode,
): CookieOptions {
  const next = { ...options };
  if (mode === "session" && isSupabaseAuthCookie(cookieName) && next.maxAge !== 0) {
    delete next.maxAge;
    delete next.expires;
  }
  return next;
}

export function isSupabaseAuthCookie(cookieName: string) {
  return cookieName.startsWith("sb-") && cookieName.includes("auth-token");
}

function setBrowserAuthPersistenceCookie(mode: AuthPersistenceMode) {
  if (typeof document === "undefined") return;
  const maxAge = mode === "persistent" ? `; Max-Age=${PERSISTENCE_COOKIE_MAX_AGE}` : "";
  document.cookie = `${AUTH_PERSISTENCE_COOKIE}=${mode}; Path=/; SameSite=Lax${maxAge}`;
}

function parseCookieHeader(cookieHeader?: string | null) {
  const cookies = new Map<string, string>();
  for (const part of cookieHeader?.split(";") ?? []) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) continue;
    cookies.set(rawName, rawValue.join("="));
  }
  return cookies;
}

function getBrowserLocalStorage() {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}
