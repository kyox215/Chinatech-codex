"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export type InventoryLifecycleValidationIssue = {
  fieldId: string;
  label: string;
  message: string;
};

export type InventoryLifecycleFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Presentational lifecycle field shell. Controls keep their own id and aria
 * attributes so callers make the field-to-feedback relationship explicit.
 */
export function InventoryLifecycleField({
  id,
  label,
  required = false,
  hint,
  error,
  children,
  className,
}: InventoryLifecycleFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div
      data-ui="inventory-lifecycle-field"
      data-field-id={id}
      className={cn("grid gap-1.5", className)}
    >
      <Label htmlFor={id} className="text-xs">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </Label>
      {children}
      {hint ? (
        <p id={hintId} className="text-[11px] leading-4 text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-status-danger-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type InventoryLifecycleValidationSummaryProps = {
  id?: string;
  issues?: readonly InventoryLifecycleValidationIssue[];
  serverError?: string;
  /**
   * Explicit submit-attempt token for repeated invalid submissions. Callers
   * increment it when the same validation result is shown again so the
   * summary receives a fresh focus request without relying on DOM guesses or
   * timers.
   */
  focusRequestKey?: string | number;
  onFocusField?: (fieldId: string) => void;
  className?: string;
};

/**
 * Focusable, keyboard-reachable validation summary used when a submit attempt
 * fails. Field links call an explicit caller-supplied focus function rather
 * than cloning or guessing a child control.
 */
export function InventoryLifecycleValidationSummary({
  id,
  issues = [],
  serverError,
  focusRequestKey,
  onFocusField,
  className,
}: InventoryLifecycleValidationSummaryProps) {
  const { t } = useLocale();
  const summaryRef = React.useRef<HTMLElement>(null);
  const generatedId = React.useId();
  const issueKey = issues.map((issue) => `${issue.fieldId}:${issue.message}`).join("|");
  const hasContent = issues.length > 0 || Boolean(serverError);

  React.useEffect(() => {
    if (hasContent) summaryRef.current?.focus({ preventScroll: true });
  }, [hasContent, issueKey, serverError, focusRequestKey]);

  if (!hasContent) return null;

  return (
    <section
      ref={summaryRef}
      id={id ?? `inventory-lifecycle-validation-summary-${generatedId}`}
      data-ui="inventory-lifecycle-validation-summary"
      tabIndex={-1}
      role="alert"
      aria-live="assertive"
      className={cn(
        "grid min-w-0 gap-2 rounded-lg border border-status-danger/40 bg-status-danger/10 p-3 text-sm text-status-danger-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <p className="font-semibold">{t("inventory2b4.validation.summary")}</p>
      {serverError ? <p className="text-xs leading-5">{serverError}</p> : null}
      {issues.length > 0 ? (
        <ul className="grid min-w-0 gap-1">
          {issues.map((issue) => (
            <li key={`${issue.fieldId}:${issue.message}`} className="min-w-0">
              {onFocusField ? (
                <button
                  type="button"
                  className="min-h-11 w-full rounded-md px-2 text-left text-xs underline decoration-current/50 underline-offset-2 hover:bg-status-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onFocusField(issue.fieldId)}
                >
                  {issue.label}：{issue.message}
                </button>
              ) : (
                <span className="block px-2 text-xs">
                  {issue.label}：{issue.message}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function inventoryLifecycleFieldFeedbackIds(id: string) {
  return { hintId: `${id}-hint`, errorId: `${id}-error` };
}
