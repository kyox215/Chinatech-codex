"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import type {
  InventoryProductCategory,
  InventoryProductFaceIdStatus,
  InventoryProductIdentifierKind,
  InventoryProductIdentifierSource,
} from "@/lib/repairdesk/types";

import { InventoryProductFormWorkspace } from "./inventory-product-form-workspace";
import {
  createInventoryProductFormDraft,
  type InventoryProductFormDraft,
} from "../model/inventory-product-form";
import type { AppleColorApprovalOverlay } from "../model/device-color-policy";

type PreviewScenario = "generic" | "apple-approved" | "apple-pending";
type PreviewLayout = "desktop" | "compact";

const APPROVED_APPLE_COLORS = {
  "iPhone 15 Pro": [
    { id: "natural-titanium", name: "原色钛金属", swatches: ["#b8ad9e"] },
    { id: "blue-titanium", name: "蓝色钛金属", swatches: ["#4d5c6c"] },
    { id: "black-titanium", name: "黑色钛金属", swatches: ["#3a3a3c"] },
  ],
} as const satisfies AppleColorApprovalOverlay;

const PHONE_INTAKE_REQUIRED_IDENTIFIERS = { imei1: true } as const;

function createPreviewDraft(scenario: PreviewScenario): InventoryProductFormDraft {
  const draft = createInventoryProductFormDraft("phone");
  const isApple = scenario !== "generic";
  const isPending = scenario === "apple-pending";

  return {
    ...draft,
    brand: isApple ? "Apple" : "Samsung",
    model: isPending ? "iPhone 15 Pro 手动型号" : isApple ? "iPhone 15 Pro" : "Galaxy A55 5G",
    color: isPending ? "午夜色（历史值）" : isApple ? "原色钛金属" : "黑色",
    ram_capacity: "8 GB",
    storage_capacity: "256 GB",
    condition: "90",
    identifiers: {
      imei1: "",
      imei2: "",
      serial: "",
      eid: "",
    },
    list_price: "499",
    cost_amount: "310",
    location: "A-02",
    warranty_months: "6",
    notes: isPending
      ? "Apple 官方颜色映射待审核；历史颜色只读保留。"
      : "本地 Storybook 合成预览，不写入业务数据。",
    inspection_battery_health: "91",
    inspection_face_id_status: "not_tested",
    inspection_touched: true,
    specifications: { network_variant: "EU" },
  };
}

function updateDraftValue<K extends keyof InventoryProductFormDraft>(
  setDraft: React.Dispatch<React.SetStateAction<InventoryProductFormDraft>>,
  key: K,
  value: InventoryProductFormDraft[K],
) {
  setDraft((current) => ({ ...current, [key]: value }));
}

function InventoryProductFormPreview({
  scenario,
  layoutMode,
}: {
  scenario: PreviewScenario;
  layoutMode: PreviewLayout;
}) {
  const [draft, setDraft] = useState(() => createPreviewDraft(scenario));
  const isApple = scenario !== "generic";
  const isPending = scenario === "apple-pending";

  const updateIdentifier = (kind: InventoryProductIdentifierKind, value: string) => {
    setDraft((current) => ({
      ...current,
      identifiers: { ...current.identifiers, [kind]: value },
    }));
  };

  const updateIdentifierSource = (
    kind: InventoryProductIdentifierKind,
    source: Extract<InventoryProductIdentifierSource, "manual" | "scan">,
  ) => {
    setDraft((current) => ({
      ...current,
      identifier_sources: { ...current.identifier_sources, [kind]: source },
    }));
  };

  const updateSpecification = (key: string, value: string) => {
    setDraft((current) => ({
      ...current,
      specifications: { ...current.specifications, [key]: value },
    }));
  };

  const updateCategory = (category: InventoryProductCategory) => {
    updateDraftValue(setDraft, "category", category);
  };

  return (
    <main className="min-h-screen w-full bg-muted/20 p-3 text-foreground sm:p-4 lg:p-6">
      <div className="mx-auto w-full max-w-[1440px] space-y-3">
        <header className="rounded-xl border border-border bg-card px-3 py-3 shadow-sm sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Quick Entry / Storybook Preview
              </p>
              <h1 className="text-base font-semibold sm:text-lg">新增库存商品</h1>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
              <span className="rounded-full border border-border px-2 py-1">
                {layoutMode === "desktop" ? "desktop-workbench" : "mobile-compact"}
              </span>
              <span className="rounded-full border border-border px-2 py-1">
                {isPending
                  ? "Apple 官方颜色待审核"
                  : isApple
                    ? "Apple 已审核颜色"
                    : "非 Apple 通用颜色"}
              </span>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            仅使用本地合成 draft 与审核 overlay；可在 390 / 430 / 768 / 1024 / 1280 / 1440px
            视口核对布局、选择器和键盘焦点。
          </p>
        </header>

        <InventoryProductFormWorkspace
          draft={draft}
          idPrefix={`storybook-${scenario}-${layoutMode}`}
          layoutMode={layoutMode}
          surface="page"
          canEnterCost
          inspectionEnabled
          existingColor={isPending ? draft.color : undefined}
          approvedAppleColorOverlay={isApple && !isPending ? APPROVED_APPLE_COLORS : undefined}
          colorRequired={false}
          requiredIdentifierKinds={PHONE_INTAKE_REQUIRED_IDENTIFIERS}
          onCategoryChange={updateCategory}
          onBrandChange={(value) => updateDraftValue(setDraft, "brand", value)}
          onModelChange={(value) => updateDraftValue(setDraft, "model", value)}
          onRamChange={(value) => updateDraftValue(setDraft, "ram_capacity", value)}
          onStorageChange={(value) => updateDraftValue(setDraft, "storage_capacity", value)}
          onColorChange={(value) => updateDraftValue(setDraft, "color", value)}
          onInspectionBatteryHealthChange={(value) =>
            updateDraftValue(setDraft, "inspection_battery_health", value)
          }
          onInspectionFaceIdStatusChange={(value: InventoryProductFaceIdStatus) =>
            updateDraftValue(setDraft, "inspection_face_id_status", value)
          }
          onIdentifierChange={updateIdentifier}
          onIdentifierSource={updateIdentifierSource}
          onPrimaryIdentifierChange={(kind) =>
            updateDraftValue(setDraft, "primary_identifier_kind", kind)
          }
          onConditionChange={(value) => updateDraftValue(setDraft, "condition", value)}
          onGtinChange={(value) => updateDraftValue(setDraft, "gtin", value)}
          onSpecificationChange={updateSpecification}
          onListPriceChange={(value) => updateDraftValue(setDraft, "list_price", value)}
          onCostChange={(value) => updateDraftValue(setDraft, "cost_amount", value)}
          onLocationChange={(value) => updateDraftValue(setDraft, "location", value)}
          onWarrantyChange={(value) => updateDraftValue(setDraft, "warranty_months", value)}
          onNotesChange={(value) => updateDraftValue(setDraft, "notes", value)}
        />
      </div>
    </main>
  );
}

const meta = {
  title: "Inventory/QuickEntry/FormWorkspace",
  component: InventoryProductFormPreview,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "本地可验证的新增设备表单组合：桌面保持 desktop-workbench 三列工作台，手机保持 mobile-compact；不连接 API、Supabase 或生产数据。建议分别在 390、430、768、1024、1280、1440px 视口核对。",
      },
    },
  },
} satisfies Meta<typeof InventoryProductFormPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NonAppleGenericDesktop: Story = {
  args: { scenario: "generic", layoutMode: "desktop" },
};

export const NonAppleGenericMobile: Story = {
  args: { scenario: "generic", layoutMode: "compact" },
};

export const AppleApprovedDesktop: Story = {
  args: { scenario: "apple-approved", layoutMode: "desktop" },
};

export const AppleApprovedMobile: Story = {
  args: { scenario: "apple-approved", layoutMode: "compact" },
};

export const ApplePendingDesktop: Story = {
  args: { scenario: "apple-pending", layoutMode: "desktop" },
};

export const ApplePendingMobile: Story = {
  args: { scenario: "apple-pending", layoutMode: "compact" },
};
