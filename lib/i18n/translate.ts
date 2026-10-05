import { interfaceMessages } from "./interface";
import { errorMessages } from "./errors";
import structuredMessages from "./structured.json";
import { publicMessages } from "./public";
import type { Locale } from "./locale";

const messages: Record<string, readonly string[]> = { ...structuredMessages, ...errorMessages, ...interfaceMessages, ...publicMessages };
const templates = Object.entries(messages).filter(([key]) => key.includes("{")).map(([key, translations]) => {
  const names: string[] = [];
  const pieces = key.split(/\{(\w+)\}/g);
  const pattern = pieces.map((piece, index) => {
    if (index % 2) { names.push(piece); return "(.+?)"; }
    return piece.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  return { pattern: new RegExp(`^${pattern}$`), names, translations };
});

/** Translate presentation messages only. Business values and signed snapshots stay original. */
export function translate(text: string, locale: Locale, values?: Record<string, string | number>): string {
  if (locale === "zh-CN") return substitute(text, values);
  const normalized = text.trim().replace(/\s+/g, " ");
  let entry = Object.hasOwn(messages, text) ? messages[text] : Object.hasOwn(messages, normalized) ? messages[normalized] : undefined;
  let variables = values;
  if (!entry && !values && /[\u3400-\u9fff]/u.test(normalized)) {
    for (const template of templates) {
      const match = normalized.match(template.pattern);
      if (!match) continue;
      // A broad template must not partially translate an unknown message or a user's name.
      if (match.slice(1).some(value => /[\u3400-\u9fff]/u.test(value))) continue;
      entry = template.translations;
      variables = Object.fromEntries(template.names.map((name, index) => [name, match[index + 1]]));
      break;
    }
  }
  if (!entry) return substitute(text, values);
  const translated = entry[locale === "it" ? 0 : 1];
  const leading = /^\s/.test(translated) ? "" : text.match(/^\s+/)?.[0] ?? "";
  const trailing = /\s$/.test(translated) ? "" : text.match(/\s+$/)?.[0] ?? "";
  return `${leading}${substitute(translated, variables)}${trailing}`;
}

function substitute(text: string, values?: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (token, key: string) => !values || !Object.hasOwn(values, key) || values[key] === undefined ? token : String(values[key]));
}
