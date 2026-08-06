import {
  Barcode,
  Boxes,
  Cpu,
  Gamepad2,
  HardDrive,
  Laptop,
  PackageOpen,
  Palette,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Smartphone,
} from "lucide-react";

import type { InventoryProductDetail } from "@/lib/repairdesk/types";
import { repairOs } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { RepairOsInfoTile } from "@/shared/ui";

export interface ProductSummaryField {
  label: string;
  value: React.ReactNode;
}

export interface VisibleIdentifier {
  kind: string;
  masked_value: string;
}

export interface WorkbenchField {
  id: string;
  label: string;
  value: string;
  icon: typeof Smartphone;
}

export function ProductHeroCard({
  item,
  icon: Icon,
  statusLabel,
  statusClassName,
  summaryFields,
}: {
  item: InventoryProductDetail;
  icon: typeof Smartphone;
  statusLabel: string;
  statusClassName: string;
  summaryFields: ProductSummaryField[];
}) {
  return (
    <section
      data-ui="inventory-product-hero"
      className={cn(repairOs.mobileInfoCard, "min-w-0 self-start p-2 sm:p-3")}
    >
      <div className="flex min-w-0 items-center gap-2 rounded-xl bg-[var(--surface-panel-muted)] p-2">
        <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-7" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-full px-1.5 text-[10px] font-semibold lg:text-[11px] lg:leading-4",
              statusClassName,
            )}
          >
            {statusLabel}
          </span>
          <h2 className="mt-1 truncate text-sm font-semibold leading-5 min-[400px]:text-base">
            {item.brand} {item.model}
          </h2>
          <p className="truncate font-mono text-[10px] leading-4 text-primary lg:text-[11px]">
            {item.sku}
          </p>
        </div>
      </div>
      {summaryFields.length ? (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {summaryFields.map((field) => (
            <RepairOsInfoTile
              key={field.label}
              label={field.label}
              value={field.value}
              valueClassName="font-semibold"
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function DeviceWorkbenchSection({ fields }: { fields: WorkbenchField[] }) {
  if (!fields.length) return null;
  return (
    <section
      data-ui="inventory-device-workbench"
      className={cn(repairOs.mobileInfoCard, "p-2 sm:p-3")}
      aria-labelledby="inventory-device-workbench-title"
    >
      <SectionTitle
        icon={Boxes}
        id="inventory-device-workbench-title"
        title="设备工作台"
        trailing={`${fields.length} 项资料`}
      />
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {fields.map((field) => (
          <WorkbenchTile key={field.id} {...field} />
        ))}
      </div>
    </section>
  );
}

export function DeviceIdentitySection({
  identifiers,
  gtin,
}: {
  identifiers: VisibleIdentifier[];
  gtin?: string;
}) {
  if (!identifiers.length && !gtin) return null;
  return (
    <section
      data-ui="inventory-device-identity"
      className={cn(repairOs.mobileInfoCard, "p-2 sm:p-3")}
      aria-labelledby="inventory-device-identity-title"
    >
      <SectionTitle icon={Barcode} id="inventory-device-identity-title" title="设备身份" />
      <div className="mt-1.5 grid min-w-0 grid-cols-2 gap-1.5">
        {identifiers.map((identifier) => (
          <RepairOsInfoTile
            key={identifier.kind}
            frame="bordered"
            label={identifierLabel(identifier.kind)}
            value={identifier.masked_value}
            valueClassName="font-mono font-semibold"
          />
        ))}
        {gtin ? (
          <RepairOsInfoTile
            frame="bordered"
            className="col-span-2"
            label="EAN / GTIN"
            value={gtin}
            valueClassName="font-mono font-semibold"
          />
        ) : null}
      </div>
    </section>
  );
}

export function ProductNotesSection({ notes }: { notes?: string }) {
  if (!notes) return null;
  return (
    <section className={cn(repairOs.mobileInfoCard, "p-2 sm:p-3")}>
      <SectionTitle icon={PackageOpen} title="备注" />
      <p className="mt-1.5 whitespace-pre-wrap break-words text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
        {notes}
      </p>
    </section>
  );
}

export function buildWorkbenchFields(item: InventoryProductDetail): WorkbenchField[] {
  const fields: WorkbenchField[] = [];
  if (item.storage_capacity)
    fields.push({ id: "storage", label: "存储", value: item.storage_capacity, icon: HardDrive });
  if (item.ram_capacity)
    fields.push({ id: "ram", label: "内存", value: item.ram_capacity, icon: Cpu });
  if (item.color) fields.push({ id: "color", label: "颜色", value: item.color, icon: Palette });
  if (item.condition)
    fields.push({ id: "condition", label: "成色", value: item.condition, icon: Sparkles });
  if (item.warranty_months !== undefined) {
    fields.push({
      id: "warranty",
      label: "保修",
      value: `${item.warranty_months} 个月`,
      icon: ShieldCheck,
    });
  }
  fields.push(
    ...Object.entries(item.specifications ?? {}).map(([key, value]) => ({
      id: `specification-${key}`,
      label: specificationLabel(key),
      value,
      icon: specificationIcon(key),
    })),
  );
  return fields;
}

function SectionTitle({
  icon: Icon,
  title,
  trailing,
  id,
}: {
  icon: typeof Smartphone;
  title: string;
  trailing?: string;
  id?: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <h3 id={id} className="truncate text-sm font-semibold">
          {title}
        </h3>
      </div>
      {trailing ? (
        <p className="shrink-0 text-[10px] text-muted-foreground lg:text-[11px] lg:leading-4">
          {trailing}
        </p>
      ) : null}
    </div>
  );
}

function WorkbenchTile({ icon: Icon, label, value }: WorkbenchField) {
  return (
    <div className="grid min-h-14 min-w-0 grid-cols-[28px_minmax(0,1fr)] items-center gap-1 rounded-lg bg-[var(--surface-panel-muted)] p-1.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[9px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
          {label}
        </span>
        <strong className="line-clamp-2 block break-words text-[11px] font-semibold leading-4 lg:text-xs lg:leading-4">
          {value}
        </strong>
      </span>
    </div>
  );
}

function identifierLabel(kind: string) {
  return (
    { imei1: "IMEI 1", imei2: "IMEI 2", serial: "序列号", eid: "EID", identifier: "设备标识" }[
      kind
    ] ?? kind
  );
}

function specificationLabel(key: string) {
  return (
    {
      network_variant: "网络版本",
      connectivity: "联网版本",
      screen_size_inches: "屏幕尺寸",
      processor: "处理器",
      disk_type: "硬盘类型",
      graphics: "显卡",
      edition: "版本",
      region: "区域",
      included_controller_count: "手柄数",
      short_specification: "简短规格",
    }[key] ?? key
  );
}

function specificationIcon(key: string) {
  if (["network_variant", "connectivity", "region"].includes(key)) return RadioTower;
  if (key === "processor") return Cpu;
  if (key === "disk_type") return HardDrive;
  if (["screen_size_inches", "graphics"].includes(key)) return Laptop;
  if (key === "included_controller_count") return Gamepad2;
  return Boxes;
}
