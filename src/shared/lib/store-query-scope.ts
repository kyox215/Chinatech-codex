export function storeQueryScope(storeId?: string | null) {
  return storeId ? (["store", storeId] as const) : ([] as const);
}
