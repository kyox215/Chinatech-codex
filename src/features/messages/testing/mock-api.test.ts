import { describe, expect, it } from "vitest";

import { getStoreSettings, updateStoreSettings } from "@/features/messages/testing/mock-api";

describe("message settings mock tenant parity", () => {
  it("returns and preserves the actor store identity", async () => {
    const actor = { storeId: "store-a", displayName: "Owner" };

    expect((await getStoreSettings(actor)).store_id).toBe("store-a");
    expect((await updateStoreSettings({ store_name: "Ripara Subito" }, actor)).store_id).toBe(
      "store-a",
    );
  });
});
