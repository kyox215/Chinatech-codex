import { describe, expect, it } from "vitest";

import {
  applyAuthCookiePersistence,
  authPersistenceModeFromRemember,
  getAuthPersistenceModeFromCookieHeader,
  readRememberLoginPreference,
  writeRememberLoginPreference,
} from "@/features/auth/model/auth-persistence";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  };
}

describe("auth persistence", () => {
  it("defaults remember login to enabled", () => {
    expect(readRememberLoginPreference(memoryStorage())).toBe(true);
  });

  it("reads and writes remember login preference", () => {
    const storage = memoryStorage();

    writeRememberLoginPreference(false, storage);
    expect(readRememberLoginPreference(storage)).toBe(false);

    writeRememberLoginPreference(true, storage);
    expect(readRememberLoginPreference(storage)).toBe(true);
  });

  it("maps remember preference to persistence mode", () => {
    expect(authPersistenceModeFromRemember(true)).toBe("persistent");
    expect(authPersistenceModeFromRemember(false)).toBe("session");
  });

  it("reads persistence mode from cookie headers", () => {
    expect(getAuthPersistenceModeFromCookieHeader("repairdesk-auth-persistence=session")).toBe(
      "session",
    );
    expect(getAuthPersistenceModeFromCookieHeader("repairdesk-auth-persistence=persistent")).toBe(
      "persistent",
    );
    expect(getAuthPersistenceModeFromCookieHeader("other=value")).toBe("persistent");
  });

  it("keeps Supabase auth cookie lifetime for persistent mode", () => {
    const expires = new Date("2030-01-01T00:00:00.000Z");
    const options = applyAuthCookiePersistence(
      "sb-project-auth-token",
      { maxAge: 100, expires, path: "/" },
      "persistent",
    );

    expect(options).toMatchObject({ maxAge: 100, expires, path: "/" });
  });

  it("converts Supabase auth cookies to session cookies when remember is disabled", () => {
    const options = applyAuthCookiePersistence(
      "sb-project-auth-token.0",
      { maxAge: 100, expires: new Date("2030-01-01T00:00:00.000Z"), path: "/" },
      "session",
    );

    expect(options.maxAge).toBeUndefined();
    expect(options.expires).toBeUndefined();
    expect(options.path).toBe("/");
  });

  it("keeps delete-cookie maxAge so sign out can clear Supabase cookies", () => {
    const options = applyAuthCookiePersistence(
      "sb-project-auth-token",
      { maxAge: 0, expires: new Date("1970-01-01T00:00:00.000Z"), path: "/" },
      "session",
    );

    expect(options.maxAge).toBe(0);
    expect(options.expires?.toISOString()).toBe("1970-01-01T00:00:00.000Z");
  });

  it("does not rewrite unrelated cookies", () => {
    const expires = new Date("2030-01-01T00:00:00.000Z");
    const options = applyAuthCookiePersistence(
      "repairdesk-auth-persistence",
      { maxAge: 100, expires, path: "/" },
      "session",
    );

    expect(options).toMatchObject({ maxAge: 100, expires, path: "/" });
  });
});
