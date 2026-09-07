import { describe, expect, it } from "vitest";
import {
  classifyOrderTransitionFailure,
  getFailedOrderTransitionIds,
  orderTransitionFailureCodes,
} from "./order-bulk-transition";

describe("safe bulk transition failures", () => {
  it.each(orderTransitionFailureCodes)("preserves stable code %s", (code) => {
    expect(classifyOrderTransitionFailure(code)).toBe(code);
    expect(classifyOrderTransitionFailure({ code, message: "SECRET_SENTINEL" })).toBe(code);
  });

  it.each([
    [new Error("工单不存在"), "NOT_FOUND"],
    [new Error("工单已被更新，请刷新后再试"), "CONFLICT"],
    [new Error("「店铺自定义状态」已停用，不能流转到该状态"), "TARGET_DISABLED"],
    [new Error("「新单」不能直接流转到「已完成」"), "TRANSITION_NOT_ALLOWED"],
    [new Error("流转到「取消」需要填写原因"), "REASON_REQUIRED"],
    [new Error("客户审批阶段必须通过审批处理记录同意或拒绝"), "APPROVAL_REQUIRED"],
    [new Error("请先确认设备是留在门店还是由客户带走，再进行此状态流转"), "CUSTODY_REQUIRED"],
    [new Error("设备当前未留店，不能进入诊断、维修或待取机状态"), "DEVICE_NOT_IN_STORE"],
    [new Error("该工单记录已作废，只能查看历史证据"), "ORDER_LOCKED"],
    [{ status: 403, message: "SECRET_SENTINEL" }, "FORBIDDEN"],
    [{ status: 500, message: "SECRET_SENTINEL" }, "UNAVAILABLE"],
  ])("maps only known domain and API failures", (error, expected) => {
    expect(classifyOrderTransitionFailure(error)).toBe(expected);
  });

  it.each([
    undefined,
    null,
    403,
    "SECRET_SENTINEL",
    new Error("SECRET_SENTINEL"),
    { code: "SECRET_SENTINEL", message: "SECRET_SENTINEL" },
    "工单不存在 SECRET_SENTINEL",
    "toString",
    "__proto__",
  ])("never exposes unknown errors", (error) => {
    expect(classifyOrderTransitionFailure(error)).toBe("TRANSITION_FAILED");
  });

  it("retains only attempted failures in request order and excludes already successful IDs on retry", () => {
    const failures = [
      { id: "failed-b" },
      { id: "unrelated" },
      { id: "failed-a" },
      { id: "failed-a" },
    ];
    const remaining = getFailedOrderTransitionIds(
      ["success", "failed-a", "failed-b", "failed-a"],
      failures,
    );
    expect(remaining).toEqual(["failed-a", "failed-b"]);
    expect(getFailedOrderTransitionIds(remaining, [{ id: "failed-b" }])).toEqual(["failed-b"]);
    expect(getFailedOrderTransitionIds(remaining, [])).toEqual([]);
  });
});
