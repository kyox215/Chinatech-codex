"use client";

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { useControlFeedback, type ControlFeedbackProps } from "./control-feedback";
import { useLanguage } from "./language-provider";

/** Keep native selection, form events and keyboard behavior in every browser. */
export function SelectControl({ children, multiple, size, error, hint, validationMessage, validate, onBlur, onInvalid, onChange, ...props }: ComponentPropsWithoutRef<"select"> & ControlFeedbackProps) {
  const { locale } = useLanguage();
  const selectRef = useRef<HTMLSelectElement>(null);
  const feedback = useControlFeedback({ error, hint, validationMessage });

  useLayoutEffect(() => {
    if (!selectRef.current) return;
    selectRef.current.setCustomValidity(validate?.(selectRef.current.value) ?? "");
    feedback.revalidate(selectRef.current);
  });

  useLayoutEffect(() => {
    const select = selectRef.current;
    if (!select || multiple || (size && size > 1) || !CSS.supports("appearance", "base-select")) return;

    // Next's bundled React still rejects the new select/button nesting. Enhance
    // after hydration; React keeps ownership of the native select and options.
    const button = document.createElement("button");
    button.type = "button";
    button.className = "select-control__button";
    const content = document.createElement("selectedcontent");
    content.className = "select-control__value";
    button.append(content);
    select.prepend(button);

    return () => button.remove();
  }, [multiple, size, locale]);

  return (
    <span className="select-control">
    <select {...props} ref={selectRef} multiple={multiple} size={size}
      aria-invalid={feedback.message ? true : props["aria-invalid"]}
      aria-describedby={feedback.describedBy(props["aria-describedby"])}
      onBlur={event => { feedback.blur(event); onBlur?.(event); }}
      onInvalid={event => { feedback.invalid(event); onInvalid?.(event); }}
      onChange={event => { event.currentTarget.setCustomValidity(validate?.(event.currentTarget.value) ?? ""); feedback.change(event.currentTarget); onChange?.(event); }}>
      {children}
    </select>
    {feedback.feedback}
    </span>
  );
}
