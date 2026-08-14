"use client";

import { ImeiScannerField } from "@/components/imei-scanner-field";

import type { InventoryProductIdentifierFieldProps } from "./inventory-product-form";

/** Production-only scanner adapter. Storybook injects the local presenter instead. */
export function InventoryProductIdentifierField(props: InventoryProductIdentifierFieldProps) {
  return <ImeiScannerField {...props} />;
}
