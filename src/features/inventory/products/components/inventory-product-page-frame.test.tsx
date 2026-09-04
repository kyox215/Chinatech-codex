import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InventoryProductPageFrame } from "./inventory-product-page-frame";

describe("InventoryProductPageFrame", () => {
  it("keeps the shared page shell and mobile actions at the 44px contract", () => {
    const onBack = vi.fn();
    const onSecondary = vi.fn();
    render(
      <InventoryProductPageFrame
        mode="edit"
        title="编辑合成商品"
        subtitle="合成页面"
        onBack={onBack}
        onSecondary={onSecondary}
        primaryLabel="保存修改"
        syncStatus="committed-refreshing"
        syncBlocked
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor="frame-fixture">合成字段</label>
        <input id="frame-fixture" />
      </InventoryProductPageFrame>,
    );

    const form = screen.getByRole("textbox").closest("form");
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存修改" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "返回商品详情" })).toHaveClass("size-11");
    expect(
      screen
        .getByTestId("inventory-product-page-frame")
        .querySelector('[data-ui="inventory-sync-status-panel"]'),
    ).toHaveAttribute("aria-live", "polite");
  });

  it("keeps explicit back and secondary actions local to the adapter", () => {
    const onBack = vi.fn();
    const onSecondary = vi.fn();
    render(
      <InventoryProductPageFrame
        mode="edit"
        title="编辑合成商品"
        subtitle="合成页面"
        onBack={onBack}
        onSecondary={onSecondary}
        primaryLabel="保存修改"
      >
        <p>合成数据</p>
      </InventoryProductPageFrame>,
    );

    fireEvent.click(screen.getByRole("button", { name: "返回商品详情" }));
    fireEvent.click(
      within(screen.getByTestId("inventory-product-page-frame")).getByRole("button", {
        name: "取消",
      }),
    );
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it("keeps long Italian Quick Entry actions wrap-safe without shrinking the touch target", () => {
    render(
      <InventoryProductPageFrame
        mode="intake"
        title="Inserimento rapido"
        subtitle="Prodotto sintetico"
        onBack={vi.fn()}
        onContinue={vi.fn()}
        continueLabel="Salva e continua l’inserimento"
        primaryLabel="Salva e visualizza prodotto"
      >
        <p>DATI SINTETICI</p>
      </InventoryProductPageFrame>,
    );

    const actions = screen
      .getByTestId("inventory-product-page-frame")
      .querySelector('[data-ui="inventory-product-actions"]');
    for (const label of ["Salva e continua l’inserimento", "Salva e visualizza prodotto"]) {
      expect(within(actions as HTMLElement).getByRole("button", { name: label })).toHaveClass(
        "h-auto",
        "min-h-11",
        "whitespace-normal",
        "text-center",
        "leading-tight",
      );
    }
  });
});
