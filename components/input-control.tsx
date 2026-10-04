"use client";

import { useLayoutEffect, useRef, useState, type ComponentPropsWithRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useControlFeedback, type ControlFeedbackProps } from "./control-feedback";

type InputProps = ComponentPropsWithRef<"input"> & ControlFeedbackProps & {
  onClear?: () => void;
  clearLabel?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  shell?: boolean;
};

/** Text-like inputs only. Checkboxes, radios, ranges and file pickers retain their own controls. */
export function InputControl({ error, hint, validationMessage, validate, onClear, clearLabel = "清空输入", leading, trailing, shell = false, ref, onBlur, onInvalid, onChange, className, ...props }: InputProps) {
  const input = useRef<HTMLInputElement | null>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState(props.defaultValue ?? "");
  const value = props.value ?? uncontrolledValue;
  const filled = String(value).length > 0;
  const feedback = useControlFeedback({ error, hint, validationMessage });
  const invalid = Boolean(feedback.message) || props["aria-invalid"] === true || props["aria-invalid"] === "true";
  const externalFeedback = !error && Boolean(props["aria-describedby"]) && (props["aria-invalid"] === true || props["aria-invalid"] === "true");
  const clearable = Boolean(onClear) && !props.disabled && !props.readOnly;
  const actions = Number(clearable) + Number(Boolean(trailing));
  useLayoutEffect(() => {
    if (!input.current) return;
    input.current.setCustomValidity(validate?.(input.current.value) ?? "");
    // Reconcile candidate selection, restored drafts and other programmatic changes.
    feedback.revalidate(input.current);
  });

  return <span className="input-control" data-filled={filled} data-invalid={invalid}>
    <span className={`input-control__body${shell ? " input-shell" : ""}`} data-actions={actions} data-leading={Boolean(leading)}>
      {leading ? <span className="input-control__leading" aria-hidden="true">{leading}</span> : null}
      <input {...props} ref={element => { input.current = element; if (typeof ref === "function") return ref(element); if (ref) ref.current = element; }}
        className={["input-control__native", className].filter(Boolean).join(" ")}
        aria-invalid={invalid || undefined} aria-describedby={externalFeedback ? props["aria-describedby"] : feedback.describedBy(props["aria-describedby"])}
        onBlur={event => { feedback.blur(event); onBlur?.(event); }}
        onInvalid={event => { feedback.invalid(event); onInvalid?.(event); }}
        onChange={event => { event.currentTarget.setCustomValidity(validate?.(event.currentTarget.value) ?? ""); if (props.value === undefined) setUncontrolledValue(event.currentTarget.value); feedback.change(event.currentTarget); onChange?.(event); }} />
      {actions ? <span className="input-control__actions">
        {clearable ? <button type="button" className="input-control__clear" aria-label={clearLabel} hidden={!filled} onClick={() => {
          if (!input.current || input.current.matches(":disabled") || input.current.readOnly) return;
          onClear?.(); feedback.clear(); input.current.focus({ preventScroll: true });
        }}><X size={16} aria-hidden="true" /></button> : null}
        {trailing}
      </span> : null}
    </span>
    {externalFeedback ? null : feedback.feedback}
  </span>;
}

export function TextareaControl({ error, hint, validationMessage, validate, onBlur, onInvalid, onChange, className, ref, ...props }: ComponentPropsWithRef<"textarea"> & ControlFeedbackProps) {
  const input = useRef<HTMLTextAreaElement | null>(null);
  const feedback = useControlFeedback({ error, hint, validationMessage });
  useLayoutEffect(() => {
    if (!input.current) return;
    input.current.setCustomValidity(validate?.(input.current.value) ?? "");
    feedback.revalidate(input.current);
  });
  const invalid = Boolean(feedback.message) || props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return <span className="input-control" data-invalid={invalid}>
    <textarea {...props} ref={element => { input.current = element; if (typeof ref === "function") return ref(element); if (ref) ref.current = element; }} className={["input-control__native", className].filter(Boolean).join(" ")} aria-invalid={invalid || undefined} aria-describedby={feedback.describedBy(props["aria-describedby"])}
      onBlur={event => { feedback.blur(event); onBlur?.(event); }}
      onInvalid={event => { feedback.invalid(event); onInvalid?.(event); }}
      onChange={event => { event.currentTarget.setCustomValidity(validate?.(event.currentTarget.value) ?? ""); feedback.change(event.currentTarget); onChange?.(event); }} />
    {feedback.feedback}
  </span>;
}
