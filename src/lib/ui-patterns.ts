/**
 * Reusable UI declarations for RepairDesk pages.
 *
 * Keep these class contracts aligned with docs/UI_PAGE_GENERATION_DECLARATION.md.
 * New routes should import from here instead of inventing page-level layout strings.
 */

export const pageShell = {
  wide: "mx-auto max-w-7xl space-y-6 px-3 py-6 sm:px-6",
  list: "mx-auto max-w-7xl px-4 pt-6 md:px-6 lg:px-8",
  detail: "mx-auto max-w-4xl px-4 pb-12 pt-4 md:px-6",
  form: "mx-auto max-w-3xl px-3 py-4 sm:px-6",
  split: "mx-auto grid max-w-7xl gap-6 px-3 py-6 sm:px-6 lg:grid-cols-[1fr_320px]",
} as const;

export const pageHeader = {
  root: "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
  eyebrow: "text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70",
  title: "font-display text-3xl font-semibold tracking-tight md:text-4xl",
  compactTitle: "font-display text-2xl font-semibold tracking-tight",
  subtitle: "mt-1 text-sm text-muted-foreground",
  actions: "flex flex-wrap items-center gap-2",
} as const;

export const surfaces = {
  card: "glass-card",
  section: "glass-card p-4 sm:p-5",
  toolbar: "glass-card flex flex-col gap-3 p-3",
  stickyActions:
    "sticky bottom-0 -mx-3 flex flex-col-reverse gap-2 border-t bg-background/80 px-3 py-3 backdrop-blur sm:-mx-6 sm:flex-row sm:justify-between sm:px-6",
  popover: "glass-strong border-border text-popover-foreground",
  empty:
    "glass-card mx-auto mt-16 flex max-w-sm flex-col items-center justify-center p-8 text-center",
} as const;

export const controls = {
  brandButton:
    "border-0 text-primary-foreground shadow-[0_8px_28px_-10px_oklch(0.7_0.2_285_/_0.7)]",
  iconButton: "inline-flex size-9 items-center justify-center rounded-md",
  searchInput:
    "h-9 border-border/60 bg-surface/60 pl-8 backdrop-blur transition-all focus-visible:border-primary/50 focus-visible:shadow-[0_0_0_4px_oklch(0.7_0.2_285_/_0.18)]",
  segmentedButton: "rounded-md border px-2 py-1 text-xs transition-colors",
  segmentedActive: "border-primary bg-primary/10 text-primary",
  segmentedInactive: "bg-surface hover:bg-accent",
} as const;

export const dataDisplay = {
  kpiGrid: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
  chartGrid: "grid gap-4 lg:grid-cols-3",
  tableWrap: "glass-card hidden overflow-hidden md:block",
  table: "w-full text-sm",
  tableHead: "text-xs text-muted-foreground",
  tableRow: "border-b border-border/30 transition-colors hover:bg-accent/30",
  mobileCardList: "space-y-3 md:hidden",
  number: "font-mono tabular-nums",
} as const;

export const formLayout = {
  stack: "space-y-4 pb-24",
  section: "glass-card p-4",
  sectionHeader: "mb-3 flex items-center justify-between",
  sectionTitle: "text-sm font-semibold",
  sectionHint: "text-xs text-muted-foreground",
  grid: "grid gap-3 sm:grid-cols-2",
  field: "space-y-1.5",
  label: "text-xs",
  required: "text-destructive",
} as const;

export const stateBlocks = {
  skeletonStack: "space-y-2",
  errorText: "text-sm text-status-danger-foreground",
  emptyIcon:
    "mb-4 grid size-16 place-items-center rounded-2xl text-primary-foreground shadow-[0_8px_28px_-8px_oklch(0.7_0.2_285_/_0.6)]",
  mutedHelp: "text-sm text-muted-foreground",
} as const;

export const iconSizes = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const;

export const brandGradientStyle = {
  background: "var(--gradient-brand)",
} as const;
