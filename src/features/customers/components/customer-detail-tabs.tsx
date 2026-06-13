import { cn } from "@/lib/utils";
import { repairOs } from "@/lib/ui-patterns";

export type CustomerDetailTab<T extends string = string> = {
  key: T;
  label: string;
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
    <div className="mb-3 max-w-full overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-0 items-center gap-1.5">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={cn(repairOs.chip, activeTab === item.key && repairOs.chipActive)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
