import type { InventoryLifecycleCommand } from "@/lib/repairdesk/types";

export type InventoryDetailActionId =
  | "after-sales-work"
  | "view-after-sales"
  | "sale-collection"
  | "sale-pickup"
  | "sale-warranty"
  | "view-sale"
  | "reserve-product"
  | "inspection-editor"
  | "edit-product";

export type InventoryDetailNextAction =
  | {
      kind: "loading";
      label: "正在读取下一动作";
      reason: "lifecycle-loading";
    }
  | {
      kind: "action";
      id: InventoryDetailActionId;
      label: string;
      href?: string;
      target?: "inspection-editor";
      command?: InventoryLifecycleCommand;
      readOnly?: boolean;
    }
  | {
      kind: "none";
      reason: "no-server-action" | "lifecycle-ready-without-summary";
    };
