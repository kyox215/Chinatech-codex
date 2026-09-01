import Link from "next/link";

import { translateMessage } from "@/shared/i18n/messages";
import { getServerLocale } from "@/shared/i18n/server";

export default async function NotFound() {
  const locale = await getServerLocale();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="glass-card max-w-md p-8 text-center">
        <h1 className="gradient-text font-display text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">{translateMessage(locale, "notFound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {translateMessage(locale, "notFound.description")}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-primary-foreground"
          style={{ background: "var(--gradient-brand)" }}
        >
          {translateMessage(locale, "notFound.backHome")}
        </Link>
      </div>
    </div>
  );
}
