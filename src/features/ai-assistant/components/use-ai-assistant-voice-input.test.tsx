import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";
import { useAiAssistantVoiceInput } from "./use-ai-assistant-voice-input";

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "SpeechRecognition");
  Reflect.deleteProperty(window, "webkitSpeechRecognition");
});

describe("useAiAssistantVoiceInput i18n", () => {
  it.each([
    ["zh-CN", "当前浏览器不支持语音输入，请使用键盘输入。"],
    ["it-IT", "Questo browser non supporta l’input vocale; usa la tastiera."],
    ["en", "This browser does not support voice input; use the keyboard."],
  ] as const)("uses the %s fallback without changing the draft", async (locale, expected) => {
    const onValueChange = vi.fn();
    const { result } = renderHook(
      () =>
        useAiAssistantVoiceInput({
          value: "DYNAMIC-草稿",
          onValueChange,
          maxLength: 800,
        }),
      { wrapper: localeWrapper(locale) },
    );

    await waitFor(() => expect(result.current.support).toBe("unsupported"));
    act(() => result.current.start());
    expect(result.current.message).toBe(expected);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

function localeWrapper(locale: AppLocale) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>;
  };
}
