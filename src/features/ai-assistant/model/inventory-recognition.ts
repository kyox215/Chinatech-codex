import {
  AI_ASSISTANT_CONTRACT_VERSION,
  aiInventoryRecognitionSchema,
  type AiInventoryConflict,
  type AiInventoryEvidenceSource,
  type AiInventoryFieldCandidate,
  type AiInventoryFieldName,
  type AiInventoryIdentifierCandidate,
  type AiInventoryRecognition,
} from "./contracts";
import {
  extractImeiCandidates,
  normalizeCaptureIdentifier,
} from "@/features/capture/model/barcode-parser";

export type LocalInventoryEvidence = {
  ocrText?: string;
  barcodeValues?: readonly string[];
};

const fieldNames = [
  "brand",
  "model",
  "color",
  "ram_capacity",
  "storage_capacity",
] as const satisfies readonly AiInventoryFieldName[];

const knownBrands = [
  "Apple",
  "Samsung",
  "Xiaomi",
  "Redmi",
  "Poco",
  "Huawei",
  "Honor",
  "Oppo",
  "Realme",
  "OnePlus",
  "Motorola",
  "Nokia",
  "Google",
  "Asus",
  "Lenovo",
  "Dell",
  "HP",
  "Acer",
] as const;

const knownColors = [
  "Black",
  "White",
  "Blue",
  "Green",
  "Red",
  "Pink",
  "Purple",
  "Gold",
  "Silver",
  "Gray",
  "Grey",
  "Orange",
  "Yellow",
] as const;

export function buildLocalInventoryRecognition({
  ocrText = "",
  barcodeValues = [],
}: LocalInventoryEvidence): AiInventoryRecognition {
  const text = normalizeOcrText(ocrText);
  const brand = findCanonicalWord(text, knownBrands);
  const color = findCanonicalWord(text, knownColors);
  const ram = findCapacity(text, ["RAM"]);
  const storage = findCapacity(text, ["ROM", "STORAGE", "CAPACITY"]);
  const model = findModel(text, brand, color);
  const { identifiers, warnings } = buildIdentifiers(text, barcodeValues);

  return aiInventoryRecognitionSchema.parse({
    schema_version: AI_ASSISTANT_CONTRACT_VERSION,
    fields: {
      brand: localField(brand, brand ? "本地 OCR 品牌词" : null),
      model: localField(model, model ? "本地 OCR 型号行" : null),
      color: localField(color, color ? "本地 OCR 颜色词" : null),
      ram_capacity: localField(ram, ram ? "本地 OCR RAM 声明" : null),
      storage_capacity: localField(storage, storage ? "本地 OCR 存储声明" : null),
    },
    identifiers,
    conflicts: [],
    warnings: unique([
      ...warnings,
      "本地识别仅表示包装标签声明，不能证明盒内设备配置、真伪或所有权。",
    ]),
    label_claim_only: true,
  });
}

export function mergeInventoryRecognitions(
  vision: AiInventoryRecognition,
  local: AiInventoryRecognition,
): AiInventoryRecognition {
  const conflicts: AiInventoryConflict[] = [...vision.conflicts, ...local.conflicts];
  const fields = Object.fromEntries(
    fieldNames.map((name) => {
      const merged = mergeField(name, vision.fields[name], local.fields[name], conflicts);
      return [name, merged];
    }),
  ) as AiInventoryRecognition["fields"];
  const identifiers = mergeIdentifiers(vision.identifiers, local.identifiers, conflicts);

  return aiInventoryRecognitionSchema.parse({
    schema_version: AI_ASSISTANT_CONTRACT_VERSION,
    fields,
    identifiers,
    conflicts: uniqueConflicts(conflicts),
    warnings: unique([...vision.warnings, ...local.warnings]),
    label_claim_only: true,
  });
}

function localField(value: string | null, evidence: string | null): AiInventoryFieldCandidate {
  return {
    value,
    confidence: value ? "review" : "unknown",
    evidence,
    source: value ? "ocr" : "unknown",
  };
}

function mergeField(
  name: AiInventoryFieldName,
  vision: AiInventoryFieldCandidate,
  local: AiInventoryFieldCandidate,
  conflicts: AiInventoryConflict[],
) {
  if (!vision.value) return local;
  if (!local.value) return vision;
  if (normalizeComparable(vision.value) === normalizeComparable(local.value)) {
    return {
      value: vision.value,
      confidence: "high" as const,
      evidence: "视觉与本地 OCR 证据一致",
      source: "merged" as const,
    };
  }

  conflicts.push({
    target: name,
    values: [vision.value, local.value],
    sources: [vision.source, local.source],
  });
  return {
    value: vision.value,
    confidence: "review" as const,
    evidence: "视觉与本地 OCR 结果冲突，请人工选择",
    source: "merged" as const,
  };
}

function buildIdentifiers(text: string, barcodeValues: readonly string[]) {
  const results: AiInventoryIdentifierCandidate[] = [];
  const warnings: string[] = [];
  const imeiSlots = { barcode: 0, ocr: 0 };

  // Preserve a checksum-valid GTIN as an EAN before the generic barcode
  // extractor has a chance to classify the same numeric value as a serial.
  for (const raw of barcodeValues) {
    const value = normalizeCaptureIdentifier(raw);
    if (!isValidGtin(value)) continue;
    pushIdentifier(results, {
      type: "ean",
      value,
      confidence: "high",
      evidence: "本地条码与 GTIN 校验",
      source: "barcode",
      validation: "valid",
    });
  }

  for (const source of ["barcode", "ocr"] as const) {
    const raw = source === "barcode" ? barcodeValues.join("\n") : text;
    const candidates = extractImeiCandidates(raw, {
      source,
      includeGenericSerial: source === "barcode",
    });
    for (const candidate of candidates) {
      const value = normalizeCaptureIdentifier(candidate.value);
      if (!value) continue;
      if (candidate.kind === "imei") {
        imeiSlots[source] += 1;
        pushIdentifier(results, {
          type: imeiSlots[source] === 1 ? "imei1" : "imei2",
          value,
          confidence: source === "barcode" ? "high" : "review",
          evidence: source === "barcode" ? "本地条码与 Luhn 校验" : "本地 OCR 与 Luhn 校验",
          source,
          validation: "valid",
        });
      } else if (candidate.kind === "serial") {
        pushIdentifier(results, {
          type: "serial",
          value,
          confidence: "review",
          evidence: source === "barcode" ? "本地条码序列号候选" : "本地 OCR 序列号候选",
          source,
          validation: "not_applicable",
        });
      } else {
        pushIdentifier(results, {
          type: "unknown",
          value,
          confidence: "review",
          evidence: "数字候选未通过 IMEI Luhn 校验",
          source,
          validation: "invalid",
        });
        warnings.push("存在未通过 Luhn 校验的 IMEI 候选，不能作为主标识符应用。");
      }
    }
  }

  return { identifiers: results.slice(0, 12), warnings };
}

function pushIdentifier(
  results: AiInventoryIdentifierCandidate[],
  candidate: AiInventoryIdentifierCandidate,
) {
  const existing = results.find((item) => item.value === candidate.value);
  if (!existing) {
    results.push(candidate);
    return;
  }
  existing.source = existing.source === candidate.source ? existing.source : "merged";
  existing.confidence =
    existing.validation === "valid" || candidate.validation === "valid" ? "high" : "review";
  if (
    (existing.type === "unknown" && candidate.type !== "unknown") ||
    (existing.type === "serial" && candidate.type === "ean")
  ) {
    existing.type = candidate.type;
  }
  if (candidate.validation === "valid") existing.validation = "valid";
  existing.evidence = "多类本地证据识别到同一标识符";
}

function mergeIdentifiers(
  vision: readonly AiInventoryIdentifierCandidate[],
  local: readonly AiInventoryIdentifierCandidate[],
  conflicts: AiInventoryConflict[],
) {
  const results: AiInventoryIdentifierCandidate[] = [];
  for (const candidate of [...vision, ...local]) pushIdentifier(results, { ...candidate });

  for (const type of ["imei1", "imei2"] as const) {
    const candidates = results.filter((candidate) => candidate.type === type);
    const values = unique(candidates.map((candidate) => candidate.value));
    if (values.length > 1) {
      conflicts.push({
        target: "identifiers",
        values,
        sources: candidates.map((candidate) => candidate.source),
      });
      for (const candidate of candidates) candidate.confidence = "review";
    }
  }
  return results.slice(0, 12);
}

function normalizeOcrText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findCanonicalWord<T extends string>(text: string, values: readonly T[]): T | null {
  return (
    values.find((value) =>
      new RegExp(`(^|[^a-z0-9])${escapeRegExp(value)}([^a-z0-9]|$)`, "i").test(text),
    ) ?? null
  );
}

function findCapacity(text: string, labels: readonly string[]) {
  const label = labels.map(escapeRegExp).join("|");
  const patterns = [
    new RegExp(`\\b(\\d{1,4})\\s*(?:GB|G)\\s*(?:${label})\\b`, "i"),
    new RegExp(`(?:${label})\\s*[:=]?\\s*(\\d{1,4})\\s*(?:GB|G)\\b`, "i"),
  ];
  for (const pattern of patterns) {
    const value = text.match(pattern)?.[1];
    if (value) return `${Number(value)} GB`;
  }
  return null;
}

function findModel(text: string, brand: string | null, color: string | null) {
  const labeled = text.match(/\b(?:MODEL|MODELLO)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 +._-]{1,48})/i)?.[1];
  if (labeled) return cleanModel(labeled, color);
  if (!brand) return null;
  const line = text
    .split(/\n+/)
    .find((candidate) => new RegExp(`\\b${escapeRegExp(brand)}\\b`, "i").test(candidate));
  if (!line) return null;
  return cleanModel(line.replace(new RegExp(`\\b${escapeRegExp(brand)}\\b`, "i"), " "), color);
}

function cleanModel(value: string, color: string | null) {
  let result = value
    .replace(/\b\d{1,4}\s*(?:GB|G)\s*(?:RAM|ROM|STORAGE|CAPACITY)?\b.*$/i, " ")
    .replace(/\b(?:RAM|ROM|STORAGE|CAPACITY)\b.*$/i, " ");
  if (color) result = result.replace(new RegExp(`\\b${escapeRegExp(color)}\\b`, "i"), " ");
  result = result
    .replace(/[^A-Za-z0-9+._ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return result.length >= 2 && result.length <= 48 ? result : null;
}

function isValidGtin(value: string) {
  if (!/^\d{8}$|^\d{12,14}$/.test(value)) return false;
  const check = Number(value.at(-1));
  const body = value.slice(0, -1);
  let sum = 0;
  for (let index = body.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    sum += Number(body[index]) * (position % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === check;
}

function normalizeComparable(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").trim();
}

function unique(values: readonly string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueConflicts(values: readonly AiInventoryConflict[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${value.target}:${value.values.join("|")}:${value.sources.join("|")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
