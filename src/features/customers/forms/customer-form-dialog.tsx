"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  Search,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { customersKeys } from "@/features/customers/api/query-keys";
import { CustomerBackupPhonesField } from "@/features/customers/forms/customer-backup-phones-field";
import { CustomerFormField } from "@/features/customers/forms/customer-form-field";
import { componentOverlay } from "@/lib/component-patterns";
import {
  searchCustomerIntakeCandidates,
  type CustomerCreateInput,
  type CustomerIntakeCandidate,
} from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { primaryPhoneRaw } from "@/shared/lib/phone";
import { useLocale } from "@/shared/i18n/locale-provider";

const customerChannelOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
] as const;

const customerLanguageOptions = [{ value: "it" }, { value: "zh" }, { value: "en" }] as const;

const compactInputClass = "h-11 text-base lg:h-9 lg:text-sm";
const compactTextareaClass = "min-h-20 text-base lg:text-sm";
const CUSTOMER_IDENTITY_DEBOUNCE_MS = 320;

export type CustomerCreateIntent = "view_customer" | "new_order";

export function CustomerFormDialog({
  open,
  onOpenChange,
  title,
  initial,
  busy,
  activeStoreId,
  onSave,
  onOpenExisting,
  onStartOrderForExisting,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  initial: CustomerCreateInput;
  busy: boolean;
  activeStoreId?: string;
  onSave: (input: CustomerCreateInput, intent: CustomerCreateIntent) => Promise<unknown>;
  onOpenExisting: (customerId: string) => void;
  onStartOrderForExisting: (customerId: string) => void;
}) {
  const { t } = useLocale();
  const [form, setForm] = useState(initial);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const debouncedPhone = useDebouncedValue(form.phone_e164, CUSTOMER_IDENTITY_DEBOUNCE_MS);
  const debouncedName = useDebouncedValue(form.name, CUSTOMER_IDENTITY_DEBOUNCE_MS);
  const phoneRaw = primaryPhoneRaw(debouncedPhone);
  const currentPhoneRaw = primaryPhoneRaw(form.phone_e164);
  const phoneReady = phoneRaw.length >= 6;
  const identityInputCurrent = currentPhoneRaw === phoneRaw;
  const identityInput = useMemo(
    () => ({
      phone: debouncedPhone.trim(),
      name: debouncedName.trim(),
      phoneMatchMode: "exact" as const,
      limit: 6,
      deviceLimit: 3,
    }),
    [debouncedName, debouncedPhone],
  );
  const identityQuery = useQuery({
    queryKey: customersKeys.intakeSearch(identityInput, activeStoreId),
    queryFn: () => searchCustomerIntakeCandidates(identityInput),
    enabled: open && Boolean(activeStoreId) && phoneReady,
    staleTime: 30_000,
    retry: false,
  });
  const candidates = identityQuery.data ?? [];
  const exactCandidates = candidates.filter(isExactPhoneCandidate);

  useEffect(() => {
    if (!open) return;
    setForm(initial);
    setDetailsOpen(false);
    setSaveError(undefined);
  }, [initial, open]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const identityVerified =
    phoneReady && identityInputCurrent && identityQuery.isSuccess && exactCandidates.length === 0;
  const canSave = Boolean(form.name.trim()) && identityVerified && !busy;
  const optionalFieldCount = [
    ...(form.contact_phones ?? []),
    form.email,
    form.notes,
    form.marketing_notes,
  ].filter((value) => value?.trim()).length;

  const requestOpenChange = (nextOpen: boolean) => {
    if (nextOpen || !dirty || busy || window.confirm(t("customers.create.discardConfirm"))) {
      onOpenChange(nextOpen);
    }
  };

  const save = async (intent: CustomerCreateIntent) => {
    if (!canSave) return;
    setSaveError(undefined);
    try {
      await onSave(form, intent);
    } catch {
      setSaveError(t("customers.create.saveError"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogContent
        closeLabel={t("customers.detail.close")}
        className={cn(
          componentOverlay.formContent,
          "flex max-h-[calc(100svh-16px)] flex-col gap-0 overflow-hidden p-0",
        )}
      >
        <DialogHeader className="shrink-0 space-y-1.5 border-b border-border/60 px-3 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-5">
          <DialogTitle className={componentOverlay.title}>{title}</DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            {t("customers.create.description")}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void save("new_order");
          }}
        >
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
            {saveError ? (
              <div
                role="alert"
                className="rounded-xl border border-status-danger-foreground/25 bg-status-danger/10 px-3 py-2 text-xs leading-5 text-status-danger-foreground"
              >
                {saveError}
              </div>
            ) : null}

            <section className="min-w-0 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-status-info/12 text-status-info-foreground">
                  <UserRound className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{t("customers.create.identity")}</h3>
                  <p className="text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
                    {t("customers.create.identityDescription")}
                  </p>
                </div>
              </div>
              <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
                <CustomerFormField
                  label={t("customers.form.phone")}
                  required
                  htmlFor="customer-create-phone"
                >
                  <Input
                    id="customer-create-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.phone_e164}
                    onChange={(event) => {
                      setForm({ ...form, phone_e164: event.target.value });
                      setSaveError(undefined);
                    }}
                    className={`${compactInputClass} font-mono`}
                    aria-describedby="customer-create-identity-status"
                  />
                </CustomerFormField>
                <CustomerFormField
                  label={t("customers.form.name")}
                  required
                  htmlFor="customer-create-name"
                >
                  <Input
                    id="customer-create-name"
                    autoComplete="name"
                    className={compactInputClass}
                    value={form.name}
                    onChange={(event) => {
                      setForm({ ...form, name: event.target.value });
                      setSaveError(undefined);
                    }}
                  />
                </CustomerFormField>
              </div>
              <CustomerIdentityStatus
                id="customer-create-identity-status"
                storeReady={Boolean(activeStoreId)}
                phoneReady={phoneReady}
                inputCurrent={identityInputCurrent}
                loading={identityQuery.isFetching}
                error={identityQuery.isError}
                candidates={candidates}
                exactCandidates={exactCandidates}
                onRetry={() => void identityQuery.refetch()}
                onOpenExisting={onOpenExisting}
                onStartOrderForExisting={onStartOrderForExisting}
              />
            </section>

            <section className="rounded-xl border border-border/70 bg-card p-3">
              <h3 className="text-xs font-semibold">
                {t("customers.create.contactAuthorization")}
              </h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2.5 text-sm">
                  <Checkbox
                    checked={form.consent_marketing ?? false}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, consent_marketing: Boolean(checked) })
                    }
                  />
                  {t("customers.form.allowContact")}
                </label>
                <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2.5 text-sm">
                  <Checkbox
                    checked={form.consent_sms ?? false}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, consent_sms: Boolean(checked) })
                    }
                  />
                  {t("customers.form.allowSms")}
                </label>
              </div>
            </section>

            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <section className="rounded-xl border border-border/70 bg-card">
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full justify-between rounded-xl px-3 text-sm"
                  >
                    <span>
                      {optionalFieldCount
                        ? t("customers.create.optionalFilled", { count: optionalFieldCount })
                        : t("customers.create.optional")}
                    </span>
                    <ChevronDown
                      className={cn("size-4 transition-transform", detailsOpen && "rotate-180")}
                      aria-hidden="true"
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid min-w-0 gap-2.5 border-t border-border/60 p-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <CustomerFormField label={t("customers.form.backupPhones")}>
                        <CustomerBackupPhonesField
                          primaryPhone={form.phone_e164}
                          phones={form.contact_phones ?? []}
                          onPrimaryPhoneChange={(phone_e164) => setForm({ ...form, phone_e164 })}
                          onPhonesChange={(contact_phones) => setForm({ ...form, contact_phones })}
                        />
                      </CustomerFormField>
                    </div>
                    <CustomerFormField
                      label={t("customers.form.email")}
                      htmlFor="customer-create-email"
                    >
                      <Input
                        id="customer-create-email"
                        type="email"
                        autoComplete="email"
                        className={compactInputClass}
                        value={form.email ?? ""}
                        onChange={(event) => setForm({ ...form, email: event.target.value })}
                      />
                    </CustomerFormField>
                    <CustomerFormField label={t("customers.form.preferredChannel")}>
                      <Select
                        value={form.preferred_channel ?? "whatsapp"}
                        onValueChange={(preferred_channel) =>
                          setForm({
                            ...form,
                            preferred_channel: preferred_channel as "whatsapp" | "sms",
                          })
                        }
                      >
                        <SelectTrigger className={compactInputClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {customerChannelOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CustomerFormField>
                    <CustomerFormField label={t("customers.detail.language")}>
                      <Select
                        value={form.language ?? "it"}
                        onValueChange={(language) =>
                          setForm({ ...form, language: language as "it" | "zh" | "en" })
                        }
                      >
                        <SelectTrigger className={compactInputClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {customerLanguageOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.value === "zh"
                                ? t("customers.language.zh")
                                : option.value === "en"
                                  ? t("customers.language.en")
                                  : t("customers.language.it")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CustomerFormField>
                    <div className="sm:col-span-2">
                      <CustomerFormField
                        label={t("customers.form.customerNotes")}
                        htmlFor="customer-create-notes"
                      >
                        <Textarea
                          id="customer-create-notes"
                          className={compactTextareaClass}
                          value={form.notes ?? ""}
                          onChange={(event) => setForm({ ...form, notes: event.target.value })}
                        />
                      </CustomerFormField>
                    </div>
                    <div className="sm:col-span-2">
                      <CustomerFormField
                        label={t("customers.form.contactNotes")}
                        htmlFor="customer-create-marketing-notes"
                      >
                        <Textarea
                          id="customer-create-marketing-notes"
                          className={compactTextareaClass}
                          value={form.marketing_notes ?? ""}
                          onChange={(event) =>
                            setForm({ ...form, marketing_notes: event.target.value })
                          }
                        />
                      </CustomerFormField>
                    </div>
                  </div>
                </CollapsibleContent>
              </section>
            </Collapsible>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/70 bg-background/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur sm:flex-row sm:px-5 sm:pb-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 lg:h-9"
              disabled={!canSave}
              onClick={() => void save("view_customer")}
            >
              {t("customers.create.saveView")}
            </Button>
            <Button type="submit" className="h-11 lg:h-9" disabled={!canSave}>
              {busy ? t("customers.create.savingOrder") : t("customers.create.saveOrder")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CustomerIdentityStatus({
  id,
  storeReady,
  phoneReady,
  inputCurrent,
  loading,
  error,
  candidates,
  exactCandidates,
  onRetry,
  onOpenExisting,
  onStartOrderForExisting,
}: {
  id: string;
  storeReady: boolean;
  phoneReady: boolean;
  inputCurrent: boolean;
  loading: boolean;
  error: boolean;
  candidates: CustomerIntakeCandidate[];
  exactCandidates: CustomerIntakeCandidate[];
  onRetry: () => void;
  onOpenExisting: (customerId: string) => void;
  onStartOrderForExisting: (customerId: string) => void;
}) {
  const { t } = useLocale();
  if (!storeReady) {
    return (
      <p
        id={id}
        className="mt-2 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4"
      >
        {t("customers.create.storeRequired")}
      </p>
    );
  }
  if (!phoneReady) {
    return (
      <p
        id={id}
        className="mt-2 text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4"
      >
        {t("customers.create.phoneRequired")}
      </p>
    );
  }
  if (!inputCurrent || loading) {
    return (
      <div
        id={id}
        role="status"
        aria-live="polite"
        className="mt-2 flex items-center gap-2 text-xs text-status-info-foreground"
      >
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />{" "}
        {t("customers.create.checking")}
      </div>
    );
  }
  if (error) {
    return (
      <div
        id={id}
        role="alert"
        className="mt-2 flex min-h-11 items-center gap-2 rounded-lg border border-status-danger-foreground/25 bg-status-danger/10 px-2.5 text-xs text-status-danger-foreground"
      >
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{t("customers.create.checkFailed")}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 px-2 text-xs lg:h-9"
          onClick={onRetry}
        >
          {t("customers.detail.retry")}
        </Button>
      </div>
    );
  }
  if (exactCandidates.length) {
    return (
      <div
        id={id}
        role="alert"
        className="mt-2 space-y-2 rounded-xl border border-status-warn-foreground/30 bg-status-warn/10 p-2.5 text-status-warn-foreground"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-semibold">{t("customers.create.duplicateTitle")}</p>
            <p className="text-[10px] leading-4 opacity-80 lg:text-xs lg:leading-4 lg:opacity-100">
              {t("customers.create.duplicateDescription")}
            </p>
          </div>
        </div>
        {exactCandidates.slice(0, 2).map((candidate) => (
          <CustomerCandidateRow
            key={candidate.customer.id}
            candidate={candidate}
            onOpenExisting={onOpenExisting}
            onStartOrderForExisting={onStartOrderForExisting}
          />
        ))}
      </div>
    );
  }
  return (
    <div id={id} role="status" aria-live="polite" className="mt-2">
      <div className="flex min-h-9 items-center gap-2 rounded-lg border border-status-success-foreground/20 bg-status-success/10 px-2.5 text-xs text-status-success-foreground">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
        {t("customers.create.noDuplicate")}
      </div>
      {candidates.length ? (
        <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-2 text-[10px] text-muted-foreground lg:text-xs lg:leading-4">
          <Search className="size-3.5 shrink-0" aria-hidden="true" />
          {t("customers.create.similar", { count: candidates.length })}
        </div>
      ) : null}
    </div>
  );
}

function CustomerCandidateRow({
  candidate,
  onOpenExisting,
  onStartOrderForExisting,
}: {
  candidate: CustomerIntakeCandidate;
  onOpenExisting: (customerId: string) => void;
  onStartOrderForExisting: (customerId: string) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="rounded-lg border border-current/15 bg-background/70 p-2 text-foreground">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{candidate.customer.name}</p>
          <p className="text-[10px] text-muted-foreground lg:text-xs lg:leading-4">
            {maskPhone(candidate.customer.phone_e164)} ·{" "}
            {t("customers.create.deviceHistoryCount", { count: candidate.historyDevices.length })}
          </p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 text-xs lg:h-10"
          onClick={() => onOpenExisting(candidate.customer.id)}
        >
          {t("customers.create.openCustomer")}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-11 text-xs lg:h-10"
          onClick={() => onStartOrderForExisting(candidate.customer.id)}
        >
          {t("customers.create.startOrder")}
        </Button>
      </div>
    </div>
  );
}

function isExactPhoneCandidate(candidate: CustomerIntakeCandidate) {
  return (
    candidate.exactMatch ||
    candidate.phoneMatchKind === "exact_primary" ||
    candidate.phoneMatchKind === "exact_alternate"
  );
}

function maskPhone(value: string) {
  const normalized = value.trim();
  if (normalized.length <= 6) return normalized;
  return `${normalized.slice(0, 4)}••••${normalized.slice(-3)}`;
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}
