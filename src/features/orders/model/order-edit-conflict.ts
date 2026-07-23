export type OrderEditConflictInput = {
  baselineUpdatedAt?: string | null;
  currentUpdatedAt?: string | null;
  hasLocalChanges: boolean;
  isEditing: boolean;
};

export function hasOrderEditRemoteConflict({
  baselineUpdatedAt,
  currentUpdatedAt,
  hasLocalChanges,
  isEditing,
}: OrderEditConflictInput) {
  return Boolean(
    isEditing &&
    hasLocalChanges &&
    baselineUpdatedAt &&
    currentUpdatedAt &&
    baselineUpdatedAt !== currentUpdatedAt,
  );
}
