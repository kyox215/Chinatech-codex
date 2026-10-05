"use client";

import { useEffect, useId, useState, useSyncExternalStore, type SyntheticEvent } from "react";
import { useLanguage } from "./language-provider";

const subscribeFormReady = () => () => {};
const clientFormReady = () => true;
const serverFormReady = () => false;

/** SSR forms unlock only after React can preserve input and handle submission. */
export function useFormReady() {
  return useSyncExternalStore(subscribeFormReady, clientFormReady, serverFormReady);
}

type NativeControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
let pointerTarget: Element | null = null;
let pointerTime = 0;
let observers = 0;
function observePointer(event: PointerEvent) {
  pointerTarget = event.target instanceof Element ? event.target : null;
  pointerTime = performance.now();
}
function clearPointer() { pointerTarget = null; pointerTime = 0; }
export type ControlFeedbackProps = {
  error?: string;
  hint?: string;
  /** A concrete instruction for a native pattern constraint. */
  validationMessage?: string;
  /** Supplied by the owning domain; returning an empty string means valid. */
  validate?: (value: string) => string;
};

function validationError(control: NativeControl, patternMessage?: string) {
  const validity = control.validity;
  if (validity.valid || control.matches(":disabled") || ("readOnly" in control && control.readOnly)) return "";
  if (validity.customError) return control.validationMessage;
  if (validity.valueMissing) return control instanceof HTMLSelectElement ? "请选择一项。" : "此项还未填写，请补充后继续。";
  if (validity.typeMismatch) return control instanceof HTMLInputElement && control.type === "email" ? "邮箱格式不完整，请填写如 name@example.com 的地址。" : "地址格式不正确，请填写完整的网址。";
  if (validity.tooShort) return `内容太短，请至少填写 ${(control as HTMLInputElement).minLength} 个字符。`;
  if (validity.tooLong) return `内容过长，请缩短至 ${(control as HTMLInputElement).maxLength} 个字符以内。`;
  if (validity.rangeUnderflow) return control instanceof HTMLInputElement && control.type === "date" ? `日期早于允许范围，请选择 ${control.min} 或之后的日期。` : `数值低于允许范围，请填写不小于 ${(control as HTMLInputElement).min} 的值。`;
  if (validity.rangeOverflow) return control instanceof HTMLInputElement && control.type === "date" ? `日期晚于允许范围，请选择 ${control.max} 或之前的日期。` : `数值超出允许范围，请填写不大于 ${(control as HTMLInputElement).max} 的值。`;
  if (validity.badInput) return "无法识别这个数值，请填写有效数字。";
  if (validity.stepMismatch) return (control as HTMLInputElement).step === "1" ? "请填写整数，不要包含小数。" : "数值精度不符合要求，请按允许的步长调整。";
  if (validity.patternMismatch) return patternMessage || control.title || "格式不符合要求，请按此字段的示例修改。";
  return control.validationMessage;
}

/** Presentation only: native constraints stay native; domain and server rules stay with callers. */
export function useControlFeedback({ error, hint, validationMessage }: ControlFeedbackProps) {
  const { t } = useLanguage();
  useEffect(() => {
    if (observers++ === 0) {
      document.addEventListener("pointerdown", observePointer, true);
      document.addEventListener("click", clearPointer, true);
      document.addEventListener("pointercancel", clearPointer, true);
      document.addEventListener("keydown", clearPointer, true);
    }
    return () => {
      if (--observers === 0) {
        document.removeEventListener("pointerdown", observePointer, true);
        document.removeEventListener("click", clearPointer, true);
        document.removeEventListener("pointercancel", clearPointer, true);
        document.removeEventListener("keydown", clearPointer, true);
        clearPointer();
      }
    };
  }, []);
  const feedbackId = useId();
  const [nativeError, setNativeError] = useState("");
  const message = error || nativeError;
  const validate = (control: NativeControl) => setNativeError(validationError(control, validationMessage));
  const change = (control: NativeControl) => { if (nativeError) validate(control); };
  return {
    message,
    validate,
    blur: (event: SyntheticEvent<NativeControl, FocusEvent>) => {
      // Adornment and other button actions must complete before a new message
      // changes the field's height. Submit/next still validate native constraints.
      const button = event.nativeEvent.relatedTarget instanceof HTMLButtonElement || performance.now() - pointerTime < 250 && pointerTarget?.closest("button");
      if (!message && button) return;
      validate(event.currentTarget);
    },
    invalid: (event: SyntheticEvent<NativeControl>) => {
      event.preventDefault();
      const control = event.currentTarget;
      validate(control);
      const first = control.form?.querySelector("input:invalid,textarea:invalid,select:invalid");
      if (!control.form || first === control) control.focus();
    },
    change,
    revalidate: (control: NativeControl) => { if (nativeError) validate(control); },
    clear: () => setNativeError(""),
    describedBy: (existing?: string) => [existing, message || hint ? feedbackId : undefined].filter(Boolean).join(" ") || undefined,
    feedback: message || hint ? <span id={feedbackId} className={`control-feedback${message ? " control-feedback--error" : ""}`} aria-live="polite">{t(message || hint || "")}</span> : null,
  };
}

export function controlError(check: () => unknown) {
  try { check(); return ""; }
  catch (reason) { return reason instanceof Error ? reason.message : "输入不符合要求，请核对后修改。"; }
}
