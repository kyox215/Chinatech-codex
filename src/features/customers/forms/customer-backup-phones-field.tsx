"use client";

import { ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface CustomerBackupPhonesFieldProps {
  primaryPhone: string;
  phones: string[];
  onPrimaryPhoneChange: (value: string) => void;
  onPhonesChange: (value: string[]) => void;
}

export function CustomerBackupPhonesField({
  primaryPhone,
  phones,
  onPrimaryPhoneChange,
  onPhonesChange,
}: CustomerBackupPhonesFieldProps) {
  const visiblePhones = phones.length > 0 ? phones : [""];

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
    onPrimaryPhoneChange(phone);
    onPhonesChange(primaryPhone.trim() ? [primaryPhone, ...next] : next);
  };

  return (
    <div className="space-y-2">
      {visiblePhones.map((phone, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-1.5">
          <Input
            value={phone}
            onChange={(event) => updatePhone(index, event.target.value)}
            placeholder="备用联系电话"
            className="font-mono"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
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
            aria-label="删除备用号码"
            onClick={() => removePhone(index)}
            disabled={phones.length === 0 && !phone.trim()}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => onPhonesChange([...visiblePhones, ""])}
      >
        <Plus className="size-3.5" /> 添加备用号码
      </Button>
      <p className="text-xs text-muted-foreground">
        第一个手机号是主号码；备用号码可用于取机期间联系客户。
      </p>
    </div>
  );
}
