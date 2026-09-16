"use client";

import { createContext, useContext } from "react";

export const NewOrderValidationContext = createContext<Readonly<Record<string, string>>>({});

export function useNewOrderFieldError(target: string, resolved = false) {
  const errors = useContext(NewOrderValidationContext);
  return resolved ? undefined : errors[target];
}

export const newOrderInvalidClass =
  "!rounded-lg !border-status-danger-foreground !bg-status-danger/10 !ring-1 !ring-status-danger-foreground/50";

export function NewOrderFieldError({ target, message }: { target: string; message?: string }) {
  return message ? (
    <span
      id={`new-order-error-${target}`}
      data-new-order-error={target}
      className="col-span-full block px-1 py-1 text-xs font-medium leading-4 text-status-danger-foreground"
    >
      {message}
    </span>
  ) : null;
}
