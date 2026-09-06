"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
} from "react";
import { Check, Delete, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VirtualKeyboardDock } from "@/components/ui/virtual-keyboard-dock";
import { useKeypadControlGuard } from "@/hooks/use-keypad-control-guard";
import { useVirtualKeyboardSurface } from "@/hooks/use-virtual-keyboard-surface";
import { useLocale } from "@/shared/i18n/locale-provider";
import { cn } from "@/lib/utils";

export type NumericKeypadInputProps = ComponentProps<typeof Input> & {
  decimalPlaces?: number;
};

// Keep a real successful/validated form control. Hidden-type and readonly proxies
// cannot preserve required/range/step validity for uncontrolled FormData forms.
export const NumericKeypadInput = forwardRef<HTMLInputElement, NumericKeypadInputProps>(
  (
    {
      decimalPlaces,
      className,
      value,
      defaultValue,
      onChange,
      onFocus,
      onBlur,
      onInvalid,
      onKeyDown,
      type = "number",
      ...props
    },
    ref,
  ) => {
    const { t } = useLocale();
    const surface = useVirtualKeyboardSurface();
    const virtual = surface === "virtual" && !props.readOnly;
    const inputRef = useRef<HTMLInputElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const redirectingFocus = useRef(false);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(expandNumericDraft(String(value ?? defaultValue ?? "")));
    const [uncontrolled, setUncontrolled] = useState(String(defaultValue ?? ""));
    const current = expandNumericDraft(value === undefined ? uncontrolled : String(value));
    const precision = decimalPlaces ?? decimalPlacesForStep(props.step, props.inputMode);
    const allowNegative = props.min === undefined || Number(props.min) < 0;
    const label =
      props["aria-label"] ??
      triggerRef.current?.labels?.[0]?.textContent?.trim() ??
      props.placeholder ??
      t("orders2b2.finance.amount");

    useEffect(() => {
      if (surface === "native") setOpen(false);
    }, [surface]);
    useEffect(() => {
      const form = inputRef.current?.form;
      const reset = () =>
        queueMicrotask(() => {
          const next = expandNumericDraft(inputRef.current?.value ?? "");
          setUncontrolled(next);
          setDraft(next);
          setOpen(false);
        });
      form?.addEventListener("reset", reset);
      return () => form?.removeEventListener("reset", reset);
    }, []);

    const canEdit = useKeypadControlGuard({
      controlRef: inputRef,
      open,
      disabled: props.disabled,
      readOnly: props.readOnly,
      onClose: () => setOpen(false),
    });
    const changeOpen = (next: boolean) => {
      if (next && !canEdit()) return;
      setOpen(next);
      if (next) setDraft(current);
    };
    const applyKey = (key: string) => {
      if (!canEdit()) return;
      const editingDraft = open ? draft : expandNumericDraft(inputRef.current?.value ?? current);
      let next = editingDraft;
      if (key === "clear") next = "";
      else if (key === "backspace") next = editingDraft.slice(0, -1);
      else if (key === "-")
        next = editingDraft.startsWith("-") ? editingDraft.slice(1) : `-${editingDraft}`;
      else if (key === ".") {
        if (!precision || editingDraft.includes(".")) return;
        next = `${editingDraft || "0"}.`;
      } else {
        if (editingDraft.includes(".") && editingDraft.split(".")[1].length >= precision) return;
        next = `${editingDraft}${key}`;
        if (next.includes(".")) {
          const [integer, decimals] = next.split(".");
          next = `${integer}.${decimals.slice(0, precision)}`;
        }
      }
      if (
        type !== "number" &&
        props.maxLength !== undefined &&
        props.maxLength >= 0 &&
        next.length > props.maxLength
      )
        return;
      setDraft(next);
      const input = inputRef.current;
      if (!input) return;
      const formValue =
        type === "number" && next && Number.isFinite(Number(next)) ? String(Number(next)) : next;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        input,
        formValue,
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const physicalKey = (event: KeyboardEvent<HTMLButtonElement>) => {
      if (onKeyDown && inputRef.current) {
        const forwarded = new globalThis.KeyboardEvent("keydown", {
          key: event.key,
          code: event.code,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          metaKey: event.metaKey,
          bubbles: true,
          cancelable: true,
        });
        inputRef.current.dispatchEvent(forwarded);
        event.stopPropagation();
        if (forwarded.defaultPrevented) {
          event.preventDefault();
          return;
        }
      }
      if (!canEdit() || event.ctrlKey || event.altKey || event.metaKey) return;
      if (
        /^\d$/.test(event.key) ||
        ((event.key === "." || event.key === ",") && precision > 0) ||
        (event.key === "-" && allowNegative)
      ) {
        event.preventDefault();
        applyKey(event.key === "," ? "." : event.key);
        setOpen(true);
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        applyKey(event.key === "Backspace" ? "backspace" : "clear");
        setOpen(true);
      }
    };
    return (
      <>
        <Input
          {...props}
          id={virtual ? undefined : props.id}
          type={type}
          value={value}
          defaultValue={defaultValue}
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          className={virtual ? "sr-only pointer-events-none" : className}
          tabIndex={virtual ? -1 : props.tabIndex}
          aria-hidden={virtual || undefined}
          aria-label={virtual ? undefined : props["aria-label"]}
          aria-labelledby={virtual ? undefined : props["aria-labelledby"]}
          inputMode={virtual ? "none" : props.inputMode}
          data-numeric-form-control={virtual ? "virtual" : "native"}
          onFocus={(event) => {
            onFocus?.(event);
            if (virtual && document.activeElement === inputRef.current) {
              redirectingFocus.current = true;
              triggerRef.current?.focus({ preventScroll: true });
              redirectingFocus.current = false;
            }
          }}
          onBlur={(event) => {
            if (!redirectingFocus.current) onBlur?.(event);
          }}
          onKeyDown={onKeyDown}
          onChange={(event) => {
            setUncontrolled(event.target.value);
            onChange?.(event);
          }}
          onInvalid={(event) => {
            onInvalid?.(event);
            if (virtual) {
              event.preventDefault();
              triggerRef.current?.focus();
            }
          }}
        />
        {virtual ? (
          <>
            <button
              type="button"
              id={props.id}
              ref={triggerRef}
              disabled={props.disabled}
              aria-label={props["aria-label"]}
              aria-labelledby={props["aria-labelledby"]}
              aria-describedby={props["aria-describedby"]}
              aria-invalid={props["aria-invalid"]}
              aria-expanded={open}
              data-numeric-keypad-trigger="true"
              data-keypad-active={open || undefined}
              className={cn(
                "data-[keypad-active=true]:border-primary data-[keypad-active=true]:bg-primary/5 data-[keypad-active=true]:ring-1 data-[keypad-active=true]:ring-primary/25",
                "flex h-9 w-full min-w-0 items-center rounded-md border border-input bg-transparent px-3 py-1 text-left text-base font-mono tabular-nums shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                className,
              )}
              onFocus={(event) => {
                if (!redirectingFocus.current)
                  inputRef.current?.dispatchEvent(
                    new FocusEvent("focusin", {
                      bubbles: true,
                      relatedTarget: event.relatedTarget,
                    }),
                  );
              }}
              onBlur={(event) => {
                inputRef.current?.dispatchEvent(
                  new FocusEvent("focusout", { bubbles: true, relatedTarget: event.relatedTarget }),
                );
              }}
              onClick={() => changeOpen(!open)}
              onKeyDown={physicalKey}
            >
              <span
                className={cn("min-w-0 truncate", !current && !open && "text-muted-foreground")}
              >
                {(open ? draft : current) || props.placeholder || "0"}
              </span>
            </button>
            <VirtualKeyboardDock
              open={open}
              onOpenChange={changeOpen}
              label={label}
              triggerRef={triggerRef}
            >
              <div data-numeric-keypad="true">
                <div className="mb-2 flex min-w-0 items-center gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {label}
                  </span>
                  <span className="min-w-0 truncate text-right font-mono text-sm font-semibold tabular-nums">
                    {draft || "0"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    "1",
                    "2",
                    "3",
                    "4",
                    "5",
                    "6",
                    "7",
                    "8",
                    "9",
                    ".",
                    "0",
                    "backspace",
                    "clear",
                    allowNegative ? "-" : "00",
                  ].map((key) => (
                    <Button
                      key={key}
                      type="button"
                      variant="outline"
                      className="h-10 rounded-lg font-mono text-base"
                      disabled={key === "." && precision === 0}
                      aria-label={
                        key === "backspace"
                          ? t("orders2b1.keypad.deleteAmount")
                          : key === "clear"
                            ? t("orders2b1.keypad.clear")
                            : key
                      }
                      data-numeric-key={key}
                      onClick={() => applyKey(key)}
                    >
                      {key === "backspace" ? (
                        <Delete className="size-4" />
                      ) : key === "clear" ? (
                        <RotateCcw className="size-4" />
                      ) : (
                        key
                      )}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    className="h-10 rounded-lg text-xs"
                    onClick={() => changeOpen(false)}
                    data-numeric-keypad-done="true"
                  >
                    <Check className="mr-1 size-3.5" />
                    {t("orders2b1.keypad.done")}
                  </Button>
                </div>
              </div>
            </VirtualKeyboardDock>
          </>
        ) : null}
      </>
    );
  },
);
NumericKeypadInput.displayName = "NumericKeypadInput";

function decimalPlacesForStep(
  step: NumericKeypadInputProps["step"],
  mode: NumericKeypadInputProps["inputMode"],
) {
  if (step === "any") return 10;
  if (step === undefined) return mode === "decimal" ? 10 : 0;
  const text = String(step).toLowerCase();
  if (text.includes("e-")) return Math.min(10, Number(text.split("e-")[1]));
  return Math.min(10, text.split(".")[1]?.length ?? 0);
}

function expandNumericDraft(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/.exec(value);
  if (!match) return value;
  const exponent = Number(match[4]);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 308) return value;
  const digits = match[2] + (match[3] ?? "");
  const point = match[2].length + exponent;
  const decimal =
    point <= 0
      ? `0.${"0".repeat(-point)}${digits}`
      : point >= digits.length
        ? `${digits}${"0".repeat(point - digits.length)}`
        : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return match[1] + decimal;
}
