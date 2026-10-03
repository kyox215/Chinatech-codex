import { createHash } from "node:crypto";
import type { RetailUnit } from "../retail";
import { BackendError } from "./database";

export const retailPhotoHash = (photo: string) => createHash("sha256").update(photo).digest("hex");
function reference(unitId: string, photo: string, index: number, saleId = "") {
  return `/api/backend/retail-photo?${new URLSearchParams({ unit: unitId, index: String(index), hash: retailPhotoHash(photo), ...(saleId ? { sale: saleId } : {}) })}`;
}
export function referenceRetailPhotos(unit: RetailUnit): RetailUnit {
  return { ...unit, photos: unit.photos.map((photo, index) => reference(unit.id, photo, index)), sales: unit.sales.map(sale => ({ ...sale, ...(sale.product ? { product: { ...sale.product, photos: sale.product.photos.map((photo, index) => reference(unit.id, photo, index, sale.id)) } } : {}) })) };
}
export function restoreRetailPhotoReferences(photos: unknown, unit: RetailUnit) {
  if (!Array.isArray(photos) || photos.length > 6) throw new BackendError("实物照片最多6张。");
  const existing = new Map(unit.photos.map((photo, index) => [reference(unit.id, photo, index), photo]));
  return photos.map(value => {
    if (typeof value !== "string") throw new BackendError("照片格式无效。");
    if (value.startsWith("/api/backend/retail-photo?")) {
      const original = existing.get(value); if (!original) throw new BackendError("原照片已变化，请重新核对。", 409);
      return original;
    }
    return value;
  });
}
