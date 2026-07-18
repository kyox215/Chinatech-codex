"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Camera, CheckCircle2, ImagePlus, Loader2, Sparkles, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  AiInventoryFieldName,
  AiInventoryRecognition,
} from "@/features/ai-assistant/model/contracts";
import {
  aiInventoryImageBlobToDataUrl,
  prepareAiInventoryImage,
  type PreparedAiInventoryImage,
} from "@/features/ai-assistant/model/inventory-image";
import { recognizeAiInventoryImageLocally } from "@/features/ai-assistant/model/inventory-local-recognition";
import { mergeInventoryRecognitions } from "@/features/ai-assistant/model/inventory-recognition";
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
  const [recognition, setRecognition] = useState<AiInventoryRecognition | null>(null);
  const [selectedFields, setSelectedFields] = useState<AiInventoryFieldName[]>([]);
  const [selectedIdentifiers, setSelectedIdentifiers] = useState<number[]>([]);
  const [status, setStatus] = useState<"idle" | "working" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      prepared?.dispose();
    },
    [prepared],
  );

  const validIdentifiers = useMemo(
    () =>
      (recognition?.identifiers ?? [])
        .map((candidate, index) => ({ candidate, index }))
        .filter(
          ({ candidate }) => candidate.type !== "unknown" && candidate.validation !== "invalid",
        ),
    [recognition],
  );

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!navigator.onLine) {
      setStatus("error");
      setMessage("当前离线，不会上传照片。请继续手工录入。");
      return;
    }
    abortRef.current?.abort();
    prepared?.dispose();
    const controller = new AbortController();
    abortRef.current = controller;
    setPrepared(null);
    setRecognition(null);
    setStatus("working");
    setMessage("正在移除照片元数据并识别标签…");
    try {
      const nextPrepared = await prepareAiInventoryImage(file);
      if (controller.signal.aborted) {
        nextPrepared.dispose();
        return;
      }
      setPrepared(nextPrepared);
      const imageDataUrl = await aiInventoryImageBlobToDataUrl(nextPrepared.blob);
      const [localResult, serverResult] = await Promise.allSettled([
        recognizeAiInventoryImageLocally(nextPrepared, { signal: controller.signal }),
        runAiInventoryVisionRecognition(
          {
            image_data_url: imageDataUrl,
            mime_type: nextPrepared.mimeType,
            byte_length: nextPrepared.byteLength,
            width: nextPrepared.width,
            height: nextPrepared.height,
            locale: "zh-CN",
          },
          { signal: controller.signal },
        ),
      ]);
      if (controller.signal.aborted) return;
      const local = localResult.status === "fulfilled" ? localResult.value : null;
      const server = serverResult.status === "fulfilled" ? serverResult.value.recognition : null;
      if (!local && !server) throw new Error("识别服务暂不可用");
      const merged =
        local && server ? mergeInventoryRecognitions(server, local) : (server ?? local)!;
      setRecognition(merged);
      setSelectedFields(fields.filter((field) => Boolean(merged.fields[field].value)));
      setSelectedIdentifiers(
        merged.identifiers
          .map((candidate, index) => ({ candidate, index }))
          .filter(
            ({ candidate }) => candidate.type !== "unknown" && candidate.validation !== "invalid",
          )
          .map(({ index }) => index),
      );
      setStatus("ready");
      setMessage("AI 仅生成候选，请取消不正确的项目后再确认应用。");
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "图片识别失败，请手工录入。");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function clear() {
    abortRef.current?.abort();
    prepared?.dispose();
    setPrepared(null);
    setRecognition(null);
    setSelectedFields([]);
    setSelectedIdentifiers([]);
    setStatus("idle");
    setMessage("");
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
      .map(({ candidate }, index) => ({
        kind: candidate.type as InventoryV2IdentifierInput["kind"],
        value: candidate.value,
        source: "ai_confirmed" as const,
        primary: index === 0,
      }));
    onApply(draft);
    setMessage("已应用人工确认的候选；价格、成本和来源不会由 AI 填写。");
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
    <section className={cn(repairOs.mobileInfoCard, "space-y-3 p-3 sm:p-4")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> AI 标签识别（可选）
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            照片会先去除元数据；识别结果不会自动写入库存。
          </p>
        </div>
        {prepared ? (
          <Button type="button" variant="ghost" size="icon" onClick={clear} aria-label="删除照片">
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" className="h-11 gap-2" asChild>
          <label>
            <Camera className="size-4" /> 手机拍照
            <input
              className="sr-only"
              type="file"
              accept={acceptedImages}
              capture="environment"
              onChange={handleFile}
            />
          </label>
        </Button>
        <Button type="button" variant="outline" className="h-11 gap-2" asChild>
          <label>
            <ImagePlus className="size-4" /> 选择图片
            <input className="sr-only" type="file" accept={acceptedImages} onChange={handleFile} />
          </label>
        </Button>
      </div>

      {status !== "idle" ? (
        <div className="flex gap-2 rounded-xl bg-[var(--surface-panel-muted)] p-2.5 text-xs leading-5">
          {status === "working" ? (
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
          ) : null}
          {status === "ready" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-status-success-foreground" />
          ) : null}
          {status === "error" ? <X className="mt-0.5 size-4 shrink-0 text-destructive" /> : null}
          <span>{message}</span>
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
                className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border-panel)] px-3 py-2 text-sm"
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
          {validIdentifiers.map(({ candidate, index }) => (
            <label
              key={`${candidate.type}-${candidate.value}`}
              className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border-panel)] px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selectedIdentifiers.includes(index)}
                onChange={(event) =>
                  setSelectedIdentifiers((current) =>
                    event.target.checked
                      ? [...current, index]
                      : current.filter((item) => item !== index),
                  )
                }
              />
              <span className="min-w-0 flex-1">
                <span className="uppercase text-muted-foreground">{candidate.type}：</span>
                {candidate.value}
              </span>
            </label>
          ))}
          <Button
            type="button"
            className="h-11 w-full"
            onClick={applySelected}
            disabled={!selectedFields.length && !selectedIdentifiers.length}
          >
            确认并应用所选候选
          </Button>
        </div>
      ) : null}
    </section>
  );
}
