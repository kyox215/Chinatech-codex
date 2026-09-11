"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { componentOverlay } from "@/lib/component-patterns";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-[var(--overlay-scrim)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  mobileEditor?: boolean;
  editorLayout?: boolean;
  initialFocus?: "container";
  showCloseButton?: boolean;
  closeClassName?: string;
  closeLabel?: string;
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      mobileEditor = false,
      editorLayout = false,
      initialFocus,
      showCloseButton = true,
      closeClassName,
      closeLabel = "关闭",
      ...props
    },
    ref,
  ) => {
    const editorOpener = React.useRef<HTMLElement | null>(null);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const editor = mobileEditor || initialFocus === "container";
    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={(node) => {
            contentRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          data-editor-layout={editorLayout || undefined}
          data-mobile-editor={mobileEditor || undefined}
          data-keypad-scope={editor || undefined}
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid max-h-[calc(100svh-24px)] w-[min(32rem,calc(100vw-24px))] translate-x-[-50%] translate-y-[-50%] gap-3 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] p-3 shadow-[var(--shadow-overlay)] outline-none duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:gap-4 sm:p-5",
            className,
            mobileEditor && componentOverlay.mobileEditor,
            editor && !editorLayout && "[&:has([data-virtual-keyboard-dock])]:!overflow-y-auto",
            editorLayout && componentOverlay.editorLayout,
          )}
          {...props}
          onOpenAutoFocus={(event) => {
            if (editor)
              editorOpener.current =
                document.activeElement instanceof HTMLElement ? document.activeElement : null;
            props.onOpenAutoFocus?.(event);
            if (
              !event.defaultPrevented &&
              (initialFocus === "container" || (mobileEditor && window.innerWidth < 1024))
            ) {
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
          {children}
          {editor ? (
            <div data-virtual-keyboard-host className="sticky bottom-0 z-40 min-w-0 empty:hidden" />
          ) : null}
          {showCloseButton ? (
            <DialogPrimitive.Close
              aria-label={closeLabel}
              className={cn(
                "absolute right-1 top-1 z-30 inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground ring-offset-background transition-colors hover:bg-[var(--surface-panel-muted)] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none sm:right-3 sm:top-3 lg:size-8",
                editor && "size-11 lg:size-8",
                closeClassName,
              )}
            >
              <X className="size-4 stroke-[2.2]" />
              <span className="sr-only">{closeLabel}</span>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-editor-header
    className={cn(
      "flex flex-col space-y-1 pe-12 text-center sm:space-y-1.5 sm:text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-editor-body className={cn(componentOverlay.editorScroll, className)} {...props} />
);

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-editor-footer
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-base font-semibold leading-tight tracking-tight sm:text-lg sm:leading-none",
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-xs text-muted-foreground sm:text-sm", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogBody,
  DialogTitle,
  DialogDescription,
};
