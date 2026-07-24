export function inventoryV2DependencyError(message: string) {
  return Object.assign(new Error(message), {
    status: 503,
    code: "INVENTORY_V2_DEPENDENCY_UNAVAILABLE",
  });
}

export async function runInventoryV2Dependency<T>(
  operation: () => PromiseLike<T>,
  message: string,
) {
  try {
    return await operation();
  } catch {
    throw inventoryV2DependencyError(message);
  }
}
