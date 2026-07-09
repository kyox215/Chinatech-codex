export const suppliersKeys = {
  all: ["suppliers"] as const,
  storeScoped: (storeId?: string) => [...suppliersKeys.all, storeId ?? "no-store"] as const,
};
