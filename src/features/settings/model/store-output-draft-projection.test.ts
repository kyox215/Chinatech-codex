import { describe, expect, it } from "vitest";

import { getStoreOutputDraftProjectionCopy } from "@/features/settings/model/store-output-draft-projection";

describe("getStoreOutputDraftProjectionCopy", () => {
  it.each([
    [false, true, "保存这份草稿后预计解除阻断"],
    [true, false, "保存这份草稿后将阻断"],
    [true, true, "实际使用的仍是服务器版本"],
    [false, false, "实际缺失状态没有变化"],
  ])(
    "describes saved=%s and draft=%s without treating the draft as active",
    (saved, draft, copy) => {
      expect(getStoreOutputDraftProjectionCopy(saved, draft)).toContain(copy);
    },
  );
});
