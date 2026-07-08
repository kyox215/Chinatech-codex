export const THEME_STORAGE_KEY = "repairdesk-theme";
export const THEME_CHANGE_EVENT = "repairdesk-theme-change";

export type ThemePreference = "light" | "dark";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark";
}

export function getThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isThemePreference(stored)) return stored;
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyThemePreference(theme: ThemePreference) {
  if (typeof window === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }));
}

export function toggleThemePreference(): ThemePreference {
  const next = getThemePreference() === "dark" ? "light" : "dark";
  applyThemePreference(next);
  return next;
}
