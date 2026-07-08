import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMessageTemplate,
  getStoreSettings,
  listMessageTemplates,
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
});

function createSupabaseQuery(result: { data: unknown; error: unknown }) {
  const query = {
    ...result,
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    maybeSingle: vi.fn(() => result),
  };
  return query;
}
