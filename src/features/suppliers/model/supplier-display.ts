import type { Supplier } from "@/lib/repairdesk/types";

// Presentation only: identities and historical supplier records are never merged by name.
export function supplierSecondaryName(supplier: Pick<Supplier, "name" | "short_name">) {
  const shortName = supplier.short_name?.trim();
  return shortName &&
    shortName.normalize("NFKC").toLocaleLowerCase() !==
      supplier.name.trim().normalize("NFKC").toLocaleLowerCase()
    ? shortName
    : undefined;
}
