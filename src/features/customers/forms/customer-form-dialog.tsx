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

const customerChannelOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
] as const;

const customerLanguageOptions = [
  { value: "it", label: "Italiano" },
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
] as const;

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
    if (nextOpen || !dirty || busy || window.confirm("放弃尚未保存的客户资料？")) {
      onOpenChange(nextOpen);
    }
  };

  const save = async (intent: CustomerCreateIntent) => {
    if (!canSave) return;
    setSaveError(undefined);
    try {
      await onSave(form, intent);
    } catch {
      setSaveError("客户暂时没有保存成功。资料已保留，请核对网络或重复客户后重试。");
    }
  };

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogContent
        className={cn(
          componentOverlay.formContent,
          "flex max-h-[calc(100svh-16px)] flex-col gap-0 overflow-hidden p-0",
        )}
      >
        <DialogHeader className="shrink-0 space-y-1.5 border-b border-border/60 px-3 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-5">
          <DialogTitle className={componentOverlay.title}>{title}</DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            先核对客户身份，再补充非必填资料。创建后可直接进入客户档案或新建维修工单。
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
                  <h3 className="text-sm font-semibold">身份确认</h3>
                  <p className="text-[11px] leading-4 text-muted-foreground">
                    手机号用于核对同店客户，避免重复建档。
                  </p>
                </div>
              </div>
              <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
                <CustomerFormField label="手机号" required htmlFor="customer-create-phone">
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
                <CustomerFormField label="姓名" required htmlFor="customer-create-name">
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
              <h3 className="text-xs font-semibold">联系授权</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2.5 text-sm">
                  <Checkbox
                    checked={form.consent_marketing ?? false}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, consent_marketing: Boolean(checked) })
                    }
                  />
                  允许主动联系
                </label>
                <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2.5 text-sm">
                  <Checkbox
                    checked={form.consent_sms ?? false}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, consent_sms: Boolean(checked) })
                    }
                  />
                  允许短信通知
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
                      补充资料{optionalFieldCount ? ` · 已填 ${optionalFieldCount} 项` : ""}
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
                      <CustomerFormField label="备用联系电话">
                        <CustomerBackupPhonesField
                          primaryPhone={form.phone_e164}
                          phones={form.contact_phones ?? []}
                          onPrimaryPhoneChange={(phone_e164) => setForm({ ...form, phone_e164 })}
                          onPhonesChange={(contact_phones) => setForm({ ...form, contact_phones })}
                        />
                      </CustomerFormField>
                    </div>
                    <CustomerFormField label="邮箱" htmlFor="customer-create-email">
                      <Input
                        id="customer-create-email"
                        type="email"
                        autoComplete="email"
                        className={compactInputClass}
                        value={form.email ?? ""}
                        onChange={(event) => setForm({ ...form, email: event.target.value })}
                      />
                    </CustomerFormField>
                    <CustomerFormField label="首选通道">
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
                    <CustomerFormField label="语言">
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
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CustomerFormField>
                    <div className="sm:col-span-2">
                      <CustomerFormField label="客户备注" htmlFor="customer-create-notes">
                        <Textarea
                          id="customer-create-notes"
                          className={compactTextareaClass}
                          value={form.notes ?? ""}
                          onChange={(event) => setForm({ ...form, notes: event.target.value })}
                        />
                      </CustomerFormField>
                    </div>
                    <div className="sm:col-span-2">
                      <CustomerFormField label="联系备注" htmlFor="customer-create-marketing-notes">
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
              仅保存并查看客户
            </Button>
            <Button type="submit" className="h-11 lg:h-9" disabled={!canSave}>
              {busy ? "正在创建…" : "保存并新建工单"}
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
  if (!storeReady) {
    return (
      <p id={id} className="mt-2 text-[11px] leading-4 text-muted-foreground">
        选择可用门店后才能核对并创建客户。
      </p>
    );
  }
  if (!phoneReady) {
    return (
      <p id={id} className="mt-2 text-[11px] leading-4 text-muted-foreground">
        输入完整手机号后自动核对同店客户。
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
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> 正在核对客户身份…
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
        <span className="min-w-0 flex-1">身份核对失败，当前不能把它当作新客户。</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 px-2 text-xs lg:h-9"
          onClick={onRetry}
        >
          重试
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
            <p className="text-xs font-semibold">这个手机号已经关联客户</p>
            <p className="text-[10px] leading-4 opacity-80">
              请复用已有档案，避免同一客户产生分散记录。
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
        未发现相同手机号，可以继续创建。
      </div>
      {candidates.length ? (
        <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-2 text-[10px] text-muted-foreground">
          <Search className="size-3.5 shrink-0" aria-hidden="true" />
          同名或相似资料 {candidates.length} 条；不会自动合并，请需要时先核对客户列表。
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
  return (
    <div className="rounded-lg border border-current/15 bg-background/70 p-2 text-foreground">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{candidate.customer.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {maskPhone(candidate.customer.phone_e164)} · {candidate.historyDevices.length}{" "}
            台历史设备
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
          打开客户
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-11 text-xs lg:h-10"
          onClick={() => onStartOrderForExisting(candidate.customer.id)}
        >
          用此客户开单
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
