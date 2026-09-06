"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-[var(--overlay-scrim)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 gap-3 overflow-hidden border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] p-3 shadow-[var(--shadow-overlay)] outline-none transition ease-in-out data-[state=closed]:duration-150 data-[state=open]:duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out sm:gap-4 sm:p-5",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 max-h-[calc(100svh-24px)] border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 max-h-[calc(100svh-24px)] border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-[min(24rem,calc(100vw-24px))] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        right:
          "inset-y-0 right-0 h-full w-[min(24rem,calc(100vw-24px))] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  mobileEditor?: boolean;
  initialFocus?: "container";
  closeLabel?: string;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(
  (
    {
      side = "right",
      className,
      children,
      mobileEditor = false,
      initialFocus,
      closeLabel = "关闭",
      ...props
    },
    ref,
  ) => {
    const editorOpener = React.useRef<HTMLElement | null>(null);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const editor = mobileEditor || initialFocus === "container";
    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content
          data-mobile-editor={mobileEditor || undefined}
          data-keypad-scope={editor || undefined}
          ref={(node) => {
            contentRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          className={cn(
            sheetVariants({ side }),
            className,
            mobileEditor && componentOverlay.mobileEditor,
            editor && "[&:has([data-virtual-keyboard-dock])]:!overflow-y-auto",
          )}
          {...props}
          onOpenAutoFocus={(event) => {
            if (editor)
              editorOpener.current =
                document.activeElement instanceof HTMLElement ? document.activeElement : null;
            props.onOpenAutoFocus?.(event);
            if (editor && !event.defaultPrevented && window.innerWidth < 1024) {
              event.preventDefault();
              contentRef.current?.focus({ preventScroll: true });
            }
          }}
          onEscapeKeyDown={(event) => {
            const keyboard = contentRef.current?.querySelector("[data-virtual-keyboard-dock]");
            if (keyboard) {
              event.preventDefault();
              keyboard.dispatchEvent(new Event("rd-keypad-dismiss", { bubbles: true }));
              return;
            }
            props.onEscapeKeyDown?.(event);
          }}
          onCloseAutoFocus={(event) => {
            props.onCloseAutoFocus?.(event);
            if (editor && !event.defaultPrevented && editorOpener.current?.isConnected) {
              event.preventDefault();
              editorOpener.current.focus({ preventScroll: true });
            }
          }}
        >
          <SheetPrimitive.Close className="absolute right-1 top-1 grid size-9 place-items-center rounded-lg text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:bg-accent hover:text-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary sm:right-3 sm:top-3 lg:size-8">
            <X className="h-4 w-4" />
            <span className="sr-only">{closeLabel}</span>
          </SheetPrimitive.Close>
          {children}
          {editor ? (
            <div data-virtual-keyboard-host className="sticky bottom-0 z-40 min-w-0 empty:hidden" />
          ) : null}
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1 pe-12 text-center sm:space-y-2 sm:text-left", className)}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold text-foreground sm:text-lg", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-xs text-muted-foreground sm:text-sm", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
