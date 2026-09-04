import { useState, type ReactNode } from "react";
import {
  Barcode,
  Boxes,
  Cpu,
  HardDrive,
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
import { InventoryInfoTile } from "@/features/inventory/components/inventory-ui-primitives";
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey, MessageValues } from "@/shared/i18n/messages";
import {
  formatInventoryProductDate,
  formatInventoryProductMoney,
  localizeInventoryIdentifierKind,
} from "../model/inventory-product-i18n";

type Translate = (key: MessageKey, values?: MessageValues) => string;

export interface ProductSummaryField {
  label: string;
  value: ReactNode;
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
  isMissing?: boolean;
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
  const { locale, t } = useLocale();
  const [imageFailed, setImageFailed] = useState(false);
  const thumbnailUrl = safeInventoryProductThumbnailUrl(item.thumbnail_url);

  return (
    <section
      data-ui="inventory-product-hero"
      className={cn(repairOs.mobileInfoCard, "min-w-0 self-start p-2 sm:p-3")}
    >
      <div className="flex min-w-0 items-center gap-2 rounded-xl bg-[var(--surface-panel-muted)] p-2">
        <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-primary">
          {thumbnailUrl && !imageFailed ? (
            <img
              src={thumbnailUrl}
              alt={`${item.brand} ${item.model}`}
              loading="eager"
              decoding="async"
              className="size-full object-contain"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <Icon className="size-7" strokeWidth={1.5} aria-hidden="true" />
          )}
          {(!thumbnailUrl || imageFailed) && (
            <span className="sr-only">{t("inventory2b4.detail.noImage")}</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "inline-flex min-h-5 max-w-full items-center rounded-full px-1.5 text-[10px] font-semibold lg:text-[11px] lg:leading-4",
              statusClassName,
            )}
          >
            <span className="truncate">{statusLabel}</span>
          </span>
          <h2 className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-5 min-[400px]:text-base">
            {item.brand} {item.model}
          </h2>
          <p className="truncate font-mono text-[10px] leading-4 text-primary lg:text-[11px]">
            SKU {item.sku}
          </p>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {summaryFields.map((field) => (
          <InventoryInfoTile
            key={field.label}
            label={field.label}
            value={field.value}
            valueClassName="font-semibold"
          />
        ))}
      </div>
      <p className="mt-1.5 text-[10px] leading-3 text-muted-foreground">
        {t("inventory2b4.detail.updatedAt", {
          date: formatInventoryProductDate(item.updated_at, locale, t),
        })}
      </p>
    </section>
  );
}

export function DeviceWorkbenchSection({ fields }: { fields: WorkbenchField[] }) {
  const { t } = useLocale();
  return (
    <section
      data-ui="inventory-device-workbench"
      className={cn(repairOs.mobileInfoCard, "p-2 sm:p-3")}
      aria-labelledby="inventory-device-workbench-title"
    >
      <SectionTitle
        icon={Boxes}
        id="inventory-device-workbench-title"
        title={t("inventory2b4.detail.deviceWorkbench")}
        trailing={t("inventory2b4.detail.coreFacts", { count: fields.length })}
      />
      <p className="mt-1 text-[10px] leading-3 text-muted-foreground">
        {t("inventory2b4.detail.deviceWorkbenchHelp")}
      </p>
      <div className="mt-1.5 grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3">
        {fields.map((field) => (
          <WorkbenchTile key={field.id} {...field} />
        ))}
      </div>
    </section>
  );
}

export function ProductBusinessSection({ item }: { item: InventoryProductDetail }) {
  const { locale, t } = useLocale();
  const fields: ProductSummaryField[] = [
    {
      label: t("inventory2b4.detail.listPrice"),
      value:
        item.list_price === undefined
          ? t("inventory2b4.detail.unpriced")
          : formatInventoryProductMoney(item.list_price, locale, t),
    },
    {
      label: t("inventory2b4.detail.location"),
      value: item.location?.trim() ? item.location : t("inventory2b4.detail.locationUnset"),
    },
    {
      label: t("inventory2b4.detail.warranty"),
      value:
        item.warranty_months === undefined
          ? t("inventory2b4.detail.notEntered")
          : t("inventory2b4.detail.months", { count: item.warranty_months }),
    },
    {
      label: t("inventory2b4.detail.created"),
      value: formatInventoryProductDate(item.created_at, locale, t),
    },
    {
      label: t("inventory2b4.detail.updated"),
      value: formatInventoryProductDate(item.updated_at, locale, t),
    },
  ];
  if (item.cost_amount !== undefined) {
    fields.splice(1, 0, {
      label: t("inventory2b4.detail.cost"),
      value: formatInventoryProductMoney(item.cost_amount, locale, t),
    });
  }

  return (
    <section
      data-ui="inventory-product-business"
      className={cn(repairOs.mobileInfoCard, "p-2 sm:p-3")}
      aria-labelledby="inventory-product-business-title"
    >
      <SectionTitle
        icon={ShieldCheck}
        id="inventory-product-business-title"
        title={t("inventory2b4.detail.business")}
      />
      <div className="mt-1.5 grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3">
        {fields.map((field) => (
          <InventoryInfoTile
            key={field.label}
            label={field.label}
            value={field.value}
            valueClassName="font-semibold"
          />
        ))}
      </div>
    </section>
  );
}

export function DeviceIdentitySection({
  identifiers,
  gtin,
  specifications,
}: {
  identifiers: VisibleIdentifier[];
  gtin?: string;
  specifications?: Record<string, string>;
}) {
  const { t } = useLocale();
  const specificationEntries = Object.entries(specifications ?? {}).filter(([, value]) =>
    Boolean(value?.trim()),
  );
  if (!identifiers.length && !gtin && !specificationEntries.length) return null;

  return (
    <details
      data-ui="inventory-device-identity"
      className={cn(repairOs.mobileInfoCard, "group p-2 sm:p-3")}
      open
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Barcode className="size-3.5" aria-hidden="true" />
        </span>
        <span role="heading" aria-level={3} className="min-w-0 truncate text-sm font-semibold">
          {t("inventory2b4.detail.identity")}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {t("inventory2b4.detail.fullSpecifications")}
        </span>
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground group-open:hidden">
          {t("inventory2b4.detail.expand")}
        </span>
        <span className="ml-auto hidden shrink-0 text-[10px] text-muted-foreground group-open:inline">
          {t("inventory2b4.detail.collapse")}
        </span>
      </summary>
      <div className="mt-1.5 grid min-w-0 grid-cols-2 gap-1.5">
        {identifiers.map((identifier) => (
          <InventoryInfoTile
            key={identifier.kind}
            frame="bordered"
            label={identifierLabel(identifier.kind, t)}
            value={identifier.masked_value}
            valueClassName="break-all font-mono font-semibold"
          />
        ))}
        {gtin ? (
          <InventoryInfoTile
            frame="bordered"
            className="col-span-2"
            label="EAN / GTIN"
            value={gtin}
            valueClassName="break-all font-mono font-semibold"
          />
        ) : null}
        {specificationEntries.map(([key, value]) => (
          <InventoryInfoTile
            key={key}
            frame="bordered"
            label={specificationLabel(key, t)}
            value={value}
            valueClassName="break-words font-semibold"
          />
        ))}
      </div>
    </details>
  );
}

export function ProductNotesSection({ notes }: { notes?: string }) {
  const { t } = useLocale();
  return (
    <section
      data-ui="inventory-product-notes"
      className={cn(repairOs.mobileInfoCard, "p-2 sm:p-3")}
      aria-labelledby="inventory-product-notes-title"
    >
      <SectionTitle
        icon={PackageOpen}
        id="inventory-product-notes-title"
        title={t("inventory2b4.detail.notes")}
      />
      <p className="mt-1.5 whitespace-pre-wrap break-words text-[11px] leading-4 text-muted-foreground lg:text-xs lg:leading-4">
        {notes?.trim() ? notes : t("inventory2b4.detail.notesEmpty")}
      </p>
    </section>
  );
}

export function buildWorkbenchFields(item: InventoryProductDetail, t: Translate): WorkbenchField[] {
  const networkValue = firstSpecificationValue(item.specifications, [
    "network_variant",
    "connectivity",
    "network",
  ]);
  const fields: WorkbenchField[] = [
    {
      id: "storage",
      label: t("inventory2b4.detail.storage"),
      value: item.storage_capacity,
      icon: HardDrive,
    },
    { id: "ram", label: t("inventory2b4.detail.ram"), value: item.ram_capacity, icon: Cpu },
    { id: "color", label: t("inventory2b4.detail.color"), value: item.color, icon: Palette },
    {
      id: "condition",
      label: t("inventory2b4.detail.condition"),
      value: item.condition,
      icon: Sparkles,
    },
    {
      id: "network",
      label: t("inventory2b4.detail.networkVersion"),
      value: networkValue,
      icon: RadioTower,
    },
  ].map((field) => ({
    ...field,
    value: field.value?.trim() ? field.value : t("inventory2b4.detail.notEntered"),
    isMissing: !field.value?.trim(),
  }));
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

function WorkbenchTile({ icon: Icon, label, value, isMissing }: WorkbenchField) {
  return (
    <div className="grid min-h-14 min-w-0 grid-cols-[28px_minmax(0,1fr)] items-center gap-1 rounded-lg bg-[var(--surface-panel-muted)] p-1.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[9px] leading-3 text-muted-foreground lg:text-[11px] lg:leading-4">
          {label}
        </span>
        <strong
          className={cn(
            "line-clamp-2 block break-words text-[11px] font-semibold leading-4 lg:text-xs lg:leading-4",
            isMissing && "font-normal text-muted-foreground",
          )}
        >
          {value}
        </strong>
      </span>
    </div>
  );
}

function identifierLabel(kind: string, t: Translate) {
  return kind === "identifier"
    ? t("inventory2b4.detail.identifier")
    : localizeInventoryIdentifierKind(kind, kind, t);
}

const specificationKeys: Record<string, MessageKey> = {
  network_variant: "inventory2b4.detail.spec.networkVariant",
  connectivity: "inventory2b4.detail.spec.connectivity",
  network: "inventory2b4.detail.spec.network",
  screen_size_inches: "inventory2b4.detail.spec.screenSize",
  processor: "inventory2b4.detail.spec.processor",
  disk_type: "inventory2b4.detail.spec.diskType",
  graphics: "inventory2b4.detail.spec.graphics",
  edition: "inventory2b4.detail.spec.edition",
  region: "inventory2b4.detail.spec.region",
  included_controller_count: "inventory2b4.detail.spec.controllerCount",
  short_specification: "inventory2b4.detail.spec.short",
};

function specificationLabel(key: string, t: Translate) {
  const messageKey = specificationKeys[key];
  return messageKey ? t(messageKey) : key;
}

function firstSpecificationValue(
  specifications: Record<string, string> | undefined,
  keys: string[],
) {
  for (const key of keys) {
    const value = specifications?.[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function safeInventoryProductThumbnailUrl(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return undefined;
  return /^\/api\/repairdesk\/inventory\/product-thumbnails\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    candidate,
  )
    ? candidate
    : undefined;
}
