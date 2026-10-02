import type { ProcurementRecord } from "./procurement";

export const procurementRecords: ProcurementRecord[] = [
  { id: "PO-2026-0101", repairId: "CT-2026-0929", item: "iPhone 15 Pro 尾插排线", supplier: "MobileParts SRL", quantity: 2, unitCostCents: 4300, expectedAt: "2026-10-01", reference: "DEMO-MP-9281", events: [
    { id: "EV-101-1", type: "ordered", quantity: 0, time: "2026-09-29 12:10", note: "已记录供应商订单，后续报价 v2 另行等待确认。" },
    { id: "EV-101-2", type: "arrival", quantity: 1, time: "2026-09-30 08:52", note: "第一批到货，外观与型号已核对。" },
  ] },
  { id: "PO-2026-0102", repairId: "CT-2026-0927", item: "MacBook Air M2 电池", supplier: "TechSupply Italia", quantity: 1, unitCostCents: 12900, expectedAt: "2026-10-03", reference: "DEMO-TS-2708", events: [
    { id: "EV-102-1", type: "ordered", quantity: 0, time: "2026-09-28 10:32", note: "供应商已确认，预计 10月3日到货。" },
  ] },
  { id: "PO-2026-0103", repairId: "CT-2026-0924", item: "Joy-Con 摇杆模组", supplier: "GameFix EU", quantity: 2, unitCostCents: 900, expectedAt: "2026-09-30", reference: "DEMO-GF-2406", events: [
    { id: "EV-103-1", type: "ordered", quantity: 0, time: "2026-09-25 09:30", note: "已记录订单。" },
    { id: "EV-103-2", type: "arrival", quantity: 1, time: "2026-09-28 14:20", note: "第一批到货。" },
    { id: "EV-103-3", type: "arrival", quantity: 1, time: "2026-09-30 08:30", note: "第二批到货，已交技术员核对。" },
  ] },
  { id: "PO-2026-0104", repairId: "CT-2026-0921", item: "S24 Ultra 显示组件", supplier: "MobileParts SRL", quantity: 1, unitCostCents: 16800, expectedAt: "2026-09-25", reference: "DEMO-MP-2103", events: [
    { id: "EV-104-1", type: "ordered", quantity: 0, time: "2026-09-22 10:15", note: "已记录订单。" },
    { id: "EV-104-2", type: "arrival", quantity: 1, time: "2026-09-25 11:25", note: "完整到货并核对型号。" },
  ] },
  { id: "PO-2026-0105", repairId: "CT-2026-0918", item: "ThinkPad 显示排线（备选方案）", required: false, supplier: "TechSupply Italia", quantity: 1, unitCostCents: null, expectedAt: "", reference: "", events: [] },
  { id: "PO-2026-0106", repairId: "CT-2026-0927", item: "MacBook Air M2 电池粘胶", supplier: "TechSupply Italia", quantity: 1, unitCostCents: null, expectedAt: "", reference: "", events: [] },
];
