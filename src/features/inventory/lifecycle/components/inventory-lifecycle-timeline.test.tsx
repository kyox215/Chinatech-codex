import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "@/shared/i18n/locale-provider";
import type { AppLocale } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

import { InventoryLifecycleTimeline } from "./inventory-lifecycle-timeline";

describe("InventoryLifecycleTimeline", () => {
  it("labels summary milestones as incomplete history and keeps native time values", () => {
    render(
      <InventoryLifecycleTimeline
        source="milestone-summary"
        result={{
          items: [
            {
              id: "m1",
              label: "设备检测",
              at: "2026-08-02T10:00:00.000Z",
              source: "milestone-summary",
            },
          ],
          scope: {
            source: "milestone-summary",
            totalValid: 1,
            displayedCount: 1,
            label: "当前摘要确认 1 项关键里程碑（不是完整审计历史）",
          },
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "关键里程碑（摘要）" })).toBeVisible();
    expect(screen.getByText(/不是完整审计历史/)).toBeVisible();
    expect(screen.getByRole("time")).toHaveAttribute("datetime", "2026-08-02T10:00:00.000Z");
  });

  it("uses list semantics and does not expose item details in privacy mode", () => {
    render(
      <InventoryLifecycleTimeline
        source="ledger-event"
        privacyRedacted
        items={[
          {
            id: "event-1",
            label: "建立案件",
            at: "2026-08-02T10:00:00.000Z",
            source: "ledger-event",
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "案件历史（服务端事件账）" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("详情已按隐私边界裁剪");
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("announces loading without pretending to know events", () => {
    render(<InventoryLifecycleTimeline source="ledger-event" status="loading" />);
    const section = screen.getByRole("region");
    expect(section).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(/正在读取时间线/);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it.each(["zh-CN", "it-IT", "en"] as const)(
    "localizes stable ledger facts while preserving unknown canonical statuses in %s",
    (locale) => {
      const dynamicStatus = "CUSTOM-状态-SENTINEL";
      renderTimeline(locale, [
        {
          id: "known-event",
          label: "RAW-KNOWN-LABEL",
          at: "2026-10-25T01:30:00.000Z",
          source: "ledger-event",
          eventType: "status_changed",
          fromStatus: "in_stock",
          toStatus: "reserved",
          fromStatusLabel: "RAW-FROM-LABEL",
          toStatusLabel: "RAW-TO-LABEL",
        },
        {
          id: "unknown-event",
          label: "RAW-UNKNOWN-LABEL",
          at: "2026-10-25T00:30:00.000Z",
          source: "ledger-event",
          eventType: "future_event",
          fromStatus: dynamicStatus,
          toStatus: "future_status",
          fromStatusLabel: dynamicStatus,
          toStatusLabel: "future_status",
        },
        {
          id: "after-sales-open-event",
          label: "RAW-AFTER-SALES-LABEL",
          at: "2026-10-24T23:30:00.000Z",
          source: "ledger-event",
          eventType: "status_changed",
          fromStatus: "open",
          toStatus: "waiting_customer",
          fromStatusLabel: "RAW-OPEN-LABEL",
          toStatusLabel: "RAW-WAITING-LABEL",
        },
      ]);

      expect(
        screen.getByRole("heading", {
          name: translateMessage(locale, "inventory2b4.timeline.title.events"),
        }),
      ).toBeVisible();
      expect(
        screen.getAllByText(translateMessage(locale, "inventory2b4.timeline.event.statusChanged")),
      ).toHaveLength(2);
      expect(
        screen.getByText(translateMessage(locale, "inventory2b4.timeline.event.generic")),
      ).toBeVisible();
      expect(
        screen.getByText(
          `${translateMessage(locale, "inventory2b4.lifecycle.status.inStock")} → ${translateMessage(
            locale,
            "inventory2b4.lifecycle.status.reserved",
          )}`,
        ),
      ).toBeVisible();
      expect(screen.getByText(`${dynamicStatus} → future_status`)).toBeVisible();
      expect(
        screen.getByText(
          `${translateMessage(locale, "inventory2b4.timeline.status.awaitingInspection")} → ${translateMessage(
            locale,
            "inventory2b4.afterSales.waitingCustomer",
          )}`,
        ),
      ).toBeVisible();
      expect(screen.getAllByRole("time")[0]).toHaveAttribute(
        "datetime",
        "2026-10-25T01:30:00.000Z",
      );
      expect(document.body).not.toHaveTextContent(
        /RAW-KNOWN|RAW-UNKNOWN|RAW-FROM|RAW-TO|RAW-AFTER-SALES|RAW-OPEN|RAW-WAITING/,
      );
    },
  );
});

function renderTimeline(
  locale: AppLocale,
  items: Parameters<typeof InventoryLifecycleTimeline>[0]["items"],
) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <InventoryLifecycleTimeline source="ledger-event" items={items} />
    </LocaleProvider>,
  );
}
