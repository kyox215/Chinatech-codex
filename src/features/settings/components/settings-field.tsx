import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import { formLayout } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export interface SettingsFieldProps {
  label: string;
  htmlFor: string;
  icon?: LucideIcon;
  className?: string;
  error?: string;
  children: ReactNode;
}

export function SettingsField({
  label,
  htmlFor,
  icon: Icon,
  className,
  error,
  children,
}: SettingsFieldProps) {
  return (
    <div className={cn(formLayout.field, className)}>
      <Label htmlFor={htmlFor} className={formLayout.label}>
        <span className="inline-flex items-center gap-1.5">
          {Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null}
          {label}
        </span>
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-[11px] leading-4 text-status-danger-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
