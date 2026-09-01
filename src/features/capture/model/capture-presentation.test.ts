import { describe, expect, it } from "vitest";

import { getCapturePayloadDisplayLabel } from "./capture-presentation";

describe("capture presentation", () => {
  it("translates parser-owned labels while preserving dynamic values", () => {
    const payload = {
      kind: "serial" as const,
      raw: "Serial:C39ZQ123N70M",
      value: "C39ZQ123N70M",
      label: "序列号",
    };

    expect(getCapturePayloadDisplayLabel(payload, "it-IT")).toBe("Numero di serie");
    expect(payload.value).toBe("C39ZQ123N70M");
  });

  it("keeps unknown custom labels unchanged", () => {
    expect(
      getCapturePayloadDisplayLabel(
        { kind: "text", raw: "custom", value: "custom", label: "店铺自定义标签" },
        "it-IT",
      ),
    ).toBe("店铺自定义标签");
  });

  it("translates parser-owned invalid status labels", () => {
    expect(
      getCapturePayloadDisplayLabel(
        {
          kind: "customer_status_link",
          raw: "https://www.chinatech.in/r#invalid",
          value: "",
          label: "无效客户工单二维码",
          sensitive: true,
        },
        "en",
      ),
    ).toBe("Invalid customer repair QR code");
  });
});
