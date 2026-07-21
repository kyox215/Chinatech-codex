"use client";

import { useMemo } from "react";
import type { CountryCode } from "libphonenumber-js/max";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  changeWhatsappPhoneCountry,
  resolveWhatsappPhone,
  whatsappCountryOptions,
} from "@/shared/lib/whatsapp-phone";

export function WhatsappRecipientEditor({
  id,
  phone,
  country,
  disabled,
  onPhoneChange,
  onCountryChange,
}: {
  id: string;
  phone: string;
  country: CountryCode;
  disabled?: boolean;
  onPhoneChange: (value: string) => void;
  onCountryChange: (country: CountryCode, phone: string) => void;
}) {
  const resolution = resolveWhatsappPhone(phone, country);
  const countryNames = useMemo(() => new Intl.DisplayNames(["zh-CN"], { type: "region" }), []);
  const options = useMemo(
    () =>
      whatsappCountryOptions
        .map((option) => ({
          ...option,
          label: countryNames.of(option.country) ?? option.country,
        }))
        .sort((left, right) => {
          if (left.country === "IT") return -1;
          if (right.country === "IT") return 1;
          return left.label.localeCompare(right.label, "zh-CN");
        }),
    [countryNames],
  );
  const helpId = `${id}-help`;

  return (
    <div className="grid min-w-0 gap-2 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2">
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div className="min-w-0">
          <Label htmlFor={`${id}-country`} className="text-xs">
            国家/地区
          </Label>
          <Select
            value={country}
            disabled={disabled}
            onValueChange={(value) => {
              const nextCountry = value as CountryCode;
              onCountryChange(nextCountry, changeWhatsappPhoneCountry(phone, nextCountry));
            }}
          >
            <SelectTrigger id={`${id}-country`} className="mt-1 h-10 min-w-0 text-sm sm:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.country} value={option.country}>
                  {option.label} +{option.callingCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <Label htmlFor={id} className="text-xs">
            WhatsApp 电话号码
          </Label>
          <Input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            disabled={disabled}
            aria-invalid={!resolution.valid}
            aria-describedby={helpId}
            onChange={(event) => onPhoneChange(event.target.value)}
            className="mt-1 h-10 min-w-0 font-mono text-base sm:h-9 sm:text-sm"
            placeholder="例如 380 151 2196"
          />
        </div>
      </div>
      <p
        id={helpId}
        role={resolution.valid ? "status" : "alert"}
        aria-live={resolution.valid ? "polite" : undefined}
        className={
          resolution.valid ? "text-xs text-status-success-foreground" : "text-xs text-destructive"
        }
      >
        {resolution.valid
          ? resolution.usedDefaultCountry
            ? `已按所选地区补全。WhatsApp 将打开：${resolution.display}`
            : `WhatsApp 将打开：${resolution.display}`
          : resolution.message}
      </p>
      <p className="text-[11px] text-muted-foreground">
        这里只验证号码格式；格式正确不代表该号码已经注册 WhatsApp。
      </p>
    </div>
  );
}
