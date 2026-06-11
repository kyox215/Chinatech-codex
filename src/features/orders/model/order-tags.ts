import { normalizeAccessoryNotes } from "./order-accessory-notes";

const accessoryPattern =
  /(sim|卡托|卡槽|取卡针|卡针|手机壳|保护壳|壳|充电器|充电头|数据线|充电线|耳机|盒子|包装|保护膜|scheda|caricatore|cavo|cover|custodia|accessori)/i;

const vipPattern = /\bvip\b/i;
const urgentPattern = /(加急|急件|优先|urgent|urgente|priority)/i;

function cleanText(value?: string | null) {
  return value?.trim() || "";
}

function joinNotes(...values: (string | undefined)[]) {
  return values
    .map((value) => cleanText(value))
    .filter(Boolean)
    .join("；");
}

export function classifyPriorityTag(value?: string | null) {
  const text = cleanText(value);
  if (!text) return undefined;
  if (vipPattern.test(text)) return "VIP";
  if (urgentPattern.test(text)) return "加急";
  if (accessoryPattern.test(text)) return undefined;
  return text;
}

export function normalizeOrderTagInput(input: {
  internalTag?: string | null;
  accessoryNotes?: string | null;
}) {
  const rawTag = cleanText(input.internalTag);
  const accessoryNotes = normalizeAccessoryNotes(input.accessoryNotes);
  const priorityTag = classifyPriorityTag(rawTag);
  const tagLooksLikeAccessory = rawTag ? accessoryPattern.test(rawTag) : false;
  const nextAccessoryNotes = tagLooksLikeAccessory
    ? normalizeAccessoryNotes(joinNotes(accessoryNotes, rawTag))
    : accessoryNotes || undefined;

  return {
    internalTag: priorityTag,
    accessoryNotes: nextAccessoryNotes,
  };
}
