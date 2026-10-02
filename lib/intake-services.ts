export type PartQuality = "" | "original" | "assembled";
export type IntakeServices = {
  screen: { quality: PartQuality; technology: "" | "incell" | "tft" | "oled" };
  battery: { quality: PartQuality; appleService: "" | "capacity" | "diagnostics" | "both" };
  port: { quality: PartQuality };
};
export const emptyIntakeServices: IntakeServices = {
  screen: { quality: "", technology: "" }, battery: { quality: "", appleService: "" }, port: { quality: "" },
};
export const isAppleBrand = (brand: string) => ["apple", "苹果"].includes(brand.trim().toLowerCase());
export const hasIntakeFault = (faults: readonly string[], group: string) => faults.some(value => value === group || value.startsWith(`${group}：`));

// Requested part specifications are independent of symptoms, diagnosis and quotes.
export function normalizeIntakeServices(value: IntakeServices, faults: readonly string[], brand: string): IntakeServices {
  return {
    screen: hasIntakeFault(faults, "屏幕") ? { ...value.screen, technology: value.screen.quality === "assembled" ? value.screen.technology : "" } : { ...emptyIntakeServices.screen },
    battery: hasIntakeFault(faults, "电池") ? { ...value.battery, appleService: isAppleBrand(brand) ? value.battery.appleService : "" } : { ...emptyIntakeServices.battery },
    port: hasIntakeFault(faults, "尾插") ? { ...value.port } : { ...emptyIntakeServices.port },
  };
}
export function intakeServiceLabels(value: IntakeServices): string[] {
  const quality = { original: "原装", assembled: "组装" };
  const items: string[] = [];
  if (value.screen.quality) items.push(`屏幕 · ${quality[value.screen.quality]}${value.screen.quality === "assembled" && value.screen.technology ? ` · ${value.screen.technology === "incell" ? "Incell" : value.screen.technology.toUpperCase()}` : ""}`);
  if (value.battery.quality) items.push(`电池 · ${quality[value.battery.quality]}`);
  const apple = { capacity: "扩容", diagnostics: "跑诊断", both: "扩容跑诊断" };
  if (value.battery.appleService) items.push(`苹果电池 · ${apple[value.battery.appleService]}`);
  if (value.port.quality) items.push(`尾插 · ${quality[value.port.quality]}`);
  return items;
}
