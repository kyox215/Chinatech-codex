"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  Check,
  CircleOff,
  ImagePlus,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  aiInventoryRecognitionSchema,
  type AiInventoryConflict,
  type AiInventoryFieldCandidate,
  type AiInventoryFieldName,
  type AiInventoryIdentifierCandidate,
  type AiInventoryRecognition,
} from "@/features/ai-assistant/model/contracts";
import {
  AI_INVENTORY_CLIENT_PIPELINE_TIMEOUT_MS,
  aiInventoryImageBlobToDataUrl,
  prepareAiInventoryImage,
  type PreparedAiInventoryImage,
} from "@/features/ai-assistant/model/inventory-image";
import { recognizeAiInventoryImageLocally } from "@/features/ai-assistant/model/inventory-local-recognition";
import {
  isLocalInventoryRecognitionSufficient,
  mergeInventoryRecognitions,
} from "@/features/ai-assistant/model/inventory-recognition";
import {
  applyInventoryRecognitionReview,
  createEmptyInventoryIntakeDraft,
  createInventoryRecognitionReview,
  inventoryIntakeDraftToInput,
  type InventoryFieldReview,
  type InventoryIdentifierReview,
  type InventoryIntakeFormDraft,
  type InventoryRecognitionReview,
} from "@/features/inventory/model/inventory-intake-draft";
import { inventoryStatusMeta } from "@/features/inventory/model/inventory-workflow";
import { createInventoryIntake, runAiInventoryVisionRecognition } from "@/lib/repairdesk/api";
import { componentOverlay } from "@/lib/component-patterns";
import { brandGradientStyle, controls, formLayout } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const imageAccept = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const sourceOptions = ["manual_stock", "supplier_purchase", "repair_resale", "buyback"] as const;
const statusOptions = ["listed", "ready_for_sale", "intake"] as const;
const fieldOrder = [
  "brand",
  "model",
  "color",
  "ram_capacity",
  "storage_capacity",
] as const satisfies readonly AiInventoryFieldName[];
const mappedIdentifierTypes = new Set(["imei1", "imei2", "serial"]);
const inputClass = "h-9 min-w-0 text-base sm:text-sm";
const selectClass =
  "h-9 min-w-0 rounded-md border border-[var(--border-panel)] bg-background px-2 text-base text-foreground sm:text-sm";
const dialogContentClass = "gap-0 !flex flex-col !overflow-hidden !p-0";
const dialogHeaderClass = "shrink-0 px-3 pt-3 sm:px-4 sm:pt-4";
const dialogBodyClass = "min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4";
const dialogFooterClass = cn(
  componentOverlay.footer,
  "shrink-0 border-t border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] px-3 py-3 sm:px-4",
);

type AiIntakeStatus =
  | "idle"
  | "preparing"
  | "recognizing"
  | "cloud"
  | "result"
  | "cancelled"
  | "error";

export function InventoryIntakeDialog({
  open,
  defaultWarrantyMonths,
  canUseVisionIntake,
  canApplyInventoryDraft,
  authorityKey,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  defaultWarrantyMonths?: number;
  canUseVisionIntake: boolean;
  canApplyInventoryDraft: boolean;
  authorityKey: string;
  onOpenChange: (open: boolean) => void;
  onDone: (id: string) => void;
}) {
  const [draft, setDraft] = useState(createEmptyInventoryIntakeDraft);
  const [step, setStep] = useState<"form" | "vision">("form");
  const [status, setStatus] = useState<AiIntakeStatus>("idle");
  const [prepared, setPrepared] = useState<PreparedAiInventoryImage | null>(null);
  const [recognition, setRecognition] = useState<AiInventoryRecognition | null>(null);
  const [review, setReview] = useState<InventoryRecognitionReview | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [applySummary, setApplySummary] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const preparedRef = useRef<PreparedAiInventoryImage | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const captureButtonRef = useRef<HTMLButtonElement | null>(null);
  const resultSummaryRef = useRef<HTMLParagraphElement | null>(null);
  const authorityRef = useRef(authorityKey);
  const wasOpenRef = useRef(open);

  const stopRecognition = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const replacePrepared = useCallback((next: PreparedAiInventoryImage | null) => {
    preparedRef.current?.dispose();
    preparedRef.current = next;
    setPrepared(next);
  }, []);

  const resetAiState = useCallback(() => {
    stopRecognition();
    replacePrepared(null);
    setStep("form");
    setStatus("idle");
    setRecognition(null);
    setReview(null);
    setErrorMessage("");
    setApplySummary([]);
  }, [replacePrepared, stopRecognition]);

  const resetDialog = useCallback(() => {
    resetAiState();
    setDraft(createEmptyInventoryIntakeDraft());
  }, [resetAiState]);

  const forceCloseDialog = useCallback(() => {
    resetDialog();
    onOpenChange(false);
  }, [onOpenChange, resetDialog]);

  const mutation = useMutation({
    mutationFn: createInventoryIntake,
    onSuccess: ({ id }) => {
      toast.success("已创建库存记录");
      onDone(id);
      forceCloseDialog();
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const hasUnsavedWork = useMemo(
    () =>
      hasManualDraftChanges(draft) ||
      Boolean(prepared || recognition || review || applySummary.length > 0),
    [applySummary.length, draft, prepared, recognition, review],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true);
        return;
      }
      if (mutation.isPending) return;
      if (
        hasUnsavedWork &&
        !window.confirm("放弃未保存的入库草稿？手工输入、照片和 AI 复核结果都会被清除。")
      ) {
        return;
      }
      forceCloseDialog();
    },
    [forceCloseDialog, hasUnsavedWork, mutation.isPending, onOpenChange],
  );

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (authorityRef.current === authorityKey) return;
    authorityRef.current = authorityKey;
    resetDialog();
    if (open) onOpenChange(false);
  }, [authorityKey, onOpenChange, open, resetDialog]);

  useEffect(() => {
    if (wasOpenRef.current && !open) resetDialog();
    wasOpenRef.current = open;
  }, [open, resetDialog]);

  useEffect(() => {
    if (step !== "vision") return;
    const frame = window.requestAnimationFrame(() => captureButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    if (status !== "result") return;
    const frame = window.requestAnimationFrame(() => resultSummaryRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [status]);

  useEffect(
    () => () => {
      stopRecognition();
      preparedRef.current?.dispose();
      preparedRef.current = null;
    },
    [stopRecognition],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!isOnline) {
        setStatus("error");
        setErrorMessage("当前离线，不会排队上传照片。请继续手工录入。");
        return;
      }
      stopRecognition();
      replacePrepared(null);
      setRecognition(null);
      setReview(null);
      setErrorMessage("");
      setStatus("preparing");
      const runId = runIdRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      const pipelineTimeoutId = window.setTimeout(() => {
        if (controller.signal.aborted || runId !== runIdRef.current) return;
        controller.abort();
        setStatus("error");
        setErrorMessage("图片处理超时，已安全停止。请重新选择照片，或返回手工表单继续录入。");
      }, AI_INVENTORY_CLIENT_PIPELINE_TIMEOUT_MS);

      try {
        const nextPrepared = await prepareAiInventoryImage(file);
        if (controller.signal.aborted || runId !== runIdRef.current) {
          nextPrepared.dispose();
          return;
        }
        replacePrepared(nextPrepared);
        setStatus("recognizing");
        const fixtureKey =
          process.env.NODE_ENV !== "production" &&
          file.name.toLowerCase().includes("synthetic-redmi-a7-pro-box")
            ? ("synthetic-redmi-a7-pro-box" as const)
            : undefined;
        const localResult = await Promise.allSettled([
          recognizeAiInventoryImageLocally(nextPrepared, { signal: controller.signal }),
        ]);
        if (controller.signal.aborted || runId !== runIdRef.current) return;

        const local = localResult[0]?.status === "fulfilled" ? localResult[0].value : null;
        if (local && isLocalInventoryRecognitionSufficient(local)) {
          const resolved = withFallbackWarnings(local, {
            localFailed: false,
            serverFailed: false,
            serverSkipped: true,
          });
          setRecognition(resolved);
          setReview(createInventoryRecognitionReview(resolved));
          setStatus("result");
          return;
        }

        setStatus("cloud");
        const imageDataUrl = await aiInventoryImageBlobToDataUrl(nextPrepared.blob, {
          signal: controller.signal,
        });
        if (controller.signal.aborted || runId !== runIdRef.current) return;
        const serverResult = await Promise.allSettled([
          runAiInventoryVisionRecognition(
            {
              client_request_id: crypto.randomUUID(),
              image_data_url: imageDataUrl,
              mime_type: nextPrepared.mimeType,
              byte_length: nextPrepared.byteLength,
              width: nextPrepared.width,
              height: nextPrepared.height,
              locale: "zh-CN",
              ...(fixtureKey ? { fixture_key: fixtureKey } : {}),
            },
            { signal: controller.signal },
          ),
        ]);
        if (controller.signal.aborted || runId !== runIdRef.current) return;

        const vision =
          serverResult[0]?.status === "fulfilled" ? serverResult[0].value.recognition : null;
        if (!vision && (!local || recognitionCandidateCount(local) === 0)) {
          throw new Error("recognition unavailable");
        }
        const merged = withFallbackWarnings(
          local && vision ? mergeInventoryRecognitions(vision, local) : (vision ?? local)!,
          { localFailed: !local, serverFailed: !vision, serverSkipped: false },
        );
        setRecognition(merged);
        setReview(createInventoryRecognitionReview(merged));
        setStatus("result");
      } catch (error) {
        if (controller.signal.aborted || runId !== runIdRef.current) return;
        setStatus("error");
        setErrorMessage(
          error instanceof Error && error.name !== "Error"
            ? error.message
            : "图片识别未完成，请重试或继续手工录入。",
        );
      } finally {
        window.clearTimeout(pipelineTimeoutId);
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [isOnline, replacePrepared, stopRecognition],
  );

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleFile(file);
  };

  const cancelRecognition = () => {
    stopRecognition();
    setStatus("cancelled");
    setErrorMessage("已取消识别，照片不会排队上传。你可以删除照片或重新识别。");
  };

  const deletePhoto = () => {
    stopRecognition();
    replacePrepared(null);
    setRecognition(null);
    setReview(null);
    setStatus("idle");
    setErrorMessage("");
  };

  const applyPreview = useMemo(
    () => (review ? applyInventoryRecognitionReview(draft, review) : null),
    [draft, review],
  );
  const applyCount = applyPreview
    ? applyPreview.appliedFields.length +
      applyPreview.preservedManualFields.length +
      applyPreview.unmappedFields.length
    : 0;

  const applyReview = () => {
    if (!applyPreview || !canApplyInventoryDraft || applyCount === 0) return;
    const result = applyPreview;
    setDraft(result.draft);
    setApplySummary([
      ...result.appliedFields.map((field) => `已应用：${draftFieldLabel(field)}`),
      ...result.preservedManualFields.map((field) => `保留手工值：${draftFieldLabel(field)}`),
      ...result.unmappedFields.map((field) => `未映射：${draftFieldLabel(field)}`),
    ]);
    setStep("form");
    toast.success("已把确认字段带入表单，尚未保存商品");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate(inventoryIntakeDraftToInput(draft));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(componentOverlay.formContent, dialogContentClass)}>
        {step === "form" ? (
          <form className="flex max-h-[calc(100svh-24px)] min-h-0 flex-col" onSubmit={handleSubmit}>
            <DialogHeader className={cn(componentOverlay.header, dialogHeaderClass)}>
              <DialogTitle className={componentOverlay.title}>新增库存商品</DialogTitle>
              <DialogDescription className={componentOverlay.description}>
                AI 只会填写当前表单草稿；成本、售价与正式保存始终由员工完成。
              </DialogDescription>
            </DialogHeader>
            <div className={cn(dialogBodyClass, "space-y-3")}>
              {canUseVisionIntake ? (
                <section className="min-w-0 rounded-xl border border-status-info-foreground/20 bg-status-info/10 p-3">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <Sparkles className="size-4 text-status-info-foreground" />
                        AI 拍照识别
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        识别包装标签声明，逐字段复核后才可带入表单，不会自动保存。
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5"
                      onClick={() => setStep("vision")}
                    >
                      <Camera className="size-3.5" />
                      {recognition ? "查看识别结果" : "拍照识别"}
                    </Button>
                  </div>
                  {!canApplyInventoryDraft ? (
                    <p className="mt-2 text-[11px] leading-4 text-status-warning-foreground">
                      当前为影子复核模式：可以查看和纠正候选，但不能应用到表单。
                    </p>
                  ) : null}
                </section>
              ) : null}

              {applySummary.length > 0 ? (
                <div
                  className="rounded-xl border border-status-success-foreground/20 bg-status-success/10 px-3 py-2"
                  role="status"
                >
                  <p className="text-xs font-semibold text-status-success-foreground">
                    AI 草稿已回到当前表单，尚未保存
                  </p>
                  <ul className="mt-1 space-y-0.5 text-[11px] leading-4 text-muted-foreground">
                    {applySummary.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-xl border border-status-info-foreground/15 bg-status-info/10 px-3 py-2 text-xs text-status-info-foreground">
                默认作为直接库存商品进入已上架状态；回收设备请选择回收来源并从回收流程补齐报价和凭证。
              </div>
              <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
                <ControlledSelect
                  name="source_type"
                  label="商品来源"
                  value={draft.source_type}
                  options={sourceOptions}
                  optionLabel={inventorySourceLabel}
                  onChange={(value) => updateDraft(setDraft, "source_type", value)}
                />
                <ControlledSelect
                  name="initial_status"
                  label="入库状态"
                  value={draft.initial_status}
                  options={statusOptions}
                  optionLabel={(value) => inventoryStatusMeta[value].label}
                  onChange={(value) => updateDraft(setDraft, "initial_status", value)}
                />
                <ControlledField
                  draft={draft}
                  setDraft={setDraft}
                  name="brand"
                  label="品牌"
                  required
                />
                <ControlledField
                  draft={draft}
                  setDraft={setDraft}
                  name="model"
                  label="型号"
                  required
                />
                <ControlledField draft={draft} setDraft={setDraft} name="category" label="类别" />
                <ControlledField draft={draft} setDraft={setDraft} name="color" label="颜色" />
                <ControlledField
                  draft={draft}
                  setDraft={setDraft}
                  name="storage_capacity"
                  label="容量"
                />
                <ControlledField
                  draft={draft}
                  setDraft={setDraft}
                  name="serial_or_imei"
                  label="IMEI/序列号"
                />
                <ControlledField
                  draft={draft}
                  setDraft={setDraft}
                  name="buyback_price"
                  label="入库成本"
                  type="number"
                  step="0.01"
                />
                <ControlledField
                  draft={draft}
                  setDraft={setDraft}
                  name="repair_cost_amount"
                  label="整备成本"
                  type="number"
                  step="0.01"
                />
                <ControlledField
                  draft={draft}
                  setDraft={setDraft}
                  name="list_price"
                  label="标价"
                  type="number"
                  step="0.01"
                />
                <ControlledField
                  draft={draft}
                  setDraft={setDraft}
                  name="warranty_months"
                  label="默认保修月数"
                  type="number"
                  min="0"
                  step="1"
                  placeholder={
                    defaultWarrantyMonths === undefined
                      ? "留空按当前店铺默认"
                      : `留空按当前店铺默认（${warrantyLabel(defaultWarrantyMonths)}）`
                  }
                  hint="只有手动填写才会覆盖；留空时由服务器读取提交时的店铺默认值。"
                />
                <ControlledField
                  draft={draft}
                  setDraft={setDraft}
                  name="payment_method"
                  label="采购/入库付款方式"
                />
                <ControlledField
                  draft={draft}
                  setDraft={setDraft}
                  name="customer_name"
                  label="来源客户/供应商"
                />
                <ControlledField
                  draft={draft}
                  setDraft={setDraft}
                  name="customer_phone"
                  label="来源电话"
                />
              </div>
              <div className={formLayout.field}>
                <Label htmlFor="inventory-intake-notes">来源、保修或商品备注</Label>
                <Textarea
                  id="inventory-intake-notes"
                  value={draft.notes}
                  className="min-h-20 text-base sm:text-sm"
                  onChange={(event) => updateDraft(setDraft, "notes", event.target.value)}
                />
              </div>
            </div>
            <DialogFooter className={dialogFooterClass}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenChange(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={mutation.isPending}
                className={controls.brandButton}
                style={brandGradientStyle}
              >
                {mutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {mutation.isPending ? "正在保存…" : "保存商品"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex max-h-[calc(100svh-24px)] min-h-0 flex-col">
            <DialogHeader className={cn(componentOverlay.header, dialogHeaderClass)}>
              <DialogTitle className={componentOverlay.title}>AI 拍照识别入库资料</DialogTitle>
              <DialogDescription className={componentOverlay.description}>
                拍清楚标签区域并避开客户、证件和无关背景；原图不会保存到库存。
              </DialogDescription>
            </DialogHeader>
            <div className={cn(dialogBodyClass, "space-y-3")}>
              {!isOnline ? (
                <Notice tone="warning" icon={CircleOff}>
                  当前离线，不会排队上传敏感照片。请返回并继续手工录入。
                </Notice>
              ) : null}
              <Notice tone="info" icon={Sparkles}>
                仅接受 4 MiB 内的静态
                JPG、PNG、WebP；浏览器和服务端都会完整解码、去除元数据并重编码，原图不写入库存。
              </Notice>
              <Notice tone="warning" icon={AlertTriangle}>
                本地识别不足且门店已批准时，衍生图可能发送至 OpenAI；默认安全监控日志可能保留最多 30
                天。
                请只保留品牌、型号、内存/容量规格区域，禁止拍摄人物/人脸、证件、客户资料、收据/地址、设备屏幕内容或设备标识；IMEI/SN
                只使用本地扫描或手工录入，不发送到云端识别。
              </Notice>

              <div className="flex min-w-0 flex-wrap gap-2">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept={imageAccept}
                  capture="environment"
                  className="sr-only"
                  aria-label="使用相机拍摄设备标签"
                  disabled={
                    !isOnline ||
                    status === "preparing" ||
                    status === "recognizing" ||
                    status === "cloud"
                  }
                  onChange={handleFileInput}
                />
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept={imageAccept}
                  className="sr-only"
                  aria-label="从相册选择设备标签照片"
                  disabled={
                    !isOnline ||
                    status === "preparing" ||
                    status === "recognizing" ||
                    status === "cloud"
                  }
                  onChange={handleFileInput}
                />
                <Button
                  ref={captureButtonRef}
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  disabled={
                    !isOnline ||
                    status === "preparing" ||
                    status === "recognizing" ||
                    status === "cloud"
                  }
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="size-3.5" />
                  拍摄标签
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={
                    !isOnline ||
                    status === "preparing" ||
                    status === "recognizing" ||
                    status === "cloud"
                  }
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <ImagePlus className="size-3.5" />
                  选择照片
                </Button>
                {prepared ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={deletePhoto}
                  >
                    <Trash2 className="size-3.5" />
                    删除照片
                  </Button>
                ) : null}
              </div>

              {prepared ? (
                <div className="overflow-hidden rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)]">
                  <img
                    src={prepared.previewUrl}
                    alt="待识别的设备标签预览"
                    className="max-h-56 w-full object-contain"
                  />
                  <p className="border-t border-[var(--border-panel)] px-3 py-1.5 text-[11px] text-muted-foreground">
                    已生成无元数据衍生图 · {prepared.width}×{prepared.height} ·{" "}
                    {formatBytes(prepared.byteLength)}
                  </p>
                </div>
              ) : null}

              {status === "preparing" || status === "recognizing" || status === "cloud" ? (
                <div
                  className="rounded-xl border border-status-info-foreground/20 bg-status-info/10 px-3 py-3"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <p className="flex items-center gap-2 text-sm font-semibold text-status-info-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {status === "preparing"
                      ? "第 1/3 步：正在生成安全图片…"
                      : status === "recognizing"
                        ? "第 2/3 步：正在本地检查标签…"
                        : "第 3/3 步：正在请求云端识别包装规格…"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    关闭或取消后不会在后台排队上传。
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={cancelRecognition}
                  >
                    取消识别
                  </Button>
                </div>
              ) : null}

              {errorMessage ? (
                <Notice tone={status === "cancelled" ? "info" : "warning"} icon={AlertTriangle}>
                  {errorMessage}
                </Notice>
              ) : null}

              {status === "result" && recognition ? (
                <p
                  ref={resultSummaryRef}
                  role="status"
                  aria-live="polite"
                  tabIndex={-1}
                  className="rounded-xl border border-status-success-foreground/20 bg-status-success/10 px-3 py-2 text-xs font-semibold text-status-success-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  识别完成：发现 {recognitionCandidateCount(recognition)} 个候选，请逐字段复核。
                </p>
              ) : null}

              {recognition && review ? (
                <RecognitionReview
                  recognition={recognition}
                  review={review}
                  draft={draft}
                  onReviewChange={setReview}
                />
              ) : null}
            </div>
            <DialogFooter className={dialogFooterClass}>
              <Button type="button" variant="outline" size="sm" onClick={() => setStep("form")}>
                返回手工表单
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!review || !canApplyInventoryDraft || applyCount === 0}
                className={controls.brandButton}
                style={brandGradientStyle}
                onClick={applyReview}
              >
                <Check className="size-3.5" />
                {canApplyInventoryDraft
                  ? applyCount > 0
                    ? `应用 ${applyCount} 个确认字段`
                    : "请先确认至少一个字段"
                  : "影子模式：不可应用"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecognitionReview({
  recognition,
  review,
  draft,
  onReviewChange,
}: {
  recognition: AiInventoryRecognition;
  review: InventoryRecognitionReview;
  draft: InventoryIntakeFormDraft;
  onReviewChange: (review: InventoryRecognitionReview) => void;
}) {
  return (
    <section className="min-w-0 space-y-2" aria-label="AI 字段复核">
      <div className="rounded-xl border border-status-warning-foreground/20 bg-status-warning/10 px-3 py-2">
        <p className="text-xs font-semibold text-status-warning-foreground">仅为包装标签声称值</p>
        <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
          不能证明盒内设备配置、真伪、所有权或实际内存。请核对设备本体后再保存。
        </p>
      </div>

      {recognition.conflicts.length > 0 ? (
        <div className="rounded-xl border border-status-danger-foreground/20 bg-status-danger/10 px-3 py-2">
          <p className="text-xs font-semibold text-status-danger-foreground">发现证据冲突</p>
          <ul className="mt-1 space-y-1 text-[11px] leading-4 text-muted-foreground">
            {recognition.conflicts.map((conflict, index) => (
              <li key={`${conflict.target}-${index}`}>{conflictLabel(conflict)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        {fieldOrder.map((field) => (
          <FieldReviewCard
            key={field}
            field={field}
            candidate={recognition.fields[field]}
            review={review.fields[field]}
            existingValue={field === "ram_capacity" ? "" : draft[mappedDraftField(field)]}
            hasConflict={recognition.conflicts.some((conflict) => conflict.target === field)}
            onChange={(next) =>
              onReviewChange({ ...review, fields: { ...review.fields, [field]: next } })
            }
          />
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">标识符候选</p>
        {review.identifiers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border-panel)] px-3 py-2 text-xs text-muted-foreground">
            未识别到可用 IMEI、序列号或 EAN；请在表单中手工填写。
          </p>
        ) : (
          review.identifiers.map((item, index) => (
            <IdentifierReviewCard
              key={`${item.candidate.type}-${item.candidate.value}-${index}`}
              item={item}
              existingValue={draft.serial_or_imei}
              onChange={(next) =>
                onReviewChange({
                  ...review,
                  identifiers: review.identifiers.map((current, itemIndex) =>
                    itemIndex === index
                      ? next
                      : next.isPrimary
                        ? { ...current, isPrimary: false }
                        : current,
                  ),
                })
              }
            />
          ))
        )}
      </div>

      {recognition.warnings.length > 0 ? (
        <ul className="space-y-1 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2 text-[11px] leading-4 text-muted-foreground">
          {recognition.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function FieldReviewCard({
  field,
  candidate,
  review,
  existingValue,
  hasConflict,
  onChange,
}: {
  field: AiInventoryFieldName;
  candidate: AiInventoryFieldCandidate;
  review: InventoryFieldReview;
  existingValue: string;
  hasConflict: boolean;
  onChange: (review: InventoryFieldReview) => void;
}) {
  const label = fieldLabel(field);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const manualConflict =
    Boolean(existingValue.trim()) && normalize(existingValue) !== normalize(review.value);
  return (
    <article className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2.5">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{label}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            来源：{evidenceSourceLabel(candidate.source)} · 置信：
            {confidenceLabel(candidate.confidence)}
            {hasConflict ? " · 有冲突" : ""}
          </p>
        </div>
        <DecisionBadge decision={review.decision} />
      </div>
      <Input
        ref={inputRef}
        value={review.value}
        aria-label={`${label}识别值`}
        className={cn(inputClass, "mt-2")}
        onChange={(event) => onChange({ ...review, value: event.target.value, decision: "edited" })}
      />
      {candidate.evidence ? (
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
          证据：{candidate.evidence}
        </p>
      ) : null}
      {field === "ram_capacity" ? (
        <p className="mt-1 text-[10px] leading-4 text-status-warning-foreground">
          当前库存表单没有独立 RAM 字段；接受后会列为未映射，不会写入备注。
        </p>
      ) : null}
      {manualConflict ? (
        <label className="mt-2 flex min-w-0 items-start gap-2 text-[11px] leading-4 text-muted-foreground">
          <input
            type="checkbox"
            checked={review.overwriteManual}
            className="mt-0.5"
            onChange={(event) => onChange({ ...review, overwriteManual: event.target.checked })}
          />
          <span className="min-w-0">覆盖当前手工值“{existingValue}”</span>
        </label>
      ) : null}
      <ReviewActions
        label={label}
        review={review}
        onChange={onChange}
        onEdit={() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }}
      />
    </article>
  );
}

function IdentifierReviewCard({
  item,
  existingValue,
  onChange,
}: {
  item: InventoryIdentifierReview;
  existingValue: string;
  onChange: (review: InventoryIdentifierReview) => void;
}) {
  const candidate = item.candidate;
  const label = identifierLabel(candidate);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canBePrimary =
    mappedIdentifierTypes.has(candidate.type) && candidate.validation !== "invalid";
  const manualConflict =
    Boolean(existingValue.trim()) && normalize(existingValue) !== normalize(item.value);
  return (
    <article className="min-w-0 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2.5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{label}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            来源：{evidenceSourceLabel(candidate.source)} · 校验：
            {validationLabel(candidate.validation)} · 置信：
            {confidenceLabel(candidate.confidence)}
          </p>
        </div>
        <DecisionBadge decision={item.decision} />
      </div>
      <Input
        ref={inputRef}
        value={item.value}
        aria-label={`${label}识别值`}
        className={cn(inputClass, "mt-2 font-mono")}
        onChange={(event) => onChange({ ...item, value: event.target.value, decision: "edited" })}
      />
      {candidate.evidence ? (
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
          证据：{candidate.evidence}
        </p>
      ) : null}
      {canBePrimary ? (
        <label className="mt-2 flex items-center gap-2 text-[11px] text-foreground">
          <input
            type="radio"
            name="ai-primary-identifier"
            checked={item.isPrimary}
            onChange={() => onChange({ ...item, isPrimary: true })}
          />
          作为当前表单的主 IMEI / 序列号
        </label>
      ) : (
        <p className="mt-1 text-[10px] leading-4 text-status-warning-foreground">
          此候选不会映射到当前主标识符字段。
        </p>
      )}
      {manualConflict && canBePrimary ? (
        <label className="mt-2 flex min-w-0 items-start gap-2 text-[11px] leading-4 text-muted-foreground">
          <input
            type="checkbox"
            checked={item.overwriteManual}
            className="mt-0.5"
            onChange={(event) => onChange({ ...item, overwriteManual: event.target.checked })}
          />
          <span className="min-w-0">覆盖当前手工主标识符</span>
        </label>
      ) : null}
      <ReviewActions
        label={label}
        review={item}
        onChange={onChange}
        onEdit={() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }}
      />
    </article>
  );
}

function ReviewActions<T extends InventoryFieldReview | InventoryIdentifierReview>({
  label,
  review,
  onChange,
  onEdit,
}: {
  label: string;
  review: T;
  onChange: (review: T) => void;
  onEdit: () => void;
}) {
  return (
    <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-[11px]"
        aria-label={`${label}：接受建议`}
        onClick={() => onChange({ ...review, decision: "accepted" })}
      >
        <Check className="size-3" /> 接受
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-[11px]"
        aria-label={`${label}：编辑识别值`}
        onClick={onEdit}
      >
        <Pencil className="size-3" /> 修改
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-[11px]"
        aria-label={`${label}：清空候选`}
        onClick={() => onChange({ ...review, value: "", decision: "edited" })}
      >
        <Trash2 className="size-3" /> 清空
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-[11px] text-status-danger-foreground"
        aria-label={`${label}：拒绝候选`}
        onClick={() => onChange({ ...review, decision: "rejected" })}
      >
        <X className="size-3" /> 拒绝
      </Button>
    </div>
  );
}

function ControlledField({
  draft,
  setDraft,
  name,
  label,
  hint,
  ...inputProps
}: {
  draft: InventoryIntakeFormDraft;
  setDraft: React.Dispatch<React.SetStateAction<InventoryIntakeFormDraft>>;
  name: keyof InventoryIntakeFormDraft;
  label: string;
  hint?: React.ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "value" | "onChange">) {
  const id = `inventory-intake-${name}`;
  return (
    <div className={formLayout.field}>
      <Label htmlFor={id}>
        {label}
        {inputProps.required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        id={id}
        value={draft[name]}
        className={inputClass}
        onChange={(event) => updateDraft(setDraft, name, event.target.value)}
        {...inputProps}
      />
      {hint ? <p className="text-[10px] leading-4 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ControlledSelect<T extends string>({
  name,
  label,
  value,
  options,
  optionLabel,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly T[];
  optionLabel: (value: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <div className={formLayout.field}>
      <Label htmlFor={`inventory-intake-${name}`}>{label}</Label>
      <select
        id={`inventory-intake-${name}`}
        value={value}
        className={selectClass}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

function Notice({
  tone,
  icon: Icon,
  children,
}: {
  tone: "info" | "warning";
  icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-5",
        tone === "warning"
          ? "border-status-warning-foreground/20 bg-status-warning/10 text-status-warning-foreground"
          : "border-status-info-foreground/20 bg-status-info/10 text-status-info-foreground",
      )}
      role={tone === "warning" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function DecisionBadge({ decision }: { decision: InventoryFieldReview["decision"] }) {
  const labels = { pending: "待复核", accepted: "已接受", edited: "已修改", rejected: "已拒绝" };
  return (
    <span className="shrink-0 rounded-full border border-[var(--border-panel)] bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
      {labels[decision]}
    </span>
  );
}

function withFallbackWarnings(
  recognition: AiInventoryRecognition,
  failures: { localFailed: boolean; serverFailed: boolean; serverSkipped: boolean },
) {
  return aiInventoryRecognitionSchema.parse({
    ...recognition,
    warnings: [
      ...recognition.warnings,
      ...(failures.localFailed ? ["本地 OCR/条码未完成，请加强人工核对。"] : []),
      ...(failures.serverFailed ? ["云端视觉服务未完成，本次仅采用本地候选。"] : []),
      ...(failures.serverSkipped ? ["本地 OCR/条码候选已足够，本次未上传至云端视觉服务。"] : []),
    ].filter((warning, index, values) => values.indexOf(warning) === index),
  });
}

function updateDraft(
  setDraft: React.Dispatch<React.SetStateAction<InventoryIntakeFormDraft>>,
  field: keyof InventoryIntakeFormDraft,
  value: string,
) {
  setDraft((current) => ({ ...current, [field]: value }));
}

function hasManualDraftChanges(draft: InventoryIntakeFormDraft) {
  const pristine = createEmptyInventoryIntakeDraft();
  return (Object.keys(pristine) as Array<keyof InventoryIntakeFormDraft>).some(
    (key) => draft[key] !== pristine[key],
  );
}

function recognitionCandidateCount(recognition: AiInventoryRecognition) {
  return (
    Object.values(recognition.fields).filter((candidate) => candidate.value?.trim()).length +
    recognition.identifiers.length
  );
}

function mappedDraftField(field: AiInventoryFieldName): keyof InventoryIntakeFormDraft {
  return field === "ram_capacity" ? "notes" : field;
}

function fieldLabel(field: AiInventoryFieldName) {
  return {
    brand: "品牌",
    model: "型号",
    color: "颜色",
    ram_capacity: "RAM",
    storage_capacity: "存储容量",
  }[field];
}

function confidenceLabel(value: AiInventoryFieldCandidate["confidence"]) {
  return { high: "高（仍需确认）", review: "需复核", unknown: "未知" }[value];
}

function validationLabel(value: AiInventoryIdentifierCandidate["validation"]) {
  return { valid: "格式有效", invalid: "无效，不可作主标识", not_applicable: "不适用" }[value];
}

function identifierLabel(candidate: AiInventoryIdentifierCandidate) {
  return {
    imei1: "IMEI 1",
    imei2: "IMEI 2",
    serial: "序列号",
    ean: "EAN / GTIN",
    sku: "SKU",
    unknown: "未知数字候选",
  }[candidate.type];
}

function conflictLabel(conflict: AiInventoryConflict) {
  return `${draftFieldLabel(conflict.target)}：${conflict.values.join(" / ")}（请人工选择）`;
}

function draftFieldLabel(field: string) {
  const labels: Record<string, string> = {
    brand: "品牌",
    model: "型号",
    color: "颜色",
    ram_capacity: "RAM",
    storage_capacity: "容量",
    serial_or_imei: "主 IMEI / 序列号",
    identifiers: "标识符",
    "identifier:imei1": "额外 IMEI 1",
    "identifier:imei2": "额外 IMEI 2",
    "identifier:serial": "额外序列号",
    "identifier:ean": "EAN / GTIN",
    "identifier:sku": "SKU",
    "identifier:unknown": "未校验数字候选",
  };
  return labels[field] ?? field;
}

function evidenceSourceLabel(value: AiInventoryFieldCandidate["source"]) {
  const labels: Record<AiInventoryFieldCandidate["source"], string> = {
    vision: "视觉服务",
    ocr: "本地 OCR",
    barcode: "本地条码",
    merged: "多证据合并",
    unknown: "未知",
  };
  return labels[value];
}

function inventorySourceLabel(value: string) {
  const labels: Record<string, string> = {
    manual_stock: "直接库存",
    supplier_purchase: "供应商采购",
    repair_resale: "维修翻新转售",
    buyback: "客户回收",
  };
  return labels[value] ?? value;
}

function warrantyLabel(months: number) {
  return months <= 0 ? "无保修" : `${months} 月`;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").trim();
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
