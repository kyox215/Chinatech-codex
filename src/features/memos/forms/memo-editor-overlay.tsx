import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/i18n/locale-provider";
import { getMemoPresentationCopy } from "@/shared/i18n/messages";

export function MemoEditorOverlay({
  compact,
  open,
  title,
  description,
  children,
  onOpenChange,
}: {
  compact: boolean;
  open: boolean;
  title: string;
  description: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
}) {
  const { locale } = useLocale();
  const closeLabel = getMemoPresentationCopy(locale).closeMemo;
  return compact ? (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        initialFocus="container"
        side="bottom"
        closeLabel={closeLabel}
        className={cn(
          componentOverlay.bottomSheet,
          componentOverlay.editorSurface,
          "inset-x-0 flex w-full min-w-0 max-w-full flex-col gap-0 overflow-x-hidden bg-card p-0",
        )}
      >
        <SheetHeader
          data-editor-header
          className={cn(
            componentOverlay.mobileHeader,
            componentOverlay.editorHeader,
            "min-w-0 max-w-full pr-14",
          )}
        >
          <SheetTitle className={componentOverlay.title}>{title}</SheetTitle>
          <SheetDescription className={componentOverlay.description}>
            {description}
          </SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus="container"
        closeLabel={closeLabel}
        className={cn(
          componentOverlay.formContent,
          componentOverlay.editorSurface,
          "flex w-[min(640px,calc(100vw-24px))] flex-col gap-0 overflow-hidden rounded-xl bg-card p-0",
        )}
        closeClassName="right-2 top-2 size-9 sm:right-3 sm:top-3"
      >
        <DialogHeader
          data-editor-header
          className={cn(componentOverlay.mobileHeader, componentOverlay.editorHeader, "pr-14")}
        >
          <DialogTitle className={componentOverlay.title}>{title}</DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
