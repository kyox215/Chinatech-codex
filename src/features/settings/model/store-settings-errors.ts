import type { StoreSettingsValidationFieldErrors } from "./store-settings-update-contract";

export const SETTINGS_ERROR_CODES = {
  contextChanged: "SETTINGS_STORE_CONTEXT_CHANGED",
  versionConflict: "SETTINGS_VERSION_CONFLICT",
  validationFailed: "SETTINGS_VALIDATION_FAILED",
  forbidden: "FORBIDDEN",
} as const;

export type SettingsErrorCode = (typeof SETTINGS_ERROR_CODES)[keyof typeof SETTINGS_ERROR_CODES];

export class SettingsMutationError extends Error {
  constructor(
    message: string,
    readonly code: SettingsErrorCode,
    readonly status: 403 | 409 | 422,
    readonly fieldErrors?: StoreSettingsValidationFieldErrors,
  ) {
    super(message);
    this.name = "SettingsMutationError";
  }

  static contextChanged() {
    return new SettingsMutationError(
      "店铺上下文已变化，请重新加载当前店铺后再保存",
      SETTINGS_ERROR_CODES.contextChanged,
      409,
    );
  }

  static versionConflict() {
    return new SettingsMutationError(
      "设置已被其他会话更新，请比较最新内容后再保存",
      SETTINGS_ERROR_CODES.versionConflict,
      409,
    );
  }

  static validationFailed(fieldErrors: StoreSettingsValidationFieldErrors) {
    return new SettingsMutationError(
      "设置内容有误，请检查标记字段",
      SETTINGS_ERROR_CODES.validationFailed,
      422,
      fieldErrors,
    );
  }
}
