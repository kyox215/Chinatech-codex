import { z } from "zod";
export const INVENTORY_RECOGNITION_CONTRACT_VERSION = "local-inventory-v1" as const;
const inventoryConfidenceSchema = z.enum(["high", "review", "unknown"]);
export const inventoryFieldNameSchema = z.enum([
  "brand",
  "model",
  "color",
  "ram_capacity",
  "storage_capacity",
]);
export type InventoryFieldName = z.infer<typeof inventoryFieldNameSchema>;

export const inventoryEvidenceSourceSchema = z.enum([
  "vision",
  "ocr",
  "barcode",
  "merged",
  "unknown",
]);
export type InventoryEvidenceSource = z.infer<typeof inventoryEvidenceSourceSchema>;

export const inventoryFieldCandidateSchema = z
  .object({
    value: z.string().trim().max(120).nullable(),
    confidence: inventoryConfidenceSchema,
    evidence: z.string().trim().max(240).nullable(),
    source: inventoryEvidenceSourceSchema,
  })
  .strict();
export type InventoryFieldCandidate = z.infer<typeof inventoryFieldCandidateSchema>;

export const inventoryIdentifierTypeSchema = z.enum([
  "imei1",
  "imei2",
  "serial",
  "ean",
  "sku",
  "unknown",
]);
export type InventoryIdentifierType = z.infer<typeof inventoryIdentifierTypeSchema>;

export const inventoryIdentifierCandidateSchema = z
  .object({
    type: inventoryIdentifierTypeSchema,
    value: z.string().trim().min(1).max(80),
    confidence: inventoryConfidenceSchema,
    evidence: z.string().trim().max(240).nullable(),
    source: inventoryEvidenceSourceSchema,
    validation: z.enum(["valid", "invalid", "not_applicable"]),
  })
  .strict();
export type InventoryIdentifierCandidate = z.infer<typeof inventoryIdentifierCandidateSchema>;

export const inventoryConflictSchema = z
  .object({
    target: z.enum(["brand", "model", "color", "ram_capacity", "storage_capacity", "identifiers"]),
    values: z.array(z.string().trim().min(1).max(120)).min(2).max(6),
    sources: z.array(inventoryEvidenceSourceSchema).min(2).max(6),
  })
  .strict();
export type InventoryConflict = z.infer<typeof inventoryConflictSchema>;

export const inventoryRecognitionSchema = z
  .object({
    schema_version: z.literal(INVENTORY_RECOGNITION_CONTRACT_VERSION),
    fields: z
      .object({
        brand: inventoryFieldCandidateSchema,
        model: inventoryFieldCandidateSchema,
        color: inventoryFieldCandidateSchema,
        ram_capacity: inventoryFieldCandidateSchema,
        storage_capacity: inventoryFieldCandidateSchema,
      })
      .strict(),
    identifiers: z.array(inventoryIdentifierCandidateSchema).max(12),
    conflicts: z.array(inventoryConflictSchema).max(12),
    warnings: z.array(z.string().trim().min(1).max(240)).max(12),
    label_claim_only: z.literal(true),
  })
  .strict();
export type InventoryRecognition = z.infer<typeof inventoryRecognitionSchema>;
