import { cn } from "@/lib/utils";

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
    <div className="mb-4 -mx-1 max-w-full overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-0 items-center gap-0.5 rounded-lg border border-border/60 bg-surface/60 p-1">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === item.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
