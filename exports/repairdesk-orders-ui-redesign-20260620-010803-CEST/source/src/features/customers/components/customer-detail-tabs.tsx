import { cn } from "@/lib/utils";
import { repairOs } from "@/lib/ui-patterns";

export type CustomerDetailTab<T extends string = string> = {
  key: T;
  label: string;
  count?: number;
};

export function CustomerDetailTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: readonly CustomerDetailTab<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
}) {
  return (
    <div className="mb-3 max-w-full overflow-x-auto pb-1 [scrollbar-width:none] md:overflow-visible [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-0 items-center gap-1.5 md:flex md:flex-wrap">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={cn(repairOs.chip, "gap-1.5", activeTab === item.key && repairOs.chipActive)}
          >
            <span>{item.label}</span>
            {item.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none tabular-nums",
                  activeTab === item.key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-[var(--surface-panel-muted)] text-muted-foreground",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
