"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { RepairOsListScaffold } from "@/shared/ui";

import type {
  InventoryProductListFilters,
  InventoryProductListItem,
  InventoryLifecycleProjectionStatus,
} from "@/lib/repairdesk/types";

import {
  InventoryLifecycleShortcutBar,
  InventoryProductCategoryTabs,
  InventoryProductListSkeleton,
  InventoryProductMessage,
  InventoryProductResults,
  InventoryProductViewToggle,
  inventoryProductListScaffoldClassName,
  type InventoryProductView,
} from "./inventory-product-queue-components";

const projection = (
  status: InventoryLifecycleProjectionStatus,
  overrides: Partial<NonNullable<InventoryProductListItem["lifecycle"]>> = {},
) => ({
  mode: "exact" as const,
  status,
  confidence: "high" as const,
  needs_review: false,
  allowed_actions: [],
  ...overrides,
});

const completeItems: InventoryProductListItem[] = [
  {
    id: "story-queue-001",
    sku: "DEMO-Q-001",
    category: "phone",
    brand: "Apple",
    model: "iPhone 15 Pro 256GB",
    color: "自然钛金属",
    specification: "A17 Pro · 256GB",
    masked_identifier: "··· 4382",
    status: "in_stock",
    location: "A-03",
    list_price: 899,
    currency_code: "EUR",
    updated_at: "2026-08-11T07:42:00.000Z",
    lifecycle: projection("in_stock"),
  },
  {
    id: "story-queue-002",
    sku: "DEMO-Q-002",
    category: "tablet",
    brand: "Samsung",
    model: "Galaxy Tab A9",
    specification: "Wi-Fi · 128GB",
    status: "reserved",
    location: "B-02",
    list_price: 229,
    currency_code: "EUR",
    updated_at: "2026-08-10T10:00:00.000Z",
    lifecycle: projection("reserved", { needs_review: true }),
  },
  {
    id: "story-queue-003",
    sku: "DEMO-Q-003",
    category: "computer",
    brand: "Lenovo",
    model: "ThinkPad T14 Gen 4",
    specification: "16GB · 512GB SSD",
    status: "sold",
    location: "C-01",
    list_price: 749,
    currency_code: "EUR",
    updated_at: "2026-08-09T09:30:00.000Z",
    lifecycle: projection("sold_pending_pickup", {
      balance: 120,
      expected_pickup_at: "2026-08-15T10:00:00.000Z",
    }),
  },
  {
    id: "story-queue-004",
    sku: "DEMO-Q-004",
    category: "game_console",
    brand: "Nintendo",
    model: "Switch OLED",
    specification: "白色 · 主机套装",
    status: "returned",
    location: "D-04",
    list_price: 299,
    currency_code: "EUR",
    updated_at: "2026-08-08T09:30:00.000Z",
    lifecycle: projection("after_sales", { after_sales_status: "in_progress" }),
  },
];

const longItem: InventoryProductListItem = {
  ...completeItems[0],
  id: "story-queue-long",
  sku: "DEMO-QUEUE-LONG-SKU-2026-001",
  brand: "Nova Devices",
  model: "RepairDesk Demo Phone Ultra 5G 1TB Midnight Edition — Long Model Copy",
  specification: "12GB RAM · 1TB · 午夜黑 / 特别版",
  location: "展示柜-第二层-右侧-备用区-长文本",
  masked_identifier: "··· 6605",
  lifecycle: projection("in_stock"),
};

function QueueFrame({
  width = 390,
  items = completeItems,
  initialView = "shelf",
  showFilters = true,
}: {
  width?: number;
  items?: InventoryProductListItem[];
  initialView?: InventoryProductView;
  showFilters?: boolean;
}) {
  const [view, setView] = useState<InventoryProductView>(initialView);
  const [filters, setFilters] = useState<InventoryProductListFilters>({});
  const [search, setSearch] = useState("");
  const [shortcut, setShortcut] = useState<
    "all" | "in_stock" | "reserved" | "sold_pending_pickup" | "processing"
  >("all");
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const categories = filters.categories ?? [];
    return items.filter((item) => {
      if (categories.length && !categories.includes(item.category)) return false;
      if (!query) return true;
      return [item.sku, item.brand, item.model, item.specification, item.location]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    });
  }, [filters.categories, items, search]);

  const categoryControls = showFilters ? (
    <InventoryProductCategoryTabs
      filters={filters}
      onChange={(categories) => setFilters({ categories })}
    />
  ) : null;
  const lifecycleControls = showFilters ? (
    <InventoryLifecycleShortcutBar
      value={shortcut}
      counts={{
        in_stock: 2,
        reserved: 1,
        sold_pending_pickup: 1,
        processing: 1,
        after_sales: 1,
      }}
      onChange={setShortcut}
    />
  ) : null;

  return (
    <main
      className="min-w-0 bg-background p-3 text-foreground"
      style={{ width: `min(${width}px, 100vw)` }}
      data-story-full-page="true"
    >
      <h1 className="sr-only">商品库存</h1>
      <RepairOsListScaffold
        title="商品库存"
        subtitle={`${filteredItems.length} 件合成商品`}
        mobileLeading={<span aria-hidden="true" className="size-9 shrink-0" />}
        className={inventoryProductListScaffoldClassName}
        searchValue={search}
        searchPlaceholder="搜索商品、SKU、型号"
        onSearchChange={setSearch}
        filterAction={
          showFilters ? <InventoryProductViewToggle value={view} onChange={setView} /> : null
        }
        desktopHeaderAddon={
          showFilters ? (
            <div className="space-y-2">
              <div className="flex min-w-0 items-center justify-end gap-2">
                <InventoryProductViewToggle value={view} onChange={setView} />
              </div>
              {categoryControls}
              {lifecycleControls}
            </div>
          ) : null
        }
      >
        <div className="space-y-2 lg:hidden">
          {categoryControls}
          {lifecycleControls}
        </div>
        {filteredItems.length ? (
          <InventoryProductResults items={filteredItems} view={view} />
        ) : (
          <InventoryProductMessage
            title="没有符合条件的演示商品"
            body="更换搜索词或清除筛选。此 Story 只使用合成数据。"
            action={
              <button
                type="button"
                className="min-h-11 rounded-lg border border-border px-3 text-xs font-medium"
                onClick={() => {
                  setSearch("");
                  setFilters({});
                }}
              >
                清除筛选
              </button>
            }
          />
        )}
      </RepairOsListScaffold>
    </main>
  );
}

function FilteredEmptyFrame() {
  return (
    <main
      data-ui="inventory-product-queue-state"
      data-state-kind="filtered-empty"
      data-recovery-action="clear-filter"
      data-sensitive-dom="synthetic"
      className="min-w-0 bg-background p-3 text-foreground"
      style={{ width: "min(390px, 100vw)" }}
    >
      <div className="grid min-w-0 gap-2" role="status" aria-live="polite">
        <h1 className="text-sm font-semibold">商品库存筛选结果</h1>
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground">
          搜索：DEMO-Q-404
        </div>
        <InventoryProductMessage
          title="没有符合条件的商品"
          body="更换搜索词或清除筛选。当前查询仅用于演示空结果，不会修改库存。"
          action={
            <button
              type="button"
              className="min-h-11 rounded-lg border border-border px-3 text-xs"
              data-recovery-action="clear-filter"
            >
              清除筛选
            </button>
          }
        />
      </div>
    </main>
  );
}

function LoadingFrame() {
  return (
    <main
      data-ui="inventory-product-queue-state"
      data-state-kind="loading"
      data-recovery-action="wait"
      data-sensitive-dom="synthetic"
      className="min-w-0 bg-background p-3"
      style={{ width: "min(390px, 100vw)" }}
    >
      <div className="grid min-w-0 gap-2" role="status" aria-live="polite" aria-busy="true">
        <h1 className="text-sm font-semibold">商品库存加载中</h1>
        <p className="text-xs text-muted-foreground">正在准备商品结果</p>
        <InventoryProductListSkeleton />
      </div>
    </main>
  );
}

const stateButtonClass =
  "min-h-11 min-w-[7rem] rounded-lg border border-border px-3 text-xs font-medium";

function QueueStateFrame({
  state,
  title,
  body,
  role,
  recoveryAction,
  action,
  width = 390,
  busy = false,
  sensitiveDom = "synthetic",
}: {
  state: string;
  title: string;
  body: string;
  role: "status" | "alert";
  recoveryAction: string;
  action?: ReactNode;
  width?: number;
  busy?: boolean;
  sensitiveDom?: "synthetic" | "redacted";
}) {
  return (
    <main
      data-ui="inventory-product-queue-state"
      data-state-kind={state}
      data-recovery-action={recoveryAction}
      data-sensitive-dom={sensitiveDom}
      className="min-w-0 bg-background p-3 text-foreground"
      style={{ width: `min(${width}px, 100vw)` }}
    >
      <div
        className="grid min-w-0 gap-2"
        role={role}
        aria-live={role === "alert" ? "assertive" : "polite"}
        aria-busy={busy ? "true" : undefined}
      >
        <h1 className="text-sm font-semibold">{title}</h1>
        <InventoryProductMessage title={title} body={body} action={action} />
      </div>
    </main>
  );
}

const meta = {
  title: "Inventory/ProductQueueComponents",
  component: QueueFrame,
  parameters: {
    layout: "fullscreen",
    a11y: { disable: false },
  },
} satisfies Meta<typeof QueueFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CompleteShelfMobile390: Story = {
  args: { width: 390, items: completeItems, initialView: "shelf" },
};

export const CompactListMobile390: Story = {
  args: { width: 390, items: completeItems.slice(0, 3), initialView: "list" },
};

export const FilteredEmptyMobile390: Story = {
  render: () => <FilteredEmptyFrame />,
};

export const LoadingMobile390: Story = {
  render: () => <LoadingFrame />,
};

export const TrueEmptyMobile390: Story = {
  render: () => (
    <QueueStateFrame
      state="true-empty"
      title="队列为空"
      body="当前没有待处理记录。可以创建一条合成演示记录，或返回工作台。"
      role="status"
      recoveryAction="create-demo"
      action={
        <button type="button" className={stateButtonClass} data-recovery-action="create-demo">
          创建演示记录
        </button>
      }
    />
  ),
};

export const ErrorRetryMobile390: Story = {
  render: () => (
    <QueueStateFrame
      state="error"
      title="库存队列加载失败"
      body="暂时无法载入队列。请重试；本次失败不会改变库存。"
      role="alert"
      recoveryAction="retry"
      action={
        <button type="button" className={stateButtonClass} data-recovery-action="retry">
          重试
        </button>
      }
    />
  ),
};

export const OfflineStaleMobile390: Story = {
  render: () => (
    <QueueStateFrame
      state="offline"
      title="离线只读"
      body="网络不可用，当前展示 10:42 的陈旧快照。写入操作已禁用。"
      role="status"
      recoveryAction="reconnect"
      action={
        <button type="button" className={stateButtonClass} disabled aria-disabled="true">
          离线不可写
        </button>
      }
    />
  ),
};

export const PermissionDeniedMobile390: Story = {
  render: () => (
    <QueueStateFrame
      state="forbidden"
      title="没有访问权限"
      body="当前角色不能读取此模块。切换到有权限的角色后再试。"
      role="alert"
      recoveryAction="switch-role"
      sensitiveDom="redacted"
      action={
        <button type="button" className={stateButtonClass} data-recovery-action="switch-role">
          返回工作台
        </button>
      }
    />
  ),
};

export const FeatureOffMobile390: Story = {
  render: () => (
    <QueueStateFrame
      state="feature-off"
      title="模块未启用"
      body="当前门店尚未启用此功能。请联系管理员或返回工作台。"
      role="alert"
      recoveryAction="return"
      sensitiveDom="redacted"
      action={
        <button type="button" className={stateButtonClass} data-recovery-action="return">
          返回工作台
        </button>
      }
    />
  ),
};

export const ConflictMobile430: Story = {
  render: () => (
    <QueueStateFrame
      state="conflict"
      title="队列上下文已更新"
      body="服务器发现上下文已更新。你可以保留当前查看内容，或重新加载最新队列。"
      role="alert"
      recoveryAction="reload-or-keep"
      width={430}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={stateButtonClass} data-recovery-action="keep-context">
            保留当前内容
          </button>
          <button type="button" className={stateButtonClass} data-recovery-action="reload">
            重新加载
          </button>
        </div>
      }
    />
  ),
};

export const PartialSuccessMobile390: Story = {
  render: () => (
    <QueueStateFrame
      state="partial-success"
      title="部分完成，等待刷新"
      body="写入已成功，但最新队列刷新失败。未确认的结果不会被标记为完成。"
      role="status"
      recoveryAction="retry-refresh"
      action={
        <button type="button" className={stateButtonClass} data-recovery-action="retry-refresh">
          重试刷新
        </button>
      }
    />
  ),
};

export const PendingMobile390: Story = {
  render: () => (
    <QueueStateFrame
      state="pending"
      title="正在保存队列变更"
      body="请求仍在处理中。尚未确认成功，请保持此页面打开。"
      role="status"
      recoveryAction="wait"
      busy
      action={
        <button type="button" className={stateButtonClass} disabled aria-disabled="true">
          处理中
        </button>
      }
    />
  ),
};

export const LongTextMobile430: Story = {
  args: { width: 430, items: [longItem], initialView: "list" },
};

export const WideReadable: Story = {
  args: { width: 840, items: [...completeItems, longItem], initialView: "list" },
};
