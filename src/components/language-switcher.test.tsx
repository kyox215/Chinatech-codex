import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LanguageSwitcher } from "@/components/language-switcher";
import { LocaleProvider } from "@/shared/i18n/locale-provider";

afterEach(() => vi.restoreAllMocks());

describe("LanguageSwitcher", () => {
  it("exposes a keyboard-compatible three-language radio menu", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const focus = vi.spyOn(HTMLButtonElement.prototype, "focus");
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
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
    await waitFor(() => expect(focus).toHaveBeenCalledWith({ preventScroll: true }));
  });

  it.each([
    ["pointer", "pointerdown"],
    ["keyboard", "keydown"],
  ] as const)(
    "captures scroll in the %s capture phase before opening focus can move the page",
    (interaction, nativeEventName) => {
      let scrollX = 24;
      let scrollY = 480;
      vi.spyOn(window, "scrollX", "get").mockImplementation(() => scrollX);
      vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollY);
      const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
        callback(0);
        return 1;
      });
      render(
        <LocaleProvider initialLocale="zh-CN">
          <LanguageSwitcher />
        </LocaleProvider>,
      );

      const trigger = screen.getByRole("button", { name: "选择界面语言" });
      trigger.addEventListener(
        nativeEventName,
        () => {
          scrollX = 0;
          scrollY = 0;
        },
        { once: true },
      );

      if (interaction === "pointer") {
        fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
      } else {
        fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
      }
      fireEvent.click(screen.getByRole("menuitemradio", { name: "English" }));

      expect(scrollTo).toHaveBeenCalledWith(24, 480);
    },
  );

  it("preserves an outside click target instead of reclaiming focus or scroll", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const focus = vi.spyOn(HTMLButtonElement.prototype, "focus");
    render(
      <LocaleProvider initialLocale="zh-CN">
        <LanguageSwitcher />
        <button type="button">外部目标</button>
      </LocaleProvider>,
    );

    const trigger = screen.getByRole("button", { name: "选择界面语言" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(3);

    const outsideTarget = screen.getByRole("button", { name: "外部目标" });
    fireEvent.pointerDown(outsideTarget, { button: 0, ctrlKey: false });
    outsideTarget.focus();
    fireEvent.click(outsideTarget);

    await waitFor(() => expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument());
    expect(outsideTarget).toHaveFocus();
    expect(focus).not.toHaveBeenCalledWith({ preventScroll: true });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
