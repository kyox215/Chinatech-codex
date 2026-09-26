import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import * as runtimeMessages from "@/shared/i18n/runtime-messages";
import { messagesByLocale } from "@/shared/i18n/messages";
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
      <button type="button" onClick={() => setLocale("it-IT")}>
        Italian
      </button>
      <button type="button" onClick={() => setLocale("en")}>
        English
      </button>
    </div>
  );
}

describe("LocaleProvider", () => {
  it("switches in place and preserves client state without remounting children", () => {
    document.title = "登录 — RepairDesk";
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
    expect(document.title).toBe("Sign in — RepairDesk");
    expect(document.cookie).toContain("repairdesk_locale=en");
  });

  it("preserves an unknown dynamic document title", () => {
    document.title = "Ordine RD-2026-001 — RepairDesk";
    render(
      <LocaleProvider initialLocale="zh-CN">
        <StatefulHarness />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(document.title).toBe("Ordine RD-2026-001 — RepairDesk");
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

describe("deferred locale catalogs", () => {
  it("preserves the active language and draft until the latest requested catalog is ready", async () => {
    const cached = vi.spyOn(runtimeMessages, "getLoadedMessageCatalog").mockReturnValue(undefined);
    let resolveEnglish!: () => void;
    let resolveItalian!: () => void;
    const load = vi.spyOn(runtimeMessages, "loadMessageCatalog").mockImplementation(
      (locale) =>
        new Promise((resolve) => {
          const finish = () => resolve(messagesByLocale[locale]);
          if (locale === "en") resolveEnglish = finish;
          else resolveItalian = finish;
        }),
    );
    try {
      render(
        <LocaleProvider initialLocale="zh-CN">
          <StatefulHarness />
        </LocaleProvider>,
      );
      const input = screen.getByRole("textbox", { name: "draft" });
      fireEvent.change(input, { target: { value: "pending local note" } });
      const dialog = screen.getByRole("dialog");
      fireEvent.click(screen.getByRole("button", { name: "English" }));
      expect(screen.getByTestId("locale")).toHaveTextContent("zh-CN");
      fireEvent.click(screen.getByRole("button", { name: "Italian" }));
      await act(async () => resolveItalian());
      expect(screen.getByTestId("locale")).toHaveTextContent("it-IT");
      await act(async () => resolveEnglish());
      expect(screen.getByTestId("locale")).toHaveTextContent("it-IT");
      expect(input).toHaveValue("pending local note");
      expect(screen.getByRole("dialog")).toBe(dialog);
    } finally {
      cached.mockRestore();
      load.mockRestore();
    }
  });

  it("keeps the current language and allows another attempt after a catalog download fails", async () => {
    const cached = vi.spyOn(runtimeMessages, "getLoadedMessageCatalog").mockReturnValue(undefined);
    const load = vi
      .spyOn(runtimeMessages, "loadMessageCatalog")
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValue(messagesByLocale.en);
    try {
      render(
        <LocaleProvider initialLocale="zh-CN">
          <StatefulHarness />
        </LocaleProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "English" }));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("语言加载失败"));
      expect(screen.getByTestId("locale")).toHaveTextContent("zh-CN");
      fireEvent.click(screen.getByRole("button", { name: "English" }));
      await waitFor(() => expect(screen.getByTestId("locale")).toHaveTextContent("en"));
    } finally {
      cached.mockRestore();
      load.mockRestore();
    }
  });
});
