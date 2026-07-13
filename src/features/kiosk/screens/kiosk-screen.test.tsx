import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { KIOSK_PUBLIC_ERROR_CODES } from "@/features/kiosk/model/kiosk-public-error";

import { KioskScreen } from "./kiosk-screen";

const tokenStorageKey = "repairdesk:kiosk-token";

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("KioskScreen public token recovery", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("removes cached customer data and the device token after revocation", async () => {
    window.localStorage.setItem(tokenStorageKey, "demo-kiosk-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            session: {
              session_type: "intake_contact",
              status: "active",
              submission_version: 0,
              expires_at: "2099-07-13T00:00:00.000Z",
            },
            device: { label: "Front iPad", status: "active" },
            store: { name: "Test Store" },
            order: {
              public_no: "SAFE-001",
              customer_name: "Cliente Riservato",
              customer_phone: "+39 333 000 0000",
              device_label: "Telefono Test",
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: "iPad 未绑定或已撤销",
            code: KIOSK_PUBLIC_ERROR_CODES.deviceUnauthorized,
          },
          401,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<KioskScreen />);

    expect(await screen.findByDisplayValue("Cliente Riservato")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "刷新任务" }));

    expect(
      await screen.findByText(
        "Questo iPad non è più autorizzato. Richiedi un nuovo codice allo staff.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Cliente Riservato")).not.toBeInTheDocument();
    expect(screen.queryByText("+39 333 000 0000")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(tokenStorageKey)).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("keeps the current form and customer input after a transient refresh failure", async () => {
    window.localStorage.setItem(tokenStorageKey, "demo-kiosk-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            session: {
              session_type: "intake_contact",
              status: "active",
              submission_version: 0,
              expires_at: "2099-07-13T00:00:00.000Z",
            },
            device: { label: "Front iPad", status: "active" },
            store: { name: "Test Store" },
            order: {
              public_no: "SAFE-002",
              customer_name: "Cliente Test",
              customer_phone: "+39 333 000 0000",
              device_label: "Telefono Test",
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { error: "Servizio temporaneamente non disponibile", code: "KIOSK_INTERNAL_ERROR" },
          500,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<KioskScreen />);

    const note = await screen.findByRole("textbox", { name: "Note" });
    await user.type(note, "Nota non ancora inviata");
    await user.click(screen.getByRole("button", { name: "刷新任务" }));

    expect(await screen.findByText(/Connessione temporaneamente non disponibile/)).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveValue("Nota non ancora inviata");
    expect(screen.getByDisplayValue("Cliente Test")).toBeVisible();
    expect(window.localStorage.getItem(tokenStorageKey)).toBe("demo-kiosk-token");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
