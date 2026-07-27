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

const description = "记录本店铺事项，或安排一项待办工作。";

export function MemoEditorOverlay({
  compact,
  open,
  title,
  children,
  onOpenChange,
}: {
  compact: boolean;
  open: boolean;
  title: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
}) {
  return compact ? (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn(componentOverlay.bottomSheet, "flex flex-col")}>
        <SheetHeader className="mb-3 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={componentOverlay.formContent}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
