type DeviceBrandAlias = {
  canonical: string;
  aliases: readonly string[];
};

const deviceBrandAliases: readonly DeviceBrandAlias[] = [
  {
    canonical: "iPhone",
    aliases: ["apple iphone", "苹果手机", "蘋果手機", "iphone", "apple", "苹果", "蘋果"],
  },
  { canonical: "Samsung", aliases: ["samsung", "三星"] },
  { canonical: "Huawei", aliases: ["huawei", "华为", "華為"] },
  { canonical: "Xiaomi", aliases: ["xiaomi", "小米"] },
  { canonical: "Redmi", aliases: ["redmi", "红米", "紅米"] },
  { canonical: "OPPO", aliases: ["oppo", "欧珀", "歐珀"] },
  { canonical: "Vivo", aliases: ["vivo", "维沃", "維沃"] },
  { canonical: "Honor", aliases: ["honor", "荣耀", "榮耀"] },
  { canonical: "OnePlus", aliases: ["oneplus", "one plus", "一加"] },
];

const chineseQueryPrefix =
  /^(?:(?:帮我|幫我|请|請|麻烦|麻煩)\s*)?(?:(?:查一下|查查|查询|查詢|查找|查看|搜索|搜尋|找找|找)\s*|(?:有没有|有沒有|是否有|有无|有無)\s*)/;
const latinQueryPrefix =
  /^(?:please\s+)?(?:find|show|search(?:\s+for)?|look\s+up|cerca|trova|mostra)\s+/;
const chineseQuerySuffix =
  /\s*(?:系列\s*)?(?:的\s*)?(?:工单|工單|订单|訂單|维修单|維修單|设备|設備|手机|手機|单子|單子)\s*$/;
const latinQuerySuffix =
  /\s*(?:(?:series|serie)\s+)?(?:orders?|repairs?|devices?|ordini|riparazioni)\s*$/;
const chineseFilterSuffix =
  /\s*(?:且|并且|並且|同时|同時|以及)\s*(?:未付款|没付款|沒付款|已付款|逾期|正在维修|正在維修|处理中|處理中).*$/;
const latinFilterSuffix =
  /\s+(?:and|with|e)\s+(?:unpaid|paid|overdue|in\s+repair|non\s+pagat[oi]|pagat[oi]|in\s+riparazione).*$/;
const seriesSuffix = /\s*(?:系列|series|serie)\s*$/;
const clauseSeparator = /[\n,，;；:：]+/;
const hanCharacterPattern = /[\u3400-\u9fff]/;

export function parseDeviceSearchIntent(message: string): string | null {
  const clauses = message.normalize("NFKC").split(clauseSeparator).slice(0, 8);
  const matches = clauses
    .map(parseDeviceSearchClause)
    .filter((value): value is string => Boolean(value));
  const uniqueMatches = [
    ...new Map(matches.map((value) => [normalizeDeviceSearchKey(value), value])).values(),
  ];
  const uniqueMatch = uniqueMatches[0];
  return uniqueMatches.length === 1 && uniqueMatch ? uniqueMatch : null;
}

function parseDeviceSearchClause(message: string): string | null {
  const candidate = message
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[?.!。！？]+$/g, "")
    .replace(chineseQueryPrefix, "")
    .replace(latinQueryPrefix, "")
    .replace(chineseQuerySuffix, "")
    .replace(latinQuerySuffix, "")
    .replace(chineseFilterSuffix, "")
    .replace(latinFilterSuffix, "")
    .replace(seriesSuffix, "")
    .trim();

  if (!candidate || candidate.length > 96) return null;

  for (const entry of deviceBrandAliases) {
    const alias = entry.aliases.find((value) => candidate.startsWith(value));
    if (!alias) continue;

    let model = candidate
      .slice(alias.length)
      .replace(/^[\s:：,，/\\-]+/, "")
      .trim();
    if (entry.canonical === "iPhone") {
      model = model.replace(/^iphone[\s:：,，/\\-]*/i, "").trim();
    }
    model = model.replace(seriesSuffix, "").trim();
    if (
      !model ||
      model.length > 40 ||
      !/[a-z0-9]/i.test(model) ||
      hanCharacterPattern.test(model) ||
      !/^[a-z0-9][a-z0-9+./\-\s]*$/i.test(model)
    ) {
      return null;
    }
    return `${entry.canonical} ${model}`.replace(/\s+/g, " ").trim();
  }

  return null;
}

export function deviceLabelMatchesSearch(deviceLabel: string, search: string) {
  const queryKey = normalizeDeviceSearchKey(search);
  return queryKey.length > 0 && normalizeDeviceSearchKey(deviceLabel).includes(queryKey);
}

export function normalizeDeviceSearchKey(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
