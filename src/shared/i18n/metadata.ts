import "server-only";

import type { Metadata } from "next";

import { getServerLocale } from "@/shared/i18n/server";
import { translateMessage, type MessageKey, type MessageValues } from "@/shared/i18n/messages";

export async function getLocalizedMetadata(
  titleKey: MessageKey,
  values?: MessageValues,
): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    title: translateMessage(locale, titleKey, values),
    description: translateMessage(locale, "metadata.description"),
  };
}

export function createLocalizedMetadata(titleKey: MessageKey) {
  return async function generateMetadata(): Promise<Metadata> {
    return getLocalizedMetadata(titleKey);
  };
}
