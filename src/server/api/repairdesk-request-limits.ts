export const INVENTORY_V2_COMMAND_REQUEST_MAX_BYTES = 65_536;
export const INVENTORY_LIFECYCLE_COMMAND_MAX_BYTES = 48 * 1024;
export const MEMO_COMMAND_REQUEST_MAX_BYTES = 8_192;
// 100 checklist items × 200 Unicode characters plus UUIDs and JSON framing.
export const MEMO_EDITOR_REQUEST_MAX_BYTES = 128 * 1024;
