import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  InventoryProductFormDetails,
  type InventoryProductFormDetailsProps,
} from "./inventory-product-form";
import { createInventoryProductFormDraft } from "../model/inventory-product-form";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage, type MessageKey } from "@/shared/i18n/messages";

function renderDetails(overrides: Partial<InventoryProductFormDetailsProps> = {}) {
  const props: InventoryProductFormDetailsProps = {
    draft: createInventoryProductFormDraft("phone"),
    identifierSection: null,
    onConditionChange: vi.fn(),
    onGtinChange: vi.fn(),
    onSpecificationChange: vi.fn(),
    onListPriceChange: vi.fn(),
    onCostChange: vi.fn(),
    onLocationChange: vi.fn(),
    onWarrantyChange: vi.fn(),
    onNotesChange: vi.fn(),
    ...overrides,
  };
  return render(<InventoryProductFormDetails {...props} />);
}

describe("InventoryProductFormDetails", () => {
  it("keeps invalid field feedback linked and uses the accessible danger token", () => {
    renderDetails({ conditionInvalid: true });
    fireEvent.click(screen.getByRole("button", { name: /更多信息/ }));

    const field = screen.getByLabelText("成色");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAttribute("aria-describedby", "product-condition-error");
    expect(screen.getByText("请检查此字段")).toHaveClass("text-status-danger-foreground");
  });

  it.each(
    (
      [
        { layoutMode: "desktop", surface: "desktop" },
        { layoutMode: "compact", surface: "mobile" },
      ] as const
    ).flatMap(({ layoutMode, surface }) =>
      (["zh-CN", "it-IT", "en"] as const).flatMap((locale) =>
        [
          {
            category: "phone" as const,
            fieldKey: "network_variant",
            labelKey: "inventory2b4.quick.spec.networkVariant" as const,
            inputId: "product-spec-network_variant",
            triggerId: "product-spec-network_variant-preset",
            customValue: "Carrier-CUSTOM-网络",
            lastOption: "JP",
          },
          {
            category: "tablet" as const,
            fieldKey: "connectivity",
            labelKey: "inventory2b4.quick.spec.connectivity" as const,
            inputId: "product-spec-connectivity",
            triggerId: "product-spec-connectivity-preset",
            customValue: "Satellite-CUSTOM-联网",
            lastOption: "Wi-Fi + Cellular",
          },
          {
            category: "game_console" as const,
            fieldKey: "edition",
            labelKey: "inventory2b4.quick.spec.edition" as const,
            inputId: "product-spec-edition",
            triggerId: "product-spec-edition-preset",
            customValue: "Collector-CUSTOM-版本",
            lastOption: "Pro",
          },
          {
            category: "game_console" as const,
            fieldKey: "region",
            labelKey: "inventory2b4.quick.spec.region" as const,
            inputId: "product-spec-region",
            triggerId: "product-spec-region-preset",
            customValue: "Region-CUSTOM-区域",
            lastOption: "CN",
          },
          {
            category: "computer" as const,
            fieldKey: "disk_type",
            labelKey: "inventory2b4.quick.spec.diskType" as const,
            inputId: "product-spec-disk_type",
            triggerId: "product-spec-disk_type-preset",
            customValue: "Storage-CUSTOM-硬盘",
            lastOption: "NVMe",
          },
          {
            category: "phone" as const,
            fieldKey: undefined,
            labelKey: "inventory2b4.quick.form.warrantyMonths" as const,
            inputId: "product-warranty",
            triggerId: "product-warranty-preset",
            customValue: "18",
            lastOption: "24",
          },
        ].map((field) => ({ locale, layoutMode, surface, ...field })),
      ),
    ),
  )(
    "uses the real $surface disclosure in $locale and preserves canonical $inputId values",
    async ({
      locale,
      category,
      fieldKey,
      labelKey,
      inputId,
      triggerId,
      customValue,
      lastOption,
      layoutMode,
      surface,
    }) => {
      render(
        <LocaleProvider initialLocale={locale}>
          <FormDetailsDisclosureHarness
            category={category}
            fieldKey={fieldKey}
            customValue={customValue}
            layoutMode={layoutMode}
          />
        </LocaleProvider>,
      );

      const label = translateMessage(locale, labelKey as MessageKey);
      const presetLabel = translateMessage(locale, "inventory2b4.quick.form.presets", { label });
      const optionsName = translateMessage(locale, "inventory2b4.quick.select.optionsAria", {
        label: presetLabel,
      });
      const input = document.getElementById(inputId);
      const trigger = document.getElementById(triggerId);
      expect(input).toBeVisible();
      expect(input).toHaveValue(customValue);
      expect(document.querySelector(`label[for="${inputId}"]`)).toHaveTextContent(label);
      expect(trigger).toHaveAccessibleName(
        translateMessage(locale, "inventory2b4.quick.form.choosePreset"),
      );
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).not.toHaveAttribute("aria-controls");

      fireEvent.click(trigger!);
      await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
      expect(
        screen.getByRole("dialog", { name: surface === "mobile" ? presetLabel : optionsName }),
      ).toBeVisible();
      const controls = trigger?.getAttribute("aria-controls");
      expect(controls).toBeTruthy();
      const listbox = controls ? document.getElementById(controls) : null;
      expect(listbox).toHaveAttribute("role", "listbox");
      expect(listbox).toHaveAccessibleName(optionsName);
      expect(
        document.querySelector(`[data-inventory-selectable-field-surface="${surface}"]`),
      ).toBeInTheDocument();
      if (surface === "mobile") {
        expect(
          screen.getByText(
            translateMessage(locale, "inventory2b4.quick.select.closesAfterSelection"),
          ),
        ).toBeVisible();
      }
      const last = within(listbox!).getAllByRole("option").at(-1);
      expect(last).toHaveAccessibleName(
        fieldKey === undefined && lastOption !== "0"
          ? translateMessage(locale, "inventory2b4.quick.form.warrantyValue", {
              months: lastOption,
            })
          : lastOption,
      );
      if (locale !== "zh-CN") {
        expect(screen.queryByText(translateMessage("zh-CN", labelKey as MessageKey))).toBeNull();
        expect(document.body).not.toHaveTextContent("选择后会自动关闭");
      }

      fireEvent.keyDown(listbox!, { key: "Escape" });
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).not.toHaveAttribute("aria-controls");
      expect(input).toHaveValue(customValue);

      fireEvent.click(trigger!);
      const reopenedListbox = await screen.findByRole("listbox");
      const reopenedLast = within(reopenedListbox).getAllByRole("option").at(-1);
      fireEvent.click(reopenedLast!);
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(input).toHaveValue(lastOption);
    },
  );
});

function FormDetailsDisclosureHarness({
  category,
  fieldKey,
  customValue,
  layoutMode,
}: {
  category: "phone" | "tablet" | "computer" | "game_console";
  fieldKey?: string;
  customValue: string;
  layoutMode: "compact" | "desktop";
}) {
  const [draft, setDraft] = useState(() => {
    const next = createInventoryProductFormDraft(category);
    if (fieldKey) next.specifications = { [fieldKey]: customValue };
    else next.warranty_months = customValue;
    return next;
  });
  return (
    <InventoryProductFormDetails
      draft={draft}
      identifierSection={null}
      layoutMode={layoutMode}
      onConditionChange={(condition) => setDraft((current) => ({ ...current, condition }))}
      onGtinChange={(gtin) => setDraft((current) => ({ ...current, gtin }))}
      onSpecificationChange={(key, value) =>
        setDraft((current) => ({
          ...current,
          specifications: { ...current.specifications, [key]: value },
        }))
      }
      onListPriceChange={(list_price) => setDraft((current) => ({ ...current, list_price }))}
      onCostChange={(cost_amount) => setDraft((current) => ({ ...current, cost_amount }))}
      onLocationChange={(location) => setDraft((current) => ({ ...current, location }))}
      onWarrantyChange={(warranty_months) =>
        setDraft((current) => ({ ...current, warranty_months }))
      }
      onNotesChange={(notes) => setDraft((current) => ({ ...current, notes }))}
    />
  );
}
