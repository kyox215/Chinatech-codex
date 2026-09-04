import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerListSkeleton } from "@/features/customers/components/customer-list-skeleton";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

const mocks = vi.hoisted(() => ({ viewport: "compact" as "pending" | "compact" | "desktop" }));

vi.mock("@/hooks/use-mobile", () => ({ useViewportMode: () => mocks.viewport }));

describe("CustomerListSkeleton i18n", () => {
  beforeEach(() => {
    mocks.viewport = "compact";
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "announces the localized loading state in %s",
    (locale) => {
      render(
        <LocaleProvider initialLocale={locale}>
          <CustomerListSkeleton />
        </LocaleProvider>,
      );
      expect(
        screen.getByText(translateMessage(locale, "customers.list.preparing"), {
          selector: '[role="status"]',
        }),
      ).toBeVisible();
    },
  );
});
