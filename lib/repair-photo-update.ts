import { validIntakePhotos, validLocalIntake, type IntakePhotoReference, type IntakeReceiptData } from "./repair-intake-record";

export class RepairPhotoUpdateError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

/** Merge only current references; stored originals are immutable and remain outside this projection. */
export function mergeRepairPhotoReferences(
  existing: { photos?: IntakePhotoReference[]; photoCount: number },
  incoming: readonly IntakePhotoReference[],
): IntakePhotoReference[] {
  const previous = existing.photos ?? [];
  if (!validIntakePhotos(previous) || existing.photoCount !== previous.length) throw new RepairPhotoUpdateError("旧照片数量与引用待核对，请先刷新工单。", 409);
  if (!Array.isArray(incoming) || !incoming.length || !validIntakePhotos(incoming)) throw new RepairPhotoUpdateError("请核对照片数量与位置。");
  const known = new Map(previous.map(photo => [photo.id.toLowerCase(), photo]));
  for (const photo of incoming) {
    const original = known.get(photo.id.toLowerCase());
    if (original && original.slot !== photo.slot) throw new RepairPhotoUpdateError("照片编号已用于其他内容，请重新选择照片。", 409);
  }
  const replacing = new Set(incoming.filter(photo => photo.slot !== "other").map(photo => photo.slot));
  const additions = new Set(incoming.map(photo => photo.id.toLowerCase()));
  const photos = [
    ...previous.filter(photo => !replacing.has(photo.slot) || additions.has(photo.id.toLowerCase())),
    ...incoming.filter(photo => !known.has(photo.id.toLowerCase())).map(photo => ({ id: photo.id.toLowerCase(), slot: photo.slot })),
  ];
  if (!validIntakePhotos(photos)) throw new RepairPhotoUpdateError("正背面各一张，其他照片最多四张。");
  return photos;
}

export function prepareIntakePhotoUpdate(current: IntakeReceiptData, revision: number, photos: readonly IntakePhotoReference[], time: string): IntakeReceiptData {
  if (!Number.isSafeInteger(revision) || revision < 1 || (current.revision ?? 1) !== revision) throw new RepairPhotoUpdateError("接机资料已变化，请重新核对。", 409);
  if (!time || time < current.updatedAt) throw new RepairPhotoUpdateError("操作时间不能早于上次更新。");
  const references = mergeRepairPhotoReferences(current, photos);
  const next = { ...current, photos: references, photoCount: references.length, revision: revision + 1, updatedAt: time };
  if (!validLocalIntake(next)) throw new RepairPhotoUpdateError("接机资料无效。");
  return next;
}
