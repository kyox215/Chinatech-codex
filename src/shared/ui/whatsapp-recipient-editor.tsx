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
import { useLocale } from "@/shared/i18n/locale-provider";
import type { MessageKey } from "@/shared/i18n/messages";

const recipientErrorKeys = {
  empty: "orders2b2.recipient.error.empty",
  invalid_country: "orders2b2.recipient.error.invalidCountry",
  too_short: "orders2b2.recipient.error.tooShort",
  too_long: "orders2b2.recipient.error.tooLong",
  invalid_number: "orders2b2.recipient.error.invalidNumber",
} as const satisfies Record<string, MessageKey>;

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
  const { locale, t } = useLocale();
  const resolution = resolveWhatsappPhone(phone, country);
  const countryNames = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
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
          return left.label.localeCompare(right.label, locale);
        }),
    [countryNames, locale],
  );
  const helpId = `${id}-help`;

  return (
    <div className="grid min-w-0 gap-2 rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-2">
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div className="min-w-0">
          <Label htmlFor={`${id}-country`} className="text-xs">
            {t("orders2b2.recipient.country")}
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
            {t("orders2b2.recipient.phone")}
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
            placeholder={t("orders2b2.recipient.placeholder")}
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
            ? t("orders2b2.recipient.prefixed", { phone: resolution.display })
            : t("orders2b2.recipient.open", { phone: resolution.display })
          : t(recipientErrorKeys[resolution.error])}
      </p>
      <p className="text-[11px] text-muted-foreground">{t("orders2b2.recipient.help")}</p>
    </div>
  );
}
