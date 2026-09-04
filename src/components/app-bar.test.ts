import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { getAppBarVisibilityClass, usesRepairOsMobileHeader } from "@/components/app-bar";

describe("AppBar responsive route contract", () => {
  it("uses the compact shell only on confirmed list routes", () => {
    expect(usesRepairOsMobileHeader("/customers")).toBe(true);
    expect(usesRepairOsMobileHeader("/inventory")).toBe(true);
    expect(usesRepairOsMobileHeader("/orders")).toBe(true);
    expect(usesRepairOsMobileHeader("/orders/new")).toBe(true);
    expect(usesRepairOsMobileHeader("/settings/closed-stores")).toBe(true);
    expect(usesRepairOsMobileHeader("/toolkit")).toBe(true);
    expect(usesRepairOsMobileHeader("/customers/id")).toBe(false);
    expect(usesRepairOsMobileHeader("/inventory/id")).toBe(false);
    expect(usesRepairOsMobileHeader("/orders/id")).toBe(false);
  });

  it("keeps the legacy mobile-only hide for unconfirmed subpages", () => {
    expect(getAppBarVisibilityClass("/customers")).toBe("max-lg:hidden");
    expect(getAppBarVisibilityClass("/inventory")).toBe("max-lg:hidden");
    expect(getAppBarVisibilityClass("/orders")).toBe("max-lg:hidden");
    expect(getAppBarVisibilityClass("/orders/new")).toBe("max-lg:hidden");
    expect(getAppBarVisibilityClass("/settings/closed-stores")).toBe("max-lg:hidden");
    expect(getAppBarVisibilityClass("/toolkit")).toBe("max-lg:hidden");
    expect(getAppBarVisibilityClass("/customers/id")).toBe("max-md:hidden");
    expect(getAppBarVisibilityClass("/inventory/id")).toBe("max-md:hidden");
    expect(getAppBarVisibilityClass("/inventory/new")).toBe("max-md:hidden");
    expect(getAppBarVisibilityClass("/orders/id")).toBe("max-md:hidden");
    expect(getAppBarVisibilityClass("/dashboard")).toBe("");
  });

  it("keeps global search in the sidebar as the single desktop-shell entry", () => {
    const appBarSource = readFileSync(resolve(process.cwd(), "src/components/app-bar.tsx"), "utf8");
    const sidebarSource = readFileSync(
      resolve(process.cwd(), "src/components/app-sidebar.tsx"),
      "utf8",
    );
    const workspaceBrandSource = readFileSync(
      resolve(process.cwd(), "src/components/workspace-brand-search.tsx"),
      "utf8",
    );
    const providersSource = readFileSync(resolve(process.cwd(), "src/app/providers.tsx"), "utf8");

    expect(appBarSource).not.toContain('aria-label="打开全局搜索"');
    expect(sidebarSource).toContain("WorkspaceBrandSearch");
    expect(workspaceBrandSource).toContain('aria-label={t("shell.openSearch")}');
    expect(sidebarSource).toContain("onOpenCommand");
    expect(workspaceBrandSource).toContain("group-data-[collapsible=icon]:hidden");
    expect(workspaceBrandSource).toContain("ml-auto flex size-11");
    expect(workspaceBrandSource).toContain('data-workspace-search-trigger="true"');
    expect(providersSource).toContain("<AppSidebar onOpenCommand={() => setOpen(true)} />");
    expect(providersSource).not.toContain("<AppBar\n                      onOpenCommand");
    expect(appBarSource).toContain('className="min-w-0 flex-1"');
    expect(appBarSource).toContain("scannerTriggerRef.current?.focus({ preventScroll: true })");
    expect(appBarSource).toContain("scannerTriggerRef?: RefObject<HTMLButtonElement | null>");
    expect(providersSource).toContain(
      "const scannerTriggerRef = useRef<HTMLButtonElement | null>(null);",
    );
    expect(providersSource).toContain("window.requestAnimationFrame");
    expect(providersSource).toContain("onOpenScanner={openScannerFromCommand}");

    const customerDetailSource = readFileSync(
      resolve(process.cwd(), "src/features/customers/screens/customer-detail-screen.tsx"),
      "utf8",
    );
    const productDetailSource = readFileSync(
      resolve(
        process.cwd(),
        "src/features/inventory/products/components/inventory-product-detail-workbench.tsx",
      ),
      "utf8",
    );
    expect(customerDetailSource).toContain("CustomerMobileFloatingHeader");
    expect(customerDetailSource).toContain('aria-label={t("customers.detail.back")}');
    expect(productDetailSource).toContain('aria-label={t("inventory2b4.detail.back")}');
    expect(productDetailSource).toContain("size-11 rounded-lg lg:hidden");

    const orderTaskSource = readFileSync(
      resolve(process.cwd(), "src/features/orders/screens/order-task-screen.tsx"),
      "utf8",
    );
    expect(orderTaskSource).toContain('href="/orders"');
    expect(orderTaskSource).toContain('aria-label={t("orders2b1.task.backOrdersAria")}');
    expect(orderTaskSource).toContain('className="size-9 rounded-lg lg:hidden"');
    expect(orderTaskSource).toContain("min-w-0 flex-1 text-center");
  });
});
