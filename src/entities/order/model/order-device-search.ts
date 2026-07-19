type DeviceBrandAlias = {
  canonical: string;
  aliases: readonly string[];
};

const deviceBrandAliases: readonly DeviceBrandAlias[] = [
  { canonical: "iPhone", aliases: ["apple iphone", "苹果手机", "iphone", "apple", "苹果"] },
  { canonical: "Samsung", aliases: ["samsung", "三星"] },
  { canonical: "Huawei", aliases: ["huawei", "华为"] },
  { canonical: "Xiaomi", aliases: ["xiaomi", "小米"] },
  { canonical: "Redmi", aliases: ["redmi", "红米"] },
  { canonical: "OPPO", aliases: ["oppo", "欧珀"] },
  { canonical: "Vivo", aliases: ["vivo", "维沃"] },
  { canonical: "Honor", aliases: ["honor", "荣耀"] },
  { canonical: "OnePlus", aliases: ["oneplus", "one plus", "一加"] },
];

const chineseQueryPrefix =
  /^(?:(?:帮我|请|麻烦)\s*)?(?:查一下|查查|查询|查找|查看|搜索|找找|找)\s*/;
const latinQueryPrefix =
  /^(?:please\s+)?(?:find|show|search(?:\s+for)?|look\s+up|cerca|trova|mostra)\s+/;
const chineseQuerySuffix = /\s*(?:的)?\s*(?:工单|订单|维修单|设备|手机)\s*$/;
const latinQuerySuffix = /\s*(?:orders?|repairs?|devices?|ordini|riparazioni)\s*$/;

export function parseDeviceSearchIntent(message: string): string | null {
  const candidate = message
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[?.!。！？]+$/g, "")
    .replace(chineseQueryPrefix, "")
    .replace(latinQueryPrefix, "")
    .replace(chineseQuerySuffix, "")
    .replace(latinQuerySuffix, "")
    .trim();

  if (!candidate || candidate.length > 64) return null;

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
    if (!model || model.length > 40 || !/[a-z0-9]/i.test(model)) return null;
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
