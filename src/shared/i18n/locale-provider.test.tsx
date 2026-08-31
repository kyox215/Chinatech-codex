import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { LocaleProvider, useLocale } from "@/shared/i18n/locale-provider";

function StatefulHarness() {
  const { locale, setLocale, t } = useLocale();
  const [dialogOpen, setDialogOpen] = useState(true);

  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="label">{t("shell.workspace")}</span>
      <input aria-label="draft" defaultValue="" />
      <button type="button" onClick={() => setDialogOpen((open) => !open)}>
        toggle dialog
      </button>
      {dialogOpen ? <div role="dialog">draft dialog</div> : null}
      <button type="button" onClick={() => setLocale("en")}>
        English
      </button>
    </div>
  );
}

describe("LocaleProvider", () => {
  it("switches in place and preserves client state without remounting children", () => {
    render(
      <LocaleProvider initialLocale="zh-CN">
        <StatefulHarness />
      </LocaleProvider>,
    );

    const input = screen.getByRole("textbox", { name: "draft" });
    fireEvent.change(input, { target: { value: "unfinished order note" } });
    const dialog = screen.getByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    expect(screen.getByTestId("label")).toHaveTextContent("Workspace");
    expect(screen.getByRole("textbox", { name: "draft" })).toHaveValue("unfinished order note");
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(document.cookie).toContain("repairdesk_locale=en");
  });

  it("keeps the in-memory locale and announces when Cookie persistence is blocked", () => {
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: () => {
        throw new DOMException("Cookie access denied", "SecurityError");
      },
    });

    try {
      render(
        <LocaleProvider initialLocale="zh-CN">
          <StatefulHarness />
        </LocaleProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "English" }));

      expect(screen.getByTestId("locale")).toHaveTextContent("en");
      expect(screen.getByTestId("label")).toHaveTextContent("Workspace");
      expect(screen.getByRole("status")).toHaveTextContent(
        "Language changed to English, but the browser could not save the preference",
      );
    } finally {
      Reflect.deleteProperty(document, "cookie");
    }
  });
});
