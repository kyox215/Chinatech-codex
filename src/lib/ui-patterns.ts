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

export const appShell = {
  sidebar: "bg-sidebar",
  mobileSidebar:
    "w-[min(18rem,calc(100vw-16px))] border-r border-[var(--border-panel)] bg-sidebar p-0 text-sidebar-foreground shadow-[var(--shadow-overlay)] [&>button]:hidden",
  sidebarHeader:
    "h-14 justify-center border-b border-[var(--border-panel)] px-2 py-0 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1.5",
  sidebarBrand:
    "flex h-10 items-center gap-2 rounded-lg px-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
  sidebarFooter:
    "border-t border-[var(--border-panel)] p-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1.5",
  topBar:
    "sticky top-0 z-30 flex h-12 w-full min-w-0 max-w-full items-center overflow-hidden border-b border-[var(--border-panel)] bg-background/95 transition-colors md:h-14 md:backdrop-blur-xl md:backdrop-saturate-150",
  content:
    "min-w-0 max-w-full flex-1 overflow-x-clip pb-[calc(env(safe-area-inset-bottom)+4rem)] md:pb-0",
} as const;

export const overlayShell = {
  modalSm: "w-[min(520px,calc(100vw-24px))] max-w-[calc(100vw-24px)]",
  modalMd: "w-[min(680px,calc(100vw-24px))] max-w-[calc(100vw-24px)]",
  modalLg: "w-[min(860px,calc(100vw-24px))] max-w-[calc(100vw-24px)]",
  modalWide: "w-[min(1240px,calc(100vw-24px))] max-w-[calc(100vw-24px)]",
  scroll: "max-h-[calc(100svh-24px)] overflow-y-auto",
  body: "min-w-0 overflow-y-auto px-3 pb-3 sm:px-4 sm:pb-4",
  detailWorkspace:
    "h-[calc(100svh-16px)] max-h-[calc(100svh-16px)] w-[calc(100vw-16px)] max-w-[calc(100vw-16px)] overflow-hidden border-transparent bg-transparent p-0 shadow-none sm:h-[calc(100svh-48px)] sm:max-h-[calc(100svh-48px)] sm:w-[min(1000px,calc(100vw-56px))] sm:max-w-[calc(100vw-56px)] lg:w-[min(1000px,calc(100vw-96px))] lg:max-w-[calc(100vw-96px)]",
  formWorkspace:
    "max-h-[calc(100svh-16px)] w-[calc(100vw-16px)] max-w-[calc(100vw-16px)] overflow-hidden border-transparent bg-transparent p-0 shadow-none sm:max-h-[calc(100svh-32px)] sm:w-[min(1400px,calc(100vw-32px))] sm:max-w-[calc(100vw-32px)]",
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
    "border-0 text-primary-foreground shadow-[var(--shadow-action)] hover:shadow-[var(--shadow-action-hover)]",
  iconButton: "inline-flex size-9 items-center justify-center rounded-md",
  searchInput:
    "h-9 border-border/60 bg-surface/60 pl-8 backdrop-blur transition-all focus-visible:border-primary/50 focus-visible:shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_18%,transparent)]",
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

export const repairOs = {
  mobilePage:
    "mx-auto w-full min-w-0 max-w-[430px] overflow-x-hidden px-3 pb-20 pt-3 sm:max-w-2xl md:max-w-7xl md:px-5 md:pb-8 lg:px-6",
  mobileListFloatingPage:
    "mx-auto w-full min-w-0 max-w-[430px] overflow-x-hidden px-2 pb-24 pt-[var(--orders-mobile-header-offset,10rem)] sm:max-w-2xl md:max-w-7xl md:px-5 md:pb-8 md:pt-5 lg:px-6",
  mobileUnifiedListPage:
    "mx-auto w-full min-w-0 max-w-[430px] overflow-x-hidden px-2 pb-24 pt-[var(--repair-os-list-header-offset,10rem)] sm:max-w-2xl md:max-w-7xl md:px-5 md:pb-8 md:pt-5 lg:px-6",
  mobileFloatingPage:
    "min-w-0 space-y-1.5 pb-20 pt-[var(--repair-os-mobile-floating-offset,calc(env(safe-area-inset-top)+10.75rem))]",
  mobileListHeaderShell:
    "fixed inset-x-0 top-0 z-40 bg-background/75 px-2 pb-2 pt-[calc(env(safe-area-inset-top)+0.35rem)] backdrop-blur-xl md:hidden",
  mobileFloatingHeaderShell:
    "fixed inset-x-0 top-0 z-40 bg-background/75 px-2 pb-2 pt-[calc(env(safe-area-inset-top)+0.35rem)] backdrop-blur-xl md:hidden",
  mobileFloatingHeaderCard:
    "mx-auto min-w-0 max-w-[430px] overflow-hidden rounded-xl border border-[var(--border-panel)] bg-card/95 px-2.5 pb-1.5 pt-1.5 shadow-[var(--shadow-card)]",
  mobileFloatingHeaderNav: "grid min-w-0 grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2",
  mobileFloatingHeaderBody: "mt-1.5 min-w-0 border-t border-[var(--border-panel)] pt-1.5",
  mobileInfoCard:
    "min-w-0 overflow-hidden rounded-xl border border-[var(--border-panel)] bg-card p-2 shadow-[var(--shadow-card)]",
  mobileInfoCardMuted:
    "min-w-0 overflow-hidden rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2 shadow-[var(--shadow-card)]",
  headerActions: "flex shrink-0 items-center gap-2",
  iconAction:
    "inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-panel)] bg-card text-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-accent",
  primaryAction:
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border-0 px-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-action)] transition-transform active:scale-95",
  searchBar:
    "flex h-10 min-w-0 items-center gap-2 rounded-2xl border border-[var(--border-panel)] bg-card px-3 shadow-[var(--shadow-card)]",
  searchInput:
    "h-9 min-w-0 border-0 bg-transparent px-0 text-sm shadow-none placeholder:text-muted-foreground/65 focus-visible:ring-0",
  metricStrip: "grid min-w-0 gap-2",
  metricCard:
    "min-w-0 rounded-2xl border border-[var(--border-panel)] bg-card px-2.5 py-2 shadow-[var(--shadow-card)]",
  metricCardDense:
    "min-w-0 rounded-2xl border border-[var(--border-panel)] bg-card px-2 py-1.5 shadow-[var(--shadow-card)]",
  metricIcon:
    "mb-1.5 grid size-7 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/10",
  metricLabel: "truncate text-[10px] uppercase tracking-widest text-muted-foreground/70",
  metricValue: "font-mono text-lg font-semibold tabular-nums leading-none text-foreground",
  chipRow: "flex min-w-0 snap-x gap-1.5 overflow-x-auto pb-1",
  chip: "inline-flex h-8 shrink-0 snap-start items-center rounded-full border border-[var(--border-panel)] bg-card px-3 text-xs font-medium text-muted-foreground shadow-[var(--shadow-card)] transition-colors",
  chipActive:
    "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-action)] hover:bg-primary",
  cardList: "grid min-w-0 gap-2",
  businessCard:
    "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-2xl border border-[var(--border-panel)] bg-card px-3 py-2.5 shadow-[var(--shadow-card)] transition-colors hover:bg-card",
  businessCardDense:
    "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-1.5 rounded-2xl border border-[var(--border-panel)] bg-card px-2.5 py-2 shadow-[var(--shadow-card)]",
  cardTitle: "truncate text-sm font-semibold leading-5 text-foreground",
  cardMeta: "truncate text-[11px] leading-4 text-muted-foreground",
  cardAmount: "whitespace-nowrap text-right font-mono text-sm font-semibold tabular-nums",
  badge:
    "inline-flex h-5 shrink-0 items-center rounded-full px-1.5 text-[10px] font-medium leading-none",
  toolbar:
    "flex min-w-0 items-center gap-2 rounded-2xl border border-[var(--border-panel)] bg-card p-2 shadow-[var(--shadow-card)]",
  floatingAction:
    "fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-3 z-40 h-10 rounded-full border border-[var(--border-panel)] bg-[var(--surface-workspace-strong)] px-3 text-xs font-semibold text-foreground shadow-[var(--shadow-overlay)] backdrop-blur-xl transition-transform active:scale-95 md:hidden",
  quickSheet:
    "max-h-[calc(100svh-5rem)] rounded-t-xl px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3",
  quickActionList: "mt-3 grid gap-2",
  quickActionItem:
    "grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel)] px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  quickActionPrimary: "border-primary/30 bg-primary/10 hover:bg-primary/15",
  quickActionIcon: "grid size-9 place-items-center rounded-md bg-accent text-accent-foreground",
  quickActionIconPrimary: "bg-primary text-primary-foreground",
  quickActionLabel: "block truncate text-sm font-medium text-foreground",
  quickActionDescription: "block truncate text-xs text-muted-foreground",
  adminSection:
    "min-w-0 rounded-2xl border border-[var(--border-panel)] bg-card p-3 shadow-[var(--shadow-card)] sm:p-3",
  adminSectionHeader: "mb-3 flex min-w-0 items-center justify-between gap-2",
  adminSectionTitle: "truncate text-sm font-semibold text-foreground",
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
    "mx-auto mb-4 grid size-16 place-items-center rounded-2xl text-primary-foreground shadow-[var(--shadow-action)]",
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
