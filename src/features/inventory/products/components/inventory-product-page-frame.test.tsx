import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InventoryProductPageFrame } from "./inventory-product-page-frame";

describe("InventoryProductPageFrame", () => {
  it.each(["committed-refresh-failed", "committed-context-stale"] as const)(
    "includes a %s notice in the fullscreen feedback target without a separate error",
    (syncStatus) => {
      render(
        <InventoryProductPageFrame
          mode="intake"
          presentation="fullscreen"
          title="合成页面"
          subtitle="合成页面"
          onBack={vi.fn()}
          primaryLabel="保存"
          syncStatus={syncStatus}
          syncBlocked
        >
          <label htmlFor="sync-feedback-field">合成字段</label>
          <input id="sync-feedback-field" />
        </InventoryProductPageFrame>,
      );
      const notice = screen.getByRole("alert");
      expect(notice.closest('[data-ui="inventory-product-feedback"]')).not.toBeNull();
      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(screen.getByRole("textbox")).toBeDisabled();
      expect(
        Boolean(
          notice.compareDocumentPosition(screen.getByRole("textbox")) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ).toBe(true);
    },
  );

  it.each([
    { mode: "intake", surface: "page", presentation: "fullscreen", feedbackFirst: true },
    { mode: "intake", surface: "page", presentation: "standard", feedbackFirst: false },
    { mode: "edit", surface: "page", presentation: "fullscreen", feedbackFirst: true },
    { mode: "intake", surface: "dialog", presentation: "fullscreen", feedbackFirst: false },
  ] as const)(
    "keeps feedback single and only moves it before fields for $mode/$surface/$presentation",
    ({ mode, surface, presentation, feedbackFirst }) => {
      render(
        <InventoryProductPageFrame
          mode={mode}
          surface={surface}
          presentation={presentation}
          title="合成页面"
          subtitle="合成页面"
          onBack={vi.fn()}
          primaryLabel="保存"
          error="合成失败"
          recoveryMessage="合成恢复"
          conflict={<p>合成冲突</p>}
        >
          <label htmlFor="feedback-field">合成字段</label>
          <input id="feedback-field" />
        </InventoryProductPageFrame>,
      );
      const field = screen.getByRole("textbox");
      for (const text of ["合成失败", "合成恢复", "合成冲突"]) {
        expect(screen.getAllByText(text)).toHaveLength(1);
        expect(
          Boolean(
            screen.getByText(text).compareDocumentPosition(field) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        ).toBe(feedbackFirst);
      }
    },
  );

  it("associates the single fullscreen header action with the real form and retains disabled state", () => {
    const onSubmit = vi.fn((event) => event.preventDefault());
    const view = render(
      <InventoryProductPageFrame
        mode="intake"
        presentation="fullscreen"
        title="录入"
        subtitle="合成页面"
        onBack={vi.fn()}
        onContinue={vi.fn()}
        primaryLabel="保存"
        onSubmit={onSubmit}
      >
        <label htmlFor="fullscreen-field">合成字段</label>
        <input id="fullscreen-field" />
      </InventoryProductPageFrame>,
    );
    const save = screen.getByRole("button", { name: "保存" });
    expect(save.closest("form")).toBeNull();
    expect((save as HTMLButtonElement).form).toBe(screen.getByRole("textbox").closest("form"));
    fireEvent.click(save);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(view.container.querySelectorAll('[data-ui="inventory-product-actions"]')).toHaveLength(
      1,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

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
