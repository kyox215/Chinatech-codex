import type { BackendReadScope } from "./read-plan";
export const customerReadVersionChangedCode = "READ_VERSION_CHANGED";
export type CustomerListSummary = { id: string; phone: string; name: string; email: string; repairCount: number; saleCount: number; historyCount: number; lastActivity: string };
export type CustomerListQuery = { q: string; mode: "directory" | "phone" | "exact" };
export type CustomerListPage = { formatVersion: 1; scope: BackendReadScope; generation: string; query: CustomerListQuery; total: number; items: CustomerListSummary[]; startIndex: number; previousCursor: string | null; nextCursor: string | null; stateToken: string };
export function customerListQuery(value: string, mode: CustomerListQuery["mode"] = "directory"): CustomerListQuery {
  if (value.length > 160) throw new Error("请求资料无效。");
  return { q: (mode === "directory" ? value : value.normalize("NFKC")).trim().toLowerCase(), mode };
}

// A scope/query/generation validator and sort boundary, never an auth token.
export function customerCursor(token: string, item: Pick<CustomerListSummary,"phone"|"lastActivity">, direction: "before"|"after") {
  const bytes=new TextEncoder().encode(JSON.stringify([token,item.lastActivity,item.phone,direction]));
  return btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join("")).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}
