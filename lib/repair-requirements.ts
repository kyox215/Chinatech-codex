import type { IntakeServices } from "./intake-services";

export type RepairRequirement = { id: string; title: string; request: string; revision: number; mode: "pending" | "parts" | "none"; confirmed: boolean; sourceFingerprint?: string; deviceFingerprint?: string };
export type RequirementSource = { requirements?: RepairRequirement[]; deviceFingerprint?: string };
type IntakeSource = { category: string; brand: string; model: string; faults?: string[]; services: IntakeServices };

/** Structured intake requests are candidates, never actual purchases or diagnoses. */
export function intakeRequirements(data: IntakeSource): RepairRequirement[] {
  const titles = [...new Set((data.faults ?? []).map(fault => fault.split("：")[0]))];
  for (const [key, title] of [["screen", "屏幕"], ["battery", "电池"], ["port", "尾插"]] as const) if (data.services[key].quality && !titles.includes(title)) titles.push(title);
  return titles.map(title => {
    const service = title === "屏幕" ? data.services.screen : title === "电池" ? data.services.battery : title === "尾插" ? data.services.port : undefined;
    const quality = service?.quality === "original" ? "原装" : service?.quality === "assembled" ? "组装" : "";
    const detail = title === "屏幕" ? data.services.screen.technology.toUpperCase() : title === "电池" ? ({ capacity: "扩容", diagnostics: "跑诊断", both: "扩容跑诊断", "": "" })[data.services.battery.appleService] : "";
    const request = [quality, detail].filter(Boolean).join(" · ");
    return { id: `intake:${title}`, title, request, revision: 1, mode: "pending", confirmed: false, deviceFingerprint: JSON.stringify([data.category, data.brand, data.model]), sourceFingerprint: JSON.stringify([data.category, data.brand, data.model, title, request]) };
  });
}
export function currentRepairRequirements(order: RequirementSource, workflow?: RequirementSource): RepairRequirement[] {
  const stored = workflow?.requirements ?? [];
  const sources = order.requirements ?? [];
  const result = sources.map(source => {
    const existing = stored.find(item => item.id === source.id);
    if (!existing) return source;
    if (existing.sourceFingerprint === source.sourceFingerprint) return existing;
    return { ...source, revision: existing.revision + 1, mode: "pending" as const, confirmed: false };
  });
  for (const item of stored) if (!sources.some(source => source.id === item.id)) result.push(item.sourceFingerprint || (order.deviceFingerprint && item.deviceFingerprint !== order.deviceFingerprint) ? { ...item, revision: item.revision + 1, mode: "pending", confirmed: false, deviceFingerprint: order.deviceFingerprint } : item);
  return result;
}
export function validateRepairRequirements(value: unknown): asserts value is RepairRequirement[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error("维修项目最多100项。");
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || Object.keys(item).some(key => !["id", "title", "request", "revision", "mode", "confirmed", "sourceFingerprint", "deviceFingerprint"].includes(key)) || typeof item.id !== "string" || !item.id || item.id.length > 100 || ids.has(item.id) || typeof item.title !== "string" || !item.title.trim() || item.title.length > 100 || typeof item.request !== "string" || item.request.length > 1200 || !Number.isSafeInteger(item.revision) || item.revision < 1 || !["pending", "parts", "none"].includes(item.mode) || typeof item.confirmed !== "boolean" || (item.mode === "pending" && item.confirmed) || (item.mode === "none" && !item.confirmed) || (item.sourceFingerprint !== undefined && (typeof item.sourceFingerprint !== "string" || item.sourceFingerprint.length > 1600)) || (item.deviceFingerprint !== undefined && (typeof item.deviceFingerprint !== "string" || item.deviceFingerprint.length > 1600))) throw new Error("维修项目资料无效。");
    ids.add(item.id);
  }
}
