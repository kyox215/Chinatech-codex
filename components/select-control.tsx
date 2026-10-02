"use client";

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react";

/** Keep native selection, form events and keyboard behavior in every browser. */
export function SelectControl({ children, multiple, size, ...props }: ComponentPropsWithoutRef<"select">) {
  const selectRef = useRef<HTMLSelectElement>(null);

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
  }, [multiple, size]);

  return (
    <select {...props} ref={selectRef} multiple={multiple} size={size}>
      {children}
    </select>
  );
}
