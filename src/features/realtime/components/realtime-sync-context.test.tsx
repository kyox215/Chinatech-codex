import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { QueryFreshnessCoordinator } from "../model/query-freshness-coordinator";
import {
  RealtimeSyncContextProvider,
  useRealtimeCoordinator,
  useRealtimeSync,
  type RealtimeSyncContextValue,
} from "./realtime-sync-context";

describe("realtime screen subscription isolation", () => {
  it("status and flush timestamps update indicators without rerendering business consumers", () => {
    let screenRenders = 0;
    let indicatorRenders = 0;
    function BusinessScreen() {
      useRealtimeCoordinator();
      screenRenders += 1;
      return null;
    }
    function Indicator() {
      useRealtimeSync();
      indicatorRenders += 1;
      return null;
    }
    const children = (
      <>
        <BusinessScreen />
        <Indicator />
      </>
    );
    const coordinator = new QueryFreshnessCoordinator(new QueryClient());
    const base: RealtimeSyncContextValue = {
      coordinator,
      storeId: "store-a",
      connectionState: "connecting",
      lastSyncedAt: null,
    };
    const view = render(
      <RealtimeSyncContextProvider value={base}>{children}</RealtimeSyncContextProvider>,
    );
    for (let i = 1; i <= 10; i++) {
      view.rerender(
        <RealtimeSyncContextProvider value={{ ...base, connectionState: "live", lastSyncedAt: i }}>
          {children}
        </RealtimeSyncContextProvider>,
      );
    }
    expect(indicatorRenders).toBe(11);
    expect(screenRenders).toBe(1);
    view.rerender(
      <RealtimeSyncContextProvider value={{ ...base, storeId: "store-b" }}>
        {children}
      </RealtimeSyncContextProvider>,
    );
    expect(screenRenders).toBe(2);
    view.rerender(
      <RealtimeSyncContextProvider value={{ ...base, coordinator: null, storeId: null }}>
        {children}
      </RealtimeSyncContextProvider>,
    );
    expect(screenRenders).toBe(3);
    coordinator.dispose();
  });
});
