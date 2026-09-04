import { isValidImei } from "@/features/inventory/products/model/device-data";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export type BuybackSensitiveTextKind = "email" | "url" | "imei" | "phone" | "identity_document";

const emailPattern =
  /(^|[^\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}(?![\p{L}\p{N}._%+-])/iu;
const urlPattern = /(?:https?:\/\/|www\.)[^\s<>{}\u005b\u005d]+/iu;
const identifierSeparator = "[\\s/._-]*";
const ciePattern = new RegExp(
  `(^|[^A-Z0-9])[A-Z]{2}${identifierSeparator}\\d{5}${identifierSeparator}[A-Z]{2}(?![A-Z0-9])`,
  "iu",
);
const passportPattern = new RegExp(
  `(^|[^A-Z0-9])[A-Z]{2}${identifierSeparator}\\d{7}(?![A-Z0-9])`,
  "iu",
);
const documentLabel =
  "(?:patente|permesso(?:\\s+di\\s+soggiorno)?|passaporto|documento|carta\\s+(?:d['’]?\\s*)?identit[aà]|id\\s*card|residence\\s+permit|driver(?:'s)?\\s+licen[cs]e|licen[cs]e|证件|护照|居留|驾照)";
const directDocumentLabel =
  "(?:patente|permesso(?:\\s+di\\s+soggiorno)?|passaporto|carta\\s+(?:d['’]?\\s*)?identit[aà]|id\\s*card|residence\\s+permit|driver(?:'s)?\\s+licen[cs]e|证件|护照|居留|驾照)";
const strongDocumentStartPattern = new RegExp(
  `${documentLabel}\\s*(?:(?:n(?:o|umero)?\\.?|number)\\s*[:：#-]?|[:：#])\\s*`,
  "giu",
);
const directDocumentStartPattern = new RegExp(`${directDocumentLabel}\\s+`, "giu");
const labeledPhoneStartPattern =
  /(?:\b(?:phone|tel(?:efono)?|telefono|cellulare)\b\.?|电话|手机)\s*(?:n(?:o|umero)?\.?|number)?\s*[:：#-]?\s*/giu;
const internationalPhoneStartPattern = /(^|[^\d+])\+/gu;
const zeroInternationalPhoneStartPattern = /(^|[^\d])00(?=\d)/gu;
const italianMobileStartPattern = /(^|[^\d])3/gu;
const italianLandlineStartPattern = /(^|[^\d])(?:0|\(0)/gu;
const tokenSeparatorPattern = /[\s/._-]/;
const phoneCharacterPattern = /[+\d\s()./_-]/;

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function isValidPhoneCandidate(value: string) {
  const length = digits(value).length;
  if (length < 8 || length > 15) return false;
  const normalized = value
    .replace(/[()/_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const international = normalized.replace(/^00/, "+");
  return (
    parsePhoneNumberFromString(
      international,
      international.startsWith("+") ? undefined : "IT",
    )?.isValid() === true
  );
}

function matchingStarts(
  shadow: string,
  pattern: RegExp,
  offset: (match: RegExpMatchArray) => number,
) {
  pattern.lastIndex = 0;
  const starts: number[] = [];
  for (const match of shadow.matchAll(pattern)) {
    starts.push((match.index ?? 0) + offset(match));
  }
  return starts;
}

function hasValidImei(shadow: string) {
  for (let start = 0; start < shadow.length; start += 1) {
    if (!/\d/.test(shadow[start] ?? "") || /\d/.test(shadow[start - 1] ?? "")) continue;
    let candidate = "";
    let digitCount = 0;
    for (let index = start; index < shadow.length; index += 1) {
      const character = shadow[index] ?? "";
      if (/\d/.test(character)) {
        candidate += character;
        digitCount += 1;
        if (digitCount === 15 && !/\d/.test(shadow[index + 1] ?? "") && isValidImei(candidate)) {
          return true;
        }
        if (digitCount >= 15) break;
      } else if (tokenSeparatorPattern.test(character)) {
        candidate += character;
      } else {
        break;
      }
    }
  }
  return false;
}

function isDocumentToken(value: string) {
  return value.length >= 6 && value.length <= 20 && /[A-Z]/i.test(value) && /\d/.test(value);
}

function hasDirectDocumentToken(shadow: string, start: number) {
  const tail = shadow.slice(start);
  const firstChunk = tail.match(/^[A-Za-z0-9-]+/)?.[0] ?? "";
  const firstToken = firstChunk.replace(/-/g, "");
  if (isDocumentToken(firstToken)) return true;
  if (!/^[A-Z]{2,3}$/.test(firstToken)) return false;

  let token = firstToken;
  let offset = firstChunk.length;
  while (offset < tail.length) {
    const separator = tail.slice(offset).match(/^\s+/)?.[0];
    if (!separator) return false;
    offset += separator.length;
    const chunk = tail.slice(offset).match(/^[A-Za-z0-9-]+/)?.[0] ?? "";
    const compactChunk = chunk.replace(/-/g, "");
    if (!/^(?:[A-Z]{1,4}|\d{1,4})$/.test(compactChunk)) return false;
    token += compactChunk;
    if (token.length > 20) return false;
    if (isDocumentToken(token)) return true;
    offset += chunk.length;
  }
  return false;
}

function hasStrongDocumentToken(shadow: string, start: number) {
  let token = "";
  let chunk = "";
  for (let index = start; index < shadow.length; index += 1) {
    const character = shadow[index] ?? "";
    if (/[A-Z0-9]/i.test(character)) {
      chunk += character;
      token += character;
    } else if (tokenSeparatorPattern.test(character)) {
      if (!chunk) continue;
      if (/^[A-Z]+$/i.test(chunk) && chunk.length > 3) return false;
      if (isDocumentToken(token)) return true;
      chunk = "";
    } else {
      break;
    }
    if (token.length > 20) return false;
  }
  if (/^[A-Z]+$/i.test(chunk) && chunk.length > 3) return false;
  return isDocumentToken(token);
}

function hasLabeledDocument(shadow: string) {
  const strongStarts = matchingStarts(
    shadow,
    strongDocumentStartPattern,
    (match) => match[0].length,
  );
  if (strongStarts.some((start) => hasStrongDocumentToken(shadow, start))) return true;
  const directStarts = matchingStarts(
    shadow,
    directDocumentStartPattern,
    (match) => match[0].length,
  );
  for (const start of directStarts) {
    if (hasDirectDocumentToken(shadow, start)) return true;
  }
  return false;
}

function hasValidPhonePrefix(
  shadow: string,
  start: number,
  kind: "any" | "international" | "mobile" | "landline",
) {
  let candidate = "";
  for (let index = start; index < shadow.length && candidate.length < 64; index += 1) {
    const character = shadow[index] ?? "";
    if (!phoneCharacterPattern.test(character)) break;
    candidate += character;
    if (!/\d/.test(character)) continue;
    const value = digits(candidate);
    if (value.length < 8) continue;
    if (value.length > 15) break;
    const kindMatches =
      kind === "any" ||
      (kind === "international" && /^(?:\+|00)/.test(candidate.trim())) ||
      (kind === "mobile" && /^3\d{9}$/.test(value)) ||
      (kind === "landline" && /^0\d{8,10}$/.test(value));
    if (kindMatches && !/\d/.test(shadow[index + 1] ?? "") && isValidPhoneCandidate(candidate)) {
      return true;
    }
  }
  return false;
}

function hasPhone(shadow: string) {
  const labeledStarts = matchingStarts(
    shadow,
    labeledPhoneStartPattern,
    (match) => match[0].length,
  );
  if (labeledStarts.some((start) => hasValidPhonePrefix(shadow, start, "any"))) return true;
  const internationalStarts = matchingStarts(
    shadow,
    internationalPhoneStartPattern,
    (match) => match[1]?.length ?? 0,
  );
  if (internationalStarts.some((start) => hasValidPhonePrefix(shadow, start, "international"))) {
    return true;
  }
  const zeroInternationalStarts = matchingStarts(
    shadow,
    zeroInternationalPhoneStartPattern,
    (match) => match[1]?.length ?? 0,
  );
  if (
    zeroInternationalStarts.some((start) => hasValidPhonePrefix(shadow, start, "international"))
  ) {
    return true;
  }
  const mobileStarts = matchingStarts(
    shadow,
    italianMobileStartPattern,
    (match) => match[1]?.length ?? 0,
  );
  if (mobileStarts.some((start) => hasValidPhonePrefix(shadow, start, "mobile"))) return true;
  const landlineStarts = matchingStarts(
    shadow,
    italianLandlineStartPattern,
    (match) => match[1]?.length ?? 0,
  );
  return landlineStarts.some((start) => hasValidPhonePrefix(shadow, start, "landline"));
}

export function classifyBuybackSensitiveText(value: string): BuybackSensitiveTextKind | null {
  const shadow = value
    .normalize("NFKC")
    .replace(/[\p{Cf}\u034f\u180b-\u180d\u180f\ufe00-\ufe0f\u{e0100}-\u{e01ef}]/giu, "")
    .replace(/\p{White_Space}/gu, " ")
    .replace(/\p{Dash_Punctuation}/gu, "-");
  if (emailPattern.test(shadow)) return "email";
  if (urlPattern.test(shadow)) return "url";
  const identifierShadow = shadow.replace(/[/._]+/g, "-").replace(/-+/g, "-");
  if (hasValidImei(identifierShadow)) return "imei";
  if (hasPhone(shadow)) return "phone";
  if (
    ciePattern.test(identifierShadow) ||
    passportPattern.test(identifierShadow) ||
    hasLabeledDocument(identifierShadow)
  ) {
    return "identity_document";
  }
  return null;
}

export function hasBuybackSensitiveText(value: string) {
  return classifyBuybackSensitiveText(value) !== null;
}
