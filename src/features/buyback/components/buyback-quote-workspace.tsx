"use client";

import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Battery,
  Box,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  History,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { buildWhatsappUrl } from "@/shared/lib/whatsapp-phone";

import { MoneyText } from "@/components/orders/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import {
  buildBuybackQuoteCreateInput,
  buildBuybackAgreementSnapshot,
  buildBuybackQuoteDraftInput,
  buildBuybackQuoteDraftUpdateInput,
  buildBuybackQuoteReviewUpdateInput,
  buildBuybackQuoteUpdateInput,
  buildBuybackQualityCheckInput,
  buybackFunctionTestGroups,
  buybackFunctionTestItems,
  buybackBatteryBands,
  buildWhatsappQuoteMessage,
  buybackQuoteSteps,
  calculateBuybackQuote,
  defaultBuybackQuoteDraft,
  getBuybackBatteryBand,
  normalizeWhatsappPhone,
  validateBuybackIntake,
  type BuybackAttachmentKind,
  type BuybackInspectionStatus,
  type BuybackQuoteDraft,
} from "@/features/buyback/model/buyback-quote";
import {
  BUYBACK_AGREEMENT_LANGUAGE,
  BUYBACK_AGREEMENT_VERSION,
  BUYBACK_PRIVACY_NOTICE_TEXT_IT,
  BUYBACK_PRIVACY_NOTICE_VERSION,
  BUYBACK_TERMS_TEXT_IT,
  canUseConfiguredBuybackLegalProfile,
  canonicalizeBuybackAgreement,
  documentNumberLast4,
  hashBuybackAgreementSnapshot,
  isSafeBuybackVerificationNote,
  requiredBuybackDocumentSides,
} from "@/features/buyback/model/buyback-agreement";
import {
  BUYBACK_EVIDENCE_UPLOAD_MAX_BYTES,
  BUYBACK_SENSITIVE_WORKFLOW_ENABLED,
} from "@/features/buyback/model/buyback-evidence-policy";
import { persistRecordOnlyBuybackQuote } from "@/features/buyback/model/buyback-record-save";
import {
  createInventoryIntake,
  finalizeBuybackPurchase,
  getInventoryItem,
  transitionInventoryItem,
  updateInventoryItem,
  uploadInventoryAttachment,
} from "@/lib/repairdesk/api";
import type { InventoryItemStatus, InventoryListItem } from "@/lib/repairdesk/types";
import { componentOverlay } from "@/lib/component-patterns";
import { brandGradientStyle, controls, repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import type { StoreOutputIdentity } from "@/entities/store/model/store-output-identity";
import {
  RepairOsBusinessCard,
  RepairOsInfoLine,
  RepairOsInfoTile,
  RepairOsSectionHeader,
  SignaturePad,
} from "@/shared/ui";
import {
  estimateAppleMarketPricing,
  getAppleIPhoneModels,
  getAppleIPhoneSeriesGroups,
  getAppleIPhoneStorageChoices,
  getAppleIPhoneStorageHint,
  type AppleIPhoneSeriesGroup,
} from "@/features/buyback/model/apple-price-guide";

interface BuybackQuoteWorkspaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDraft?: BuybackQuoteDraft | null;
  targetItem?: InventoryListItem | null;
  canCaptureEvidence?: boolean;
  canFinalize?: boolean;
  storeIdentity: StoreOutputIdentity;
}

type DraftKey = keyof BuybackQuoteDraft;
const buybackQuoteRecordSteps = [
  { key: "device", label: "设备" },
  { key: "quote", label: "报价" },
  { key: "inspection", label: "检测" },
  { key: "save", label: "保存" },
] as const;

type StepKey = (typeof buybackQuoteSteps)[number]["key"] | "save";
type AttachmentDraft = Partial<Record<BuybackAttachmentKind, File>>;
type UploadedEvidence = Partial<Record<BuybackAttachmentKind, string>>;

const quoteCardClass = cn(repairOs.mobileInfoCard, "space-y-2");

export function BuybackQuoteWorkspace({
  open,
  onOpenChange,
  initialDraft,
  targetItem,
  canCaptureEvidence: canCaptureEvidencePermission = false,
  canFinalize: canFinalizePermission = false,
  storeIdentity,
}: BuybackQuoteWorkspaceProps) {
  const queryClient = useQueryClient();
  const stepContentRef = useRef<HTMLDivElement>(null);
  const workingItemIdRef = useRef<string | null>(null);
  const expectedUpdatedAtRef = useRef<string | null>(null);
  const uploadedEvidenceRef = useRef<UploadedEvidence>({});
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<BuybackQuoteDraft>(defaultBuybackQuoteDraft);
  const [attachments, setAttachments] = useState<AttachmentDraft>({});
  const [signatureHash, setSignatureHash] = useState("");
  const [signatureBindingCanonical, setSignatureBindingCanonical] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [completion, setCompletion] = useState<{
    id: string;
    agreementId?: string;
    reviewOnly?: boolean;
  } | null>(null);
  const canUseBuybackLegalProfile = canUseConfiguredBuybackLegalProfile();
  const canCaptureEvidence = BUYBACK_SENSITIVE_WORKFLOW_ENABLED && canCaptureEvidencePermission;
  const hasFinalizePermission = BUYBACK_SENSITIVE_WORKFLOW_ENABLED && canFinalizePermission;
  const canFinalize = hasFinalizePermission && canUseBuybackLegalProfile;
  const activeSteps = BUYBACK_SENSITIVE_WORKFLOW_ENABLED
    ? buybackQuoteSteps
    : buybackQuoteRecordSteps;
  const result = useMemo(() => calculateBuybackQuote(draft), [draft]);
  const agreementSnapshot = useMemo(
    () => buildBuybackAgreementSnapshot(draft, result),
    [draft, result],
  );
  const agreementCanonical = useMemo(
    () => canonicalizeBuybackAgreement(agreementSnapshot),
    [agreementSnapshot],
  );
  const intakeValidation = useMemo(() => {
    const validation = validateBuybackIntake(draft, result);
    if (!BUYBACK_SENSITIVE_WORKFLOW_ENABLED || canUseBuybackLegalProfile) return validation;
    return {
      ...validation,
      canSave: false,
      hardBlockReasons: Array.from(
        new Set([...validation.hardBlockReasons, "当前店铺没有已批准的回收协议法务配置"]),
      ),
    };
  }, [draft, result, canUseBuybackLegalProfile]);
  const currentStep = activeSteps[stepIndex];
  const estimateGateMessage = getEstimateGateMessage(draft);
  const functionGateMessage = useMemo(
    () => getFunctionGateMessage(draft, result, BUYBACK_SENSITIVE_WORKFLOW_ENABLED),
    [draft, result],
  );
  const sellerGateMessage = canCaptureEvidence
    ? getSellerGateMessage(draft)
    : getSellerReviewGateMessage(draft);
  const phone = normalizeWhatsappPhone(draft.customer_phone);
  const footerHint = getCurrentFooterHint(
    currentStep.key,
    result,
    intakeValidation,
    estimateGateMessage,
    functionGateMessage,
    draft,
    canCaptureEvidence,
  );

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setDraft(
      initialDraft
        ? {
            ...initialDraft,
            customer_signature_status: "pending",
            signature_captured: false,
            device_photo_captured: false,
            id_front_captured: false,
            id_back_captured: false,
            invoice_photo_captured: false,
            box_photo_captured: false,
          }
        : defaultBuybackQuoteDraft,
    );
    setAttachments({});
    setSignatureHash("");
    setSignatureBindingCanonical("");
    setSaveError("");
    setCompletion(null);
    workingItemIdRef.current = targetItem?.id ?? null;
    expectedUpdatedAtRef.current = targetItem?.updated_at ?? null;
    uploadedEvidenceRef.current = {};
    idempotencyKeyRef.current = crypto.randomUUID();
  }, [initialDraft, open, targetItem?.id, targetItem?.updated_at]);

  useEffect(() => {
    const syncOnlineState = () => setIsOnline(window.navigator.onLine);
    syncOnlineState();
    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);
    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => stepContentRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, stepIndex]);

  useEffect(() => {
    if (!signatureBindingCanonical || signatureBindingCanonical === agreementCanonical) return;
    setAttachments((current) => {
      const next = { ...current };
      delete next.signature;
      return next;
    });
    delete uploadedEvidenceRef.current.signature;
    setDraft((current) => ({
      ...current,
      customer_signature_status: "pending",
      signature_captured: false,
    }));
    setSignatureHash("");
    setSignatureBindingCanonical("");
    setSaveError("成交资料已变化，请让客户重新签名");
  }, [agreementCanonical, signatureBindingCanonical]);

  function resetWorkspace() {
    setStepIndex(0);
    setDraft(defaultBuybackQuoteDraft);
    setAttachments({});
    setSignatureHash("");
    setSignatureBindingCanonical("");
    setSaveError("");
    setCompletion(null);
    workingItemIdRef.current = null;
    expectedUpdatedAtRef.current = null;
    uploadedEvidenceRef.current = {};
    idempotencyKeyRef.current = crypto.randomUUID();
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaveError("");
      if (!canUseBuybackLegalProfile) {
        throw new Error("当前店铺没有已批准的回收协议法务配置");
      }
      if (!hasFinalizePermission) {
        throw new Error("当前员工不能确认回收成交，请交由店主或店长处理");
      }
      const validation = intakeValidation;
      if (!validation.canSave) {
        throw new Error(
          [...validation.missing, ...validation.hardBlockReasons].slice(0, 3).join("、") ||
            "成交资料未完成",
        );
      }
      if (!signatureHash || !attachments.signature) {
        throw new Error("客户签名尚未绑定当前成交摘要");
      }
      const currentHash = await hashBuybackAgreementSnapshot(agreementSnapshot);
      if (currentHash !== signatureHash) throw new Error("成交资料已变化，请让客户重新签名");

      let id = workingItemIdRef.current;
      const mode = targetItem ? ("updated" as const) : ("created" as const);
      if (!id) {
        const created = await createInventoryIntake(buildBuybackQuoteCreateInput(draft, result));
        id = created.id;
        workingItemIdRef.current = id;
      }
      if (targetItem) {
        await updateInventoryItem(id, buildBuybackQuoteReviewUpdateInput(draft, result));
      }
      const currentDetail = await getInventoryItem(id);
      expectedUpdatedAtRef.current = currentDetail.item.updated_at;
      const evidence = await uploadBuybackAttachments(
        id,
        attachments,
        uploadedEvidenceRef.current,
        signatureHash,
      );
      uploadedEvidenceRef.current = evidence;
      const signatureAttachmentId = evidence.signature;
      if (!signatureAttachmentId) throw new Error("客户签名上传未完成");
      const requiredSides = requiredBuybackDocumentSides(draft.customer_document_type);
      if (!evidence.device_photo || requiredSides.some((kind) => !evidence[kind])) {
        throw new Error("设备或证件照片上传未完成");
      }

      const expectedUpdatedAt = expectedUpdatedAtRef.current;
      if (!expectedUpdatedAt) throw new Error("缺少回收记录版本，请关闭后重新打开");
      const finalized = await finalizeBuybackPurchase(id, {
        expected_updated_at: expectedUpdatedAt,
        idempotency_key: idempotencyKeyRef.current,
        item_patch: buildBuybackQuoteUpdateInput(draft, result),
        quality_check: buildBuybackQualityCheckInput(draft),
        agreement_snapshot: agreementSnapshot,
        agreement_hash: signatureHash,
        agreement_version: BUYBACK_AGREEMENT_VERSION,
        privacy_notice_version: BUYBACK_PRIVACY_NOTICE_VERSION,
        language: BUYBACK_AGREEMENT_LANGUAGE,
        document_type: draft.customer_document_type,
        document_no_last4: documentNumberLast4(draft.customer_document_no),
        signature_attachment_id: signatureAttachmentId,
        evidence_attachment_ids: Object.values(evidence).filter(Boolean) as string[],
        payment_method: draft.payment_method,
      });
      return { id, mode, agreementId: finalized.agreement_id };
    },
    onSuccess: async ({ id, mode, agreementId }) => {
      toast.success(mode === "updated" ? "回收成交单已更新并转入库存" : "回收成交已完成");
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      setCompletion({ id, agreementId, reviewOnly: false });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "保存报价失败";
      setSaveError(message);
      toast.error(message);
    },
  });

  const deferMutation = useMutation({
    mutationFn: async () => {
      if (targetItem) {
        const input = buildBuybackQuoteDraftUpdateInput(draft, result, "deferred");
        if (!BUYBACK_SENSITIVE_WORKFLOW_ENABLED) delete input.payment_method;
        await updateInventoryItem(targetItem.id, input);
        await advanceDeferredBuybackQuote(targetItem.id, targetItem.status, result);
        return { id: targetItem.id, mode: "updated" as const };
      }

      const input = buildBuybackQuoteDraftInput(draft, result, "deferred");
      if (!BUYBACK_SENSITIVE_WORKFLOW_ENABLED) delete input.payment_method;
      const { id } = await createInventoryIntake(input);
      await transitionInventoryItem(id, "offer_made", {
        reason: `客户考虑中，初步报价 €${result.finalOffer.toFixed(2)}`,
      });
      return { id, mode: "created" as const };
    },
    onSuccess: async ({ mode }) => {
      toast.success(
        mode === "updated" ? "已更新客户考虑中的回收报价" : "已保存为客户考虑中的回收报价",
      );
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      onOpenChange(false);
      resetWorkspace();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存考虑中报价失败"),
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (canCaptureEvidence) throw new Error("当前员工可以继续采集证件，无需提交交接");

      return persistRecordOnlyBuybackQuote({
        existingItemId: workingItemIdRef.current,
        create: async () => {
          const input = buildBuybackQuoteCreateInput(draft, result);
          delete input.repair_cost_amount;
          delete input.payment_method;
          return createInventoryIntake(input);
        },
        rememberItemId: (id) => {
          workingItemIdRef.current = id;
        },
        loadStatus: async (id) => (await getInventoryItem(id)).item.status,
        updateExisting: async (id) => {
          const patch = buildBuybackQuoteReviewUpdateInput(draft, result);
          delete patch.repair_cost_amount;
          delete patch.payment_method;
          await updateInventoryItem(id, patch);
        },
        transitionToOfferMade: (id) =>
          transitionInventoryItem(id, "offer_made", {
            reason: "报价与检测已保存，成交资料功能暂时关闭",
          }),
      });
    },
    onSuccess: async ({ id }) => {
      toast.success("报价与检测记录已保存");
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      setCompletion({ id, reviewOnly: true });
    },
    onError: (error) => {
      const detail = error instanceof Error ? error.message : "保存失败";
      const retryHint = workingItemIdRef.current
        ? "已创建的记录会继续保留；请保持本页打开并重试。"
        : "报价和检测结果仍保留在本页；请检查网络后重试。";
      const message = `${detail}。${retryHint}`;
      setSaveError(message);
      toast.error(message);
    },
  });

  function updateDraft<K extends DraftKey>(key: K, value: BuybackQuoteDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateAttachment(kind: BuybackAttachmentKind, file?: File) {
    delete uploadedEvidenceRef.current[kind];
    if (kind !== "signature" && signatureHash) {
      delete uploadedEvidenceRef.current.signature;
      setSignatureHash("");
      setSignatureBindingCanonical("");
      setDraft((current) => ({
        ...current,
        customer_signature_status: "pending",
        signature_captured: false,
      }));
      setAttachments((current) => {
        const next = { ...current };
        delete next.signature;
        return next;
      });
      setSaveError("凭证已变化，请让客户重新签名");
    }
    setAttachments((current) => {
      const next = { ...current };
      if (file) next[kind] = file;
      else delete next[kind];
      return next;
    });
    const capturedKey = attachmentCapturedKey(kind);
    if (capturedKey) {
      updateDraft(capturedKey, Boolean(file) as BuybackQuoteDraft[typeof capturedKey]);
    }
  }

  async function updateSignature(file?: File) {
    if (!file) {
      updateAttachment("signature", undefined);
      setSignatureHash("");
      setSignatureBindingCanonical("");
      updateDraft("customer_signature_status", "pending");
      return;
    }
    const hash = await hashBuybackAgreementSnapshot(agreementSnapshot);
    updateAttachment("signature", file);
    setSignatureHash(hash);
    setSignatureBindingCanonical(agreementCanonical);
    updateDraft("customer_signature_status", "signed");
    setSaveError("");
  }

  function openWhatsappQuote() {
    if (!storeIdentity.canOutput) {
      toast.error(storeIdentity.blockReason ?? "请先补齐当前店铺资料后再发送报价");
      return;
    }
    if (!phone) {
      toast.error("请先填写可用的客户 WhatsApp 电话");
      return;
    }
    const message = buildWhatsappQuoteMessage(draft, result, storeIdentity);
    const url = buildWhatsappUrl(draft.customer_phone, message);
    if (!url) {
      toast.error("请检查客户 WhatsApp 电话及国家区号");
      return;
    }
    window.open(url, "_blank", "noopener");
  }

  function rejectQuoteAndClose() {
    toast.info("客户未接受报价，本次未保存库存记录");
    onOpenChange(false);
    resetWorkspace();
  }

  if (completion) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            componentOverlay.bottomSheet,
            "left-1/2 right-auto h-[calc(100svh-0.5rem)] max-h-[calc(100svh-0.5rem)] w-[min(430px,calc(100vw-0.5rem))] -translate-x-1/2 rounded-t-xl p-0 md:bottom-4 md:h-auto md:max-h-[calc(100svh-2rem)] md:w-[min(720px,calc(100vw-2rem))] md:rounded-xl [&>button.absolute]:hidden",
          )}
        >
          <BuybackSuccess
            itemId={completion.id}
            amount={result.finalOffer}
            reviewOnly={completion.reviewOnly}
            onNew={() => resetWorkspace()}
            onInventory={() =>
              window.location.assign(completion.reviewOnly ? "/buyback" : "/inventory")
            }
            onClose={() => onOpenChange(false)}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          componentOverlay.bottomSheet,
          "left-1/2 right-auto h-[calc(100svh-0.5rem)] max-h-[calc(100svh-0.5rem)] w-[min(430px,calc(100vw-0.5rem))] -translate-x-1/2 rounded-t-xl p-0 md:bottom-4 md:h-[calc(100svh-2rem)] md:max-h-[calc(100svh-2rem)] md:w-[min(1120px,calc(100vw-2rem))] md:rounded-xl [&>button.absolute]:hidden",
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-[var(--surface-workspace)]">
          <SheetHeader className="w-full px-2 pb-1.5 pt-2 text-left md:px-3 md:pt-3">
            <section
              className={cn(
                "w-full min-w-0 overflow-hidden rounded-xl border border-[var(--border-panel)] bg-card/95 px-2.5 pb-2 pt-1.5 shadow-[var(--shadow-card)]",
              )}
            >
              <header className={repairOs.mobileFloatingHeaderNav}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0 rounded-lg"
                  onClick={() => onOpenChange(false)}
                  aria-label="关闭回收报价"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="min-w-0 text-center">
                  <SheetTitle className="truncate text-xs font-semibold leading-4">
                    {BUYBACK_SENSITIVE_WORKFLOW_ENABLED ? "引导式回收" : "回收报价"}
                  </SheetTitle>
                  <p className="truncate text-[9px] leading-3 text-muted-foreground">
                    {BUYBACK_SENSITIVE_WORKFLOW_ENABLED
                      ? `${currentStep.label} · ${stepSubtitle(currentStep.key, result, draft)}`
                      : `仅估价、确认与检测 · ${currentStep.label}`}
                  </p>
                  <SheetDescription className="sr-only">
                    {BUYBACK_SENSITIVE_WORKFLOW_ENABLED
                      ? "按设备信息、检测结果和风险规则生成回收报价。"
                      : "当前只能保存报价与检测。资料登记和回收成交暂时关闭，本流程不会要求证件号码、证件图片或客户签名。"}
                  </SheetDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11 shrink-0 gap-1 rounded-lg px-2 text-[11px]"
                  onClick={() =>
                    toast.info(
                      BUYBACK_SENSITIVE_WORKFLOW_ENABLED
                        ? "保存成交后，可在库存详情里查看历史记录和附件凭证"
                        : "保存后，可在回收列表查看报价与检测记录",
                    )
                  }
                >
                  <History className="size-3.5" />
                  历史
                </Button>
              </header>
              <div className={repairOs.mobileFloatingHeaderBody}>
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[12px] font-semibold leading-4 text-primary">
                      {[draft.brand, draft.model].filter(Boolean).join(" ") || "待填写设备"}
                    </p>
                    <p className="truncate text-[9px] leading-3 text-muted-foreground">
                      {stepHelper(currentStep.key, result, draft)}
                    </p>
                  </div>
                  {BUYBACK_SENSITIVE_WORKFLOW_ENABLED ? (
                    <Badge
                      variant={result.hardBlock ? "destructive" : "outline"}
                      className="scale-90 text-[10px]"
                    >
                      {stepBadgeLabel(currentStep.key, result)}
                    </Badge>
                  ) : (
                    <Badge className="border-0 bg-status-warn text-[10px] text-status-warn-foreground">
                      资料关闭
                    </Badge>
                  )}
                </div>
                <QuoteStepper activeIndex={stepIndex} steps={activeSteps} />
              </div>
            </section>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5 md:px-3">
            {!BUYBACK_SENSITIVE_WORKFLOW_ENABLED ? (
              <section
                className={cn(
                  repairOs.mobileInfoCard,
                  "mx-auto mb-2 flex w-full max-w-[430px] items-start gap-2 border-status-warn-foreground/20 bg-status-warn md:max-w-[1080px]",
                )}
                aria-label="当前流程范围"
              >
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-status-warn-foreground" />
                <div className="min-w-0">
                  <h2 className="text-xs font-semibold text-status-warn-foreground">
                    当前只能保存报价与检测
                  </h2>
                  <p className="mt-0.5 text-[11px] leading-4 text-status-warn-foreground/90">
                    资料登记和回收成交暂时关闭。本流程不会要求证件号码、证件图片或客户签名。
                  </p>
                </div>
              </section>
            ) : null}
            <div className="mx-auto grid w-full max-w-[430px] gap-2 md:max-w-[1080px] lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
              <div
                ref={stepContentRef}
                className="min-w-0 focus:outline-none"
                tabIndex={-1}
                aria-label={`当前步骤：${currentStep.label}`}
              >
                {currentStep.key === "device" ? (
                  <QuickEstimateStep draft={draft} result={result} updateDraft={updateDraft} />
                ) : null}
                {currentStep.key === "quote" ? (
                  <IntentStep
                    result={result}
                    onDefer={() => deferMutation.mutate()}
                    onReject={rejectQuoteAndClose}
                    isDeferring={deferMutation.isPending}
                  />
                ) : null}
                {currentStep.key === "inspection" ? (
                  <FunctionStep draft={draft} result={result} updateDraft={updateDraft} />
                ) : null}
                {currentStep.key === "seller" ? (
                  <SellerStep
                    draft={draft}
                    updateDraft={updateDraft}
                    collectEvidenceDetails={canCaptureEvidence}
                  />
                ) : null}
                {currentStep.key === "save" ? (
                  <QuoteRecordOnlyStep result={result} saveError={saveError} isOnline={isOnline} />
                ) : null}
                {currentStep.key === "evidence" ? (
                  <EvidenceStep
                    draft={draft}
                    result={result}
                    updateDraft={updateDraft}
                    attachments={attachments}
                    updateAttachment={updateAttachment}
                    validation={intakeValidation}
                    onSignature={updateSignature}
                    signatureResetKey={agreementCanonical}
                    canUseBuybackLegalProfile={canUseBuybackLegalProfile}
                  />
                ) : null}
                {currentStep.key === "confirm" ? (
                  <ConfirmStep
                    draft={draft}
                    result={result}
                    validation={intakeValidation}
                    saveError={saveError}
                    onWhatsapp={openWhatsappQuote}
                  />
                ) : null}
              </div>
              <QuoteWorkspaceSidebar
                draft={draft}
                result={result}
                validation={intakeValidation}
                currentStepLabel={currentStep.label}
                recordOnly={!BUYBACK_SENSITIVE_WORKFLOW_ENABLED}
              />
            </div>
          </div>

          <div className="border-t border-[var(--border-panel)] bg-card/95 px-2 py-1.5 pb-[calc(env(safe-area-inset-bottom)+0.4rem)] md:px-3">
            <div className="mx-auto flex w-full max-w-[430px] min-w-0 items-center justify-between gap-2 md:max-w-[1080px]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 shrink-0 rounded-lg px-2 text-xs"
                disabled={stepIndex === 0 || reviewMutation.isPending || saveMutation.isPending}
                onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft className="size-3.5" />
                上一步
              </Button>
              <div className="hidden line-clamp-2 min-w-0 text-center text-[10px] leading-3 text-muted-foreground sm:block">
                {footerHint}
              </div>
              {currentStep.key === "save" ? (
                <Button
                  type="button"
                  size="sm"
                  className={cn("h-11 shrink-0 rounded-lg px-3 text-xs", controls.brandButton)}
                  style={brandGradientStyle}
                  disabled={reviewMutation.isPending || !isOnline}
                  aria-busy={reviewMutation.isPending}
                  onClick={() => {
                    setSaveError("");
                    reviewMutation.mutate();
                  }}
                >
                  <FileText className="size-3.5" />
                  {reviewMutation.isPending
                    ? "正在保存记录…"
                    : result.hardBlock
                      ? "保存风险检测记录"
                      : "保存报价与检测记录"}
                </Button>
              ) : stepIndex < activeSteps.length - 1 ? (
                <Button
                  type="button"
                  size="sm"
                  className={cn("h-11 shrink-0 rounded-lg px-3 text-xs", controls.brandButton)}
                  style={brandGradientStyle}
                  disabled={
                    reviewMutation.isPending ||
                    (currentStep.key === "device" && Boolean(estimateGateMessage)) ||
                    (currentStep.key === "inspection" && Boolean(functionGateMessage)) ||
                    (currentStep.key === "seller" && Boolean(sellerGateMessage)) ||
                    (currentStep.key === "evidence" && Boolean(getEvidenceGateMessage(draft)))
                  }
                  onClick={() => {
                    if (currentStep.key === "quote") {
                      updateDraft("customer_intent_outcome", "accepted");
                      updateDraft("customer_intent_confirmed", true);
                    }
                    if (currentStep.key === "seller" && !canCaptureEvidence) {
                      reviewMutation.mutate();
                      return;
                    }
                    setStepIndex((current) => Math.min(activeSteps.length - 1, current + 1));
                  }}
                >
                  {reviewMutation.isPending && currentStep.key === "seller"
                    ? "正在提交…"
                    : nextButtonLabel(
                        currentStep.key,
                        draft,
                        canCaptureEvidence,
                        BUYBACK_SENSITIVE_WORKFLOW_ENABLED,
                      )}
                  <ChevronRight className="size-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className={cn("h-11 shrink-0 rounded-lg px-3 text-xs", controls.brandButton)}
                  style={brandGradientStyle}
                  disabled={
                    saveMutation.isPending ||
                    !canFinalize ||
                    !draft.model.trim() ||
                    !intakeValidation.canSave
                  }
                  onClick={() => saveMutation.mutate()}
                >
                  <ShieldCheck className="size-3.5" />
                  {saveMutation.isPending
                    ? "正在安全成交…"
                    : `完成回收并转入库存 · €${result.finalOffer.toFixed(0)}`}
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function QuoteStepper({
  activeIndex,
  steps,
}: {
  activeIndex: number;
  steps: readonly { key: StepKey; label: string }[];
}) {
  return (
    <div className="mt-1.5">
      <ol
        className={cn("grid gap-1", steps.length === 4 ? "grid-cols-4" : "grid-cols-6")}
        aria-label={`步骤 ${activeIndex + 1} / ${steps.length}`}
      >
        {steps.map((step, index) => {
          const active = index === activeIndex;
          const complete = index < activeIndex;
          return (
            <li
              key={step.key}
              className="relative min-w-0 text-center"
              aria-current={active ? "step" : undefined}
            >
              {index > 0 ? (
                <div className="absolute right-1/2 top-2.5 h-px w-full bg-primary/25" />
              ) : null}
              <span
                className={cn(
                  "relative z-10 mx-auto grid size-5 place-items-center rounded-full border text-[10px] font-semibold",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-action)]"
                    : complete
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-primary/40 bg-card text-primary",
                )}
              >
                {index + 1}
              </span>
              <p
                className={cn(
                  "mt-0.5 truncate text-[9px] leading-3",
                  active ? "font-medium text-primary" : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function stepSubtitle(
  step: StepKey,
  result: ReturnType<typeof calculateBuybackQuote>,
  draft: BuybackQuoteDraft,
) {
  if (step === "device") {
    const gate = getEstimateGateMessage(draft);
    return gate || `先估 €${result.suggestedLow}-${result.suggestedHigh}`;
  }
  if (step === "quote") return "向客户说明价格";
  if (step === "inspection") return "检测账号锁与功能";
  if (step === "save") return "保存报价与检测记录";
  if (step === "seller") return "只登记成交所需资料";
  if (step === "evidence") return "拍证件并现场签名";
  return "最后核对并安全成交";
}

function stepHelper(
  step: StepKey,
  result: ReturnType<typeof calculateBuybackQuote>,
  draft: BuybackQuoteDraft,
) {
  if (step === "device") return getEstimateGateMessage(draft) || "先选设备，系统自动计算";
  if (step === "quote") return `当前报价 €${result.finalOffer.toFixed(0)} · 等客户确认`;
  if (step === "inspection") return "客户已同意 · 按清单逐项检查";
  if (step === "save") return "只保存报价与检测 · 不完成成交";
  if (step === "seller") return "姓名、电话、证件类型和声明";
  if (step === "evidence") return "证件进入私有受限存储";
  return "成交后自动生成付款并转入库存";
}

function stepBadgeLabel(step: StepKey, result: ReturnType<typeof calculateBuybackQuote>) {
  if (result.hardBlock) return "风险";
  if (step === "device") return "第 1 / 6 步";
  if (step === "quote") return "待确认";
  if (step === "inspection") return "检测中";
  if (step === "save") return "待保存";
  if (step === "seller") return "登记中";
  if (step === "evidence") return "受限资料";
  return "待成交";
}

function stepFooterHint(step: StepKey, result: ReturnType<typeof calculateBuybackQuote>) {
  if (result.hardBlock) return "风险待处理";
  if (step === "device") return `建议 €${result.suggestedLow}-${result.suggestedHigh}`;
  if (step === "quote") return "客户同意后继续";
  if (step === "inspection") return `检测后 €${result.finalOffer.toFixed(0)}`;
  if (step === "save") return "不会登记证件、签名或付款";
  if (step === "seller") return "仅收集必要资料";
  if (step === "evidence") return "签名需绑定当前摘要";
  return "所有写入一次完成";
}

function getCurrentFooterHint(
  step: StepKey,
  result: ReturnType<typeof calculateBuybackQuote>,
  validation: ReturnType<typeof validateBuybackIntake>,
  estimateGateMessage: string,
  functionGateMessage: string,
  draft: BuybackQuoteDraft,
  canCaptureEvidence: boolean,
) {
  if (step === "confirm" && !validation.canSave) {
    return [...validation.missing, ...validation.hardBlockReasons][0] ?? "需补齐资料";
  }
  if (step === "device" && estimateGateMessage) return estimateGateMessage;
  if (step === "inspection" && functionGateMessage) return functionGateMessage;
  if (step === "save") {
    return result.hardBlock ? "仅保存风险记录，不会完成成交" : "保存后返回回收列表";
  }
  if (step === "seller") {
    const sellerGate = canCaptureEvidence
      ? getSellerGateMessage(draft)
      : getSellerReviewGateMessage(draft);
    return (
      sellerGate || (canCaptureEvidence ? stepFooterHint(step, result) : "负责人继续采集证件与签名")
    );
  }
  if (step === "evidence") return getEvidenceGateMessage(draft) || stepFooterHint(step, result);
  return stepFooterHint(step, result);
}

function getEstimateGateMessage(draft: BuybackQuoteDraft) {
  if (!draft.model.trim()) return "先选择 iPhone 型号";
  if (!draft.storage_capacity.trim()) return "请选择容量";
  if (!draft.battery_health.trim()) return "请选择电池健康区间";
  return "";
}

function getFunctionGateMessage(
  draft: BuybackQuoteDraft,
  result: ReturnType<typeof calculateBuybackQuote>,
  blockHardRisk = true,
) {
  if (blockHardRisk && result.hardBlock) {
    return (
      result.riskNotes.find((note) => /锁|IMEI|抹除|解锁/.test(note)) ?? "存在硬阻断，不能继续成交"
    );
  }
  const missingRequiredItem = buybackFunctionTestItems.find((item) => {
    if (!item.required) return false;
    const status = draft[item.key];
    return status === "unchecked" || status === "not_applicable";
  });
  if (!missingRequiredItem) return "";
  return `请先完成「${missingRequiredItem.label}」检测`;
}

function nextButtonLabel(
  step: StepKey,
  draft: BuybackQuoteDraft,
  canCaptureEvidence: boolean,
  sensitiveWorkflowEnabled: boolean,
) {
  if (step === "device") {
    if (!draft.model.trim()) return "先选型号";
    if (!draft.storage_capacity.trim()) return "先选容量";
    if (!draft.battery_health.trim()) return "先选电池";
    return "下一步：查看回收价格";
  }
  if (step === "quote") return "客户接受，开始检查手机";
  if (step === "inspection") {
    return sensitiveWorkflowEnabled ? "检测完成，登记卖家" : "检测完成，进入保存";
  }
  if (step === "seller") {
    return canCaptureEvidence ? "下一步：拍摄证件" : "提交负责人继续回收";
  }
  if (step === "evidence") return "确认签名";
  return "下一步";
}

function getSellerGateMessage(draft: BuybackQuoteDraft) {
  if (!draft.customer_name.trim()) return "请填写卖家姓名";
  if (!normalizeWhatsappPhone(draft.customer_phone)) return "请填写可用电话";
  if (!draft.customer_document_no.trim()) return "请填写证件号码";
  if (!draft.ownership_confirmed) return "请确认卖家拥有设备";
  if (!draft.purchase_proof && !draft.no_invoice_confirmed) return "请确认无发票声明";
  if (!draft.box_included && !draft.no_box_confirmed) return "请确认无原装盒声明";
  return "";
}

function getSellerReviewGateMessage(draft: BuybackQuoteDraft) {
  if (!draft.customer_name.trim()) return "请填写卖家姓名";
  if (!normalizeWhatsappPhone(draft.customer_phone)) return "请填写可用电话";
  if (!draft.ownership_confirmed) return "请确认卖家拥有设备";
  if (!draft.purchase_proof && !draft.no_invoice_confirmed) return "请确认无发票声明";
  if (!draft.box_included && !draft.no_box_confirmed) return "请确认无原装盒声明";
  return "";
}

function getEvidenceGateMessage(draft: BuybackQuoteDraft) {
  if (!draft.device_photo_captured) return "请拍摄设备照片";
  if (!draft.id_front_captured) return "请拍摄证件资料面";
  if (draft.customer_document_type !== "passport" && !draft.id_back_captured) {
    return "请拍摄证件反面";
  }
  if (!draft.data_wipe_authorized) return "请确认数据清除授权";
  if (!draft.privacy_notice_accepted) return "请确认隐私告知";
  if (!draft.agreement_accepted) return "请确认回收协议";
  if (!isSafeBuybackVerificationNote(draft.customer_signature_note)) {
    return "核验备注不能包含完整证件号或超过 160 字";
  }
  if (!draft.signature_captured) return "请让客户在下方签名";
  return "";
}

async function uploadBuybackAttachments(
  id: string,
  attachments: AttachmentDraft,
  uploaded: UploadedEvidence,
  agreementHash: string,
) {
  const next = { ...uploaded };
  for (const [kind, file] of Object.entries(attachments) as [BuybackAttachmentKind, File][]) {
    if (!file) continue;
    if (next[kind]) continue;
    const uploadFile = await prepareBuybackEvidenceFile(file, kind === "signature");
    const dataBase64 = await fileToBase64(uploadFile);
    const mimeType = uploadFile.type || mimeTypeFromFileName(uploadFile.name) || "image/jpeg";
    const result = await uploadInventoryAttachment(id, {
      kind,
      file_name: uploadFile.name || `${kind}.jpg`,
      mime_type: mimeType,
      file_size: uploadFile.size,
      data_base64: dataBase64,
      note: buybackAttachmentLabel(kind),
      agreement_hash: kind === "signature" ? agreementHash : undefined,
    }).catch((error) => {
      throw new Error(
        `${buybackAttachmentLabel(kind)}上传失败：${
          error instanceof Error ? error.message : "未知错误"
        }`,
      );
    });
    next[kind] = result.attachment.id;
  }
  return next;
}

async function advanceDeferredBuybackQuote(
  id: string,
  currentStatus: InventoryItemStatus,
  result: ReturnType<typeof calculateBuybackQuote>,
) {
  if (currentStatus !== "intake" && currentStatus !== "evaluating") return;
  await transitionInventoryItem(id, "offer_made", {
    reason: `客户考虑中，初步报价 €${result.finalOffer.toFixed(2)}`,
  });
}

async function prepareBuybackEvidenceFile(file: File, preserveOriginal: boolean) {
  if (file.size <= BUYBACK_EVIDENCE_UPLOAD_MAX_BYTES) return file;
  if (preserveOriginal) {
    throw new Error("客户签名文件过大，请清除后重新签名");
  }
  const mimeType = file.type || mimeTypeFromFileName(file.name) || "";
  if (!mimeType.startsWith("image/")) {
    throw new Error("照片过大，请改用 JPG、PNG 或 WebP 图片后重试");
  }

  let decoded: Awaited<ReturnType<typeof decodeBuybackUploadImage>> | undefined;
  try {
    decoded = await decodeBuybackUploadImage(file);
    let scale = Math.min(1, 2200 / Math.max(decoded.width, decoded.height));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("当前浏览器无法处理照片");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(decoded.source, 0, 0, width, height);
      const blob = await canvasToBlob(canvas, "image/jpeg", Math.max(0.58, 0.84 - attempt * 0.07));
      if (blob.size <= BUYBACK_EVIDENCE_UPLOAD_MAX_BYTES) {
        const baseName = file.name.replace(/\.[^.]+$/, "") || "buyback-evidence";
        return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
      }
      scale *= 0.78;
    }
  } catch (error) {
    throw new Error(
      `照片过大且自动压缩失败，请在相机中选择兼容格式后重拍：${
        error instanceof Error ? error.message : "无法读取图片"
      }`,
    );
  } finally {
    decoded?.dispose();
  }
  throw new Error("照片压缩后仍然过大，请靠近证件重新拍摄");
}

async function decodeBuybackUploadImage(file: File) {
  if (typeof globalThis.createImageBitmap === "function") {
    const bitmap = await globalThis.createImageBitmap(file);
    return {
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const candidate = new Image();
      candidate.onload = () => resolve(candidate);
      candidate.onerror = () => reject(new Error("浏览器无法解码该图片"));
      candidate.src = objectUrl;
    });
    return {
      source: image as CanvasImageSource,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("浏览器无法生成压缩图片"))),
      mimeType,
      quality,
    );
  });
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? (value.split(",").pop() ?? "") : value);
    };
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

function mimeTypeFromFileName(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  if (extension === "pdf") return "application/pdf";
  return undefined;
}

function attachmentCapturedKey(kind: BuybackAttachmentKind) {
  const map = {
    device_photo: "device_photo_captured",
    id_front: "id_front_captured",
    id_back: "id_back_captured",
    signature: "signature_captured",
    invoice_photo: "invoice_photo_captured",
    box_photo: "box_photo_captured",
  } as const;
  return map[kind as keyof typeof map];
}

function buybackAttachmentLabel(kind: BuybackAttachmentKind) {
  if (kind === "device_photo") return "设备照片";
  if (kind === "id_front") return "证件正面";
  if (kind === "id_back") return "证件反面";
  if (kind === "signature") return "客户签名";
  if (kind === "invoice_photo") return "发票/无票确认";
  if (kind === "box_photo") return "原装盒/无盒确认";
  return "附件";
}

function QuickEstimateStep({
  draft,
  result,
  updateDraft,
}: {
  draft: BuybackQuoteDraft;
  result: ReturnType<typeof calculateBuybackQuote>;
  updateDraft: <K extends DraftKey>(key: K, value: BuybackQuoteDraft[K]) => void;
}) {
  const modelGroups = getAppleIPhoneSeriesGroups();
  const allModels = getAppleIPhoneModels();
  const [editingStage, setEditingStage] = useState<"model" | "storage" | "battery" | null>(null);
  const selectedModelSeries =
    modelGroups.find((group) => group.models.some((model) => model.model === draft.model))?.key ??
    modelGroups[0]?.key ??
    "iphone17";
  const [selectedSeries, setSelectedSeries] = useState(selectedModelSeries);
  const activeSeriesGroup = modelGroups.find((group) => group.key === selectedSeries);
  const visibleModels = activeSeriesGroup?.models ?? allModels.slice(0, 6);
  const storageChoices = getAppleIPhoneStorageChoices(draft.model);
  const selectedModel = allModels.find((model) => model.model === draft.model);
  const selectedStorage = storageChoices.find(
    (storage) => `${storage.valueGb}GB` === draft.storage_capacity,
  );
  const selectedBatteryBand = getBuybackBatteryBand(Number(draft.battery_health));
  const hasModel = Boolean(draft.model.trim());
  const hasStorage = Boolean(draft.storage_capacity.trim());
  const hasBattery = Boolean(draft.battery_health.trim());
  const hasMarketReference = result.resaleReference > 0;
  const showModelPicker = !hasModel || editingStage === "model";
  const showStoragePicker = hasModel && (!hasStorage || editingStage === "storage");
  const showBatteryPicker = hasModel && hasStorage && (!hasBattery || editingStage === "battery");
  const applyMarketSuggestion = (model: string, storageCapacity: string) => {
    const suggestion = estimateAppleMarketPricing({
      brand: "Apple",
      model,
      storageCapacity,
    });
    if (!suggestion) return;
    updateDraft("market_price", String(suggestion.resaleReference));
    updateDraft("target_profit", String(suggestion.targetProfit));
  };

  useEffect(() => {
    if (!draft.model.trim()) return;
    setSelectedSeries(selectedModelSeries);
  }, [draft.model, selectedModelSeries]);

  return (
    <div className="space-y-1.5">
      {showModelPicker ? (
        <section className={quoteCardClass}>
          <SectionTitle
            icon={Smartphone}
            title="选择 iPhone"
            subtitle="第一步只选型号，系统不会提前要求客户资料。"
          />
          <IPhoneSeriesPicker
            groups={modelGroups}
            value={selectedSeries}
            onChange={(value) => setSelectedSeries(value)}
          />
          <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="truncate text-[10px] font-medium leading-4">
                {activeSeriesGroup?.label ?? "当前系列"}
              </p>
              <p className="shrink-0 text-[9px] leading-3 text-muted-foreground">
                {visibleModels.length} 款可选
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-1.5 min-[390px]:grid-cols-2 sm:grid-cols-3">
            {visibleModels.map((model) => {
              const selected = draft.model === model.model;
              return (
                <RepairOsBusinessCard
                  key={model.model}
                  as="button"
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    repairOs.businessCardDense,
                    "min-h-14 min-w-0 rounded-lg px-2.5 py-2 text-left transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    selected && "border-primary/50 bg-primary/10 text-primary",
                  )}
                  bodyClassName="min-w-0"
                  trailingClassName="flex justify-end self-start"
                  trailing={
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded-full border border-transparent",
                        selected && "border-primary/40 text-primary",
                      )}
                      aria-hidden="true"
                    >
                      {selected ? <CheckCircle2 className="size-3" /> : null}
                    </span>
                  }
                  onClick={() => {
                    updateDraft("brand", "Apple");
                    updateDraft("model", model.model);
                    updateDraft("storage_capacity", "");
                    updateDraft("market_price", "");
                    setEditingStage(null);
                  }}
                >
                  <p className="truncate text-[12px] font-semibold leading-4">{model.model}</p>
                  <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground">
                    {model.releaseYear} · 起 {model.baseStorageGb}GB
                  </p>
                </RepairOsBusinessCard>
              );
            })}
          </div>
          {!hasModel ? <EstimateUnlockHint label="选好型号后继续选择容量" /> : null}
        </section>
      ) : (
        <EstimateSelectionSummary
          icon={Smartphone}
          label="已选型号"
          value={draft.model}
          meta={
            selectedModel
              ? `${selectedModel.releaseYear} · 官方起步 ${selectedModel.baseStorageGb}GB`
              : "Apple iPhone"
          }
          onEdit={() => setEditingStage("model")}
        />
      )}

      {showStoragePicker ? (
        <section className={quoteCardClass}>
          <SectionTitle
            icon={ClipboardCheck}
            title="选择容量"
            subtitle="第二步只选容量；非官方容量会降低可信度。"
          />
          <StorageChoicePicker
            choices={storageChoices}
            value={draft.storage_capacity}
            onChange={(value) => {
              updateDraft("storage_capacity", value);
              applyMarketSuggestion(draft.model, value);
              setEditingStage(null);
            }}
          />
          <p className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
            {getAppleIPhoneStorageHint(draft.model)}
          </p>
          {!hasStorage ? <EstimateUnlockHint label="选好容量后继续选择电池健康区间" /> : null}
        </section>
      ) : hasModel && hasStorage ? (
        <EstimateSelectionSummary
          icon={ClipboardCheck}
          label="已选容量"
          value={draft.storage_capacity}
          meta={
            selectedStorage?.official === false
              ? "非官方容量，成交前需复核"
              : "官方容量，参与行情估算"
          }
          onEdit={() => setEditingStage("storage")}
        />
      ) : null}

      {showBatteryPicker ? (
        <section className={quoteCardClass}>
          <SectionTitle
            icon={Battery}
            title="电池健康"
            subtitle="第三步按 3% 档位扣价，必要时可输入精确值。"
          />
          <BatteryBandPicker
            value={draft.battery_health}
            onChange={(value) => {
              updateDraft("battery_health", value);
              setEditingStage(null);
            }}
          />
          <details className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
            <summary className="cursor-pointer text-[11px] font-medium text-foreground">
              输入精确电池健康
            </summary>
            <TextField
              label="电池健康"
              value={draft.battery_health}
              onChange={(value) => updateDraft("battery_health", value)}
              inputMode="numeric"
              suffix="%"
              className="mt-2"
            />
          </details>
          {selectedBatteryBand ? (
            <p className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
              当前按「{selectedBatteryBand.label} · {selectedBatteryBand.rangeLabel}」估算：
              {selectedBatteryBand.helper}。
            </p>
          ) : (
            <EstimateUnlockHint label="选好电池健康后继续选择屏幕和机身状态" />
          )}
        </section>
      ) : hasModel && hasStorage && hasBattery ? (
        <EstimateSelectionSummary
          icon={Battery}
          label="电池健康"
          value={selectedBatteryBand?.label ?? `${draft.battery_health}%`}
          meta={
            selectedBatteryBand
              ? `${selectedBatteryBand.rangeLabel} · 扣减 €${selectedBatteryBand.deduction}`
              : "按精确百分比估算"
          }
          onEdit={() => setEditingStage("battery")}
        />
      ) : null}

      {hasModel && hasStorage && hasBattery ? (
        <section className={quoteCardClass}>
          <SectionTitle
            icon={ShieldCheck}
            title="口头估价条件"
            subtitle="只记录会影响区间的条件，详细检测在客户同意后做。"
          />
          <div className="grid grid-cols-1 gap-1.5">
            <ChoiceGroup
              label="屏幕"
              value={draft.screen_condition}
              onChange={(value) => updateDraft("screen_condition", value)}
              options={[
                ["normal", "正常"],
                ["light_scratches", "轻微划痕"],
                ["deep_scratches", "明显划痕"],
                ["cracked", "裂屏"],
                ["display_issue", "显示异常"],
              ]}
            />
            <ChoiceGroup
              label="机身"
              value={draft.body_condition}
              onChange={(value) => updateDraft("body_condition", value)}
              options={[
                ["normal", "正常"],
                ["light_wear", "轻微磨损"],
                ["heavy_wear", "明显磨损"],
                ["bent", "变形"],
              ]}
            />
            <div className="grid grid-cols-2 gap-1.5">
              <ToggleRow
                label="带原装盒"
                checked={draft.box_included}
                onChange={(value) => updateDraft("box_included", value)}
              />
              <ToggleRow
                label="有发票/凭证"
                checked={draft.purchase_proof}
                onChange={(value) => updateDraft("purchase_proof", value)}
              />
            </div>
          </div>
        </section>
      ) : null}

      {hasModel && hasStorage && hasBattery ? (
        <section className={quoteCardClass}>
          <SectionTitle
            icon={TrendingUp}
            title="口头报价区间"
            subtitle="客户同意后再进入完整功能检测和资料采集。"
          />
          <MarketGuidePanel
            result={result}
            onApplyMarket={() => {
              if (!result.marketSuggestion) return;
              updateDraft("market_price", String(result.marketSuggestion.resaleReference));
            }}
            onApplyTargetProfit={() => {
              if (!result.marketSuggestion) return;
              updateDraft("target_profit", String(result.marketSuggestion.targetProfit));
            }}
          />
          <AutoCosmeticAssessmentCard result={result} />
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--surface-panel-muted)] p-1">
            <InfoMetric label="参考售价" value={`€${result.resaleReference.toFixed(0)}`} />
            <InfoMetric label="区间" value={`€${result.suggestedLow}-${result.suggestedHigh}`} />
            <InfoMetric label="建议" value={`€${result.finalOffer.toFixed(0)}`} strong />
          </div>
          <QuoteFormulaCard result={result} />
          <DeductionPreview result={result} />
          {!hasMarketReference ? (
            <details className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
              <summary className="cursor-pointer text-[11px] font-medium text-foreground">
                手动补充价格参数
              </summary>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <TextField
                  label="市场"
                  value={draft.market_price}
                  onChange={(value) => updateDraft("market_price", value)}
                  inputMode="decimal"
                  prefix="€"
                />
                <TextField
                  label="成本"
                  value={draft.estimated_repair_cost}
                  onChange={(value) => updateDraft("estimated_repair_cost", value)}
                  inputMode="decimal"
                  prefix="€"
                />
                <TextField
                  label="利润"
                  value={draft.target_profit}
                  onChange={(value) => updateDraft("target_profit", value)}
                  inputMode="decimal"
                  prefix="€"
                />
              </div>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function EstimateSelectionSummary({
  icon: Icon,
  label,
  value,
  meta,
  onEdit,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  meta: string;
  onEdit: () => void;
}) {
  return (
    <RepairOsBusinessCard
      className={cn(repairOs.businessCardDense, "rounded-xl px-2 py-1.5")}
      leading={
        <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-3.5" />
        </span>
      }
      trailing={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 rounded-lg px-2.5 text-[11px]"
          onClick={onEdit}
        >
          更改
        </Button>
      }
      bodyClassName="min-w-0"
      trailingClassName="flex justify-end"
    >
      <div className="min-w-0">
        <p className="truncate text-[9px] leading-3 text-muted-foreground">{label}</p>
        <p className="truncate text-[11px] font-semibold leading-4">{value}</p>
        <p className="truncate text-[9px] leading-3 text-muted-foreground">{meta}</p>
      </div>
    </RepairOsBusinessCard>
  );
}

function EstimateUnlockHint({ label }: { label: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
      {label}
    </div>
  );
}

function StorageChoicePicker({
  choices,
  value,
  onChange,
}: {
  choices: ReturnType<typeof getAppleIPhoneStorageChoices>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">容量</Label>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {choices.map((storage) => {
          const optionValue = `${storage.valueGb}GB`;
          const selected = value === optionValue;

          return (
            <RepairOsBusinessCard
              key={optionValue}
              as="button"
              type="button"
              aria-pressed={selected}
              className={cn(
                repairOs.businessCardDense,
                "min-h-12 rounded-lg px-2 py-1.5 text-left transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                selected && "border-primary/50 bg-primary/10 text-primary",
              )}
              bodyClassName="min-w-0"
              trailingClassName="flex justify-end self-start"
              trailing={
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-full border border-transparent",
                    selected && "border-primary/40 text-primary",
                  )}
                  aria-hidden="true"
                >
                  {selected ? <CheckCircle2 className="size-3" /> : null}
                </span>
              }
              onClick={() => onChange(optionValue)}
            >
              <p className="truncate text-[12px] font-semibold leading-4">{storage.label}</p>
              <p
                className={cn(
                  "mt-0.5 truncate text-[9px] leading-3 text-muted-foreground",
                  !storage.official && "text-status-warn-foreground",
                )}
              >
                {storage.official ? "官方容量" : (storage.note ?? "需成交前核对")}
              </p>
            </RepairOsBusinessCard>
          );
        })}
      </div>
    </div>
  );
}

function BatteryBandPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const active = getBuybackBatteryBand(Number(value));
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {buybackBatteryBands.map((band) => {
        const selected = active?.key === band.key;
        return (
          <RepairOsBusinessCard
            key={band.key}
            as="button"
            type="button"
            aria-pressed={selected}
            className={cn(
              repairOs.businessCardDense,
              "min-h-12 rounded-lg px-2 py-1.5 text-left transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              selected && "border-primary/50 bg-primary/10 text-primary",
            )}
            bodyClassName="min-w-0"
            trailingClassName="flex justify-end self-start"
            trailing={
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full border border-transparent",
                  selected && "border-primary/40 text-primary",
                )}
                aria-hidden="true"
              >
                {selected ? <CheckCircle2 className="size-3" /> : null}
              </span>
            }
            onClick={() => onChange(band.value)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold leading-4">{band.label}</span>
              <span className="shrink-0 rounded-full bg-[var(--surface-panel-muted)] px-1.5 py-0.5 font-mono text-[9px] leading-none text-muted-foreground">
                {band.deduction > 0 ? `-€${band.deduction}` : "不扣"}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[9px] leading-3 text-muted-foreground">
              {band.rangeLabel} · {band.helper}
            </p>
          </RepairOsBusinessCard>
        );
      })}
    </div>
  );
}

function InfoMetric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <RepairOsInfoTile
      label={label}
      value={value}
      frame="plain"
      className="rounded-md bg-card px-2 py-1"
      labelClassName="text-[9px]"
      valueClassName={cn(
        "truncate font-mono text-[11px] font-semibold leading-4 tabular-nums",
        strong && "text-primary",
      )}
    />
  );
}

function QuoteFormulaCard({ result }: { result: ReturnType<typeof calculateBuybackQuote> }) {
  const deductionTotal = result.deductions.reduce((sum, item) => sum + item.amount, 0);
  const formulaItems = [
    ["参考售价", result.resaleReference],
    ["目标利润", -result.targetProfit],
    ["维修成本", -result.estimatedRepairCost],
    ["风险扣减", -deductionTotal],
  ] as const;

  return (
    <div className="rounded-lg bg-[var(--surface-panel-muted)] p-1.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-semibold leading-4">报价计算</p>
        <p className="truncate text-[9px] leading-3 text-muted-foreground">
          系统价 = 参考 - 利润 - 成本 - 扣减
        </p>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {formulaItems.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-md bg-card px-1.5 py-1">
            <p className="truncate text-[9px] leading-3 text-muted-foreground">{label}</p>
            <p
              className={cn(
                "truncate font-mono text-[10px] font-semibold leading-4 tabular-nums",
                value < 0 && "text-muted-foreground",
              )}
            >
              {value < 0 ? "-" : ""}€{Math.abs(value).toFixed(0)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeductionPreview({ result }: { result: ReturnType<typeof calculateBuybackQuote> }) {
  if (!result.deductions.length) {
    return (
      <div className="rounded-lg bg-status-success/15 px-2 py-1.5 text-[10px] leading-4 text-status-success-foreground">
        当前没有明显扣减项，仍需客户同意后做完整功能检测。
      </div>
    );
  }

  return (
    <details className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
      <summary className="cursor-pointer text-[11px] font-medium text-foreground">
        扣减明细 {result.deductions.length} 项
      </summary>
      <div className="mt-1 grid gap-1">
        {result.deductions.map((item) => (
          <div key={item.key} className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate">{item.label}</span>
            <span className="shrink-0 font-mono text-status-warn-foreground">
              -€{item.amount.toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

function MarketGuidePanel({
  result,
  onApplyMarket,
  onApplyTargetProfit,
}: {
  result: ReturnType<typeof calculateBuybackQuote>;
  onApplyMarket: () => void;
  onApplyTargetProfit: () => void;
}) {
  const suggestion = result.marketSuggestion;
  if (!suggestion) {
    return (
      <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4 text-muted-foreground">
        Apple 行情库暂未匹配该型号。可以手动输入市场参考价，后续再补入价格规则。
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[var(--surface-panel-muted)] p-2">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[11px] font-semibold leading-4 text-primary">
            <TrendingUp className="size-3" />
            Apple 行情建议
          </div>
          <p className="truncate text-[9px] leading-3 text-muted-foreground">
            {suggestion.matched.model}
            {suggestion.requestedStorageGb ? ` ${suggestion.requestedStorageGb}GB` : ""} ·{" "}
            {suggestion.matched.sourceLabel} {suggestion.matched.observedAt}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {suggestion.confidence === "high"
            ? "高可信"
            : suggestion.confidence === "medium"
              ? "中可信"
              : "低可信"}
        </Badge>
      </div>
      <div className="mt-1.5 grid grid-cols-3 divide-x divide-[var(--border-panel)] rounded-lg bg-card px-1.5 py-1 text-[10px]">
        <div className="min-w-0 px-1">
          <p className="truncate text-[9px] text-muted-foreground">参考售价</p>
          <MoneyText amount={suggestion.resaleReference} className="font-semibold leading-4" />
        </div>
        <div className="min-w-0 px-1">
          <p className="truncate text-[9px] text-muted-foreground">建议利润</p>
          <MoneyText amount={suggestion.targetProfit} className="font-semibold leading-4" />
        </div>
        <div className="min-w-0 px-1">
          <p className="truncate text-[9px] text-muted-foreground">预检上限</p>
          <MoneyText amount={suggestion.preInspectionCeiling} className="font-semibold leading-4" />
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-[11px]"
          onClick={onApplyMarket}
        >
          套用售价
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-[11px]"
          onClick={onApplyTargetProfit}
        >
          套用利润
        </Button>
      </div>
      <p className="mt-1 truncate text-[9px] leading-3 text-muted-foreground">
        下次建议刷新：{suggestion.nextRefreshAt}。成交前以到店复检和本店库存周转为准。
      </p>
    </div>
  );
}

function AutoCosmeticAssessmentCard({
  result,
}: {
  result: ReturnType<typeof calculateBuybackQuote>;
}) {
  const assessment = result.cosmeticAssessment;
  return (
    <div className="rounded-lg bg-card p-2 shadow-[var(--shadow-card)]">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold leading-4">系统评估成色</p>
          <p className="line-clamp-2 text-[9px] leading-3 text-muted-foreground">
            根据屏幕、机身、电池、拆修/进水和功能检测自动生成，不需要手动选择等级。
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {assessment.label}
        </Badge>
      </div>
      <div className="mt-1.5 grid grid-cols-[72px_minmax(0,1fr)] gap-1.5">
        <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
          <p className="truncate text-[9px] leading-3 text-muted-foreground">评分</p>
          <p className="font-mono text-[12px] font-semibold leading-4 text-primary">
            {assessment.score}/100
          </p>
        </div>
        <div className="min-w-0 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
          <p className="truncate text-[9px] leading-3 text-muted-foreground">依据</p>
          <p className="line-clamp-2 text-[10px] font-medium leading-4">{assessment.summary}</p>
        </div>
      </div>
    </div>
  );
}

function IntentStep({
  result,
  onDefer,
  onReject,
  isDeferring,
}: {
  result: ReturnType<typeof calculateBuybackQuote>;
  onDefer: () => void;
  onReject: () => void;
  isDeferring: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <QuoteSummaryCard
        title="简易估价"
        result={result}
        badgeLabel={result.hardBlock ? "风险待处理" : "可继续"}
      >
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
          {BUYBACK_SENSITIVE_WORKFLOW_ENABLED
            ? "这是给客户看的初步口头估价。客户同意后，再进入账号锁、功能检测、实名资料和签名登记。"
            : "这是给客户看的初步口头估价。客户同意后，可继续做功能检测并保存记录。"}
        </p>
      </QuoteSummaryCard>

      <section className={quoteCardClass}>
        <SectionTitle
          icon={CheckCircle2}
          title="下一步流程"
          subtitle="避免一开始就收集敏感资料，先确认客户意向。"
        />
        <div className="grid gap-1.5">
          <ProcessRow
            index="1"
            title="客户接受简易报价"
            detail={
              BUYBACK_SENSITIVE_WORKFLOW_ENABLED
                ? "确认愿意继续检测和登记资料。"
                : "确认愿意继续检测并保存报价记录。"
            }
          />
          <ProcessRow
            index="2"
            title="检测手机功能"
            detail="账号锁、Face ID、相机、充电、电池等。"
          />
          <ProcessRow
            index="3"
            title={BUYBACK_SENSITIVE_WORKFLOW_ENABLED ? "登记成交资料" : "保存报价与检测"}
            detail={
              BUYBACK_SENSITIVE_WORKFLOW_ENABLED
                ? "姓名、电话、证件、签名，保存为回收单。"
                : "不会登记证件、签名、付款或完成回收成交。"
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5 border-t border-[var(--border-panel)] pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-lg text-xs"
            disabled={isDeferring}
            onClick={onDefer}
          >
            {isDeferring ? "保存中" : "保存考虑中"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-lg text-xs text-status-danger-foreground hover:text-status-danger-foreground"
            disabled={isDeferring}
            onClick={onReject}
          >
            客户不接受
          </Button>
        </div>
        <p className="text-[10px] leading-4 text-muted-foreground">
          “考虑中”只保存报价草稿，不计入回收成本；“不接受”不会写入库存记录。
        </p>
      </section>
    </div>
  );
}

function ProcessRow({ index, title, detail }: { index: string; title: string; detail: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)] gap-2 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
        {index}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold leading-4">{title}</p>
        <p className="truncate text-[10px] leading-3 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function FunctionChecklist({
  draft,
  result,
  updateDraft,
}: {
  draft: BuybackQuoteDraft;
  result: ReturnType<typeof calculateBuybackQuote>;
  updateDraft: <K extends DraftKey>(key: K, value: BuybackQuoteDraft[K]) => void;
}) {
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const requiredItems = buybackFunctionTestItems.filter((item) => item.required);
  const requiredDone = requiredItems.filter(
    (item) => draft[item.key] !== "unchecked" && draft[item.key] !== "not_applicable",
  ).length;
  const uncheckedCount = buybackFunctionTestItems.filter(
    (item) => draft[item.key] === "unchecked",
  ).length;
  const itemHandled = (item: (typeof buybackFunctionTestItems)[number]) => {
    const status = draft[item.key];
    if (status === "unchecked") return false;
    return !item.required || status !== "not_applicable";
  };
  const hardBlockText = result.hardBlock
    ? (result.riskNotes.find((note) => /锁|IMEI|抹除|解锁/.test(note)) ?? "风险待处理")
    : "可继续";
  const activeGroup = buybackFunctionTestGroups[activeGroupIndex] ?? buybackFunctionTestGroups[0];
  const activeItems = activeGroup.itemKeys
    .map((key) => buybackFunctionTestItems.find((item) => item.key === key))
    .filter((item): item is (typeof buybackFunctionTestItems)[number] => Boolean(item));
  const activeDone = activeItems.filter((item) => itemHandled(item)).length;
  const activeRequiredPending = activeItems.some((item) => {
    if (!item.required) return false;
    const status = draft[item.key];
    return status === "unchecked" || status === "not_applicable";
  });
  const groupStats = buybackFunctionTestGroups.map((group) => {
    const items = group.itemKeys
      .map((key) => buybackFunctionTestItems.find((item) => item.key === key))
      .filter((item): item is (typeof buybackFunctionTestItems)[number] => Boolean(item));
    const done = items.filter((item) => itemHandled(item)).length;
    const requiredPending = items.some((item) => {
      if (!item.required) return false;
      const status = draft[item.key];
      return status === "unchecked" || status === "not_applicable";
    });
    return { group, done, total: items.length, requiredPending };
  });
  const markActiveGroupPass = () => {
    activeItems.forEach((item) => {
      updateDraft(item.key, "pass" as BuybackQuoteDraft[typeof item.key]);
    });
  };
  const resetActiveGroup = () => {
    activeItems.forEach((item) => {
      updateDraft(item.key, "unchecked" as BuybackQuoteDraft[typeof item.key]);
    });
  };

  return (
    <div className="space-y-1.5 rounded-lg bg-[var(--surface-panel-muted)] p-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] font-medium text-muted-foreground">引导式功能检测</Label>
        <Badge variant="secondary" className="text-[10px]">
          {buybackFunctionTestItems.length} 项
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <MetricPill label="必检完成" value={`${requiredDone}/${requiredItems.length}`} />
        <MetricPill label="未测项目" value={String(uncheckedCount)} />
        <MetricPill
          label="成交状态"
          value={hardBlockText}
          tone={result.hardBlock ? "danger" : "success"}
        />
      </div>

      <div className="grid grid-cols-4 gap-1">
        {groupStats.map(({ group, done, total, requiredPending }, index) => {
          const active = index === activeGroupIndex;
          return (
            <button
              key={group.key}
              type="button"
              className={cn(
                "min-w-0 rounded-lg border border-[var(--border-panel)] bg-card px-1 py-1 text-center shadow-[var(--shadow-card)]",
                active && "border-primary/40 bg-primary/10 text-primary",
              )}
              onClick={() => setActiveGroupIndex(index)}
            >
              <span className="block truncate text-[10px] font-semibold leading-4">
                {group.label}
              </span>
              <span
                className={cn(
                  "block truncate text-[9px] leading-3 text-muted-foreground",
                  requiredPending && "text-status-warn-foreground",
                )}
              >
                {done}/{total}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg bg-card p-1.5 shadow-[var(--shadow-card)]">
        <div className="mb-1.5 flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold leading-4">{activeGroup.label}</p>
            <p className="truncate text-[9px] leading-3 text-muted-foreground">
              {activeGroup.hint}
            </p>
          </div>
          <Badge
            variant={activeRequiredPending ? "secondary" : "outline"}
            className="shrink-0 text-[10px]"
          >
            {activeDone}/{activeItems.length}
          </Badge>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {activeItems.map((item) => (
            <InspectionStatusRow
              key={item.key}
              label={item.label}
              required={item.required}
              value={draft[item.key] as BuybackInspectionStatus}
              onChange={(value) =>
                updateDraft(item.key, value as BuybackQuoteDraft[typeof item.key])
              }
            />
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-[11px]"
            onClick={markActiveGroupPass}
          >
            本组全部正常
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg text-[11px] text-muted-foreground"
            onClick={resetActiveGroup}
          >
            重置本组
          </Button>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 border-t border-[var(--border-panel)] pt-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-[11px]"
            disabled={activeGroupIndex === 0}
            onClick={() => setActiveGroupIndex((current) => Math.max(0, current - 1))}
          >
            上一组
          </Button>
          <Button
            type="button"
            size="sm"
            className={cn("h-8 rounded-lg text-[11px]", controls.brandButton)}
            style={brandGradientStyle}
            disabled={
              activeRequiredPending || activeGroupIndex >= buybackFunctionTestGroups.length - 1
            }
            onClick={() =>
              setActiveGroupIndex((current) =>
                Math.min(buybackFunctionTestGroups.length - 1, current + 1),
              )
            }
          >
            下一组
          </Button>
        </div>
        {activeRequiredPending ? (
          <p className="mt-1 text-[10px] leading-4 text-status-warn-foreground">
            本组还有必检项未完成，完成后再进入下一组。
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MetricPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger";
}) {
  return (
    <RepairOsInfoTile
      label={label}
      value={value}
      frame="plain"
      className={cn(
        "min-w-0 rounded-lg bg-card px-2 py-1 shadow-[var(--shadow-card)]",
        tone === "success" && "bg-status-success/15 text-status-success-foreground",
        tone === "danger" && "bg-status-danger/15 text-status-danger-foreground",
      )}
      labelClassName="text-[9px]"
      valueClassName="truncate text-[11px] font-semibold leading-4"
    />
  );
}

function InspectionStatusRow({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required: boolean;
  value: BuybackInspectionStatus;
  onChange: (value: BuybackInspectionStatus) => void;
}) {
  const options: [BuybackInspectionStatus, string][] = required
    ? [
        ["pass", "正常"],
        ["fail", "异常"],
        ["unchecked", "未测"],
      ]
    : [
        ["pass", "正常"],
        ["fail", "异常"],
        ["not_applicable", "不适用"],
        ["unchecked", "未测"],
      ];
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-card p-1.5">
      <div className="mb-1 flex min-w-0 items-center justify-between gap-1.5">
        <span className="truncate text-[11px] font-medium leading-4">{label}</span>
        {required ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">
            必检
          </span>
        ) : null}
      </div>
      <div className={cn("grid gap-1", required ? "grid-cols-3" : "grid-cols-4")}>
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            className={cn(
              "h-8 min-w-0 rounded-md border border-[var(--border-panel)] px-1 text-[10px] font-medium text-muted-foreground transition-colors",
              value === option && "border-primary/40 bg-primary/10 text-primary",
              value === "fail" && option === "fail" && "border-status-danger-foreground/40",
            )}
            onClick={() => onChange(option)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function DeviceSummaryCard({
  draft,
  result,
  showDeviceMeta,
}: {
  draft: BuybackQuoteDraft;
  result: ReturnType<typeof calculateBuybackQuote>;
  showDeviceMeta?: boolean;
}) {
  return (
    <section className={cn(repairOs.mobileInfoCard, "grid grid-cols-[56px_minmax(0,1fr)] gap-2")}>
      <div className="grid aspect-[3/4] place-items-center rounded-lg bg-[var(--surface-panel-muted)] text-primary">
        <Smartphone className="size-6" />
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-[13px] font-semibold leading-5">
          {[draft.brand, draft.model].filter(Boolean).join(" ") || "待填写设备"}
        </h2>
        <div className="mt-0.5 flex min-w-0 flex-wrap gap-1">
          {[draft.storage_capacity, draft.color].filter(Boolean).map((item) => (
            <Badge key={item} variant="secondary" className="h-5 text-[10px]">
              {item}
            </Badge>
          ))}
        </div>
        {showDeviceMeta ? (
          <>
            <InfoLine label="IMEI" value={draft.serial_or_imei || "未填写"} />
            <InfoLine label="购买地区" value={draft.purchase_region || "-"} />
            <InfoLine label="保修状态" value={draft.warranty_status || "-"} />
          </>
        ) : (
          <>
            <InfoLine label="市场范围" value={`€ ${result.marketMin} - € ${result.marketMax}`} />
            <InfoLine label="有效期" value={`${result.validDays} 天`} />
          </>
        )}
      </div>
    </section>
  );
}

function QuoteWorkspaceSidebar({
  draft,
  result,
  validation,
  currentStepLabel,
  recordOnly = false,
}: {
  draft: BuybackQuoteDraft;
  result: ReturnType<typeof calculateBuybackQuote>;
  validation: ReturnType<typeof validateBuybackIntake>;
  currentStepLabel: string;
  recordOnly?: boolean;
}) {
  const pendingItems = recordOnly
    ? result.riskNotes
    : [...validation.missing, ...validation.hardBlockReasons];

  return (
    <aside className="hidden min-w-0 space-y-2 lg:block">
      <div className="sticky top-2 min-w-0 space-y-2">
        <DeviceSummaryCard draft={draft} result={result} showDeviceMeta />
        <QuoteSummaryCard
          title="报价摘要"
          result={result}
          badgeLabel={result.hardBlock ? "风险待处理" : "建议接受"}
        >
          <div className="grid grid-cols-2 gap-1.5 text-[10px] leading-4">
            <InfoLine label="当前步骤" value={currentStepLabel} />
            <InfoLine
              label={recordOnly ? "当前范围" : "资料状态"}
              value={recordOnly ? "报价与检测" : validation.canSave ? "可入库" : "待补齐"}
            />
            {recordOnly ? <InfoLine label="成交状态" value="未完成" /> : null}
            <InfoLine label="市场低位" value={`€ ${result.marketMin}`} />
            <InfoLine label="市场高位" value={`€ ${result.marketMax}`} />
          </div>
        </QuoteSummaryCard>
        <section className={quoteCardClass}>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <h3 className="truncate text-[11px] font-semibold leading-4">
              {recordOnly ? "检测风险" : "风险与缺口"}
            </h3>
            <Badge
              variant={pendingItems.length ? "secondary" : "outline"}
              className="shrink-0 text-[10px]"
            >
              {pendingItems.length || "OK"}
            </Badge>
          </div>
          {pendingItems.length ? (
            <ul className="space-y-1">
              {pendingItems.slice(0, 5).map((item) => (
                <li
                  key={item}
                  className="rounded-lg border border-status-warn-foreground/20 bg-status-warn px-2 py-1 text-[10px] leading-4 text-status-warn-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-status-success-foreground/20 bg-status-success px-2 py-1.5 text-[10px] leading-4 text-status-success-foreground">
              {recordOnly ? "未发现需要特别记录的检测风险。" : "资料和硬性风险已满足当前保存要求。"}
            </p>
          )}
          {!recordOnly && result.riskNotes.length ? (
            <p className="line-clamp-3 text-[10px] leading-4 text-muted-foreground">
              {result.riskNotes.join("；")}
            </p>
          ) : null}
        </section>
      </div>
    </aside>
  );
}

function QuoteSummaryCard({
  title,
  result,
  badgeLabel,
  children,
}: {
  title: string;
  result: ReturnType<typeof calculateBuybackQuote>;
  badgeLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={quoteCardClass}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[11px] font-semibold leading-4">
            {title}
            <ShieldCheck className="size-3 text-primary" />
          </div>
          <MoneyText
            amount={result.finalOffer}
            className="mt-0.5 block text-xl font-semibold leading-6 text-primary"
          />
        </div>
        <Badge
          variant={result.hardBlock ? "destructive" : "outline"}
          className="shrink-0 gap-1 text-[10px]"
        >
          {result.hardBlock ? (
            <AlertTriangle className="size-3" />
          ) : (
            <Sparkles className="size-3" />
          )}
          {badgeLabel}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4">
        <div className="min-w-0">
          <p className="truncate text-muted-foreground">建议回收区间</p>
          <p className="truncate font-mono">
            € {result.suggestedLow} - € {result.suggestedHigh}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="truncate text-muted-foreground">报价有效期</p>
          <p className="truncate font-mono">{result.validDays} 天</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function FunctionStep({
  draft,
  result,
  updateDraft,
}: {
  draft: BuybackQuoteDraft;
  result: ReturnType<typeof calculateBuybackQuote>;
  updateDraft: <K extends DraftKey>(key: K, value: BuybackQuoteDraft[K]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <section className={quoteCardClass}>
        <SectionTitle
          icon={ClipboardCheck}
          title="功能检测"
          subtitle="逐项引导测试，必检项不能遗漏。"
        />
        <div className="space-y-2">
          <TextField
            label="IMEI / 序列号"
            value={draft.serial_or_imei}
            onChange={(value) => updateDraft("serial_or_imei", value)}
            placeholder="扫描或输入 IMEI / SN"
            inputMode="numeric"
          />
          <div className="grid gap-1.5 rounded-lg bg-[var(--surface-panel-muted)] p-2">
            <ToggleRow
              label="客户可现场解锁设备"
              checked={draft.account_unlocked}
              onChange={(value) => updateDraft("account_unlocked", value)}
            />
            <ToggleRow
              label="Find My / FRP / 账号锁已关闭"
              checked={draft.activation_lock_off}
              onChange={(value) => updateDraft("activation_lock_off", value)}
            />
            <ToggleRow
              label="有购买凭证或来源说明"
              checked={draft.purchase_proof}
              onChange={(value) => updateDraft("purchase_proof", value)}
            />
            <ToggleRow
              label="有盒子/主要配件"
              checked={draft.box_included}
              onChange={(value) => updateDraft("box_included", value)}
            />
          </div>
          <FunctionChecklist draft={draft} result={result} updateDraft={updateDraft} />
          <div className="rounded-lg bg-[var(--surface-panel-muted)] p-2">
            <Label className="text-[10px] text-muted-foreground">人工最终报价</Label>
            <div className="mt-1.5 grid grid-cols-[104px_minmax(0,1fr)] gap-1.5">
              <TextField
                label="金额"
                value={draft.manual_offer}
                onChange={(value) => updateDraft("manual_offer", value)}
                inputMode="decimal"
                prefix="€"
                hideLabel
              />
              <Textarea
                value={draft.manual_reason}
                onChange={(event) => updateDraft("manual_reason", event.target.value)}
                placeholder="超过系统建议或特殊换购时填写原因"
                className="min-h-8 resize-none rounded-lg text-base md:text-xs"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function QuoteRecordOnlyStep({
  result,
  saveError,
  isOnline,
}: {
  result: ReturnType<typeof calculateBuybackQuote>;
  saveError: string;
  isOnline: boolean;
}) {
  return (
    <div className="space-y-2" aria-busy="false">
      <section className={quoteCardClass}>
        <SectionTitle
          icon={FileText}
          title="资料登记暂时关闭"
          subtitle="本次只能保存报价与检测记录，不能完成回收成交。"
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-status-success px-2.5 py-2 text-status-success-foreground">
            <p className="text-[11px] font-semibold">本次会保存</p>
            <p className="mt-0.5 text-[10px] leading-4">设备信息、客户意向、报价和功能检测</p>
          </div>
          <div className="rounded-lg bg-status-warn px-2.5 py-2 text-status-warn-foreground">
            <p className="text-[11px] font-semibold">本次不会保存</p>
            <p className="mt-0.5 text-[10px] leading-4">证件号码、证件图片、客户签名或付款记录</p>
          </div>
          <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2.5 py-2">
            <p className="text-[11px] font-semibold">保存后</p>
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
              返回回收列表查看记录；资料登记恢复后再按门店流程继续。
            </p>
          </div>
        </div>
        {result.hardBlock ? (
          <p className="rounded-lg bg-status-warn px-2.5 py-2 text-[11px] leading-4 text-status-warn-foreground">
            检测到风险。本次仅保存为风险记录，不会完成成交。
          </p>
        ) : null}
        {!isOnline ? (
          <p
            role="alert"
            className="rounded-lg bg-status-danger px-2.5 py-2 text-[11px] leading-4 text-status-danger-foreground"
          >
            当前离线，记录尚未保存。联网后再试。
          </p>
        ) : null}
        {saveError ? (
          <p
            role="alert"
            className="rounded-lg bg-status-danger px-2.5 py-2 text-[11px] leading-4 text-status-danger-foreground"
          >
            {saveError}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function SellerStep({
  draft,
  updateDraft,
  collectEvidenceDetails,
}: {
  draft: BuybackQuoteDraft;
  updateDraft: <K extends DraftKey>(key: K, value: BuybackQuoteDraft[K]) => void;
  collectEvidenceDetails: boolean;
}) {
  return (
    <div className="space-y-2">
      <section className={quoteCardClass}>
        <SectionTitle icon={UserRound} title="登记卖家" subtitle="只收集完成本次回收所需的信息。" />
        <div className="grid gap-2 sm:grid-cols-2">
          <TextField
            label="客户姓名"
            value={draft.customer_name}
            onChange={(value) => updateDraft("customer_name", value)}
            placeholder="Mario Rossi"
          />
          <TextField
            label="WhatsApp / 电话"
            value={draft.customer_phone}
            onChange={(value) => updateDraft("customer_phone", value)}
            placeholder="+39 333..."
            inputMode="tel"
          />
        </div>
        {collectEvidenceDetails ? (
          <div className="space-y-2 rounded-xl bg-[var(--surface-panel-muted)] p-2.5">
            <ChoiceGroup
              label="证件类型"
              value={draft.customer_document_type}
              onChange={(value) => updateDraft("customer_document_type", value)}
              options={[
                ["id_card", "身份证"],
                ["passport", "护照"],
                ["residence_permit", "居留"],
                ["driver_license", "驾照"],
                ["other", "其他"],
              ]}
            />
            <TextField
              label="证件号码（系统只保留后四位）"
              value={draft.customer_document_no}
              onChange={(value) => updateDraft("customer_document_no", value)}
              placeholder="Document ID"
            />
          </div>
        ) : (
          <p className="rounded-lg bg-primary/8 px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
            你只需登记姓名和电话。证件、签名与付款由店主或店长接手采集。
          </p>
        )}
        <ChoiceGroup
          label="付款方式"
          value={draft.payment_method}
          onChange={(value) => updateDraft("payment_method", value)}
          options={[
            ["cash", "现金"],
            ["bank_transfer", "转账"],
            ["store_credit", "店内额度"],
            ["other", "其他"],
          ]}
        />
      </section>

      <section className={quoteCardClass}>
        <SectionTitle
          icon={ShieldCheck}
          title="卖家声明"
          subtitle="点击确认，不要求上传假的“无票照片”。"
        />
        <ToggleRow
          label="卖家确认设备归本人所有，并有权出售"
          checked={draft.ownership_confirmed}
          onChange={(value) => updateDraft("ownership_confirmed", value)}
        />
        {!draft.purchase_proof ? (
          <ToggleRow
            label="卖家确认无法提供发票或购买凭证"
            checked={draft.no_invoice_confirmed}
            onChange={(value) => updateDraft("no_invoice_confirmed", value)}
          />
        ) : null}
        {!draft.box_included ? (
          <ToggleRow
            label="卖家确认未提供原装盒"
            checked={draft.no_box_confirmed}
            onChange={(value) => updateDraft("no_box_confirmed", value)}
          />
        ) : null}
        {collectEvidenceDetails ? (
          <p className="rounded-lg bg-primary/8 px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
            完整证件号码不会写入普通库存备注、日志或浏览器缓存。
          </p>
        ) : null}
      </section>
    </div>
  );
}

function EvidenceStep({
  draft,
  result,
  updateDraft,
  attachments,
  updateAttachment,
  validation,
  onSignature,
  signatureResetKey,
  canUseBuybackLegalProfile,
}: {
  draft: BuybackQuoteDraft;
  result: ReturnType<typeof calculateBuybackQuote>;
  updateDraft: <K extends DraftKey>(key: K, value: BuybackQuoteDraft[K]) => void;
  attachments: AttachmentDraft;
  updateAttachment: (kind: BuybackAttachmentKind, file?: File) => void;
  validation: ReturnType<typeof validateBuybackIntake>;
  onSignature: (file?: File) => Promise<void>;
  signatureResetKey: string;
  canUseBuybackLegalProfile: boolean;
}) {
  const needsBack = draft.customer_document_type !== "passport";
  return (
    <div className="space-y-2">
      <section className={quoteCardClass}>
        <SectionTitle
          icon={Camera}
          title="拍摄证件与设备"
          subtitle="证件和签名进入私有受限存储；护照只拍资料页。"
        />
        <div className="grid gap-2 min-[390px]:grid-cols-2">
          <AttachmentCaptureButton
            kind="device_photo"
            icon={Smartphone}
            label="设备照片"
            file={attachments.device_photo}
            required
            onChange={updateAttachment}
          />
          <AttachmentCaptureButton
            kind="id_front"
            icon={UserRound}
            label={draft.customer_document_type === "passport" ? "护照资料页" : "证件正面"}
            file={attachments.id_front}
            required
            onChange={updateAttachment}
          />
          {needsBack ? (
            <AttachmentCaptureButton
              kind="id_back"
              icon={UserRound}
              label="证件反面"
              file={attachments.id_back}
              required
              onChange={updateAttachment}
            />
          ) : null}
          {draft.purchase_proof ? (
            <AttachmentCaptureButton
              kind="invoice_photo"
              icon={ReceiptText}
              label="发票/购买凭证"
              file={attachments.invoice_photo}
              onChange={updateAttachment}
            />
          ) : null}
          {draft.box_included ? (
            <AttachmentCaptureButton
              kind="box_photo"
              icon={Box}
              label="原装盒照片"
              file={attachments.box_photo}
              onChange={updateAttachment}
            />
          ) : null}
        </div>
      </section>

      <section className={quoteCardClass}>
        <SectionTitle
          icon={ShieldCheck}
          title="客户确认"
          subtitle="先阅读成交摘要，再由客户现场签名。"
        />
        <div className="rounded-xl border border-primary/20 bg-primary/8 p-2.5 text-[11px] leading-5">
          <p className="font-semibold">Riepilogo acquisto</p>
          <p>{[draft.brand, draft.model, draft.storage_capacity].filter(Boolean).join(" ")}</p>
          <p>IMEI / SN: {draft.serial_or_imei || "—"}</p>
          <p className="font-semibold text-primary">Importo: €{result.finalOffer.toFixed(2)}</p>
          <p>Metodo di pagamento: {buybackPaymentLabel(draft.payment_method)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
            <p className="text-xs font-semibold">Informativa e condizioni da firmare</p>
            <span className="text-[10px] text-muted-foreground">
              {canUseBuybackLegalProfile
                ? `${BUYBACK_PRIVACY_NOTICE_VERSION} · ${BUYBACK_AGREEMENT_VERSION}`
                : "未配置"}
            </span>
          </div>
          <div className="max-h-52 space-y-3 overflow-y-auto rounded-lg bg-background p-2 text-[10px] leading-4 text-foreground">
            {canUseBuybackLegalProfile ? (
              <>
                <LegalDocumentText text={BUYBACK_PRIVACY_NOTICE_TEXT_IT} />
                <LegalDocumentText text={BUYBACK_TERMS_TEXT_IT} />
              </>
            ) : (
              <p role="alert" className="text-status-warn-foreground">
                当前店铺没有已批准的回收协议法务配置，不能让客户签署成交协议。
              </p>
            )}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
            {canUseBuybackLegalProfile
              ? "Il testo e la versione visualizzati vengono inclusi nel riepilogo firmato."
              : "请先完成当前店铺自己的回收协议与隐私告知配置。"}
          </p>
        </div>
        <ToggleRow
          label="Il cliente autorizza la cancellazione dei dati dal dispositivo"
          checked={draft.data_wipe_authorized}
          onChange={(value) => updateDraft("data_wipe_authorized", value)}
        />
        <ToggleRow
          label="Il cliente ha letto e accetta l'informativa privacy"
          checked={draft.privacy_notice_accepted}
          onChange={(value) => updateDraft("privacy_notice_accepted", value)}
        />
        <ToggleRow
          label="Il cliente conferma la vendita alle condizioni sopra indicate"
          checked={draft.agreement_accepted}
          onChange={(value) => updateDraft("agreement_accepted", value)}
        />
        <Textarea
          value={draft.customer_signature_note}
          onChange={(event) => updateDraft("customer_signature_note", event.target.value)}
          placeholder="门店核验备注（不要填写完整证件号码）"
          maxLength={160}
          className="min-h-16 resize-none rounded-lg text-base"
        />
        <SignaturePad
          ariaLabel="客户回收成交签名区域"
          required
          resetKey={signatureResetKey}
          disabled={
            !draft.data_wipe_authorized ||
            !draft.privacy_notice_accepted ||
            !draft.agreement_accepted
          }
          onChange={(capture) => void onSignature(capture?.file)}
        />
        {getEvidenceGateMessage(draft) ? (
          <p
            role="alert"
            className="rounded-lg bg-status-warn/20 px-2.5 py-2 text-[11px] text-status-warn-foreground"
          >
            {getEvidenceGateMessage(draft)}
          </p>
        ) : (
          <p className="rounded-lg bg-status-success/20 px-2.5 py-2 text-[11px] text-status-success-foreground">
            证件和签名已齐全，可进入最后确认。
          </p>
        )}
        <span className="sr-only">{validation.canSave ? "资料完整" : "资料待补齐"}</span>
      </section>
    </div>
  );
}

function LegalDocumentText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5">
      {text.split("\n\n").map((paragraph, index) => (
        <p
          key={`${index}-${paragraph.slice(0, 24)}`}
          className={index === 0 ? "font-semibold" : ""}
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function ConfirmStep({
  draft,
  result,
  validation,
  saveError,
  onWhatsapp,
}: {
  draft: BuybackQuoteDraft;
  result: ReturnType<typeof calculateBuybackQuote>;
  validation: ReturnType<typeof validateBuybackIntake>;
  saveError: string;
  onWhatsapp: () => void;
}) {
  const missing = [...validation.missing, ...validation.hardBlockReasons];
  return (
    <div className="space-y-2">
      <DeviceSummaryCard draft={draft} result={result} showDeviceMeta />
      <QuoteSummaryCard
        title="最终成交金额"
        result={result}
        badgeLabel={result.hardBlock ? "风险待处理" : "已核对"}
      >
        <div className="grid gap-1.5 text-[11px] sm:grid-cols-2">
          <InfoLine label="卖家" value={draft.customer_name || "—"} />
          <InfoLine
            label="证件"
            value={`${buybackDocumentLabel(draft.customer_document_type)} · ••••${documentNumberLast4(draft.customer_document_no)}`}
          />
          <InfoLine label="付款" value={buybackPaymentLabel(draft.payment_method)} />
          <InfoLine label="凭证" value={draft.signature_captured ? "证件与签名已绑定" : "待签名"} />
        </div>
      </QuoteSummaryCard>
      <section className={quoteCardClass}>
        <SectionTitle
          icon={ShieldCheck}
          title="最后确认"
          subtitle="点击底部按钮后，成交、付款与库存会一次完成。"
        />
        {missing.length ? (
          <ul className="space-y-1" aria-label="待补齐资料">
            {missing.slice(0, 6).map((item) => (
              <li
                key={item}
                className="rounded-lg bg-status-warn/20 px-2.5 py-2 text-[11px] text-status-warn-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-status-success/20 px-2.5 py-2 text-[11px] leading-4 text-status-success-foreground">
            所有必要资料已完成。重复点击或网络重试不会生成第二笔回收付款。
          </p>
        )}
        {saveError ? (
          <p
            role="alert"
            className="rounded-lg bg-status-danger/20 px-2.5 py-2 text-[11px] text-status-danger-foreground"
          >
            {saveError}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full gap-2"
          onClick={onWhatsapp}
        >
          <MessageCircle className="size-4" />
          先把报价发送到 WhatsApp
        </Button>
      </section>
    </div>
  );
}

function BuybackSuccess({
  itemId,
  amount,
  reviewOnly,
  onNew,
  onInventory,
  onClose,
}: {
  itemId: string;
  amount: number;
  reviewOnly?: boolean;
  onNew: () => void;
  onInventory: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex min-h-[520px] flex-col bg-[var(--surface-workspace)] p-3 sm:p-5">
      <SheetHeader className="sr-only">
        <SheetTitle>回收报价结果</SheetTitle>
        <SheetDescription>
          {reviewOnly
            ? "本次记录尚未完成回收成交，本次保存未新增证件、签名或付款资料。"
            : "回收付款、协议和库存已完成。"}
        </SheetDescription>
      </SheetHeader>
      <div className="m-auto w-full max-w-md space-y-4 text-center" aria-live="polite">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-status-success text-status-success-foreground">
          <CheckCircle2 className="size-9" />
        </span>
        <div>
          <h2 className="text-xl font-semibold">
            {reviewOnly ? "报价与检测记录已保存" : "回收成交完成"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {reviewOnly
              ? "本次记录尚未完成回收成交；本次保存未新增证件、签名或付款资料。"
              : "付款、协议与库存记录已一次写入"}
          </p>
        </div>
        <section className={cn(quoteCardClass, "text-left")}>
          <InfoLine label="回收编号" value={itemId.slice(0, 12)} />
          <InfoLine label={reviewOnly ? "报价金额" : "成交金额"} value={`€${amount.toFixed(2)}`} />
          <InfoLine
            label="下一步"
            value={reviewOnly ? "资料登记恢复后，再按门店流程继续" : "执行数据清除并准备翻新"}
          />
        </section>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" className="min-h-11" onClick={onInventory}>
            {reviewOnly ? "返回回收列表" : "查看库存"}
          </Button>
          {!reviewOnly ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => window.print()}
            >
              <ReceiptText className="size-4" />
              打印回收凭据
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="min-h-11" onClick={onNew}>
            {reviewOnly ? "开始新的报价" : "新建回收"}
          </Button>
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
            完成并关闭
          </Button>
        </div>
      </div>
    </div>
  );
}

function buybackDocumentLabel(value: BuybackQuoteDraft["customer_document_type"]) {
  if (value === "passport") return "护照";
  if (value === "residence_permit") return "居留";
  if (value === "driver_license") return "驾照";
  if (value === "other") return "其他";
  return "身份证";
}

function buybackPaymentLabel(value: BuybackQuoteDraft["payment_method"]) {
  if (value === "bank_transfer") return "银行转账";
  if (value === "store_credit") return "店内额度";
  if (value === "other") return "其他";
  return "现金";
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <RepairOsSectionHeader
      icon={Icon}
      title={title}
      description={subtitle}
      headingLevel={3}
      className="mb-0 justify-start"
      bodyClassName="gap-1.5"
      titleClassName="text-[11px] leading-4"
      descriptionClassName="text-[9px] leading-3"
      iconClassName="size-3.5"
      iconWrapperClassName="size-6"
    />
  );
}

function AttachmentCaptureButton({
  kind,
  icon: Icon,
  label,
  file,
  required,
  onChange,
}: {
  kind: BuybackAttachmentKind;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  file?: File;
  required?: boolean;
  onChange: (kind: BuybackAttachmentKind, file?: File) => void;
}) {
  const inputId = `buyback-${kind}`;
  return (
    <div className="min-w-0 space-y-1">
      <RepairOsBusinessCard
        as="label"
        className={cn(repairOs.businessCardDense, "min-h-11 cursor-pointer rounded-lg px-2 py-1.5")}
        leading={
          <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-3.5" />
          </span>
        }
      >
        <span className="block truncate text-[11px] font-semibold leading-4">
          {label}
          {required ? <span className="ml-0.5 text-status-danger-foreground">*</span> : null}
        </span>
        <span className="block truncate text-[9px] leading-3 text-muted-foreground">
          {file ? file.name : "点击拍照/选择"}
        </span>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          className="sr-only"
          onChange={(event) => onChange(kind, event.currentTarget.files?.[0])}
        />
      </RepairOsBusinessCard>
      {file ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-5 px-1 text-[10px] leading-3 text-muted-foreground"
          onClick={() => onChange(kind, undefined)}
        >
          重新选择
        </Button>
      ) : null}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  prefix,
  suffix,
  className,
  hideLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  prefix?: string;
  suffix?: string;
  className?: string;
  hideLabel?: boolean;
}) {
  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      {!hideLabel ? <Label className="text-[10px] text-muted-foreground">{label}</Label> : null}
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          className={cn(
            "h-11 rounded-lg px-2 text-base md:text-sm",
            prefix && "pl-5",
            suffix && "pr-7",
          )}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <RepairOsBusinessCard
      as="button"
      type="button"
      aria-pressed={checked}
      className={cn(
        repairOs.businessCardDense,
        "min-h-11 rounded-lg px-2 py-1.5 text-left text-[11px] leading-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        checked
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-[var(--border-panel)] bg-card text-foreground",
      )}
      bodyClassName="min-w-0"
      trailingClassName="flex justify-end"
      trailing={
        <span className="grid size-4 shrink-0 place-items-center rounded-full border border-current">
          {checked ? <CheckCircle2 className="size-3" /> : null}
        </span>
      }
      onClick={() => onChange(!checked)}
    >
      <span className="truncate">{label}</span>
    </RepairOsBusinessCard>
  );
}

function IPhoneSeriesPicker({
  groups,
  value,
  onChange,
}: {
  groups: AppleIPhoneSeriesGroup[];
  value: string;
  onChange: (value: string) => void;
}) {
  const activeGroup = groups.find((group) => group.key === value);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] font-medium text-foreground">选择系列</Label>
        <span className="truncate text-[9px] leading-3 text-muted-foreground">
          {activeGroup ? `当前：${activeGroup.label}` : "先选代际，再选型号"}
        </span>
      </div>
      <div className="-mx-1 overflow-hidden">
        <div className="grid grid-cols-2 gap-1 px-1 pb-1 sm:grid-cols-4">
          {groups.map((group) => {
            const selected = value === group.key;
            const years = group.models.map((model) => model.releaseYear);
            const minYear = Math.min(...years);
            const maxYear = Math.max(...years);
            const yearLabel =
              minYear === maxYear
                ? `${minYear}`
                : `${String(minYear).slice(2)}-${String(maxYear).slice(2)}`;

            return (
              <RepairOsBusinessCard
                key={group.key}
                as="button"
                type="button"
                aria-pressed={selected}
                className={cn(
                  repairOs.businessCardDense,
                  "min-h-[46px] min-w-0 rounded-lg px-2 py-1.5 text-center transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  selected &&
                    "border-primary/50 bg-primary/10 text-primary shadow-[var(--shadow-action)]",
                )}
                bodyClassName="min-w-0"
                onClick={() => onChange(group.key)}
              >
                <span className="flex min-w-0 items-center justify-center gap-1 leading-3">
                  <span className="truncate text-[11px] font-semibold">{group.label}</span>
                  {selected ? <CheckCircle2 className="size-3.5 shrink-0 text-primary" /> : null}
                </span>
                <span className="mt-1 block truncate text-[9px] leading-3 text-muted-foreground">
                  {group.models.length} 款 · {yearLabel}
                </span>
              </RepairOsBusinessCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ChoiceGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="flex min-w-0 flex-wrap gap-1">
        {options.map(([option, text]) => (
          <RepairOsBusinessCard
            key={option}
            as="button"
            type="button"
            aria-pressed={value === option}
            className={cn(
              repairOs.businessCardDense,
              "h-11 shrink-0 rounded-lg px-2.5 py-0 text-[12px] font-medium text-muted-foreground transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              value === option && "border-primary/40 bg-primary/10 text-primary",
            )}
            bodyClassName="flex min-w-0 items-center justify-center gap-1.5"
            onClick={() => onChange(option)}
          >
            {value === option ? <CheckCircle2 className="size-3.5" /> : null}
            {text}
          </RepairOsBusinessCard>
        ))}
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <RepairOsInfoLine label={label} value={value} className="mt-1" />;
}

function inspectionToneClass(tone: "success" | "warn" | "danger" | "neutral") {
  if (tone === "success") return "bg-status-success text-status-success-foreground";
  if (tone === "warn") return "bg-status-warn text-status-warn-foreground";
  if (tone === "danger") return "bg-status-danger text-status-danger-foreground";
  return "bg-status-neutral text-status-neutral-foreground";
}
