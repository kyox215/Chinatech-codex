export function assertNewOrderExpectedStore(
  expectedStoreId: string | undefined,
  actorStoreId: string,
) {
  if (expectedStoreId && expectedStoreId !== actorStoreId) {
    throw new Error("店铺上下文已变化，请关闭后在当前店铺重新接单");
  }
}
