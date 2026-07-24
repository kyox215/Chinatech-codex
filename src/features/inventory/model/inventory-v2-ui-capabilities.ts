type InventoryV2UiPermissions = {
  canSellInventory?: boolean;
  inventoryV2UiEnabled?: boolean;
  inventoryV2CommandsEnabled?: boolean;
};

export function resolveInventoryV2UiCapabilities(
  permissions: InventoryV2UiPermissions | null | undefined,
) {
  const commandsEnabled = permissions?.inventoryV2CommandsEnabled === true;

  return {
    canUseIntake: commandsEnabled && permissions?.inventoryV2UiEnabled === true,
    canUseAtomicSale: commandsEnabled && permissions?.canSellInventory === true,
  };
}
