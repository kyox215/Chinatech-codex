import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingsLayout } from "@/features/settings/components/settings-layout";
import { getSettingsSection } from "@/features/settings/model/settings-section-registry";

describe("SettingsLayout", () => {
  it("keeps stable rail and content hooks for the overview", () => {
    const { container } = render(
      <SettingsLayout activeSection={null} rail={<div>导航</div>}>
        <div>总览</div>
      </SettingsLayout>,
    );

    expect(container.querySelector("[data-settings-layout]")).toBeInTheDocument();
    expect(container.querySelector("[data-settings-rail]")).toHaveTextContent("导航");
    expect(container.querySelector("[data-settings-content]")).toHaveTextContent("总览");
    expect(container.querySelector("[data-settings-tablet-back]")).not.toBeInTheDocument();
  });

  it("leaves subpage return ownership to the shared floating header", () => {
    render(
      <SettingsLayout activeSection={getSettingsSection("store")} rail={<div>导航</div>}>
        <div>店铺资料</div>
      </SettingsLayout>,
    );

    expect(screen.queryByRole("link", { name: "返回设置总览" })).not.toBeInTheDocument();
  });
});
