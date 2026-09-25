"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ScanLine } from "lucide-react";
import { ImeiScannerField, normalizeImeiIdentifier } from "@/components/imei-scanner-field";
import {
  extractValidImeiCandidates,
  getPreferredValidImeiCandidate,
} from "@/entities/device/model/imei-candidates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import type { ImeiCandidate } from "@/features/capture/model/barcode-parser";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { getOrderDetailSafeErrorMessage } from "@/features/orders/model/order-detail-i18n";

const imeiOcrImageAccept =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";
const imeiOcrImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const imeiOcrImageExtensionPattern = /\.(?:jpe?g|png|webp|heic|heif)$/i;
const imeiOcrDecodeTimeoutMs = 5_000;

export function ImeiCaptureSheet({
  open,
  value,
  savedValue,
  pending,
  onOpenChange,
  onChange,
  onSave,
}: {
  open: boolean;
  value: string;
  savedValue: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  onSave: () => Promise<void>;
}) {
  const { t } = useLocale();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<"choice" | "barcode" | "ocr">("choice");
  const [scannerToken, setScannerToken] = useState(0);
  const [ocrText, setOcrText] = useState("");
  const [ocrCandidates, setOcrCandidates] = useState<ImeiCandidate[]>([]);
  const [selectedOcrCandidateId, setSelectedOcrCandidateId] = useState("");
  const [ocrPending, setOcrPending] = useState(false);
  const [error, setError] = useState("");
  const selectedOcrCandidate =
    ocrCandidates.find((candidate) => candidate.id === selectedOcrCandidateId) ??
    ocrCandidates[0] ??
    null;

  useEffect(() => {
    if (!open) return;
    setMode("choice");
    setOcrText("");
    setOcrCandidates([]);
    setSelectedOcrCandidateId("");
    setError("");
  }, [open]);

  const chooseBarcode = () => {
    setMode("barcode");
    setError("");
    setScannerToken((current) => current + 1);
  };

  const handleOcrFile = async (file?: File) => {
    if (!file) return;
    const fileError = validateImeiOcrImageFile(file);
    if (fileError) {
      setError(fileError);
      toast.error(fileError);
      return;
    }

    setOcrPending(true);
    setError("");
    setOcrCandidates([]);
    setSelectedOcrCandidateId("");
    try {
      const text = await withImeiOcrTimeout(
        detectTextFromImageFile(file),
        imeiOcrDecodeTimeoutMs,
        "OCR 识别超时",
      );
      const candidates = extractValidImeiCandidates(text, { source: "ocr" });
      setOcrText(candidates.length > 0 ? `已识别到 ${candidates.length} 个有效 IMEI。` : "");
      const candidate = getPreferredValidImeiCandidate(candidates);
      if (!candidate) {
        setError("未自动识别到有效 IMEI。请检查照片清晰度，SN 或 EID 请在对应字段手动输入。");
        return;
      }
      if (candidates.length > 1) {
        setOcrCandidates(candidates);
        setSelectedOcrCandidateId(candidate.id);
        setError(
          candidates.length > 1
            ? "找到多个可能的编号，请选择一个后保存。"
            : "请确认 IMEI 后再填入。",
        );
        return;
      }
      onChange(candidate.value);
    } catch (error) {
      const message = getOrderDetailSafeErrorMessage(error, "ocr", t);
      setError(message);
      toast.error(message);
    } finally {
      setOcrPending(false);
    }
  };

  const save = async () => {
    try {
      await onSave();
    } catch (error) {
      const message = getOrderDetailSafeErrorMessage(error, "imei", t);
      setError(message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[calc(100svh-16px)] rounded-t-xl p-0 sm:mx-auto sm:max-w-xl"
      >
        <div className="flex max-h-[calc(100svh-16px)] min-w-0 flex-col overflow-hidden">
          <SheetHeader className="border-b border-[var(--border-panel)] px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ScanLine className="size-4 text-primary" />
              扫描 IMEI
            </SheetTitle>
            <SheetDescription>
              扫码或 OCR 仅识别通过校验的 15 位 IMEI，不识别 SN 或 EID。
            </SheetDescription>
          </SheetHeader>

          <div className={cn(componentOverlay.body, "space-y-3 pt-3")}>
            <input
              ref={fileInputRef}
              type="file"
              accept={imeiOcrImageAccept}
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void handleOcrFile(file);
              }}
            />

            {mode === "choice" ? (
              <section className={cn(componentOverlay.flatSection, "grid gap-2 p-2.5")}>
                <button
                  type="button"
                  className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-2 text-left"
                  disabled={pending}
                  onClick={chooseBarcode}
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                    <ScanLine className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">扫描二维码 / 条码</span>
                    <span className="block truncate text-[10px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
                      对准 IMEI 条码或序列号二维码，识别后自动填入。
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel)] px-2.5 py-2 text-left"
                  disabled={pending || ocrPending}
                  onClick={() => {
                    setMode("ocr");
                    fileInputRef.current?.click();
                  }}
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-[var(--surface-panel-muted)] text-primary">
                    <Camera className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">OCR 识别文字</span>
                    <span className="block truncate text-[10px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
                      适合没有二维码、只显示数字的设备标签。
                    </span>
                  </span>
                </button>
              </section>
            ) : null}

            {mode === "barcode" ? (
              <section
                className={cn(
                  componentOverlay.flatSection,
                  "space-y-2 p-2.5",
                  pending && "pointer-events-none opacity-60",
                )}
              >
                <ImeiScannerField
                  value={value}
                  onChange={onChange}
                  placeholder="扫描或输入 IMEI"
                  density="compact"
                  showPaste={false}
                  startScannerToken={scannerToken}
                />
                <p className="text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
                  当前入口不显示粘贴按钮；无法识别时可直接手动输入。
                </p>
              </section>
            ) : null}

            {mode === "ocr" ? (
              <section className={cn(componentOverlay.flatSection, "space-y-2 p-2.5")}>
                <div className="grid gap-1">
                  <label className="text-[10px] font-medium text-muted-foreground lg:text-[11px] lg:leading-4">
                    识别结果 / 手动确认
                  </label>
                  <Input
                    value={value}
                    onChange={(event) =>
                      onChange(normalizeImeiIdentifier(event.target.value).value)
                    }
                    disabled={pending}
                    className="h-8 font-mono text-xs"
                    placeholder="拍照识别后会填入这里"
                  />
                </div>
                {ocrText ? (
                  <div className="rounded-lg bg-[var(--surface-panel-muted)] px-2 py-1.5 text-[10px] leading-4 text-muted-foreground lg:text-[11px] lg:leading-4">
                    {ocrText}
                  </div>
                ) : null}
                {ocrCandidates.length > 0 ? (
                  <div className="grid gap-1.5">
                    {ocrCandidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        className={cn(
                          "min-w-0 rounded-lg border px-2 py-1.5 text-left",
                          selectedOcrCandidateId === candidate.id
                            ? "border-primary bg-primary/10"
                            : "border-[var(--border-panel)] bg-[var(--surface-panel-muted)]",
                        )}
                        aria-pressed={selectedOcrCandidateId === candidate.id}
                        onClick={() => setSelectedOcrCandidateId(candidate.id)}
                      >
                        <span className="flex min-w-0 items-center justify-between gap-2">
                          <span className="truncate text-[10px] font-semibold lg:text-[11px] lg:leading-4">
                            {candidate.label}
                          </span>
                          <span className="shrink-0 text-[9px] text-muted-foreground lg:text-[11px] lg:leading-4">
                            {candidate.confidence === "high" ? "高可信" : "需确认"}
                          </span>
                        </span>
                        <span className="mt-0.5 block break-all font-mono text-[10px] lg:text-[11px] lg:leading-4">
                          {candidate.value}
                        </span>
                        {candidate.reason ? (
                          <span className="mt-0.5 block text-[9px] leading-3 text-status-warn-foreground lg:text-[11px] lg:leading-4">
                            {candidate.reason}
                          </span>
                        ) : null}
                      </button>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full rounded-lg text-xs"
                      disabled={!selectedOcrCandidate || pending}
                      onClick={() => {
                        if (selectedOcrCandidate) onChange(selectedOcrCandidate.value);
                      }}
                    >
                      使用选择的编号
                    </Button>
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full rounded-lg text-xs"
                  disabled={pending || ocrPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="mr-1.5 size-3.5" />
                  {ocrPending ? "识别中..." : "重新拍照识别"}
                </Button>
              </section>
            ) : null}

            {error ? (
              <p className="rounded-lg bg-status-danger px-2.5 py-2 text-[10px] leading-4 text-status-danger-foreground lg:text-xs lg:leading-[18px]">
                {error}
              </p>
            ) : null}

            <SheetFooter className={componentOverlay.footer}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={pending}
                onClick={() => {
                  onChange(savedValue);
                  onOpenChange(false);
                }}
              >
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                disabled={pending || ocrPending}
                onClick={() => void save()}
              >
                {pending ? "保存中..." : "保存"}
              </Button>
            </SheetFooter>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function validateImeiOcrImageFile(file: File) {
  if (!imeiOcrImageMimeTypes.has(file.type) && !imeiOcrImageExtensionPattern.test(file.name)) {
    return "仅支持 JPG、PNG、WebP、HEIC 或 HEIF 图片。";
  }
  if (file.size > 8 * 1024 * 1024) {
    return "图片不能超过 8 MB。";
  }
  return "";
}

type BrowserTextDetector = {
  detect: (source: unknown) => Promise<Array<{ rawValue?: string }>>;
};

type BrowserWindowWithTextDetector = Window & {
  TextDetector?: new () => BrowserTextDetector;
};

async function detectTextFromImageFile(file: File) {
  const TextDetectorCtor = (window as BrowserWindowWithTextDetector).TextDetector;
  if (!TextDetectorCtor) {
    throw new Error("当前浏览器暂不支持本机 OCR。请改用二维码/条码扫描或手动输入。");
  }

  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = imageUrl;
    await image.decode();
    const detector = new TextDetectorCtor();
    const results = await detector.detect(image);
    return results
      .map((item) => item.rawValue?.trim())
      .filter((item): item is string => Boolean(item))
      .join(" ");
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function withImeiOcrTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
