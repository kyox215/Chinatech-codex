export const SUPPLIER_COLOR_PALETTE = [
  { value: "#2563eb", label: "蓝色", swatchClass: "bg-primary" },
  { value: "#16a34a", label: "绿色", swatchClass: "bg-status-success-foreground" },
  { value: "#f59e0b", label: "黄色", swatchClass: "bg-status-warn-foreground" },
  { value: "#dc2626", label: "红色", swatchClass: "bg-status-danger-foreground" },
  { value: "#7c3aed", label: "紫色", swatchClass: "bg-status-progress-foreground" },
  { value: "#0891b2", label: "青色", swatchClass: "bg-status-info-foreground" },
] as const;

export const DEFAULT_SUPPLIER_COLOR = SUPPLIER_COLOR_PALETTE[0].value;

export function supplierSwatchClass(color: string | undefined) {
  return (
    SUPPLIER_COLOR_PALETTE.find((option) => option.value.toLowerCase() === color?.toLowerCase())
      ?.swatchClass ?? "bg-status-neutral-foreground"
  );
}
