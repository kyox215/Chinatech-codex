"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Camera,
  CheckCircle2,
  Crop,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  AiInventoryFieldName,
  AiInventoryIdentifierCandidate,
  AiInventoryRecognition,
} from "@/features/ai-assistant/model/contracts";
import {
  AI_INVENTORY_CLIENT_PIPELINE_TIMEOUT_MS,
  aiInventoryImageBlobToDataUrl,
  cropPreparedAiInventoryImage,
  prepareAiInventoryImage,
  type AiInventoryNormalizedCrop,
  type PreparedAiInventoryImage,
} from "@/features/ai-assistant/model/inventory-image";
import { recognizeAiInventoryImageLocally } from "@/features/ai-assistant/model/inventory-local-recognition";
import {
  isLocalInventoryRecognitionSufficient,
  mergeInventoryRecognitions,
} from "@/features/ai-assistant/model/inventory-recognition";
import { runAiInventoryVisionRecognition } from "@/lib/repairdesk/api";
import type { InventoryV2IdentifierInput } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

const acceptedImages = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const fields = ["brand", "model", "color", "ram_capacity", "storage_capacity"] as const;
const fieldLabels: Record<AiInventoryFieldName, string> = {
  brand: "品牌",
  model: "型号",
  color: "颜色",
  ram_capacity: "内存",
  storage_capacity: "容量",
};
type VisionDraftStatus =
  | "idle"
  | "preparing"
  | "local"
  | "crop"
  | "cropping"
  | "cloud"
  | "ready"
  | "error";

const initialSpecCrop: AiInventoryNormalizedCrop = {
  x: 0.04,
  y: 0.04,
  width: 0.92,
  height: 0.48,
};

const identifierKindPriority: Record<AiInventoryIdentifierCandidate["type"], number> = {
  imei1: 0,
  imei2: 1,
  serial: 2,
  ean: 3,
  sku: 4,
  unknown: 5,
};

function prioritizeIdentifierCandidates(identifiers: AiInventoryIdentifierCandidate[]) {
  return identifiers
    .map((candidate, index) => ({ candidate, index }))
    .sort(
      (left, right) =>
        identifierKindPriority[left.candidate.type] -
          identifierKindPriority[right.candidate.type] || left.index - right.index,
    );
}

export type InventoryV2VisionDraft = Partial<Record<AiInventoryFieldName, string>> & {
  identifiers: InventoryV2IdentifierInput[];
};

export function InventoryV2VisionDraftCard({
  enabled,
  onApply,
}: {
  enabled: boolean;
  onApply: (draft: InventoryV2VisionDraft) => void;
}) {
  const [prepared, setPrepared] = useState<PreparedAiInventoryImage | null>(null);
  const [cloudCrop, setCloudCrop] = useState<PreparedAiInventoryImage | null>(null);
  const [specCrop, setSpecCrop] = useState<AiInventoryNormalizedCrop>(initialSpecCrop);
  const [cropConfirmed, setCropConfirmed] = useState(false);
  const [localRecognition, setLocalRecognition] = useState<AiInventoryRecognition | null>(null);
  const [recognition, setRecognition] = useState<AiInventoryRecognition | null>(null);
  const [selectedFields, setSelectedFields] = useState<AiInventoryFieldName[]>([]);
  const [selectedIdentifiers, setSelectedIdentifiers] = useState<number[]>([]);
  const [primaryIdentifierIndex, setPrimaryIdentifierIndex] = useState<number | null>(null);
  const [revealedIdentifiers, setRevealedIdentifiers] = useState<number[]>([]);
  const [online, setOnline] = useState(true);
  const [status, setStatus] = useState<VisionDraftStatus>("idle");
  const [message, setMessage] = useState("");
  const preparedRef = useRef<PreparedAiInventoryImage | null>(null);
  const cloudCropRef = useRef<PreparedAiInventoryImage | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const isWorking =
    status === "preparing" || status === "local" || status === "cropping" || status === "cloud";

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

  const replaceCloudCrop = useCallback((next: PreparedAiInventoryImage | null) => {
    cloudCropRef.current?.dispose();
    cloudCropRef.current = next;
    setCloudCrop(next);
  }, []);

  const setReviewRecognition = useCallback((next: AiInventoryRecognition | null) => {
    setRecognition(next);
    const nextFields = next ? fields.filter((field) => Boolean(next.fields[field].value)) : [];
    const nextIdentifiers = next
      ? prioritizeIdentifierCandidates(next.identifiers)
          .filter(
            ({ candidate }) => candidate.type !== "unknown" && candidate.validation !== "invalid",
          )
          .map(({ index }) => index)
      : [];
    setSelectedFields(nextFields);
    setSelectedIdentifiers(nextIdentifiers);
    setPrimaryIdentifierIndex(nextIdentifiers[0] ?? null);
    setRevealedIdentifiers([]);
  }, []);

  const resetRecognition = useCallback(() => {
    stopRecognition();
    replacePrepared(null);
    replaceCloudCrop(null);
    setLocalRecognition(null);
    setReviewRecognition(null);
    setSpecCrop(initialSpecCrop);
    setCropConfirmed(false);
    setStatus("idle");
    setMessage("");
  }, [replaceCloudCrop, replacePrepared, setReviewRecognition, stopRecognition]);

  useEffect(
    () => () => {
      stopRecognition();
      preparedRef.current?.dispose();
      preparedRef.current = null;
      cloudCropRef.current?.dispose();
      cloudCropRef.current = null;
    },
    [stopRecognition],
  );

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!enabled) resetRecognition();
  }, [enabled, resetRecognition]);

  const identifierCandidates = useMemo(
    () => prioritizeIdentifierCandidates(recognition?.identifiers ?? []),
    [recognition],
  );
  const validIdentifiers = useMemo(
    () =>
      identifierCandidates.filter(
        ({ candidate }) => candidate.type !== "unknown" && candidate.validation !== "invalid",
      ),
    [identifierCandidates],
  );

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    stopRecognition();
    replacePrepared(null);
    replaceCloudCrop(null);
    const runId = runIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setLocalRecognition(null);
    setReviewRecognition(null);
    setSpecCrop(initialSpecCrop);
    setCropConfirmed(false);
    setStatus("preparing");
    setMessage("第 1/2 步：正在生成仅供本机使用的安全图片…");
    const isCurrent = () =>
      runId === runIdRef.current && abortRef.current === controller && !controller.signal.aborted;
    const pipelineTimeoutId = window.setTimeout(() => {
      if (!isCurrent()) return;
      controller.abort();
      setStatus("error");
      setMessage("图片处理超时，已安全停止。你可以重新选择图片，或直接下一步手工录入。");
    }, AI_INVENTORY_CLIENT_PIPELINE_TIMEOUT_MS);
    try {
      const nextPrepared = await prepareAiInventoryImage(file);
      if (!isCurrent()) {
        nextPrepared.dispose();
        return;
      }
      replacePrepared(nextPrepared);
      setStatus("local");
      setMessage("第 2/2 步：正在本机读取规格、IMEI 和条码…");
      const [localResult] = await Promise.allSettled([
        recognizeAiInventoryImageLocally(nextPrepared, { signal: controller.signal }),
      ]);
      if (!isCurrent()) return;
      const local = localResult.status === "fulfilled" ? localResult.value : null;
      const localOnly = Boolean(local && isLocalInventoryRecognitionSufficient(local));
      setLocalRecognition(local);
      setReviewRecognition(local);
      if (localOnly && local) {
        setStatus("ready");
        setMessage("本地候选已足够；完整标签未上传，请复核后再应用。");
      } else {
        setStatus("crop");
        setMessage(
          navigator.onLine
            ? "本地结果已保留。规格仍不完整，请调整并预览只含规格的裁剪。"
            : "当前离线：本地结果已保留。可直接应用或下一步手工补充；不会排队上传。",
        );
      }
    } catch (error) {
      if (!isCurrent()) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "图片识别失败，请手工录入。");
    } finally {
      window.clearTimeout(pipelineTimeoutId);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function updateSpecCrop(next: AiInventoryNormalizedCrop) {
    setSpecCrop(next);
    replaceCloudCrop(null);
    setCropConfirmed(false);
    if (status === "crop") {
      setMessage("裁剪范围已变化，请重新生成并检查发送预览。");
    }
  }

  async function prepareCloudCropPreview() {
    const currentPrepared = preparedRef.current;
    if (!currentPrepared) return;
    stopRecognition();
    replaceCloudCrop(null);
    setCropConfirmed(false);
    const runId = runIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("cropping");
    setMessage("正在本机生成只含规格的发送预览…");
    try {
      const nextCrop = await cropPreparedAiInventoryImage(currentPrepared, specCrop, {
        signal: controller.signal,
      });
      const isCurrent =
        runId === runIdRef.current && abortRef.current === controller && !controller.signal.aborted;
      if (!isCurrent) {
        nextCrop.dispose();
        return;
      }
      replaceCloudCrop(nextCrop);
      setCropConfirmed(false);
      setStatus("crop");
      setMessage("请检查发送预览；确认没有 IMEI、SN、EAN 或其他设备标识后才能发送。");
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus("crop");
      setMessage(error instanceof Error ? error.message : "无法生成规格裁剪，请重试。");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  async function runCloudRecognition() {
    const currentCrop = cloudCropRef.current;
    if (!currentCrop || !cropConfirmed) return;
    if (!navigator.onLine) {
      setStatus("crop");
      setMessage("当前离线，不会排队上传。请联网后重试，或直接下一步手工补充。");
      return;
    }
    stopRecognition();
    const runId = runIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("cloud");
    setMessage("正在发送已确认的规格裁剪；本地 IMEI 不会上传…");
    const isCurrent = () =>
      runId === runIdRef.current && abortRef.current === controller && !controller.signal.aborted;
    const pipelineTimeoutId = window.setTimeout(() => {
      if (!isCurrent()) return;
      controller.abort();
      setStatus(localRecognition && hasRecognitionCandidates(localRecognition) ? "ready" : "error");
      setMessage("云端规格识别超时；已保留本地结果，可继续手工录入。");
    }, AI_INVENTORY_CLIENT_PIPELINE_TIMEOUT_MS);
    try {
      const imageDataUrl = await aiInventoryImageBlobToDataUrl(currentCrop.blob, {
        signal: controller.signal,
      });
      if (!isCurrent()) return;
      const response = await runAiInventoryVisionRecognition(
        {
          client_request_id: crypto.randomUUID(),
          image_data_url: imageDataUrl,
          mime_type: currentCrop.mimeType,
          byte_length: currentCrop.byteLength,
          width: currentCrop.width,
          height: currentCrop.height,
          locale: "zh-CN",
        },
        { signal: controller.signal },
      );
      if (!isCurrent()) return;
      const merged = localRecognition
        ? mergeInventoryRecognitions(response.recognition, localRecognition)
        : response.recognition;
      setReviewRecognition(merged);
      setStatus("ready");
      setMessage("规格裁剪与本地标识候选已合并；请逐项核对后再应用。");
    } catch {
      if (!isCurrent()) return;
      if (localRecognition && hasRecognitionCandidates(localRecognition)) {
        setReviewRecognition(localRecognition);
        setStatus("ready");
        setMessage("云端规格识别未完成；已保留本地候选，请核对或手工补充。");
      } else {
        setStatus("error");
        setMessage("图片识别未完成，请重新选择图片，或直接下一步手工录入。");
      }
    } finally {
      window.clearTimeout(pipelineTimeoutId);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function clear() {
    resetRecognition();
  }

  function applySelected() {
    if (!recognition) return;
    const draft: InventoryV2VisionDraft = { identifiers: [] };
    for (const field of selectedFields) {
      const value = recognition.fields[field].value?.trim();
      if (value) draft[field] = value;
    }
    draft.identifiers = validIdentifiers
      .filter(({ index }) => selectedIdentifiers.includes(index))
      .map(({ candidate, index }) => ({
        kind: candidate.type as InventoryV2IdentifierInput["kind"],
        value: candidate.value,
        source: "scan" as const,
        primary: index === primaryIdentifierIndex,
      }));
    onApply(draft);
    setMessage("已把人工确认的候选带入草稿，尚未入库；价格、成本和来源不会由 AI 填写。");
  }

  if (!enabled) {
    return (
      <section className={cn(repairOs.mobileInfoCard, "space-y-2 p-3")}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" /> AI 标签识别
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          当前门店尚未开放图片识别。可继续扫描或手工录入，不影响正式入库。
        </p>
      </section>
    );
  }

  return (
    <section className={cn(repairOs.mobileInfoCard, "space-y-3 p-3 sm:p-4")} aria-busy={isWorking}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> AI 标签识别（可选）
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            拍一次完整包装标签：规格、IMEI、SN、EAN 先在本机读取。完整照片和设备标识绝不发送
            OpenAI；只有你预览并确认的规格裁剪可能发送，安全监控日志最多保留 30
            天。禁止拍摄人物、证件、客户资料、收据、地址或设备屏幕。候选不会自动入库。
          </p>
        </div>
        {prepared ? (
          <Button type="button" variant="ghost" size="icon" onClick={clear} aria-label="删除照片">
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" className="h-9 gap-2" asChild>
          <label>
            <Camera className="size-4" /> 拍完整标签
            <input
              className="sr-only"
              type="file"
              accept={acceptedImages}
              capture="environment"
              disabled={isWorking}
              onChange={handleFile}
            />
          </label>
        </Button>
        <Button type="button" variant="outline" className="h-9 gap-2" asChild>
          <label>
            <ImagePlus className="size-4" /> 选择图片
            <input
              className="sr-only"
              type="file"
              accept={acceptedImages}
              disabled={isWorking}
              onChange={handleFile}
            />
          </label>
        </Button>
      </div>

      {status !== "idle" ? (
        <div
          className="flex min-w-0 gap-2 rounded-xl bg-[var(--surface-panel-muted)] p-2.5 text-xs leading-5"
          role={status === "error" ? "alert" : "status"}
          aria-live={status === "error" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          {isWorking ? <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" /> : null}
          {status === "ready" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-status-success-foreground" />
          ) : null}
          {status === "crop" ? <Crop className="mt-0.5 size-4 shrink-0 text-primary" /> : null}
          {status === "error" ? <X className="mt-0.5 size-4 shrink-0 text-destructive" /> : null}
          <span className="min-w-0 break-words">{message}</span>
        </div>
      ) : null}

      {prepared && ["crop", "cropping", "cloud"].includes(status) ? (
        <SpecCropReview
          prepared={prepared}
          crop={specCrop}
          cloudCrop={cloudCrop}
          confirmed={cropConfirmed}
          online={online}
          status={status}
          onCropChange={updateSpecCrop}
          onPreparePreview={() => void prepareCloudCropPreview()}
          onConfirmedChange={setCropConfirmed}
          onSend={() => void runCloudRecognition()}
        />
      ) : null}

      {recognition ? (
        <div className="space-y-2">
          {fields.map((field) => {
            const candidate = recognition.fields[field];
            if (!candidate.value) return null;
            return (
              <label
                key={field}
                className="flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border-panel)] px-2.5 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedFields.includes(field)}
                  onChange={(event) =>
                    setSelectedFields((current) =>
                      event.target.checked
                        ? [...current, field]
                        : current.filter((item) => item !== field),
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="text-muted-foreground">{fieldLabels[field]}：</span>
                  {candidate.value}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {candidate.confidence === "high" ? "高" : "待核对"}
                </span>
              </label>
            );
          })}
          {identifierCandidates.map(({ candidate, index }) => {
            const selectable = candidate.type !== "unknown" && candidate.validation !== "invalid";
            const selected = selectedIdentifiers.includes(index);
            const revealed = revealedIdentifiers.includes(index);
            return (
              <div
                key={`${candidate.type}-${candidate.value}`}
                className={cn(
                  "grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-3 py-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]",
                  selectable ? "border-[var(--border-panel)]" : "border-destructive/40",
                )}
              >
                <input
                  type="checkbox"
                  aria-label={`${candidate.type === "unknown" ? "疑似标识" : candidate.type}：选择候选`}
                  checked={selected}
                  disabled={!selectable}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...selectedIdentifiers, index]
                      : selectedIdentifiers.filter((item) => item !== index);
                    setSelectedIdentifiers(next);
                    if (event.target.checked && primaryIdentifierIndex === null) {
                      setPrimaryIdentifierIndex(index);
                    } else if (!event.target.checked && primaryIdentifierIndex === index) {
                      setPrimaryIdentifierIndex(next[0] ?? null);
                    }
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] uppercase text-muted-foreground">
                    {candidate.type === "unknown" ? "疑似 IMEI" : candidate.type}
                    {candidate.validation === "invalid" ? " · 未通过校验" : " · 本地识别"}
                  </span>
                  <span className="block break-all font-mono">
                    {revealed ? candidate.value : maskIdentifier(candidate.value)}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={revealed ? "隐藏完整标识" : "查看完整标识"}
                  onClick={() =>
                    setRevealedIdentifiers((current) =>
                      current.includes(index)
                        ? current.filter((item) => item !== index)
                        : [...current, index],
                    )
                  }
                >
                  {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
                {selectable && selected ? (
                  <label className="col-span-3 flex items-center gap-1.5 text-[10px] text-muted-foreground sm:col-span-1">
                    <input
                      type="radio"
                      name="inventory-vision-primary-identifier"
                      checked={primaryIdentifierIndex === index}
                      onChange={() => setPrimaryIdentifierIndex(index)}
                    />
                    主标识
                  </label>
                ) : null}
              </div>
            );
          })}
          {recognition.conflicts.length > 0 ? (
            <div
              className="rounded-xl bg-status-warn p-2.5 text-xs leading-5 text-status-warn-foreground"
              role="alert"
            >
              检测到候选冲突。请取消不正确的项目，并明确选择一个主标识。
            </div>
          ) : null}
          <Button
            type="button"
            className="h-[38px] w-full"
            onClick={applySelected}
            disabled={
              (!selectedFields.length && !selectedIdentifiers.length) ||
              (selectedIdentifiers.length > 0 && primaryIdentifierIndex === null)
            }
          >
            确认并应用所选候选
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function SpecCropReview({
  prepared,
  crop,
  cloudCrop,
  confirmed,
  online,
  status,
  onCropChange,
  onPreparePreview,
  onConfirmedChange,
  onSend,
}: {
  prepared: PreparedAiInventoryImage;
  crop: AiInventoryNormalizedCrop;
  cloudCrop: PreparedAiInventoryImage | null;
  confirmed: boolean;
  online: boolean;
  status: VisionDraftStatus;
  onCropChange: (crop: AiInventoryNormalizedCrop) => void;
  onPreparePreview: () => void;
  onConfirmedChange: (confirmed: boolean) => void;
  onSend: () => void;
}) {
  const widthPercent = Math.round(crop.width * 100);
  const heightPercent = Math.round(crop.height * 100);
  const xPercent = Math.round(crop.x * 100);
  const yPercent = Math.round(crop.y * 100);
  const controlsDisabled = status === "cropping" || status === "cloud";
  const update = (patch: Partial<AiInventoryNormalizedCrop>) => {
    const width = patch.width ?? crop.width;
    const height = patch.height ?? crop.height;
    onCropChange({
      width,
      height,
      x: Math.max(0, Math.min(patch.x ?? crop.x, 1 - width)),
      y: Math.max(0, Math.min(patch.y ?? crop.y, 1 - height)),
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start gap-2 text-xs leading-5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>完整标签只在本机。蓝框内的规格裁剪是唯一允许发送的图片。</span>
      </div>
      <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg bg-black/5">
        {/* Full-label preview is local-only and is never serialized into the request. */}
        <img
          src={prepared.previewUrl}
          alt="仅在本机显示的完整包装标签"
          className="block h-auto max-h-72 max-w-full"
        />
        <div
          className="pointer-events-none absolute border-2 border-primary bg-primary/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]"
          style={{
            left: `${xPercent}%`,
            top: `${yPercent}%`,
            width: `${widthPercent}%`,
            height: `${heightPercent}%`,
          }}
          aria-hidden="true"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <CropRange
          label="横向位置"
          value={xPercent}
          max={Math.max(0, 100 - widthPercent)}
          disabled={controlsDisabled}
          onChange={(value) => update({ x: value / 100 })}
        />
        <CropRange
          label="纵向位置"
          value={yPercent}
          max={Math.max(0, 100 - heightPercent)}
          disabled={controlsDisabled}
          onChange={(value) => update({ y: value / 100 })}
        />
        <CropRange
          label="裁剪宽度"
          value={widthPercent}
          min={25}
          max={96}
          disabled={controlsDisabled}
          onChange={(value) => update({ width: value / 100 })}
        />
        <CropRange
          label="裁剪高度"
          value={heightPercent}
          min={20}
          max={80}
          disabled={controlsDisabled}
          onChange={(value) => update({ height: value / 100 })}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full gap-2"
        onClick={onPreparePreview}
        disabled={status === "cropping" || status === "cloud"}
      >
        {status === "cropping" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Crop className="size-4" />
        )}
        {cloudCrop ? "重新生成发送预览" : "生成发送预览"}
      </Button>
      {cloudCrop ? (
        <div className="space-y-2 rounded-xl bg-background p-2.5">
          <p className="text-xs font-semibold">将发送给 AI 的图片</p>
          <img
            src={cloudCrop.previewUrl}
            alt="将发送给 AI 的规格裁剪预览"
            className="mx-auto max-h-48 max-w-full rounded-lg object-contain"
          />
          <label className="flex min-h-9 items-start gap-2 rounded-lg border border-[var(--border-panel)] p-2 text-xs leading-5">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(event) => onConfirmedChange(event.target.checked)}
            />
            我已检查：裁剪内只有包装规格，不含 IMEI、SN、EAN、人物或客户资料。
          </label>
          <Button
            type="button"
            className="h-9 w-full"
            onClick={onSend}
            disabled={!confirmed || !online || controlsDisabled}
          >
            {status === "cloud" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {status === "cloud" ? "正在识别规格…" : online ? "确认并识别规格" : "离线，暂不上传"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CropRange({
  label,
  value,
  min = 0,
  max,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid grid-cols-[80px_minmax(0,1fr)_36px] items-center gap-2 text-[11px] text-muted-foreground">
      <span>{label}</span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        value={Math.min(max, Math.max(min, value))}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="text-right tabular-nums">{value}%</span>
    </label>
  );
}

function maskIdentifier(value: string) {
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`;
}

function hasRecognitionCandidates(recognition: AiInventoryRecognition) {
  return (
    fields.some((field) => Boolean(recognition.fields[field].value?.trim())) ||
    recognition.identifiers.some(
      (candidate) => candidate.type !== "unknown" && candidate.validation !== "invalid",
    )
  );
}
