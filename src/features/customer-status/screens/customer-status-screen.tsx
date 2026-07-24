"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  RefreshCw,
  Smartphone,
  Store,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  resolveCustomerStatus,
  resolveCustomerStatusForStaff,
} from "@/features/customer-status/api/customer-status-client";
import {
  CUSTOMER_STATUS_LINK_UNAVAILABLE_MESSAGE,
  CUSTOMER_STATUS_TOKEN_PATTERN,
  type CustomerStatusPublicView,
} from "@/features/customer-status/model/customer-status";
import { brandGradientStyle } from "@/lib/ui-patterns";

type ViewState =
  | { kind: "loading" }
  | { kind: "success"; status: CustomerStatusPublicView }
  | { kind: "unavailable" }
  | { kind: "error"; message: string; retryAfter?: string };

export function CustomerStatusScreen() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [token, setToken] = useState("");
  const publicRequestSequence = useRef(0);

  const loadPublicStatus = useCallback(async (nextToken: string) => {
    const requestSequence = ++publicRequestSequence.current;
    if (!CUSTOMER_STATUS_TOKEN_PATTERN.test(nextToken)) {
      if (requestSequence === publicRequestSequence.current) {
        setState({ kind: "unavailable" });
      }
      return;
    }
    setState({ kind: "loading" });
    try {
      const status = await resolveCustomerStatus(nextToken);
      if (requestSequence !== publicRequestSequence.current) return;
      setState({ kind: "success", status });
    } catch (error) {
      if (requestSequence !== publicRequestSequence.current) return;
      const status = getErrorStatus(error);
      if (status === 404 || status === 503) {
        setState({ kind: "unavailable" });
        return;
      }
      setState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossibile caricare lo stato della riparazione.",
        retryAfter: getRetryAfter(error),
      });
    }
  }, []);

  useEffect(() => {
    const consumeLocationHash = () => {
      const hashToken = window.location.hash.replace(/^#/, "").trim();
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      if (!CUSTOMER_STATUS_TOKEN_PATTERN.test(hashToken)) {
        publicRequestSequence.current += 1;
        setToken("");
        setState({ kind: "unavailable" });
        return;
      }
      setToken(hashToken);
      void loadPublicStatus(hashToken);
      void resolveCustomerStatusForStaff(hashToken)
        .then((internalPath) => router.replace(internalPath))
        .catch(() => {
          // Anonymous and unauthorized scans intentionally stay on the public progress page.
        });
    };

    consumeLocationHash();
    window.addEventListener("hashchange", consumeLocationHash);
    return () => {
      publicRequestSequence.current += 1;
      window.removeEventListener("hashchange", consumeLocationHash);
    };
  }, [loadPublicStatus, router]);

  const pageBrand = state.kind === "success" ? state.status.store.name : "RepairDesk";

  return (
    <main className="flex min-h-svh w-full min-w-0 items-center justify-center overflow-x-hidden bg-background px-3 py-6 sm:px-6">
      <section className="w-full max-w-[430px] min-w-0 rounded-[var(--radius-xl)] border border-[var(--border-panel)] bg-card p-4 shadow-[var(--shadow-workspace)] sm:p-5">
        <header className="flex min-w-0 items-start gap-3 border-b border-border/60 pb-4">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-primary-foreground shadow-sm"
            style={brandGradientStyle}
          >
            <Store className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              {pageBrand}
            </p>
            <h1 className="mt-0.5 text-lg font-semibold">Stato della riparazione</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Informazioni essenziali e aggiornate dal negozio.
            </p>
          </div>
        </header>

        <div className="py-4" aria-live="polite">
          {state.kind === "loading" ? <CustomerStatusLoading /> : null}
          {state.kind === "success" ? <CustomerStatusSuccess status={state.status} /> : null}
          {state.kind === "unavailable" ? <CustomerStatusUnavailable /> : null}
          {state.kind === "error" ? (
            <CustomerStatusError
              message={state.message}
              retryAfter={state.retryAfter}
              onRetry={() => token && void loadPublicStatus(token)}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function CustomerStatusLoading() {
  return (
    <div className="space-y-3" role="status">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Caricamento dello stato…
      </div>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

function CustomerStatusSuccess({ status }: { status: CustomerStatusPublicView }) {
  const contact = status.store.whatsapp || status.store.phone || status.store.email;
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-[var(--border-panel)] bg-muted/30 p-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ordine</p>
            <p className="mt-0.5 truncate font-mono text-base font-semibold text-primary">
              {status.order.public_no}
            </p>
          </div>
          <Smartphone className="mt-1 size-5 shrink-0 text-muted-foreground" />
        </div>
        <p className="mt-2 truncate text-sm font-medium">{status.order.device}</p>
      </section>

      <section className="rounded-xl border border-[var(--border-panel)] p-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-status-success-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Stato attuale
            </p>
            <p className="mt-0.5 text-base font-semibold">{status.order.stage_label}</p>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {status.order.progress_percent}%
          </span>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`Avanzamento: ${status.order.stage_label}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={status.order.progress_percent}
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${status.order.progress_percent}%` }}
          />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {status.order.next_action}
        </p>
      </section>

      <section className="space-y-2 rounded-xl border border-[var(--border-panel)] p-3 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <Clock3 className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">Ultimo aggiornamento</span>
          <strong className="ml-auto truncate font-medium">
            {formatItalianDateTime(status.order.last_updated_at)}
          </strong>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{status.store.name}</span>
        </div>
        {contact ? <p className="break-words pl-6 text-muted-foreground">{contact}</p> : null}
      </section>
    </div>
  );
}

function CustomerStatusUnavailable() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-panel)] px-4 py-8 text-center">
      <AlertCircle className="mx-auto size-7 text-muted-foreground" />
      <h2 className="mt-3 text-sm font-semibold">Link non disponibile</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {CUSTOMER_STATUS_LINK_UNAVAILABLE_MESSAGE}
      </p>
    </div>
  );
}

function CustomerStatusError({
  message,
  retryAfter,
  onRetry,
}: {
  message: string;
  retryAfter?: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="rounded-xl border border-[var(--border-panel)] bg-muted/30 px-4 py-7 text-center text-status-danger-foreground"
      role="alert"
    >
      <AlertCircle className="mx-auto size-7" />
      <h2 className="mt-3 text-sm font-semibold">Connessione non disponibile</h2>
      <p className="mt-1 text-xs leading-relaxed">{message}</p>
      {retryAfter ? (
        <p className="mt-1 text-[11px]">Riprova tra circa {retryAfter} secondi.</p>
      ) : null}
      <Button type="button" variant="outline" className="mt-3 gap-2" onClick={onRetry}>
        <RefreshCw className="size-4" /> Riprova
      </Button>
    </div>
  );
}

function getErrorStatus(error: unknown) {
  return Number((error as { status?: unknown } | null)?.status || 0);
}

function getRetryAfter(error: unknown) {
  const value = (error as { retryAfter?: unknown } | null)?.retryAfter;
  return typeof value === "string" ? value : undefined;
}

function formatItalianDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("it-IT", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Rome",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
