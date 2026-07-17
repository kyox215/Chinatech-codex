import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMessageTemplate,
  getStoreSettings,
  listMessageTemplates,
  updateStoreSettingsRow,
} from "@/features/messages/server/message-settings.repository";

const mocks = vi.hoisted(() => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => mocks.supabase,
}));

const missingStoreIdError = {
  code: "42703",
  message: "Could not find the 'store_id' column in the schema cache",
};

describe("message settings repository tenant boundaries", () => {
  beforeEach(() => {
    mocks.supabase.from.mockReset();
  });

  it("fails closed when store_settings lacks store_id instead of reading default settings", async () => {
    const settingsQuery = createSupabaseQuery({ data: null, error: missingStoreIdError });
    mocks.supabase.from.mockReturnValueOnce(settingsQuery);

    await expect(getStoreSettings("store_1")).rejects.toThrow("读取消息模板失败");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
    expect(mocks.supabase.from).toHaveBeenCalledWith("store_settings");
    expect(settingsQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
  });

  it("fails closed when message_templates list lacks store_id instead of listing global templates", async () => {
    const templatesQuery = createSupabaseQuery({ data: null, error: missingStoreIdError });
    mocks.supabase.from.mockReturnValueOnce(templatesQuery);

    await expect(listMessageTemplates("store_1")).rejects.toThrow("读取消息模板失败");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
    expect(mocks.supabase.from).toHaveBeenCalledWith("message_templates");
    expect(templatesQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
  });

  it("fails closed when message template detail lacks store_id instead of reading by id only", async () => {
    const templateQuery = createSupabaseQuery({ data: null, error: missingStoreIdError });
    mocks.supabase.from.mockReturnValueOnce(templateQuery);

    await expect(getMessageTemplate("tpl_1", "store_1")).rejects.toThrow("读取店铺设置失败");

    expect(mocks.supabase.from).toHaveBeenCalledTimes(1);
    expect(mocks.supabase.from).toHaveBeenCalledWith("message_templates");
    expect(templateQuery.eq).toHaveBeenCalledWith("id", "tpl_1");
    expect(templateQuery.eq).toHaveBeenCalledWith("store_id", "store_1");
  });

  it("initializes missing settings with the authenticated tenant name and no foreign address", async () => {
    const settingsQuery = createSupabaseQuery({ data: null, error: null });
    const insertedRow = storeSettingsRow({
      store_id: "store_partner",
      store_name: "Ripara Subito",
      print_footer: "Grazie per aver scelto Ripara Subito.",
      message_signature: "Ripara Subito",
    });
    const insertQuery = createSupabaseQuery({ data: insertedRow, error: null });
    mocks.supabase.from.mockReturnValueOnce(settingsQuery).mockReturnValueOnce(insertQuery);

    const result = await getStoreSettings("store_partner", "Ripara Subito");

    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: "store_partner",
        store_name: "Ripara Subito",
        store_address: "",
        public_base_url: "",
        print_footer: "Grazie per aver scelto Ripara Subito.",
        message_signature: "Ripara Subito",
      }),
    );
    expect(result).toMatchObject({
      store_id: "store_partner",
      store_name: "Ripara Subito",
      store_address: "",
    });
    expect(JSON.stringify(result)).not.toMatch(/ChinaTech|Floridia|Viale Vittorio Veneto/i);
  });

  it("updates only submitted section fields with an atomic store and version CAS", async () => {
    const updated = storeSettingsRow({
      store_id: "store_partner",
      store_name: "Ripara Subito",
      store_phone: "+39 333 1111111",
    });
    const updateQuery = createSupabaseQuery({ data: updated, error: null });
    mocks.supabase.from.mockReturnValueOnce(updateQuery);

    await updateStoreSettingsRow({
      input: { store_phone: "+39 333 1111111" },
      expectedUpdatedAt: "2026-07-12T00:00:00.000Z",
      actorId: "actor_1",
      storeId: "store_partner",
    });

    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        store_phone: "+39 333 1111111",
        updated_by: "actor_1",
      }),
    );
    const updatePayload = (updateQuery.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(updatePayload).not.toHaveProperty("store_name");
    expect(updatePayload).not.toHaveProperty("print_footer");
    expect(updateQuery.eq).toHaveBeenCalledWith("store_id", "store_partner");
    expect(updateQuery.eq).toHaveBeenCalledWith("updated_at", "2026-07-12T00:00:00.000Z");
    expect(updateQuery.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("normalizes and clears public customer portal URLs before saving", async () => {
    const normalized = storeSettingsRow({
      public_base_url: "https://example.test/customer",
    });
    const normalizeQuery = createSupabaseQuery({ data: normalized, error: null });
    mocks.supabase.from.mockReturnValueOnce(normalizeQuery);

    await updateStoreSettingsRow({
      input: { public_base_url: " https://user:pass@example.test/customer/?token=secret#top " },
      expectedUpdatedAt: "2026-07-12T00:00:00.000Z",
      actorId: "actor_1",
      storeId: "store_partner",
    });

    expect(normalizeQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ public_base_url: "https://example.test/customer" }),
    );

    const cleared = storeSettingsRow({ public_base_url: "" });
    const clearQuery = createSupabaseQuery({ data: cleared, error: null });
    mocks.supabase.from.mockReturnValueOnce(clearQuery);

    await updateStoreSettingsRow({
      input: { public_base_url: "   " },
      expectedUpdatedAt: "2026-07-12T00:00:00.000Z",
      actorId: "actor_1",
      storeId: "store_partner",
    });

    expect(clearQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ public_base_url: "" }),
    );
  });

  it("rejects unsafe public customer portal URLs before touching Supabase", async () => {
    await expect(
      updateStoreSettingsRow({
        input: { public_base_url: "http://example.test" },
        expectedUpdatedAt: "2026-07-12T00:00:00.000Z",
        actorId: "actor_1",
        storeId: "store_partner",
      }),
    ).rejects.toThrow("客户门户域名必须使用 HTTPS");

    expect(mocks.supabase.from).not.toHaveBeenCalled();
  });

  it("returns null for a lost CAS and defensively rejects a blank store name", async () => {
    const updateQuery = createSupabaseQuery({ data: null, error: null });
    mocks.supabase.from.mockReturnValue(updateQuery);

    await expect(
      updateStoreSettingsRow({
        input: { store_name: "   " },
        expectedUpdatedAt: "2026-07-12T00:00:00.000Z",
        actorId: "actor_1",
        storeId: "store_partner",
      }),
    ).rejects.toThrow("店铺名不能为空");
    expect(mocks.supabase.from).not.toHaveBeenCalled();

    await expect(
      updateStoreSettingsRow({
        input: { print_footer: "Footer" },
        expectedUpdatedAt: "2026-07-12T00:00:00.000Z",
        actorId: "actor_1",
        storeId: "store_partner",
      }),
    ).resolves.toBeNull();
  });
});

function createSupabaseQuery(result: { data: unknown; error: unknown }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    maybeSingle: vi.fn(() => result),
    single: vi.fn(() => result),
  };
  return query;
}

function storeSettingsRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "store-settings:store_partner",
    store_id: "store_partner",
    store_name: "Ripara Subito",
    store_address: "",
    store_phone: "",
    store_whatsapp: "",
    store_email: "",
    public_base_url: "",
    default_order_warranty_text: "6个月",
    default_order_warranty_months: 6,
    default_inventory_warranty_months: 12,
    print_footer: "",
    message_signature: "",
    created_at: "2026-07-12T00:00:00.000Z",
    updated_at: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}
