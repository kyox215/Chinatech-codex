export const PLATFORM_OWNER_EMAIL = "kyox120@gmail.com";

export function isPlatformOwnerEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === PLATFORM_OWNER_EMAIL;
}
