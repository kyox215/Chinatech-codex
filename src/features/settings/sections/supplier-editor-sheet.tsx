"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { UnsavedSettingsGuard } from "@/features/settings/components/unsaved-settings-guard";
import {
  validateSupplierInput,
  type SupplierInputField,
} from "@/features/suppliers/model/supplier-input-contract";
import {
  DEFAULT_SUPPLIER_COLOR,
  SUPPLIER_COLOR_PALETTE,
} from "@/features/suppliers/model/supplier-color-palette";
import { cn } from "@/lib/utils";
import type { Supplier, SupplierInput } from "@/lib/repairdesk/types";

export interface SupplierEditorSheetProps {
  mode: "new" | "edit" | null;
  supplier?: Supplier;
  isSaving: boolean;
  errorMessage?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSave: (input: SupplierInput, id?: string) => Promise<void>;
}

export function SupplierEditorSheet({
  mode,
  supplier,
  isSaving,
  errorMessage,
  returnFocusRef,
  onOpenChange,
  onDirtyChange,
  onSave,
}: SupplierEditorSheetProps) {
  const initial = supplier ? supplierToInput(supplier) : defaultSupplierInput();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<SupplierInputField, string>>>({});
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const draftRef = useRef(initial);
  const baseRef = useRef(initial);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const next = supplier ? supplierToInput(supplier) : defaultSupplierInput();
    draftRef.current = next;
    baseRef.current = next;
    setDraft(next);
    setErrors({});
  }, [mode, supplier]);

  const dirty = Boolean(mode && isSupplierDraftDirty(draft, baseRef.current));
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  if (!mode) return null;

  const update = (patch: Partial<SupplierInput>) => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    setErrors((current) => {
      const copy = { ...current };
      for (const key of Object.keys(patch)) delete copy[key as SupplierInputField];
      return copy;
    });
  };
  const discard = () => {
    const next = baseRef.current;
    draftRef.current = next;
    setDraft(next);
    setErrors({});
    setDiscardConfirmOpen(false);
    onOpenChange(false);
  };
  const save = async () => {
    const result = validateSupplierInput(draftRef.current);
    if (!result.success) {
      setErrors(result.errors);
      requestAnimationFrame(() => focusFirstSupplierError(result.errors, firstInputRef));
      throw new Error("供应商资料校验失败");
    }
    await onSave(result.data, supplier?.id);
    draftRef.current = result.data;
    baseRef.current = result.data;
    onOpenChange(false);
  };

  return (
    <>
      <UnsavedSettingsGuard
        id="settings-supplier-editor"
        dirty={dirty}
        isDirty={() => isSupplierDraftDirty(draftRef.current, baseRef.current)}
        busy={isSaving}
        label={mode === "new" ? "新供应商资料" : `${supplier?.name ?? "供应商"}资料`}
        onSave={async () => {
          try {
            await save();
            return { status: "resolved" };
          } catch {
            return { status: "blocked", focus: () => firstInputRef.current?.focus() };
          }
        }}
        onDiscard={() => {
          discard();
          return { status: "resolved" };
        }}
        onFocusFallback={() => firstInputRef.current?.focus()}
      />
      <Sheet
        open
        onOpenChange={(open) => {
          if (open || isSaving) return;
          if (dirty) {
            setDiscardConfirmOpen(true);
            return;
          }
          onOpenChange(false);
        }}
      >
        <SheetContent
          side="right"
          className="flex h-full w-[calc(100vw-16px)] max-w-[calc(100vw-8px)] flex-col gap-0 p-0 sm:w-[min(38rem,calc(100vw-24px))]"
          aria-busy={isSaving}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => returnFocusRef?.current?.focus());
          }}
        >
          <SheetHeader className="border-b border-[var(--border-panel)] px-4 py-4 pr-14 text-left">
            <SheetTitle>
              {mode === "new" ? "添加供应商" : `编辑 ${supplier?.name ?? "供应商"}`}
            </SheetTitle>
            <SheetDescription>
              资料只属于当前店铺。归档和恢复不在这个编辑器中执行。
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SupplierField label="名称" field="name" errors={errors}>
                <Input
                  ref={firstInputRef}
                  id="supplier-name"
                  className="min-h-11 text-base sm:text-sm"
                  maxLength={120}
                  value={draft.name}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "supplier-name-error" : undefined}
                  onChange={(event) => update({ name: event.target.value })}
                />
              </SupplierField>
              <SupplierField label="简称" field="short_name" errors={errors}>
                <Input
                  id="supplier-short_name"
                  className="min-h-11 text-base sm:text-sm"
                  maxLength={32}
                  value={draft.short_name ?? ""}
                  aria-invalid={Boolean(errors.short_name)}
                  aria-describedby={errors.short_name ? "supplier-short_name-error" : undefined}
                  onChange={(event) => update({ short_name: event.target.value })}
                />
              </SupplierField>
              <SupplierField label="联系人" field="contact_name" errors={errors}>
                <Input
                  id="supplier-contact_name"
                  className="min-h-11 text-base sm:text-sm"
                  maxLength={120}
                  value={draft.contact_name ?? ""}
                  aria-invalid={Boolean(errors.contact_name)}
                  aria-describedby={errors.contact_name ? "supplier-contact_name-error" : undefined}
                  onChange={(event) => update({ contact_name: event.target.value })}
                />
              </SupplierField>
              <SupplierField label="电话" field="phone" errors={errors}>
                <Input
                  id="supplier-phone"
                  type="tel"
                  className="min-h-11 text-base sm:text-sm"
                  maxLength={40}
                  value={draft.phone ?? ""}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? "supplier-phone-error" : undefined}
                  onChange={(event) => update({ phone: event.target.value })}
                />
              </SupplierField>
              <SupplierField label="邮箱" field="email" errors={errors}>
                <Input
                  id="supplier-email"
                  type="email"
                  className="min-h-11 text-base sm:text-sm"
                  maxLength={254}
                  value={draft.email ?? ""}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "supplier-email-error" : undefined}
                  onChange={(event) => update({ email: event.target.value })}
                />
              </SupplierField>
              <SupplierField label="网站" field="website" errors={errors}>
                <Input
                  id="supplier-website"
                  type="url"
                  inputMode="url"
                  className="min-h-11 text-base sm:text-sm"
                  maxLength={500}
                  placeholder="https://example.com"
                  value={draft.website ?? ""}
                  aria-invalid={Boolean(errors.website)}
                  aria-describedby={errors.website ? "supplier-website-error" : undefined}
                  onChange={(event) => update({ website: event.target.value })}
                />
              </SupplierField>
            </div>

            <fieldset>
              <legend className="text-xs font-semibold">识别颜色</legend>
              <p className="mt-1 text-xs text-muted-foreground">
                使用受控语义色，颜色不是供应商状态。
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUPPLIER_COLOR_PALETTE.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={`选择${option.label}`}
                    aria-pressed={draft.color === option.value}
                    className={cn(
                      "grid size-11 place-items-center rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      draft.color === option.value
                        ? "border-primary ring-2 ring-primary/25"
                        : "border-border",
                    )}
                    onClick={() => update({ color: option.value })}
                  >
                    <span className={cn("size-5 rounded-full", option.swatchClass)} aria-hidden />
                  </button>
                ))}
              </div>
            </fieldset>

            <SupplierField label="内部备注" field="notes" errors={errors}>
              <Textarea
                id="supplier-notes"
                className="min-h-28 text-base sm:text-sm"
                maxLength={2000}
                value={draft.notes ?? ""}
                aria-invalid={Boolean(errors.notes)}
                aria-describedby={errors.notes ? "supplier-notes-error" : undefined}
                onChange={(event) => update({ notes: event.target.value })}
              />
            </SupplierField>

            {errorMessage ? (
              <div
                role="alert"
                className="rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-sm text-status-danger-foreground"
              >
                {errorMessage}
              </div>
            ) : null}
          </div>

          <SheetFooter className="border-t border-[var(--border-panel)] bg-card px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={isSaving}
              onClick={() => (dirty ? setDiscardConfirmOpen(true) : onOpenChange(false))}
            >
              取消
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={!dirty || isSaving}
              onClick={() => void save().catch(() => undefined)}
            >
              {isSaving ? "保存中…" : "保存供应商"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>放弃供应商草稿？</AlertDialogTitle>
            <AlertDialogDescription>未保存的联系资料、备注和颜色会被清除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">继续编辑</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={discard}>
              放弃修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SupplierField({
  label,
  field,
  errors,
  children,
}: {
  label: string;
  field: SupplierInputField;
  errors: Partial<Record<SupplierInputField, string>>;
  children: React.ReactNode;
}) {
  const error = errors[field];
  const id = `supplier-${field}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-status-danger-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function defaultSupplierInput(): SupplierInput {
  return {
    name: "",
    short_name: "",
    color: DEFAULT_SUPPLIER_COLOR,
    contact_name: "",
    phone: "",
    email: "",
    website: "",
    notes: "",
  };
}

function supplierToInput(supplier: Supplier): SupplierInput {
  return {
    name: supplier.name,
    short_name: supplier.short_name,
    color: supplier.color,
    contact_name: supplier.contact_name ?? "",
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
    website: supplier.website ?? "",
    notes: supplier.notes ?? "",
  };
}

function isSupplierDraftDirty(value: SupplierInput, base: SupplierInput) {
  return JSON.stringify(value) !== JSON.stringify(base);
}

function focusFirstSupplierError(
  errors: Partial<Record<SupplierInputField, string>>,
  fallback: RefObject<HTMLInputElement | null>,
) {
  const field = Object.keys(errors)[0];
  const control = field ? document.getElementById(`supplier-${field}`) : null;
  if (control instanceof HTMLElement) control.focus();
  else fallback.current?.focus();
}
