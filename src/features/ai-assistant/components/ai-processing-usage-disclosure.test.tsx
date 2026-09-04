import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";
import { AiProcessingUsageDisclosure } from "./ai-processing-usage-disclosure";

afterEach(cleanup);

describe("AiProcessingUsageDisclosure i18n", () => {
  it.each([
    ["zh-CN", "展开处理方式和用量", "本地处理"],
    ["it-IT", "Mostra modalità e utilizzo", "Elaborazione locale"],
    ["en", "Expand processing and usage", "Local processing"],
  ] as const)("localizes the disclosure for %s without changing its mode", (locale, aria, mode) => {
    const onOpenChange = vi.fn();
    renderDisclosure(locale, onOpenChange);

    const trigger = screen.getByRole("button", { name: aria });
    expect(screen.getByText(mode)).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});

function renderDisclosure(locale: AppLocale, onOpenChange: (open: boolean) => void) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <AiProcessingUsageDisclosure
        open={false}
        onOpenChange={onOpenChange}
        processingMode="local"
        onProcessingModeChange={vi.fn()}
        canUseModel
        canSubmit
        capabilitiesLoading={false}
        capabilitiesError={false}
        isSubmitting={false}
        voiceSupported={false}
        canReadUsage={false}
        usageLoading={false}
        usageError={false}
        onRetryUsage={vi.fn()}
      />
    </LocaleProvider>,
  );
}
