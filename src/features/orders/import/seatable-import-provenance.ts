import crypto from "node:crypto";

const IMPORT_BATCH_PATTERN = /^[a-z0-9][a-z0-9._-]{7,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const IMPORT_NAMESPACE_BYTES = Buffer.from("3e724f42545f5a2b9d65c3d6ff12f4e8", "hex");

export const SEATABLE_IMPORT_PROVENANCE_VERSION = 1;
export const SEATABLE_IMPORT_MAPPER_VERSION = "2026-07-16";

export interface SeaTableImportProvenance {
  importBatchId: string;
  sourceFileName: string;
  sourceFileSha256: string;
  fallbackTimestamp: string;
  targetStoreId?: string;
}

export function normalizeSeaTableImportProvenance(input: SeaTableImportProvenance) {
  const importBatchId = input.importBatchId.trim().toLowerCase();
  const sourceFileName = input.sourceFileName.trim();
  const sourceFileSha256 = input.sourceFileSha256.trim().toLowerCase();
  const fallbackDate = new Date(input.fallbackTimestamp);
  const targetStoreId = input.targetStoreId?.trim().toLowerCase();

  if (!IMPORT_BATCH_PATTERN.test(importBatchId)) {
    throw new Error(
      "SeaTable import batch id must be 8-64 lowercase letters, numbers, dots, underscores, or hyphens.",
    );
  }
  if (!sourceFileName || sourceFileName.includes("/") || sourceFileName.includes("\\")) {
    throw new Error("SeaTable source file name must be a basename without path separators.");
  }
  if (!SHA256_PATTERN.test(sourceFileSha256)) {
    throw new Error("SeaTable source file SHA-256 must be 64 lowercase hexadecimal characters.");
  }
  if (Number.isNaN(fallbackDate.getTime())) {
    throw new Error("SeaTable fallback timestamp must be a valid ISO date-time.");
  }
  if (
    targetStoreId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(targetStoreId)
  ) {
    throw new Error("SeaTable target store id must be a UUID when provided.");
  }

  return {
    importBatchId,
    sourceFileName,
    sourceFileSha256,
    fallbackTimestamp: fallbackDate.toISOString(),
    ...(targetStoreId ? { targetStoreId } : {}),
  };
}

export function seaTableImportBatchToken(importBatchId: string, sourceFileSha256 = "") {
  return crypto
    .createHash("sha256")
    .update(`${importBatchId}:${sourceFileSha256}`)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
}

export function seaTableImportPublicNo(
  importBatchId: string,
  rowNumber: number,
  sourceFileSha256 = "",
) {
  return `SEA-${seaTableImportBatchToken(importBatchId, sourceFileSha256)}-${String(rowNumber - 1).padStart(6, "0")}`;
}

export function seaTableImportInternalTag(importBatchId: string) {
  return `seatable:${importBatchId}`;
}

export function deterministicSeaTableImportId(
  prefix: string,
  rowNumber: number,
  provenance: SeaTableImportProvenance,
) {
  const name = `${provenance.targetStoreId ?? "unbound"}:${provenance.importBatchId}:${provenance.sourceFileSha256}:${prefix}:${String(rowNumber)}`;
  const digest = crypto
    .createHash("sha1")
    .update(IMPORT_NAMESPACE_BYTES)
    .update(name)
    .digest("hex")
    .slice(0, 32);
  const variant = ((Number.parseInt(digest[16], 16) & 0x3) | 0x8).toString(16);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-${variant}${digest.slice(17, 20)}-${digest.slice(20)}`;
}

export function isKnownRepairDeskDemoOrder(input: { public_no?: unknown; internal_tag?: unknown }) {
  const publicNo = typeof input.public_no === "string" ? input.public_no.trim() : "";
  const internalTag = typeof input.internal_tag === "string" ? input.internal_tag.trim() : "";
  return /^TEST-\d{4}$/.test(publicNo) && /^AI_TEST_BATCH_[A-Z0-9_-]+\s+·\s+/.test(internalTag);
}
