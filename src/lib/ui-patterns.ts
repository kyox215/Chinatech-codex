/**
 * Reusable UI declarations for RepairDesk pages.
 *
 * Keep these class contracts aligned with docs/UI_PAGE_GENERATION_DECLARATION.md.
 * New routes should import from here instead of inventing page-level layout strings.
 */

export const pageShell = {
  safe: "w-full min-w-0 max-w-full overflow-x-hidden",
  wide: "mx-auto w-full min-w-0 max-w-7xl space-y-6 overflow-x-hidden px-3 py-6 sm:px-6",
  list: "mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden px-3 pt-5 sm:px-4 md:px-6 lg:px-8",
  detail: "mx-auto w-full min-w-0 max-w-4xl overflow-x-hidden px-4 pb-12 pt-4 md:px-6",
  form: "mx-auto w-full min-w-0 max-w-3xl overflow-x-hidden px-3 py-4 sm:px-6",
  split:
    "mx-auto grid w-full min-w-0 max-w-7xl gap-6 overflow-x-hidden px-3 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]",
} as const;

export const layoutGuards = {
  noPageOverflow: "w-full min-w-0 max-w-full overflow-x-hidden",
  flexChild: "min-w-0",
  truncateCell: "min-w-0 truncate",
  wrapRow: "flex min-w-0 flex-wrap items-center gap-2",
  responsiveDialog:
    "w-[min(960px,calc(100vw-24px))] max-h-[calc(100svh-24px)] max-w-[calc(100vw-24px)] overflow-y-auto",
} as const;

export const overlayShell = {
  modalSm: "w-[min(520px,calc(100vw-24px))] max-w-[calc(100vw-24px)]",
  modalMd: "w-[min(680px,calc(100vw-24px))] max-w-[calc(100vw-24px)]",
  modalLg: "w-[min(860px,calc(100vw-24px))] max-w-[calc(100vw-24px)]",
  modalWide: "w-[min(1240px,calc(100vw-24px))] max-w-[calc(100vw-24px)]",
  scroll: "max-h-[calc(100svh-24px)] overflow-y-auto",
  body: "min-w-0 overflow-y-auto px-3 pb-3 sm:px-4 sm:pb-4",
  detailWorkspace:
    "h-[calc(100svh-16px)] max-h-[calc(100svh-16px)] w-[calc(100vw-16px)] max-w-[calc(100vw-16px)] overflow-hidden border-transparent bg-transparent p-0 shadow-none sm:h-[calc(100svh-32px)] sm:max-h-[calc(100svh-32px)] sm:w-[min(1180px,calc(100vw-32px))] sm:max-w-[calc(100vw-32px)]",
  formWorkspace:
    "max-h-[calc(100svh-16px)] w-[calc(100vw-16px)] max-w-[calc(100vw-16px)] overflow-hidden border-transparent bg-transparent p-0 shadow-none sm:max-h-[calc(100svh-32px)] sm:w-[min(1240px,calc(100vw-32px))] sm:max-w-[calc(100vw-32px)]",
} as const;

export const detailWorkspace = {
  root: "min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-workspace)] shadow-[var(--shadow-workspace)]",
  body: "min-w-0 overflow-y-auto p-2 sm:p-3 md:p-4",
  flatHero:
    "mb-2 min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel)] px-2 py-2 sm:mb-3 sm:px-4 sm:py-3",
  flatPanel:
    "min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel)] p-2.5 shadow-none sm:p-3",
  densePanel:
    "min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel)] p-2 shadow-none",
  flatPanelMuted:
    "min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2.5 shadow-none sm:p-3",
  compactDetailGrid: "grid min-w-0 gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
  orderDetailGrid:
    "lg:grid-cols-[minmax(220px,0.9fr)_minmax(300px,1.15fr)_minmax(240px,0.85fr)] xl:grid-cols-[minmax(250px,0.9fr)_minmax(360px,1.15fr)_minmax(280px,0.9fr)]",
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
  kpiGrid: "hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4",
  chartGrid: "grid gap-4 lg:grid-cols-3",
  tableWrap: "glass-card hidden min-w-0 overflow-hidden lg:block",
  denseTableWrap: "glass-card hidden min-w-0 overflow-x-auto overflow-y-hidden lg:block",
  table: "w-full min-w-0 text-sm",
  tableHead: "text-xs text-muted-foreground",
  tableRow: "border-b border-border/30 transition-colors hover:bg-accent/30",
  mobileCardList: "space-y-3 md:hidden",
  tabletCardList: "space-y-3 lg:hidden",
  number: "font-mono tabular-nums",
} as const;

export const density = {
  toolbarCompact: "flex min-w-0 flex-wrap items-center gap-2",
  tableDense: "w-full min-w-0 text-xs",
  rowDense: "border-b border-border/30 px-2 py-1.5",
  cardDense: "rounded-lg border bg-card px-3 py-2",
  metaDense: "truncate text-[11px] leading-4 text-muted-foreground",
  valueDense: "truncate text-xs font-medium leading-5",
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
