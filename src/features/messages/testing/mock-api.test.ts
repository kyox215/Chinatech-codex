import { describe, expect, it } from "vitest";

import { getStoreSettings, updateStoreSettings } from "@/features/messages/testing/mock-api";
import { createStore } from "@/features/stores/testing/mock-api";

describe("message settings mock tenant parity", () => {
  it("provisions a newly created mock store with its own trimmed print address", async () => {
    const created = await createStore(
      {
        name: "  ZYG HOME Riparazioni  ",
        address: "  Via Demo 12, Siracusa  ",
      },
      { id: "owner-new", displayName: "Owner New" },
    );
    const store = created.activeStore;

    expect(store).toBeDefined();
    await expect(
      getStoreSettings({
        storeId: store?.id,
        storeName: store?.name,
        displayName: "Owner New",
      }),
    ).resolves.toMatchObject({
      store_id: store?.id,
      store_name: "ZYG HOME Riparazioni",
      store_address: "Via Demo 12, Siracusa",
      message_signature: "ZYG HOME Riparazioni",
      print_footer: "Grazie per aver scelto ZYG HOME Riparazioni.",
    });
  });

  it("keeps stores isolated and enforces expected store plus version CAS", async () => {
    const actorA = {
      storeId: "5248dda1-2b32-46cd-8ed0-d15386a9e8ed",
      displayName: "Owner A",
    };
    const actorB = {
      storeId: "4c48f33b-a46c-4adb-9bd4-771481ecf928",
      displayName: "Owner B",
    };
    const beforeA = await getStoreSettings(actorA);
    const beforeB = await getStoreSettings(actorB);

    const afterA = await updateStoreSettings(
      {
        section: "store",
        expectedStoreId: actorA.storeId,
        expectedUpdatedAt: beforeA.updated_at,
        input: {
          store_name: "Ripara Subito",
          store_address: beforeA.store_address,
          store_phone: beforeA.store_phone,
          store_whatsapp: beforeA.store_whatsapp,
          store_email: beforeA.store_email,
        },
      },
      actorA,
    );
    expect(afterA.store_id).toBe(actorA.storeId);
    expect((await getStoreSettings(actorB)).store_name).toBe(beforeB.store_name);
    await expect(
      updateStoreSettings(
        {
          section: "notifications",
          expectedStoreId: actorB.storeId,
          expectedUpdatedAt: afterA.updated_at,
          input: { print_footer: "Wrong", message_signature: "Wrong" },
        },
        actorA,
      ),
    ).rejects.toMatchObject({ code: "SETTINGS_STORE_CONTEXT_CHANGED" });
    await expect(
      updateStoreSettings(
        {
          section: "notifications",
          expectedStoreId: actorA.storeId,
          expectedUpdatedAt: beforeA.updated_at,
          input: { print_footer: "Stale", message_signature: "Stale" },
        },
        actorA,
      ),
    ).rejects.toMatchObject({ code: "SETTINGS_VERSION_CONFLICT" });
  });
});
