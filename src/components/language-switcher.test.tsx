import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LanguageSwitcher } from "@/components/language-switcher";
import { LocaleProvider } from "@/shared/i18n/locale-provider";

afterEach(() => vi.restoreAllMocks());

describe("LanguageSwitcher", () => {
  it("exposes a keyboard-compatible three-language radio menu", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    render(
      <LocaleProvider initialLocale="zh-CN">
        <LanguageSwitcher />
      </LocaleProvider>,
    );

    const trigger = screen.getByRole("button", { name: "选择界面语言" });
    expect(trigger).toHaveClass("size-11");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    const options = screen.getAllByRole("menuitemradio");
    expect(options).toHaveLength(3);
    expect(screen.getByRole("menuitemradio", { name: "中文" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    fireEvent.click(screen.getByRole("menuitemradio", { name: "English" }));
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(screen.getByRole("button", { name: "Choose interface language" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Interface language changed to English");
  });
});
