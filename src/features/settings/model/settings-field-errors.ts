export type SettingsFieldErrors = Record<string, string[]>;

export function getSettingsFieldError(errors: SettingsFieldErrors, field: string) {
  return errors[`input.${field}`]?.[0];
}

export function getSettingsFieldErrorId(
  errors: SettingsFieldErrors,
  field: string,
  controlId: string,
) {
  return getSettingsFieldError(errors, field) ? `${controlId}-error` : undefined;
}
