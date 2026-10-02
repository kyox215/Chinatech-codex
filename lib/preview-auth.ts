export const PREVIEW_SESSION_COOKIE = "ct_preview_session";
export const PREVIEW_SESSION_VALUE = "m1-visual-sample";
export const PREVIEW_EMAIL = "demo@chinatech.local";
export const PREVIEW_PASSWORD = "Preview2026!";

export function isPreviewLoginAvailable() {
  return process.env.BACKEND_MODE !== "supabase" && process.env.NODE_ENV !== "production" && process.env.LOCAL_PREVIEW !== "false";
}
