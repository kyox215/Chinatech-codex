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
import { componentOverlay, memoQuickEntry } from "@/lib/component-patterns";
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
        side="bottom"
        closeLabel={closeLabel}
        className={cn(
          componentOverlay.bottomSheet,
          memoQuickEntry.surface,
          memoQuickEntry.mobile,
          "inset-x-0 flex w-full min-w-0 max-w-full flex-col overflow-x-hidden",
        )}
      >
        <SheetHeader className={cn(memoQuickEntry.header, "min-w-0 max-w-full")}>
          <SheetTitle className={memoQuickEntry.title}>{title}</SheetTitle>
          <SheetDescription className={memoQuickEntry.description}>{description}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={closeLabel}
        className={cn(
          componentOverlay.formContent,
          memoQuickEntry.surface,
          memoQuickEntry.desktop,
          "flex flex-col overflow-hidden",
        )}
        closeClassName="right-2 top-2 size-9 hover:bg-transparent focus:ring-[var(--memo-quick-entry-focus)] sm:right-2 sm:top-2"
      >
        <DialogHeader className={memoQuickEntry.header}>
          <DialogTitle className={memoQuickEntry.title}>{title}</DialogTitle>
          <DialogDescription className={memoQuickEntry.description}>
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
