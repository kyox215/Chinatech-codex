export function normalizePhoneRaw(value: string) {
  return value.replace(/\D/g, "");
}

export function samePhoneRaw(left: string, right: string) {
  return normalizePhoneRaw(left) === normalizePhoneRaw(right);
}
