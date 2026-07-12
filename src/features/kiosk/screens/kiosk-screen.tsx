"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPenLine,
  Loader2,
  RefreshCw,
  TabletSmartphone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  KioskPairResult,
  KioskPublicSession,
  KioskSessionSubmitInput,
} from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

const tokenStorageKey = "repairdesk:kiosk-token";

export function KioskScreen() {
  const [token, setToken] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [pairingError, setPairingError] = useState("");
  const [pairingPending, setPairingPending] = useState(false);
  const [session, setSession] = useState<KioskPublicSession | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setToken(window.localStorage.getItem(tokenStorageKey) ?? "");
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const next = await fetchKioskSession(token);
        if (!cancelled) {
          setSession(next);
          if (next?.session.status === "returned") setSubmitted(false);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "读取任务失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [token, submitted]);

  const pair = async (event: FormEvent) => {
    event.preventDefault();
    setPairingPending(true);
    setPairingError("");
    try {
      const result = await postKioskJson<KioskPairResult>("/api/kiosk/pair", {
        code: pairingCode,
      });
      window.localStorage.setItem(tokenStorageKey, result.token);
      setToken(result.token);
      setPairingCode("");
    } catch (error) {
      setPairingError(error instanceof Error ? error.message : "配对失败");
    } finally {
      setPairingPending(false);
    }
  };

  if (!token) {
    return (
      <main className="grid min-h-dvh bg-background px-4 py-6 text-foreground">
        <form
          onSubmit={pair}
          className="mx-auto grid w-full max-w-md place-self-center gap-4 rounded-xl border border-[var(--border-panel)] bg-card p-5 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
              <TabletSmartphone className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold">Customer Kiosk</h1>
              <p className="text-sm text-muted-foreground">
                Inserisci il codice fornito dallo staff.
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pairing-code">Codice iPad</Label>
            <Input
              id="pairing-code"
              autoComplete="one-time-code"
              className="h-12 text-center text-lg font-semibold tracking-[0.2em]"
              value={pairingCode}
              onChange={(event) => setPairingCode(event.target.value.toUpperCase())}
            />
          </div>
          {pairingError ? (
            <p
              role="alert"
              className="rounded-lg bg-status-danger/10 px-3 py-2 text-sm text-status-danger-foreground"
            >
              {pairingError}
            </p>
          ) : null}
          <Button type="submit" className="h-11" disabled={pairingPending}>
            {pairingPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Collega iPad
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background px-3 py-4 text-foreground sm:px-6 sm:py-6">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)] gap-4">
        <header className="flex min-w-0 items-center justify-between gap-3 border-b border-border pb-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">{session?.store.name ?? "Negozio"}</p>
            <h1 className="truncate text-xl font-semibold">Customer Kiosk</h1>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            onClick={() => {
              setSubmitted(false);
              void fetchKioskSession(token)
                .then((next) => {
                  setSession(next);
                  if (next?.session.status === "returned") setSubmitted(false);
                  setLoadError("");
                })
                .catch((error) =>
                  setLoadError(error instanceof Error ? error.message : "读取任务失败"),
                );
            }}
            aria-label="刷新任务"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </header>

        <section className="grid min-h-0 place-items-center">
          {(submitted && session?.session.status !== "returned") ||
          session?.session.status === "submitted" ? (
            <DoneState />
          ) : session ? (
            <KioskSessionForm
              token={token}
              session={session}
              onSubmitted={() => {
                setSubmitted(true);
                setSession((current) =>
                  current
                    ? {
                        ...current,
                        session: {
                          ...current.session,
                          status: "submitted",
                          submitted_at: new Date().toISOString(),
                        },
                      }
                    : current,
                );
              }}
            />
          ) : (
            <WaitingState loading={loading} error={loadError} />
          )}
        </section>
      </div>
    </main>
  );
}

function WaitingState({ loading, error }: { loading: boolean; error: string }) {
  return (
    <div className="grid w-full max-w-md gap-3 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
        {loading ? (
          <Loader2 className="size-6 animate-spin" />
        ) : (
          <TabletSmartphone className="size-6" />
        )}
      </span>
      <h2 className="text-xl font-semibold">Attendere lo staff</h2>
      <p className="text-sm text-muted-foreground">
        Quando lo staff invia un modulo, apparira qui.
      </p>
      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-status-warn/30 px-3 py-2 text-sm text-status-warn-foreground"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DoneState() {
  return (
    <div className="grid w-full max-w-md gap-3 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-status-success text-status-success-foreground">
        <CheckCircle2 className="size-8" />
      </span>
      <h2 className="text-2xl font-semibold">Modulo inviato</h2>
      <p className="text-sm text-muted-foreground">Grazie. Restituisci l'iPad allo staff.</p>
    </div>
  );
}

function KioskSessionForm({
  token,
  session,
  onSubmitted,
}: {
  token: string;
  session: KioskPublicSession;
  onSubmitted: () => void;
}) {
  const signatureRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const requiresContact = session.session.session_type !== "pickup_signature";
  const [form, setForm] = useState<KioskSessionSubmitInput>({
    customer_name: session.order?.customer_name ?? "",
    customer_phone: session.order?.customer_phone ?? "",
    preferred_channel: "whatsapp",
    language: "it",
    confirmation_checked: false,
  });
  const [hasSignature, setHasSignature] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (requiresContact && (!form.customer_name?.trim() || !form.customer_phone?.trim())) {
      setError("Inserisci nome e telefono.");
      return;
    }
    if (!form.confirmation_checked) {
      setError("Conferma prima di inviare.");
      return;
    }
    setPending(true);
    try {
      const signature = hasSignature ? signatureRef.current?.toDataURL("image/png") : undefined;
      await postKioskJson(
        "/api/kiosk/session/submit",
        {
          ...form,
          signature_data_url: signature,
        },
        token,
      );
      onSubmitted();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Invio non riuscito");
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="grid w-full gap-4 rounded-xl border border-[var(--border-panel)] bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
    >
      <div className="grid gap-1">
        <p className="text-sm font-medium text-primary">
          {session.session.session_type === "pickup_signature" ? "Conferma ritiro" : "Dati cliente"}
        </p>
        <h2 className="text-xl font-semibold">
          {session.order?.public_no ? `Ordine ${session.order.public_no}` : "Modulo cliente"}
        </h2>
        {session.order?.device_label ? (
          <p className="text-sm text-muted-foreground">{session.order.device_label}</p>
        ) : null}
      </div>

      {session.session.status === "returned" ? (
        <p className="inline-flex items-start gap-2 rounded-lg bg-status-warn/25 px-3 py-2 text-sm text-status-warn-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Lo staff ha richiesto una correzione. Controlla i dati e invia di nuovo.
        </p>
      ) : null}

      {requiresContact ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <KioskField label="Nome" htmlFor="customer-name">
            <Input
              id="customer-name"
              className="h-11"
              value={form.customer_name ?? ""}
              onChange={(event) =>
                setForm((current) => ({ ...current, customer_name: event.target.value }))
              }
            />
          </KioskField>
          <KioskField label="Telefono" htmlFor="customer-phone">
            <Input
              id="customer-phone"
              className="h-11"
              inputMode="tel"
              value={form.customer_phone ?? ""}
              onChange={(event) =>
                setForm((current) => ({ ...current, customer_phone: event.target.value }))
              }
            />
          </KioskField>
          <KioskField label="Telefono alternativo" htmlFor="backup-phone">
            <Input
              id="backup-phone"
              className="h-11"
              inputMode="tel"
              value={form.backup_phone ?? ""}
              onChange={(event) =>
                setForm((current) => ({ ...current, backup_phone: event.target.value }))
              }
            />
          </KioskField>
          <KioskField label="Note" htmlFor="note">
            <Textarea
              id="note"
              className="min-h-11"
              value={form.note ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            />
          </KioskField>
        </div>
      ) : (
        <p className="rounded-lg bg-status-warn/25 px-3 py-2 text-sm text-status-warn-foreground">
          Conferma di aver ritirato il dispositivo. La firma e facoltativa in questa versione.
        </p>
      )}

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Firma cliente</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const canvas = signatureRef.current;
              const context = canvas?.getContext("2d");
              if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
              setHasSignature(false);
            }}
          >
            Cancella
          </Button>
        </div>
        <canvas
          ref={signatureRef}
          width={720}
          height={220}
          className="h-44 w-full touch-none rounded-lg border border-dashed border-border bg-background"
          onPointerDown={(event) => startDrawing(event, signatureRef.current, drawingRef)}
          onPointerMove={(event) => {
            if (draw(event, signatureRef.current, drawingRef)) setHasSignature(true);
          }}
          onPointerUp={() => {
            drawingRef.current = false;
          }}
          onPointerLeave={() => {
            drawingRef.current = false;
          }}
        />
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3">
        <Checkbox
          checked={form.confirmation_checked}
          onCheckedChange={(checked) =>
            setForm((current) => ({ ...current, confirmation_checked: checked === true }))
          }
        />
        <span className="text-sm leading-5">
          Confermo che i dati inseriti sono corretti e che lo staff puo procedere con la pratica.
        </span>
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-status-danger/10 px-3 py-2 text-sm text-status-danger-foreground"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" className="h-12 text-base" disabled={pending}>
        {pending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <ClipboardPenLine className="mr-2 size-4" />
        )}
        Invia allo staff
      </Button>
    </form>
  );
}

function KioskField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function startDrawing(
  event: PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement | null,
  drawingRef: MutableRefObject<boolean>,
) {
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;
  drawingRef.current = true;
  const point = pointerPoint(event, canvas);
  context.beginPath();
  context.moveTo(point.x, point.y);
}

function draw(
  event: PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement | null,
  drawingRef: MutableRefObject<boolean>,
) {
  if (!drawingRef.current || !canvas) return false;
  const context = canvas.getContext("2d");
  if (!context) return false;
  const point = pointerPoint(event, canvas);
  context.lineWidth = 4;
  context.lineCap = "round";
  context.strokeStyle = "#111827";
  context.lineTo(point.x, point.y);
  context.stroke();
  return true;
}

function pointerPoint(event: PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

async function fetchKioskSession(token: string) {
  const response = await fetch("/api/kiosk/session", {
    headers: { "x-kiosk-token": token },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: KioskPublicSession | null;
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error || "读取任务失败");
  return payload.data ?? null;
}

async function postKioskJson<T = unknown>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-kiosk-token": token } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!response.ok) throw new Error(payload.error || "请求失败");
  return payload.data as T;
}
