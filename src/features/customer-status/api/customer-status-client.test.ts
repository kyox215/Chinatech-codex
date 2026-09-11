import { afterEach, describe, expect, it, vi } from "vitest";
import { issueCustomerStatusLinks } from "./customer-status-client";

afterEach(() => vi.unstubAllGlobals());

describe("customer status link preparation failure contract", () => {
  it.each([401, 403, 503])("retains HTTP %s for localized caller recovery", async (status) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: "Internal diagnostic", code: "FORBIDDEN" } }),
          { status },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await expect(
      issueCustomerStatusLinks(["synthetic-order"], { signal: controller.signal }),
    ).rejects.toMatchObject({ status, code: "FORBIDDEN" });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "/api/repairdesk/customer-status-links/issue",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        body: JSON.stringify({ order_ids: ["synthetic-order"] }),
      }),
    );
  });

  it("retains the stable top-level code and does not turn invalid success content into links", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "denied", code: "FORBIDDEN" }), { status: 403 }),
        )
        .mockResolvedValueOnce(new Response("{}", { status: 200 })),
    );
    await expect(issueCustomerStatusLinks(["synthetic-order"])).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
    await expect(issueCustomerStatusLinks(["synthetic-order"])).rejects.toBeInstanceOf(Error);
  });

  it("preserves successful link results without changing the request", async () => {
    const links = [
      { order_id: "synthetic-order", url: "https://example.invalid/r#synthetic-only" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ links }), { status: 200 })),
    );
    await expect(issueCustomerStatusLinks(["synthetic-order"])).resolves.toEqual(links);
  });
});
