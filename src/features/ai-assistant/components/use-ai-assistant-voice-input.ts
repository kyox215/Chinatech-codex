"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/shared/i18n/locale-provider";
import { getAiAssistantPresentationCopy } from "@/shared/i18n/messages";

export type AiAssistantVoiceSupport = "checking" | "supported" | "unsupported";
export type AiAssistantVoicePhase =
  | "idle"
  | "requesting_permission"
  | "listening"
  | "processing"
  | "error";

type BrowserSpeechRecognitionAlternative = {
  transcript: string;
};

type BrowserSpeechRecognitionResult = {
  readonly length: number;
  readonly isFinal: boolean;
  readonly [index: number]: BrowserSpeechRecognitionAlternative;
  item?: (index: number) => BrowserSpeechRecognitionAlternative | null;
};

type BrowserSpeechRecognitionResultList = {
  readonly length: number;
  readonly [index: number]: BrowserSpeechRecognitionResult;
  item?: (index: number) => BrowserSpeechRecognitionResult | null;
};

type BrowserSpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
};

type BrowserSpeechRecognitionErrorEvent = Event & {
  error: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: ((event: Event) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

export interface UseAiAssistantVoiceInputOptions {
  value: string;
  onValueChange: (value: string) => void;
  maxLength: number;
  disabled?: boolean;
  lang?: string;
}

export interface AiAssistantVoiceInputController {
  support: AiAssistantVoiceSupport;
  phase: AiAssistantVoicePhase;
  message?: string;
  isActive: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  toggle: () => void;
}

export function useAiAssistantVoiceInput({
  value,
  onValueChange,
  maxLength,
  disabled = false,
  lang,
}: UseAiAssistantVoiceInputOptions): AiAssistantVoiceInputController {
  const { locale } = useLocale();
  const copy = getAiAssistantPresentationCopy(locale);
  const [support, setSupport] = useState<AiAssistantVoiceSupport>("checking");
  const [phase, setPhaseState] = useState<AiAssistantVoicePhase>("idle");
  const [message, setMessage] = useState<string>();
  const recognitionRef = useRef<BrowserSpeechRecognition | undefined>(undefined);
  const phaseRef = useRef<AiAssistantVoicePhase>("idle");
  const baseValueRef = useRef("");
  const receivedTranscriptRef = useRef(false);
  const truncatedRef = useRef(false);
  const errorRef = useRef(false);
  const ignoreEndRef = useRef(false);

  const setPhase = useCallback((nextPhase: AiAssistantVoicePhase) => {
    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
  }, []);

  const abort = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = undefined;
    ignoreEndRef.current = true;
    if (recognition) {
      detachRecognitionHandlers(recognition);
      try {
        recognition.abort();
      } catch {
        // The browser may already have ended the session.
      }
    }
    setPhase("idle");
    setMessage(undefined);
  }, [setPhase]);

  useEffect(() => {
    setSupport(getSpeechRecognitionConstructor() ? "supported" : "unsupported");
  }, []);

  useEffect(() => {
    if (disabled) abort();
  }, [abort, disabled]);

  useEffect(
    () => () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = undefined;
      if (!recognition) return;
      detachRecognitionHandlers(recognition);
      try {
        recognition.abort();
      } catch {
        // Unmount cleanup is best effort and must not surface a UI error.
      }
    },
    [],
  );

  const start = useCallback(() => {
    if (disabled || (phaseRef.current !== "idle" && phaseRef.current !== "error")) return;

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setSupport("unsupported");
      setPhase("error");
      setMessage(copy.voiceUnsupportedHint);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    baseValueRef.current = value;
    receivedTranscriptRef.current = false;
    truncatedRef.current = false;
    errorRef.current = false;
    ignoreEndRef.current = false;

    recognition.lang = resolveSpeechLanguage(lang);
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (recognitionRef.current !== recognition) return;
      setPhase("listening");
      setMessage(copy.voiceListening);
    };

    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      const transcript = collectTranscript(event.results);
      if (!transcript.trim()) return;

      const merged = mergeVoiceInputValue(baseValueRef.current, transcript, maxLength);
      receivedTranscriptRef.current = true;
      truncatedRef.current = merged.truncated;
      onValueChange(merged.value);
    };

    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      if (event.error === "aborted" && ignoreEndRef.current) return;
      errorRef.current = true;
      setPhase("error");
      setMessage(toVoiceErrorMessage(event.error, copy));
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = undefined;
      detachRecognitionHandlers(recognition);
      if (ignoreEndRef.current) {
        ignoreEndRef.current = false;
        return;
      }
      if (errorRef.current) return;

      setPhase("idle");
      if (truncatedRef.current) {
        setMessage(copy.voiceTruncated.replace("{max}", String(maxLength)));
      } else if (receivedTranscriptRef.current) {
        setMessage(copy.voiceFilled);
      } else {
        setMessage(copy.voiceNoSpeech);
      }
    };

    setSupport("supported");
    setPhase("requesting_permission");
    setMessage(copy.voiceRequesting);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = undefined;
      detachRecognitionHandlers(recognition);
      setPhase("error");
      setMessage(copy.voiceStartFailed);
    }
  }, [copy, disabled, lang, maxLength, onValueChange, setPhase, value]);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (phaseRef.current === "requesting_permission") {
      recognitionRef.current = undefined;
      ignoreEndRef.current = true;
      detachRecognitionHandlers(recognition);
      try {
        recognition.abort();
      } catch {
        // The browser may have closed the permission request already.
      }
      setPhase("idle");
      setMessage(copy.voiceCancelled);
      return;
    }

    if (phaseRef.current !== "listening") return;
    setPhase("processing");
    setMessage(copy.voiceFormatting);
    try {
      recognition.stop();
    } catch {
      recognitionRef.current = undefined;
      detachRecognitionHandlers(recognition);
      setPhase("error");
      setMessage(copy.voiceFinishFailed);
    }
  }, [copy, setPhase]);

  const toggle = useCallback(() => {
    if (phaseRef.current === "requesting_permission" || phaseRef.current === "listening") {
      stop();
      return;
    }
    start();
  }, [start, stop]);

  return {
    support,
    phase,
    message,
    isActive: phase === "requesting_permission" || phase === "listening" || phase === "processing",
    start,
    stop,
    abort,
    toggle,
  };
}

export function mergeVoiceInputValue(baseValue: string, transcript: string, maxLength: number) {
  const spokenText = transcript.trim();
  const safeBaseValue = baseValue.slice(0, maxLength);
  if (!spokenText) return { value: safeBaseValue, truncated: baseValue.length > maxLength };

  const separator = safeBaseValue.length > 0 && !/\s$/u.test(safeBaseValue) ? " " : "";
  const combined = `${safeBaseValue}${separator}${spokenText}`;
  return {
    value: combined.slice(0, maxLength),
    truncated: combined.length > maxLength,
  };
}

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function resolveSpeechLanguage(language?: string) {
  if (language?.trim()) return language;
  if (typeof document !== "undefined" && document.documentElement.lang.trim()) {
    return document.documentElement.lang;
  }
  if (typeof navigator !== "undefined" && navigator.language) return navigator.language;
  return "zh-CN";
}

function collectTranscript(results: BrowserSpeechRecognitionResultList) {
  let transcript = "";
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index] ?? results.item?.(index);
    if (!result) continue;
    const alternative = result[0] ?? result.item?.(0);
    if (alternative?.transcript) transcript += alternative.transcript;
  }
  return transcript;
}

function toVoiceErrorMessage(
  errorCode: string,
  copy: ReturnType<typeof getAiAssistantPresentationCopy>,
) {
  switch (errorCode) {
    case "not-allowed":
    case "service-not-allowed":
      return copy.voicePermission;
    case "no-speech":
      return copy.voiceNoSpeech;
    case "audio-capture":
      return copy.voiceCapture;
    case "network":
      return copy.voiceNetwork;
    case "language-not-supported":
      return copy.voiceLanguage;
    default:
      return copy.voiceGeneric;
  }
}

function detachRecognitionHandlers(recognition: BrowserSpeechRecognition) {
  recognition.onstart = null;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
}
