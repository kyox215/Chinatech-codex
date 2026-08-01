"use client";

import { ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { uniqueContactPhones } from "@/shared/lib/phone";

export interface CustomerBackupPhonesFieldProps {
  primaryPhone: string;
  phones: string[];
  onPrimaryPhoneChange: (value: string) => void;
  onPhonesChange: (value: string[]) => void;
  onPromotePhone?: (primaryPhone: string, phones: string[]) => void;
  compact?: boolean;
}

export function CustomerBackupPhonesField({
  primaryPhone,
  phones,
  onPrimaryPhoneChange,
  onPhonesChange,
  onPromotePhone,
  compact = false,
}: CustomerBackupPhonesFieldProps) {
  const filteredPhones = uniqueContactPhones(primaryPhone, phones);
  const visiblePhones = filteredPhones.length > 0 ? filteredPhones : [""];

  const updatePhone = (index: number, value: string) => {
    const next = [...visiblePhones];
    next[index] = value;
    onPhonesChange(next);
  };

  const removePhone = (index: number) => {
    const next = visiblePhones.filter((_, itemIndex) => itemIndex !== index);
    onPhonesChange(next.length > 0 ? next : []);
  };

  const promotePhone = (index: number) => {
    const phone = visiblePhones[index]?.trim();
    if (!phone) return;
    const next = visiblePhones.filter((_, itemIndex) => itemIndex !== index);
    if (onPromotePhone) {
      onPromotePhone(phone, primaryPhone.trim() ? [primaryPhone, ...next] : next);
      return;
    }
    onPrimaryPhoneChange(phone);
    onPhonesChange(primaryPhone.trim() ? [primaryPhone, ...next] : next);
  };

  return (
    <div className={cn("min-w-0 space-y-2", compact && "space-y-1.5")}>
      {visiblePhones.map((phone, index) => (
        <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] gap-1.5">
          <Input
            aria-label="备用联系电话"
            value={phone}
            onChange={(event) => updatePhone(index, event.target.value)}
            placeholder="备用联系电话"
            className={cn(
              compact
                ? "h-8 font-mono text-sm sm:h-8"
                : "h-11 font-mono text-base lg:h-9 lg:text-sm",
            )}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(compact ? "size-8" : "size-11 lg:size-9")}
            aria-label="设为主号码"
            onClick={() => promotePhone(index)}
            disabled={!phone.trim()}
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(compact ? "size-8" : "size-11 lg:size-9")}
            aria-label="删除备用号码"
            onClick={() => removePhone(index)}
            disabled={filteredPhones.length === 0 && !phone.trim()}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-1.5 text-xs", compact ? "h-8" : "h-11 lg:h-9")}
        onClick={() => onPhonesChange([...visiblePhones, ""])}
      >
        <Plus className="size-3.5" /> 添加备用号码
      </Button>
      <p className={cn("text-xs text-muted-foreground", compact && "text-[10px] leading-3")}>
        第一个手机号是主号码；备用号码可用于取机期间联系客户。
      </p>
    </div>
  );
}
