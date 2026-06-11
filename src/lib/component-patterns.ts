/**
 * Reusable component-level declarations for RepairDesk.
 *
 * Page-level declarations live in ui-patterns.ts. Use this file when building
 * reusable cards, list items, dialogs, filters, metric blocks, and domain widgets.
 */

export type ComponentTone = "neutral" | "info" | "progress" | "warn" | "success" | "danger";

export const toneClasses: Record<
  ComponentTone,
  {
    subtle: string;
    foreground: string;
    ring: string;
    dot: string;
  }
> = {
  neutral: {
    subtle: "bg-status-neutral",
    foreground: "text-status-neutral-foreground",
    ring: "ring-status-neutral-foreground/20",
    dot: "bg-status-neutral-foreground/70",
  },
  info: {
    subtle: "bg-status-info",
    foreground: "text-status-info-foreground",
    ring: "ring-status-info-foreground/30",
    dot: "bg-status-info-foreground",
  },
  progress: {
    subtle: "bg-status-progress",
    foreground: "text-status-progress-foreground",
    ring: "ring-status-progress-foreground/30",
    dot: "bg-status-progress-foreground",
  },
  warn: {
    subtle: "bg-status-warn",
    foreground: "text-status-warn-foreground",
    ring: "ring-status-warn-foreground/30",
    dot: "bg-status-warn-foreground",
  },
  success: {
    subtle: "bg-status-success",
    foreground: "text-status-success-foreground",
    ring: "ring-status-success-foreground/30",
    dot: "bg-status-success-foreground",
  },
  danger: {
    subtle: "bg-status-danger",
    foreground: "text-status-danger-foreground",
    ring: "ring-status-danger-foreground/30",
    dot: "bg-status-danger-foreground",
  },
};

export const componentShell = {
  panel: "glass-card text-card-foreground",
  panelPadding: "p-4 sm:p-5",
  header: "flex items-start justify-between gap-3",
  titleGroup: "min-w-0 space-y-1",
  title: "font-display text-base font-semibold tracking-tight text-foreground",
  compactTitle: "text-sm font-semibold text-foreground",
  description: "text-sm text-muted-foreground",
  eyebrow: "text-[10px] uppercase tracking-widest text-muted-foreground/70",
  body: "mt-4 space-y-3",
  footer: "mt-4 flex flex-wrap items-center justify-end gap-2",
  separator: "border-t border-border/50",
} as const;

export const componentList = {
  root: "divide-y divide-border/40",
  item: "group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/30",
  itemInteractive:
    "group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  itemTitle: "truncate text-sm font-medium text-foreground",
  itemMeta: "truncate text-xs text-muted-foreground",
  itemTrailing: "ml-auto flex shrink-0 items-center gap-2",
  empty: "py-8 text-center text-sm text-muted-foreground",
} as const;

export const componentMetric = {
  root: "glass-card group relative overflow-hidden px-3 py-2",
  label: "text-[10px] uppercase tracking-widest text-muted-foreground/70",
  value: "font-display text-lg font-semibold tabular-nums leading-none text-foreground",
  valueLarge: "font-display text-2xl font-semibold tabular-nums leading-none text-foreground",
  delta: "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
  sparklineWrap: "mt-3 h-10",
} as const;

export const componentForm = {
  section: "glass-card p-4",
  sectionHeader: "mb-3 flex items-start justify-between gap-3",
  sectionTitle: "text-sm font-semibold text-foreground",
  sectionHint: "text-xs text-muted-foreground",
  field: "space-y-1.5",
  label: "text-xs",
  required: "text-destructive",
  grid: "grid gap-3 sm:grid-cols-2",
  help: "text-xs text-muted-foreground",
  error: "text-xs text-status-danger-foreground",
} as const;

export const componentOverlay = {
  content:
    "border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] text-popover-foreground shadow-[var(--shadow-overlay)]",
  responsiveContent:
    "w-[min(960px,calc(100vw-24px))] max-h-[calc(100svh-24px)] max-w-[calc(100vw-24px)] overflow-y-auto border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] text-popover-foreground shadow-[var(--shadow-overlay)]",
  modalSm: "w-[min(520px,calc(100vw-24px))] max-w-[calc(100vw-24px)]",
  modalMd: "w-[min(680px,calc(100vw-24px))] max-w-[calc(100vw-24px)]",
  modalLg: "w-[min(860px,calc(100vw-24px))] max-w-[calc(100vw-24px)]",
  modalWide: "w-[min(1240px,calc(100vw-24px))] max-w-[calc(100vw-24px)]",
  detailWorkspace:
    "h-[calc(100svh-16px)] max-h-[calc(100svh-16px)] w-[calc(100vw-16px)] max-w-[calc(100vw-16px)] overflow-hidden border-transparent bg-transparent p-0 shadow-none sm:h-[calc(100svh-32px)] sm:max-h-[calc(100svh-32px)] sm:w-[min(1180px,calc(100vw-32px))] sm:max-w-[calc(100vw-32px)]",
  formWorkspace:
    "max-h-[calc(100svh-16px)] w-[calc(100vw-16px)] max-w-[calc(100vw-16px)] overflow-hidden border-transparent bg-transparent p-0 shadow-none sm:max-h-[calc(100svh-32px)] sm:w-[min(1240px,calc(100vw-32px))] sm:max-w-[calc(100vw-32px)]",
  body: "min-w-0 overflow-y-auto px-3 pb-3 sm:px-4 sm:pb-4",
  section:
    "min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel)] p-3",
  flatSection:
    "min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3 shadow-none",
  sheetPanel: "h-full min-w-0 overflow-y-auto bg-[var(--surface-workspace-strong)] text-foreground",
  popoverContent:
    "max-w-[calc(100vw-24px)] border-[var(--border-panel)] bg-popover text-popover-foreground shadow-[var(--shadow-overlay)]",
  header: "space-y-1.5",
  title: "font-display text-lg font-semibold tracking-tight",
  description: "text-sm text-muted-foreground",
  footer: "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
} as const;

export const componentDensity = {
  compactPanel: "glass-card p-3 sm:p-4",
  denseRow: "grid min-w-0 items-center gap-2 px-3 py-2",
  denseMeta: "truncate text-[11px] leading-4 text-muted-foreground",
  denseValue: "truncate text-xs font-medium leading-5 text-foreground",
  denseCell: "min-w-0 px-2 py-1.5",
  denseAction: "inline-flex size-7 shrink-0 items-center justify-center rounded-md",
} as const;

export const componentAction = {
  row: "flex flex-wrap items-center gap-2",
  iconButton: "inline-flex size-9 items-center justify-center rounded-md",
  primary: "border-0 text-primary-foreground",
  secondary: "border-border/60 bg-surface/60",
  danger: "text-destructive hover:text-destructive",
} as const;
