"use client";

import {
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import type { InventoryV2IdentifierInput } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import type {
  InventoryFieldName,
  InventoryIdentifierCandidate,
  InventoryRecognition,
} from "@/shared/lib/inventory-recognition/contracts";
import {
  INVENTORY_CLIENT_PIPELINE_TIMEOUT_MS,
  prepareInventoryImage,
  type PreparedInventoryImage,
} from "@/shared/lib/inventory-recognition/inventory-image";
import { recognizeInventoryImageLocally } from "@/shared/lib/inventory-recognition/inventory-local-recognition";

const acceptedImages = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const fields = ["brand", "model", "color", "ram_capacity", "storage_capacity"] as const;
const fieldLabels: Record<InventoryFieldName, string> = {
  brand: "品牌",
  model: "型号",
  color: "颜色",
  ram_capacity: "内存",
  storage_capacity: "容量",
};
type VisionDraftStatus = "idle" | "preparing" | "local" | "ready" | "error";

const identifierKindPriority: Record<InventoryIdentifierCandidate["type"], number> = {
  imei1: 0,
  imei2: 1,
  serial: 2,
  ean: 3,
  sku: 4,
  unknown: 5,
};

function prioritizeIdentifierCandidates(identifiers: InventoryIdentifierCandidate[]) {
  return identifiers
    .map((candidate, index) => ({ candidate, index }))
    .sort(
      (left, right) =>
        identifierKindPriority[left.candidate.type] -
          identifierKindPriority[right.candidate.type] || left.index - right.index,
    );
}

export type InventoryV2VisionDraft = Partial<Record<InventoryFieldName, string>> & {
  identifiers: InventoryV2IdentifierInput[];
};

export function InventoryV2VisionDraftCard({
  enabled,
  onApply,
}: {
  enabled: boolean;
  onApply: (draft: InventoryV2VisionDraft) => void;
}) {
  const [prepared, setPrepared] = useState<PreparedInventoryImage | null>(null);
  const [recognition, setRecognition] = useState<InventoryRecognition | null>(null);
  const [selectedFields, setSelectedFields] = useState<InventoryFieldName[]>([]);
  const [selectedIdentifiers, setSelectedIdentifiers] = useState<number[]>([]);
  const [primaryIdentifierIndex, setPrimaryIdentifierIndex] = useState<number | null>(null);
  const [revealedIdentifiers, setRevealedIdentifiers] = useState<number[]>([]);
  const [status, setStatus] = useState<VisionDraftStatus>("idle");
  const [message, setMessage] = useState("");
  const preparedRef = useRef<PreparedInventoryImage | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const isWorking = status === "preparing" || status === "local";

  const stopRecognition = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const replacePrepared = useCallback((next: PreparedInventoryImage | null) => {
    preparedRef.current?.dispose();
    preparedRef.current = next;
    setPrepared(next);
  }, []);

  const setReviewRecognition = useCallback((next: InventoryRecognition | null) => {
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

    setReviewRecognition(null);

    setStatus("idle");
    setMessage("");
  }, [replacePrepared, setReviewRecognition, stopRecognition]);

  useEffect(
    () => () => {
      stopRecognition();
      preparedRef.current?.dispose();
      preparedRef.current = null;
    },
    [stopRecognition],
  );

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

    const runId = runIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;

    setReviewRecognition(null);

    setStatus("preparing");
    setMessage("第 1/2 步：正在生成仅供本机使用的安全图片…");
    const isCurrent = () =>
      runId === runIdRef.current && abortRef.current === controller && !controller.signal.aborted;
    const pipelineTimeoutId = window.setTimeout(() => {
      if (!isCurrent()) return;
      controller.abort();
      setStatus("error");
      setMessage("图片处理超时，已安全停止。你可以重新选择图片，或直接下一步手工录入。");
    }, INVENTORY_CLIENT_PIPELINE_TIMEOUT_MS);
    try {
      const nextPrepared = await prepareInventoryImage(file);
      if (!isCurrent()) {
        nextPrepared.dispose();
        return;
      }
      replacePrepared(nextPrepared);
      setStatus("local");
      setMessage("第 2/2 步：正在本机读取规格、IMEI 和条码…");
      const [localResult] = await Promise.allSettled([
        recognizeInventoryImageLocally(nextPrepared, { signal: controller.signal }),
      ]);
      if (!isCurrent()) return;
      const local = localResult.status === "fulfilled" ? localResult.value : null;
      setReviewRecognition(local);
      setStatus(local ? "ready" : "error");
      setMessage(
        local
          ? "本地结果已保留，请复核候选；缺失信息可手工补充。"
          : "本地识别未完成，请重试或手工录入。",
      );
    } catch (error) {
      if (!isCurrent()) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "图片识别失败，请手工录入。");
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
    setMessage("已把人工确认的候选带入草稿，尚未入库；价格、成本和来源需手工填写。");
  }

  if (!enabled) {
    return (
      <section className={cn(repairOs.mobileInfoCard, "space-y-2 p-3")}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" /> 本地标签识别
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
            <Sparkles className="size-4 text-primary" /> 本地标签识别（可选）
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            拍摄包装标签，在本机读取规格、IMEI
            和条码；图片不会上传。请复核候选后应用，缺失信息可手工补充。
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
          {status === "error" ? <X className="mt-0.5 size-4 shrink-0 text-destructive" /> : null}
          <span className="min-w-0 break-words">{message}</span>
        </div>
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

function maskIdentifier(value: string) {
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`;
}
