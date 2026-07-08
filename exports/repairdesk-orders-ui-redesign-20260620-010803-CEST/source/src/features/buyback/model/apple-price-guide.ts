export interface ApplePriceGuideEntry {
  brand: "Apple";
  productLine: "iPhone";
  model: string;
  releaseYear: number;
  baseStorageGb: number;
  storageOptionsGb: number[];
  refurbRetailFloorEur: number;
  buybackFloorEur: number;
  sourceLabel: string;
  sourceUrl: string;
  observedAt: string;
}

export interface AppleMarketPricingSuggestion {
  matched: ApplePriceGuideEntry;
  requestedStorageGb?: number;
  storagePremium: number;
  resaleReference: number;
  marketMin: number;
  marketMax: number;
  targetProfit: number;
  preInspectionCeiling: number;
  confidence: "high" | "medium" | "low";
  nextRefreshAt: string;
  notes: string[];
}

export interface AppleIPhoneSeriesGroup {
  key: string;
  label: string;
  models: ApplePriceGuideEntry[];
}

export interface AppleIPhoneStorageChoice {
  valueGb: number;
  label: string;
  official: boolean;
  note?: string;
}

export const APPLE_PRICE_GUIDE_OBSERVED_AT = "2026-06-16";

export const APPLE_PRICE_GUIDE_SOURCES = [
  {
    label: "Apple Support - Identify your iPhone model",
    url: "https://support.apple.com/en-us/108044",
    purpose: "官方 iPhone 型号校准。",
  },
  {
    label: "Apple Support - iPhone technical specifications",
    url: "https://support.apple.com/docs/iphone",
    purpose: "官方技术规格中的容量选项校准；部分 64GB 起步型号没有 128GB。",
  },
  {
    label: "Apple Support - before selling/trading in",
    url: "https://support.apple.com/en-us/109511",
    purpose: "账号退出、Find My/Activation Lock 和资料清除风险规则。",
  },
  {
    label: "Apple Trade In Italia",
    url: "https://www.apple.com/it/shop/trade-in",
    purpose: "官方换购流程和到店复检口径。",
  },
  {
    label: "Refurbed Italia iPhone marketplace",
    url: "https://www.refurbed.it/c/iphone/",
    purpose: "欧盟/意大利翻新零售价下限参考。",
  },
] as const;

export const APPLE_IPHONE_PRICE_GUIDE: ApplePriceGuideEntry[] = [
  price("iPhone 8", 2017, 64, [64, 256], 120),
  price("iPhone 8 Plus", 2017, 64, [64, 256], 150),
  price("iPhone X", 2017, 64, [64, 256], 170),
  price("iPhone XR", 2018, 64, [64, 128, 256], 160),
  price("iPhone XS", 2018, 64, [64, 256, 512], 180),
  price("iPhone XS Max", 2018, 64, [64, 256, 512], 220),
  price("iPhone 11", 2019, 64, [64, 128, 256], 181),
  price("iPhone 11 Pro", 2019, 64, [64, 256, 512], 226),
  price("iPhone 11 Pro Max", 2019, 64, [64, 256, 512], 262),
  price("iPhone SE 2020", 2020, 64, [64, 128, 256], 105),
  price("iPhone 12 mini", 2020, 64, [64, 128, 256], 141),
  price("iPhone 12", 2020, 64, [64, 128, 256], 174),
  price("iPhone 12 Pro", 2020, 128, [128, 256, 512], 242),
  price("iPhone 12 Pro Max", 2020, 128, [128, 256, 512], 282),
  price("iPhone 13 mini", 2021, 128, [128, 256, 512], 209),
  price("iPhone 13", 2021, 128, [128, 256, 512], 261),
  price("iPhone 13 Pro", 2021, 128, [128, 256, 512, 1024], 340),
  price("iPhone 13 Pro Max", 2021, 128, [128, 256, 512, 1024], 375),
  price("iPhone SE 2022", 2022, 64, [64, 128, 256], 132),
  price("iPhone 14", 2022, 128, [128, 256, 512], 320),
  price("iPhone 14 Plus", 2022, 128, [128, 256, 512], 360),
  price("iPhone 14 Pro", 2022, 128, [128, 256, 512, 1024], 441),
  price("iPhone 14 Pro Max", 2022, 128, [128, 256, 512, 1024], 505),
  price("iPhone 15", 2023, 128, [128, 256, 512], 430),
  price("iPhone 15 Plus", 2023, 128, [128, 256, 512], 500),
  price("iPhone 15 Pro", 2023, 128, [128, 256, 512, 1024], 563),
  price("iPhone 15 Pro Max", 2023, 256, [256, 512, 1024], 661),
  price("iPhone 16e", 2025, 128, [128, 256, 512], 395),
  price("iPhone 16", 2024, 128, [128, 256, 512], 583),
  price("iPhone 16 Plus", 2024, 128, [128, 256, 512], 640),
  price("iPhone 16 Pro", 2024, 128, [128, 256, 512, 1024], 661),
  price("iPhone 16 Pro Max", 2024, 256, [256, 512, 1024], 874),
  price("iPhone 17e", 2026, 128, [128, 256, 512], 470),
  price("iPhone 17", 2026, 128, [128, 256, 512], 670),
  price("iPhone Air", 2026, 256, [256, 512, 1024], 760),
  price("iPhone 17 Pro", 2026, 256, [256, 512, 1024], 880),
  price("iPhone 17 Pro Max", 2026, 256, [256, 512, 1024], 980),
];

export function getApplePriceGuideCandidates(query: string, limit = 6) {
  const normalized = normalizeModelName(query);
  if (!normalized) return APPLE_IPHONE_PRICE_GUIDE.slice(0, limit);
  return APPLE_IPHONE_PRICE_GUIDE.filter((entry) =>
    normalizeModelName(entry.model).includes(normalized),
  ).slice(0, limit);
}

export function getAppleIPhoneModels() {
  return APPLE_IPHONE_PRICE_GUIDE;
}

export function getAppleIPhoneSeriesGroups(): AppleIPhoneSeriesGroup[] {
  const groupLabels: Record<string, string> = {
    iphone17: "17 / Air",
    iphone16: "16 / 16e",
    iphone15: "15",
    iphone14: "14",
    iphone13: "13",
    iphone12: "12",
    iphone11: "11 / SE",
    classic: "X / 8",
  };
  const groups = new Map<string, ApplePriceGuideEntry[]>();
  for (const entry of APPLE_IPHONE_PRICE_GUIDE) {
    const key = seriesKeyForModel(entry.model);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return Object.keys(groupLabels)
    .map((key) => ({
      key,
      label: groupLabels[key],
      models: groups.get(key) ?? [],
    }))
    .filter((group) => group.models.length > 0);
}

export function getAppleIPhoneStorageOptions(model?: string) {
  return findAppleGuideEntry(model)?.storageOptionsGb ?? [64, 128, 256, 512];
}

export function getAppleIPhoneStorageChoices(model?: string): AppleIPhoneStorageChoice[] {
  const entry = findAppleGuideEntry(model);
  if (!entry) {
    return [64, 128, 256, 512].map((valueGb) => ({
      valueGb,
      label: `${valueGb}GB`,
      official: true,
    }));
  }

  const official = new Set(entry.storageOptionsGb);
  const maxOfficial = Math.max(...entry.storageOptionsGb);
  const choices = new Map<number, AppleIPhoneStorageChoice>();
  for (const valueGb of entry.storageOptionsGb) {
    choices.set(valueGb, { valueGb, label: `${valueGb}GB`, official: true });
  }

  for (const valueGb of [128]) {
    if (official.has(valueGb) || valueGb <= entry.baseStorageGb || valueGb >= maxOfficial) continue;
    choices.set(valueGb, {
      valueGb,
      label: `${valueGb}GB 非官方`,
      official: false,
      note: "二手市场常见扩容/翻新容量，非 Apple 官方出厂容量",
    });
  }

  return Array.from(choices.values()).sort((left, right) => left.valueGb - right.valueGb);
}

export function getAppleIPhoneStorageHint(model?: string) {
  const entry = findAppleGuideEntry(model);
  if (!entry) return "选择型号后显示该机型官方容量。";
  const capacities = entry.storageOptionsGb.map((value) => `${value}GB`).join(" / ");
  const missing128 = entry.baseStorageGb === 64 && !entry.storageOptionsGb.includes(128);
  if (missing128) {
    return `${entry.model} 官方容量：${capacities}。二手市场的 128GB 通常按疑似扩容/翻新改存储处理，成交前需要核对设置容量、IMEI 和拆修记录。`;
  }
  return `${entry.model} 官方容量：${capacities}。`;
}

export function estimateAppleMarketPricing(input: {
  brand?: string;
  model?: string;
  storageCapacity?: string;
}): AppleMarketPricingSuggestion | undefined {
  if (!isAppleBrand(input.brand)) return undefined;
  const matched = findAppleGuideEntry(input.model);
  if (!matched) return undefined;

  const requestedStorageGb = parseStorageGb(input.storageCapacity);
  const officialStorage = isOfficialStorageOption(matched, requestedStorageGb);
  const storagePremium = officialStorage
    ? getStoragePremium(requestedStorageGb, matched.baseStorageGb)
    : 0;
  const resaleReference = roundToFive(matched.refurbRetailFloorEur + storagePremium);
  const marketMin = roundToFive(resaleReference * 0.9);
  const marketMax = roundToFive(resaleReference * 1.12);
  const targetProfit = roundToFive(
    Math.max(75, Math.min(240, resaleReference * profitRateFor(matched))),
  );
  const preInspectionCeiling = roundToFive(Math.max(0, resaleReference - targetProfit));

  const notes = [
    `参考 ${matched.sourceLabel} 于 ${matched.observedAt} 的翻新零售价下限。`,
    "成交前仍需要按本机成色、账号锁、IMEI、维修成本和周转风险复检。",
  ];
  if (!requestedStorageGb) notes.push("未识别容量，使用该型号基础容量估算。");
  if (requestedStorageGb && !officialStorage) {
    notes.push("所选容量不是 Apple 官方出厂容量，按疑似扩容/翻新改存储处理，价格可信度降低。");
  } else if (requestedStorageGb && requestedStorageGb !== matched.baseStorageGb) {
    notes.push(`容量从 ${matched.baseStorageGb}GB 调整到 ${requestedStorageGb}GB。`);
  }

  return {
    matched,
    requestedStorageGb,
    storagePremium,
    resaleReference,
    marketMin,
    marketMax,
    targetProfit,
    preInspectionCeiling,
    confidence: getConfidence(matched, requestedStorageGb, officialStorage),
    nextRefreshAt: nextWeeklyRefresh(matched.observedAt),
    notes,
  };
}

export function formatAppleMarketSuggestionLabel(suggestion: AppleMarketPricingSuggestion) {
  const storage = suggestion.requestedStorageGb
    ? `${suggestion.requestedStorageGb}GB`
    : `${suggestion.matched.baseStorageGb}GB`;
  return `${suggestion.matched.model} ${storage}`;
}

function price(
  model: string,
  releaseYear: number,
  baseStorageGb: number,
  storageOptionsGb: number[],
  refurbRetailFloorEur: number,
): ApplePriceGuideEntry {
  return {
    brand: "Apple",
    productLine: "iPhone",
    model,
    releaseYear,
    baseStorageGb,
    storageOptionsGb,
    refurbRetailFloorEur,
    buybackFloorEur: roundToFive(refurbRetailFloorEur * 0.35),
    sourceLabel: "Refurbed Italia",
    sourceUrl: "https://www.refurbed.it/c/iphone/",
    observedAt: APPLE_PRICE_GUIDE_OBSERVED_AT,
  };
}

function isAppleBrand(brand?: string) {
  const text = normalizeModelName(brand);
  return text === "apple" || text === "iphone";
}

function findAppleGuideEntry(model?: string) {
  const normalized = normalizeModelName(model);
  if (!normalized) return undefined;
  return APPLE_IPHONE_PRICE_GUIDE.find((entry) => normalizeModelName(entry.model) === normalized);
}

function normalizeModelName(value?: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function seriesKeyForModel(model: string) {
  const normalized = normalizeModelName(model);
  if (normalized.includes("iphone17") || normalized === "iphoneair") return "iphone17";
  if (normalized.includes("iphone16")) return "iphone16";
  if (normalized.includes("iphone15")) return "iphone15";
  if (normalized.includes("iphone14")) return "iphone14";
  if (normalized.includes("iphone13")) return "iphone13";
  if (normalized.includes("iphone12")) return "iphone12";
  if (normalized.includes("iphone11") || normalized.includes("iphonese")) return "iphone11";
  return "classic";
}

function parseStorageGb(value?: string) {
  const text = String(value ?? "")
    .toLowerCase()
    .replace(",", ".");
  const tbMatch = text.match(/(\d+(?:\.\d+)?)\s*tb/);
  if (tbMatch) return Math.round(Number(tbMatch[1]) * 1024);
  const gbMatch = text.match(/(\d+)\s*gb/);
  if (gbMatch) return Number(gbMatch[1]);
  const plain = text.match(/\b(64|128|256|512|1024)\b/);
  return plain ? Number(plain[1]) : undefined;
}

function getStoragePremium(storageGb: number | undefined, baseStorageGb: number) {
  if (!storageGb || storageGb <= baseStorageGb) return 0;
  const steps = [64, 128, 256, 512, 1024].filter(
    (step) => step > baseStorageGb && step <= storageGb,
  );
  return steps.reduce((sum, step) => {
    if (step === 128) return sum + 25;
    if (step === 256) return sum + 45;
    if (step === 512) return sum + 70;
    if (step === 1024) return sum + 100;
    return sum + 15;
  }, 0);
}

function profitRateFor(entry: ApplePriceGuideEntry) {
  const age = new Date().getFullYear() - entry.releaseYear;
  if (age <= 1) return 0.2;
  if (age <= 3) return 0.24;
  if (age <= 5) return 0.28;
  return 0.32;
}

function isOfficialStorageOption(entry: ApplePriceGuideEntry, storageGb: number | undefined) {
  if (!storageGb) return true;
  return entry.storageOptionsGb.includes(storageGb);
}

function getConfidence(
  entry: ApplePriceGuideEntry,
  storageGb: number | undefined,
  officialStorage: boolean,
) {
  if (!officialStorage) return "low";
  const age = new Date().getFullYear() - entry.releaseYear;
  if (!storageGb) return "medium";
  if (age <= 4) return "high";
  if (age <= 6) return "medium";
  return "low";
}

function nextWeeklyRefresh(observedAt: string) {
  const date = new Date(`${observedAt}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

function roundToFive(value: number) {
  return Math.round(value / 5) * 5;
}
