import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { initialNewOrderForm } from "@/features/orders/model/new-order-form";
import type { DeviceCustodyStatus } from "@/lib/repairdesk/types";

import { NewOrderDeviceUnlockSection } from "./new-order-customer-device-section";

describe("NewOrderDeviceUnlockSection", () => {
  it.each([null, "with_shop", "with_customer"] as const)(
    "keeps phone-password editing available when custody is %s",
    (deviceCustodyStatus: DeviceCustodyStatus | null) => {
      render(
        <NewOrderDeviceUnlockSection
          form={{ ...initialNewOrderForm, deviceCustodyStatus }}
          setForm={vi.fn()}
        />,
      );

      expect(screen.getByRole("heading", { name: "手机密码" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "无" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "文字" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "PIN" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "图案" })).toBeEnabled();
    },
  );
});
