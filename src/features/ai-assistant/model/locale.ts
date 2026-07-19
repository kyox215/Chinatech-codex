import type { AiAssistantLocale } from "./contracts";

export function resolveAiAssistantLocale(documentLanguage?: string | null): AiAssistantLocale {
  const normalized = documentLanguage?.trim().replace(/_/g, "-").toLowerCase() ?? "";
  if (normalized === "it" || normalized.startsWith("it-")) return "it-IT";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
  return "zh-CN";
}

export function currentAiAssistantLocale(): AiAssistantLocale {
  return resolveAiAssistantLocale(
    typeof document === "undefined" ? undefined : document.documentElement.lang,
  );
}
