export type AuthState = "anonymous" | "unverified" | "account" | "workspace" | "unavailable";
export type AuthStatus = { state: AuthState; scope: string | null; formal: boolean };
export function authDestination(state: AuthState) {
  return state === "workspace" ? "/app/dashboard" : state === "account" ? "/account/pending" : state === "unverified" ? "/verify-email" : "/login";
}
