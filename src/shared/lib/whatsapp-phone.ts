import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js/max";

export type WhatsappPhoneError =
  | "empty"
  | "invalid_country"
  | "too_short"
  | "too_long"
  | "invalid_number";

export type WhatsappPhoneResolution =
  | {
      valid: true;
      input: string;
      country: CountryCode;
      callingCode: string;
      e164: string;
      waDigits: string;
      display: string;
      nationalNumber: string;
      usedDefaultCountry: boolean;
    }
  | {
      valid: false;
      input: string;
      country?: CountryCode;
      error: WhatsappPhoneError;
      message: string;
    };

export const DEFAULT_WHATSAPP_COUNTRY: CountryCode = "IT";

export const whatsappCountryOptions = getCountries().map((country) => ({
  country,
  callingCode: getCountryCallingCode(country),
}));

export function resolveWhatsappPhone(
  input: string,
  defaultCountry: CountryCode = DEFAULT_WHATSAPP_COUNTRY,
): WhatsappPhoneResolution {
  const trimmed = input.trim();
  if (!trimmed) {
    return invalidResolution(input, "empty", "缺少客户电话号码。请输入号码后再打开 WhatsApp。");
  }

  const internationalInput = trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed;
  const explicitInternational = internationalInput.startsWith("+");
  const options = explicitInternational
    ? { extract: false as const }
    : { defaultCountry, extract: false as const };
  const phone = parsePhoneNumberFromString(internationalInput, options);

  if (!phone) {
    const lengthError = explicitInternational
      ? validatePhoneNumberLength(internationalInput)
      : validatePhoneNumberLength(internationalInput, defaultCountry);
    return invalidResolution(input, mapLengthError(lengthError), phoneErrorMessage(lengthError));
  }

  const parsedCountry = phone.country;
  if (!phone.isValid() || !parsedCountry) {
    const lengthError = explicitInternational
      ? validatePhoneNumberLength(internationalInput)
      : validatePhoneNumberLength(internationalInput, defaultCountry);
    return {
      ...invalidResolution(input, mapLengthError(lengthError), phoneErrorMessage(lengthError)),
      country: parsedCountry,
    };
  }

  return {
    valid: true,
    input,
    country: parsedCountry,
    callingCode: phone.countryCallingCode,
    e164: phone.number,
    waDigits: phone.number.slice(1),
    display: phone.formatInternational(),
    nationalNumber: phone.nationalNumber,
    usedDefaultCountry: !explicitInternational,
  };
}

export function inferWhatsappCountry(
  input: string,
  fallback: CountryCode = DEFAULT_WHATSAPP_COUNTRY,
) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("+") && !trimmed.startsWith("00")) return fallback;
  const internationalInput = trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed;
  return parsePhoneNumberFromString(internationalInput, { extract: false })?.country ?? fallback;
}

export function changeWhatsappPhoneCountry(input: string, nextCountry: CountryCode) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("+") && !trimmed.startsWith("00")) return trimmed;
  const internationalInput = trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed;
  return (
    parsePhoneNumberFromString(internationalInput, { extract: false })?.nationalNumber ?? trimmed
  );
}

export function buildWhatsappUrl(
  input: string,
  body = "",
  defaultCountry: CountryCode = DEFAULT_WHATSAPP_COUNTRY,
) {
  const resolution = resolveWhatsappPhone(input, defaultCountry);
  if (!resolution.valid) return "";
  const text = body.trim() ? `?text=${encodeURIComponent(body.trim())}` : "";
  return `https://wa.me/${resolution.waDigits}${text}`;
}

function invalidResolution(
  input: string,
  error: WhatsappPhoneError,
  message: string,
): Extract<WhatsappPhoneResolution, { valid: false }> {
  return { valid: false, input, error, message };
}

function mapLengthError(error: ReturnType<typeof validatePhoneNumberLength>): WhatsappPhoneError {
  if (error === "INVALID_COUNTRY") return "invalid_country";
  if (error === "TOO_SHORT" || error === "INVALID_LENGTH") return "too_short";
  if (error === "TOO_LONG") return "too_long";
  return "invalid_number";
}

function phoneErrorMessage(error: ReturnType<typeof validatePhoneNumberLength>) {
  if (error === "INVALID_COUNTRY") return "国家区号无效。请选择正确的国家或地区。";
  if (error === "TOO_SHORT" || error === "INVALID_LENGTH") {
    return "电话号码不完整。请选择国家或地区并检查号码。";
  }
  if (error === "TOO_LONG") return "电话号码位数过多。请检查是否重复填写了国家区号。";
  return "电话号码格式无效。请选择国家或地区并检查号码。";
}
