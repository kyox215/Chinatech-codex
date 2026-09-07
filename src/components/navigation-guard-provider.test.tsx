import { useEffect, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnsavedSettingsGuard } from "@/features/settings/components/unsaved-settings-guard";
import { NavigationGuardProvider, useNavigationGuard } from "./navigation-guard-provider";

const navigationMocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigationMocks.push }),
}));

describe("NavigationGuardProvider", () => {
  beforeEach(() => {
    navigationMocks.push.mockReset();
    window.history.replaceState({}, "", "/settings?section=store");
  });

  it("keeps the first link target pending and supports cancel then save", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(
      <NavigationGuardProvider>
        <GuardHarness onSave={save} />
        <a href="/orders">工单</a>
        <a href="/customers">客户</a>
      </NavigationGuardProvider>,
    );

    const ordersLink = screen.getByRole("link", { name: "工单" });
    const customersLink = screen.getByRole("link", { name: "客户" });
    await user.click(ordersLink);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(customersLink);
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(navigationMocks.push).not.toHaveBeenCalled();

    await user.click(ordersLink);
    await user.click(screen.getByRole("button", { name: "保存并继续" }));
    await waitFor(() => expect(navigationMocks.push).toHaveBeenCalledTimes(1));
    expect(navigationMocks.push).toHaveBeenCalledWith("/orders", { scroll: true });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("discards once before an imperative transition and blocks double targets", async () => {
    const user = userEvent.setup();
    const discard = vi.fn();
    let transitionState: { guardConnected: boolean; pointerEvents: string } | undefined;
    const first = vi.fn(() => {
      transitionState = {
        guardConnected: Boolean(document.querySelector('[data-navigation-guard-dialog="true"]')),
        pointerEvents: document.body.style.pointerEvents,
      };
    });
    const second = vi.fn();
    const secondOutcome = vi.fn();
    render(
      <NavigationGuardProvider>
        <GuardHarness onDiscard={discard} />
        <TransitionButton label="第一个" run={first} />
        <TransitionButton label="第二个" run={second} onOutcome={secondOutcome} />
      </NavigationGuardProvider>,
    );

    const firstButton = screen.getByRole("button", { name: "第一个" });
    const secondButton = screen.getByRole("button", { name: "第二个" });
    await user.click(firstButton);
    fireEvent.click(secondButton);
    await waitFor(() =>
      expect(secondOutcome).toHaveBeenCalledWith({
        status: "ignored",
        reason: "transition-pending",
      }),
    );
    await user.click(screen.getByRole("button", { name: "放弃修改" }));
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));
    expect(transitionState).toEqual({ guardConnected: false, pointerEvents: "" });
    expect(second).not.toHaveBeenCalled();
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it("releases the whole guard before one transition when exit animation acknowledgement is late", async () => {
    vi.useFakeTimers();
    const nativeStyle = window.getComputedStyle.bind(window);
    const computedStyle = vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      const style = nativeStyle(element);
      const guardLayer =
        element.hasAttribute("data-navigation-guard-dialog") ||
        element.classList.contains("bg-[var(--overlay-scrim)]");
      if (!guardLayer) return style;
      // Model browser Presence retaining both layers until animationend is delivered.
      return new Proxy(style, {
        get(target, property) {
          if (property === "animationName")
            return element.getAttribute("data-state") === "closed" ? "guard-exit" : "guard-enter";
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const discard = vi.fn();
    const run = vi.fn();
    let dirty = true;
    function ImmediateGuard() {
      const { registerGuard } = useNavigationGuard();
      useEffect(
        () =>
          registerGuard({
            id: "slow-presence",
            label: () => "录入草稿",
            isDirty: () => dirty,
            isBusy: () => false,
            discard: () => {
              dirty = false;
              discard();
              return { status: "resolved" };
            },
            save: async () => ({ status: "blocked" }),
          }),
        [registerGuard],
      );
      return null;
    }
    const view = render(
      <NavigationGuardProvider>
        <ImmediateGuard />
        <TransitionButton label="关闭录入" run={run} />
      </NavigationGuardProvider>,
    );
    try {
      fireEvent.click(screen.getByRole("button", { name: "关闭录入" }));
      const guard = screen.getByRole("alertdialog");
      const overlay = document.querySelector('[class~="bg-[var(--overlay-scrim)]"]');
      expect(overlay).not.toBeNull();
      run.mockImplementation(() => {
        expect(guard.isConnected).toBe(false);
        expect(overlay?.isConnected).toBe(false);
        expect(document.body.style.pointerEvents).not.toBe("none");
      });
      fireEvent.click(screen.getByRole("button", { name: "放弃修改" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
        fireEvent.animationEnd(guard, { animationName: "guard-exit" });
        if (overlay) fireEvent.animationEnd(overlay, { animationName: "guard-exit" });
        await vi.advanceTimersByTimeAsync(32);
      });
      expect(dirty).toBe(false);
      expect(run).toHaveBeenCalledTimes(1);
      expect(discard).toHaveBeenCalledTimes(1);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      computedStyle.mockRestore();
      consoleError.mockRestore();
      vi.useRealTimers();
    }
  });

  it("uses native beforeunload only while dirty and restores history methods on unmount", () => {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    const view = render(
      <NavigationGuardProvider>
        <GuardHarness />
      </NavigationGuardProvider>,
    );

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(window.history.pushState).not.toBe(originalPushState);
    expect(window.history.replaceState).not.toBe(originalReplaceState);

    view.unmount();
    expect(window.history.pushState).toBe(originalPushState);
    expect(window.history.replaceState).toBe(originalReplaceState);
  });

  it("runs clean imperative transitions without opening a dialog", async () => {
    const run = vi.fn();
    const onOutcome = vi.fn();
    render(
      <NavigationGuardProvider>
        <GuardHarness initialDirty={false} />
        <TransitionButton label="直接前往" run={run} onOutcome={onOutcome} />
      </NavigationGuardProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "直接前往" }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith({ status: "executed" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("returns an observable busy outcome without opening an unusable dialog", async () => {
    const onOutcome = vi.fn();
    render(
      <NavigationGuardProvider>
        <GuardHarness busy />
        <TransitionButton label="忙碌时前往" run={vi.fn()} onOutcome={onOutcome} />
      </NavigationGuardProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "忙碌时前往" }));
    await waitFor(() =>
      expect(onOutcome).toHaveBeenCalledWith({ status: "ignored", reason: "source-busy" }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("returns a failed outcome instead of swallowing transition errors", async () => {
    const onOutcome = vi.fn();
    const error = new Error("NAVIGATION_SECRET_SENTINEL");
    error.stack = "STACK_SECRET_SENTINEL";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <NavigationGuardProvider>
        <GuardHarness initialDirty={false} />
        <TransitionButton
          label="失败导航"
          run={() => Promise.reject(error)}
          onOutcome={onOutcome}
        />
      </NavigationGuardProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "失败导航" }));
    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith({ status: "failed", error }));
    expect(consoleError).toHaveBeenCalledWith("[navigation-guard] transition failed");
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(
      /NAVIGATION_SECRET_SENTINEL|STACK_SECRET_SENTINEL/,
    );
    consoleError.mockRestore();
  });

  it("keeps a blocked resolution focus target without calling the fallback", async () => {
    const user = userEvent.setup();
    const fallback = vi.fn();
    render(
      <NavigationGuardProvider>
        <UnsavedSettingsGuard
          dirty
          busy={false}
          label="店铺资料分组"
          onSave={async () => ({
            status: "blocked",
            focus: () => screen.getByLabelText("错误字段").focus(),
          })}
          onDiscard={() => ({ status: "blocked" })}
          onFocusFallback={fallback}
        />
        <input aria-label="错误字段" />
        <a href="/orders">离开页面</a>
      </NavigationGuardProvider>,
    );

    await user.click(screen.getByRole("link", { name: "离开页面" }));
    await user.click(screen.getByRole("button", { name: "保存并继续" }));
    await waitFor(() => expect(screen.getByLabelText("错误字段")).toHaveFocus());
    expect(fallback).not.toHaveBeenCalled();
    expect(navigationMocks.push).not.toHaveBeenCalled();
  });

  it("explains and disables save when a draft has no safe apply contract", async () => {
    const user = userEvent.setup();
    render(
      <NavigationGuardProvider>
        <UnsavedSettingsGuard
          dirty
          busy={false}
          canSave={false}
          saveUnavailableReason="状态流需等待事务接口获批后才能应用。"
          label="工单状态流草稿"
          onSave={async () => ({ status: "blocked" })}
          onDiscard={() => ({ status: "resolved" })}
        />
        <a href="/orders">离开状态流</a>
      </NavigationGuardProvider>,
    );

    await user.click(screen.getByRole("link", { name: "离开状态流" }));

    expect(screen.getByRole("button", { name: "保存并继续" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("状态流需等待事务接口获批后才能应用");
  });

  it("resolves multiple dirty sources before running one transition", async () => {
    const user = userEvent.setup();
    const firstSave = vi.fn();
    const secondSave = vi.fn();
    render(
      <NavigationGuardProvider>
        <GuardHarness id="first" label="第一个草稿" onSave={firstSave} />
        <GuardHarness id="second" label="第二个草稿" onSave={secondSave} />
        <a href="/orders">前往工单</a>
      </NavigationGuardProvider>,
    );

    await user.click(screen.getByRole("link", { name: "前往工单" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("第二个草稿");
    await user.click(screen.getByRole("button", { name: "保存并继续" }));
    await waitFor(() => expect(secondSave).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("第一个草稿");
    expect(navigationMocks.push).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "保存并继续" }));
    await waitFor(() => expect(firstSave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigationMocks.push).toHaveBeenCalledTimes(1));
  });
});

function GuardHarness({
  id,
  label = "店铺资料分组",
  initialDirty = true,
  busy = false,
  onSave,
  onDiscard,
}: {
  id?: string;
  label?: string;
  initialDirty?: boolean;
  busy?: boolean;
  onSave?: () => void;
  onDiscard?: () => void;
}) {
  const [dirty, setDirty] = useState(initialDirty);
  return (
    <UnsavedSettingsGuard
      id={id}
      dirty={dirty}
      busy={busy}
      label={label}
      onSave={async () => {
        onSave?.();
        setDirty(false);
        return { status: "resolved" };
      }}
      onDiscard={() => {
        onDiscard?.();
        setDirty(false);
        return { status: "resolved" };
      }}
    />
  );
}

function TransitionButton({
  label,
  run,
  onOutcome,
}: {
  label: string;
  run: () => void | Promise<unknown>;
  onOutcome?: (outcome: unknown) => void;
}) {
  const { runGuardedTransition } = useNavigationGuard();
  return (
    <button
      type="button"
      onClick={() => {
        void runGuardedTransition({ kind: "route", label, run }).then(onOutcome);
      }}
    >
      {label}
    </button>
  );
}
