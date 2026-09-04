import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CustomerFormDialog,
  type CustomerCreateIntent,
} from "@/features/customers/forms/customer-form-dialog";
import type { CustomerCreateInput, CustomerIntakeCandidate } from "@/lib/repairdesk/types";
import type { AppLocale } from "@/shared/i18n/locales";
import { LocaleProvider } from "@/shared/i18n/locale-provider";
import { translateMessage } from "@/shared/i18n/messages";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const { searchCustomerIntakeCandidates } = vi.hoisted(() => ({
  searchCustomerIntakeCandidates: vi.fn(),
}));

vi.mock("@/lib/repairdesk/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/repairdesk/api")>();
  return { ...actual, searchCustomerIntakeCandidates };
});

const locales = ["zh-CN", "it-IT", "en"] as const;
const initial: CustomerCreateInput = {
  name: "",
  phone_e164: "",
  contact_phones: [],
  preferred_channel: "whatsapp",
  language: "it",
  consent_marketing: false,
  consent_sms: false,
};
const dynamicName = "动态客户 Mario Ω";
const dynamicPhone = "+39 333 765 4321";
const dynamicNotes = "动态客户备注 Ω";

function t(locale: AppLocale, key: Parameters<typeof translateMessage>[1]) {
  return translateMessage(locale, key);
}

function renderDialog(
  locale: AppLocale,
  onSave: (input: CustomerCreateInput, intent: CustomerCreateIntent) => Promise<unknown> = vi
    .fn()
    .mockResolvedValue(undefined),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenExisting = vi.fn();
  const onStartOrderForExisting = vi.fn();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initialLocale={locale}>
        <CustomerFormDialog
          open
          title={t(locale, "customers.list.new")}
          activeStoreId="store-dynamic"
          initial={initial}
          busy={false}
          onOpenChange={vi.fn()}
          onSave={onSave}
          onOpenExisting={onOpenExisting}
          onStartOrderForExisting={onStartOrderForExisting}
        />
      </LocaleProvider>
    </QueryClientProvider>,
  );
  return { ...view, onOpenExisting, onStartOrderForExisting, queryClient };
}

function enterIdentity(locale: AppLocale) {
  fireEvent.change(screen.getByLabelText(t(locale, "customers.form.name"), { exact: false }), {
    target: { value: dynamicName },
  });
  fireEvent.change(screen.getByLabelText(t(locale, "customers.form.phone"), { exact: false }), {
    target: { value: dynamicPhone },
  });
}

async function waitForNoMatch(locale: AppLocale) {
  expect(await screen.findByText(t(locale, "customers.create.noDuplicate"))).toBeVisible();
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  searchCustomerIntakeCandidates.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CustomerFormDialog runtime i18n", () => {
  it.each(locales)("shows the localized verified no-match state in %s", async (locale) => {
    searchCustomerIntakeCandidates.mockResolvedValue([]);
    renderDialog(locale);
    enterIdentity(locale);

    await waitForNoMatch(locale);
    expect(
      screen.getByRole("button", { name: t(locale, "customers.create.saveView") }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: t(locale, "customers.create.saveOrder") }),
    ).toBeEnabled();
    expect(screen.getByDisplayValue(dynamicName)).toBeVisible();
    expect(screen.getByDisplayValue(dynamicPhone)).toBeVisible();
  });

  it.each(locales)(
    "blocks an exact identity conflict with localized reuse actions in %s",
    async (locale) => {
      searchCustomerIntakeCandidates.mockResolvedValue([
        {
          customer: {
            id: "customer-existing-dynamic",
            name: "既有客户 Dynamic Ω",
            phone_e164: "+393337654321",
            phone_raw: "393337654321",
            contact_phones: [],
            consent_marketing: false,
            consent_sms: false,
            preferred_channel: "whatsapp",
            language: "it",
          },
          exactMatch: true,
          phoneMatchKind: "exact_primary",
          nameMatchKind: "contains",
          historyDevices: [],
        } satisfies CustomerIntakeCandidate,
      ]);
      const { onOpenExisting, onStartOrderForExisting } = renderDialog(locale);
      enterIdentity(locale);

      await waitFor(() => {
        expect(screen.getByText(t(locale, "customers.create.duplicateTitle"))).toBeVisible();
        expect(screen.getByText("既有客户 Dynamic Ω")).toBeVisible();
      });
      fireEvent.click(
        screen.getByRole("button", { name: t(locale, "customers.create.openCustomer") }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: t(locale, "customers.create.startOrder") }),
      );
      expect(onOpenExisting).toHaveBeenCalledOnce();
      expect(onOpenExisting).toHaveBeenCalledWith("customer-existing-dynamic");
      expect(onStartOrderForExisting).toHaveBeenCalledOnce();
      expect(onStartOrderForExisting).toHaveBeenCalledWith("customer-existing-dynamic");
      expect(
        screen.getByRole("button", { name: t(locale, "customers.create.saveOrder") }),
      ).toBeDisabled();
    },
  );

  it.each(locales)(
    "shows a safe localized lookup error without the raw sentinel in %s",
    async (locale) => {
      searchCustomerIntakeCandidates.mockRejectedValue(new Error("RAW-LOOKUP-SENTINEL"));
      renderDialog(locale);
      enterIdentity(locale);

      expect(await screen.findByText(t(locale, "customers.create.checkFailed"))).toBeVisible();
      expect(screen.queryByText("RAW-LOOKUP-SENTINEL")).not.toBeInTheDocument();
      expect(screen.queryByText(t(locale, "customers.create.noDuplicate"))).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: t(locale, "customers.create.saveOrder") }),
      ).toBeDisabled();
    },
  );

  it.each(locales)(
    "keeps the dialog and dynamic draft after one rejected save in %s",
    async (locale) => {
      searchCustomerIntakeCandidates.mockResolvedValue([]);
      const onSave = vi.fn().mockRejectedValue(new Error("RAW-SAVE-SENTINEL"));
      renderDialog(locale, onSave);
      enterIdentity(locale);
      await userEvent.click(
        screen.getByRole("button", { name: t(locale, "customers.create.optional") }),
      );
      fireEvent.change(screen.getByLabelText(t(locale, "customers.form.customerNotes")), {
        target: { value: dynamicNotes },
      });
      await waitForNoMatch(locale);

      fireEvent.click(screen.getByRole("button", { name: t(locale, "customers.create.saveView") }));
      await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
      expect(await screen.findByText(t(locale, "customers.create.saveError"))).toBeVisible();
      expect(screen.getByRole("dialog", { name: t(locale, "customers.list.new") })).toBeVisible();
      expect(screen.getByDisplayValue(dynamicName)).toBeVisible();
      expect(screen.getByDisplayValue(dynamicPhone)).toBeVisible();
      expect(screen.getByDisplayValue(dynamicNotes)).toBeVisible();
      expect(screen.queryByText("RAW-SAVE-SENTINEL")).not.toBeInTheDocument();
    },
  );

  it("keeps both real create intents and inputs locale-invariant", async () => {
    const byLocale: unknown[][] = [];
    for (const locale of locales) {
      searchCustomerIntakeCandidates.mockResolvedValue([]);
      const onSave = vi.fn().mockResolvedValue(undefined);
      const view = renderDialog(locale, onSave);
      enterIdentity(locale);
      await userEvent.click(
        screen.getByRole("button", { name: t(locale, "customers.create.optional") }),
      );
      fireEvent.change(screen.getByLabelText(t(locale, "customers.form.customerNotes")), {
        target: { value: dynamicNotes },
      });
      await waitForNoMatch(locale);

      fireEvent.click(screen.getByRole("button", { name: t(locale, "customers.create.saveView") }));
      fireEvent.click(
        screen.getByRole("button", { name: t(locale, "customers.create.saveOrder") }),
      );
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
      byLocale.push(onSave.mock.calls);
      view.unmount();
      view.queryClient.clear();
    }

    expect(byLocale[1]).toEqual(byLocale[0]);
    expect(byLocale[2]).toEqual(byLocale[0]);
    const expectedInput = {
      ...initial,
      name: dynamicName,
      phone_e164: dynamicPhone,
      notes: dynamicNotes,
    };
    expect(byLocale[0]).toEqual([
      [expectedInput, "view_customer"],
      [expectedInput, "new_order"],
    ]);
  });
});
