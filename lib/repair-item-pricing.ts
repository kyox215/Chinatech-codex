export type ItemQuote = { item: string; amountCents: number | null };
export type ItemQuoteChange = { id: string; time: string; item: string; previousCents: number | null; amountCents: number | null; actorId?: string };
const validAmount = (value: unknown): value is number | null => value === null || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100000000);
const validItem = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 100 && value === value.trim();
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
export function validItemQuotes(value: unknown): value is ItemQuote[] {
  if (!Array.isArray(value) || value.length > 100) return false;
  const seen = new Set<string>();
  for (const row of value) {
    if (!object(row) || Object.keys(row).some(key => !["item", "amountCents"].includes(key)) || !validItem(row.item) || !validAmount(row.amountCents) || seen.has(row.item)) return false;
    seen.add(row.item);
  }
  return true;
}
export function validItemQuoteHistory(value: unknown): value is ItemQuoteChange[] {
  if (!Array.isArray(value) || value.length > 1000) return false;
  const seen = new Set<string>();
  for (const row of value) {
    if (!object(row) || Object.keys(row).some(key => !["id", "time", "item", "previousCents", "amountCents", "actorId"].includes(key)) || typeof row.id !== "string" || !row.id || row.id.length > 150 || seen.has(row.id) || typeof row.time !== "string" || !row.time || row.time.length > 40 || !validItem(row.item) || !validAmount(row.previousCents) || !validAmount(row.amountCents) || (row.actorId !== undefined && (typeof row.actorId !== "string" || !row.actorId || row.actorId.length > 100))) return false;
    seen.add(row.id);
  }
  return true;
}
export function itemQuoteTotal(quotes: readonly ItemQuote[] | undefined): number | null {
  if (!quotes?.length) return null;
  if (!validItemQuotes(quotes)) throw new Error("维修项目报价无效。");
  if (quotes.some(row => row.amountCents === null)) return null;
  return quotes.reduce((total, row) => total + row.amountCents!, 0);
}
/** Blank is unknown, zero is explicit. Never round extra decimals or accept exponent notation. */
export function parseItemMoney(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(text) || text.length > 20) throw new Error("金额须为非负数字，最多两位小数。");
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!validAmount(cents)) throw new Error("金额超出允许范围。");
  return cents;
}
export function updateItemQuotes(previous: readonly ItemQuote[] | undefined, next: readonly ItemQuote[], history: readonly ItemQuoteChange[] | undefined, activity: { id: string; time: string; actorId?: string }): { itemQuotes: ItemQuote[]; itemQuoteHistory: ItemQuoteChange[] } {
  if (!validItemQuotes(previous ?? []) || !validItemQuotes(next) || !validItemQuoteHistory(history ?? [])) throw new Error("维修报价或历史无效。");
  const before = new Map((previous ?? []).map(row => [row.item, row.amountCents]));
  const after = new Map(next.map(row => [row.item, row.amountCents]));
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(item => before.has(item) !== after.has(item) || before.get(item) !== after.get(item));
  const additions = changed.map((item, index) => ({ ...activity, id: `${activity.id}:${index + 1}`, item, previousCents: before.get(item) ?? null, amountCents: after.get(item) ?? null }));
  const itemQuoteHistory = [...history ?? [], ...additions];
  if (!validItemQuoteHistory(itemQuoteHistory)) throw new Error("报价历史重复或已达上限，未保存。");
  if (additions.length && history?.some(row => row.time > activity.time)) throw new Error("报价操作时间不能早于已有历史。");
  return { itemQuotes: next.map(row => ({ ...row })), itemQuoteHistory };
}
