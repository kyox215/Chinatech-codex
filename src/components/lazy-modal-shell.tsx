"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";

export interface LazyModalShellProps {
  title: string;
  description: string;
  onCancel: () => void;
  onRetry?: () => void;
  state?: "loading" | "error";
  dataAttribute?: string;
  className?: string;
}

/**
 * A small, dependency-free modal surface used while a lazy workspace is
 * loading (or when its import failed). Keeping the shell visible gives the
 * user a stable cancel target and lets focus recovery happen before the
 * actual Radix dialog is mounted.
 */
export function LazyModalShell({
  title,
  description,
  onCancel,
  onRetry,
  state = "loading",
  dataAttribute = "lazy-modal-shell",
  className,
}: LazyModalShellProps) {
  const { t } = useLocale();
  const cancelRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
        data-lazy-modal-state={state}
        {...{ [`data-${dataAttribute}`]: "true" }}
        className={cn(componentOverlay.content, componentOverlay.modalSm, "rounded-xl", className)}
      >
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
          <DialogDescription className="text-xs leading-5">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-1 gap-2 sm:mt-2">
          <Button ref={cancelRef} type="button" variant="outline" size="sm" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          {onRetry ? (
            <Button type="button" size="sm" onClick={onRetry}>
              {t("common.retry")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LazyModalErrorBoundaryProps {
  children: React.ReactNode;
  open: boolean;
  onCancel: () => void;
  onRetry: () => void;
  title: string;
}

interface LazyModalErrorBoundaryState {
  hasError: boolean;
}

/** Catch a rejected dynamic import without replacing it with fake content. */
export class LazyModalErrorBoundary extends React.Component<
  LazyModalErrorBoundaryProps,
  LazyModalErrorBoundaryState
> {
  state: LazyModalErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): LazyModalErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: LazyModalErrorBoundaryProps) {
    if (!previousProps.open && this.props.open && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <LazyModalErrorFallback
          title={this.props.title}
          onCancel={this.props.onCancel}
          onRetry={this.props.onRetry}
        />
      );
    }
    return this.props.children;
  }
}

function LazyModalErrorFallback({
  title,
  onCancel,
  onRetry,
}: {
  title: string;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const { t } = useLocale();
  return (
    <LazyModalShell
      state="error"
      title={t("lazy.errorTitle", { title })}
      description={t("lazy.errorDescription")}
      onCancel={onCancel}
      onRetry={onRetry}
      dataAttribute="lazy-modal-error"
    />
  );
}
