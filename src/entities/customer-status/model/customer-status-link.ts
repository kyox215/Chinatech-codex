export const CUSTOMER_STATUS_LEGACY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const CUSTOMER_STATUS_STABLE_TOKEN_PATTERN =
  /^v2\.[1-9a-z][0-9a-z]*\.[A-Za-z0-9_-]{22}\.[1-9a-z][0-9a-z]*\.[A-Za-z0-9_-]{43}$/;
export const CUSTOMER_STATUS_TOKEN_PATTERN = new RegExp(
  `(?:${CUSTOMER_STATUS_LEGACY_TOKEN_PATTERN.source})|(?:${CUSTOMER_STATUS_STABLE_TOKEN_PATTERN.source})`,
);

const CUSTOMER_STATUS_PATH = "/r";
const PRODUCTION_HOSTS = new Set(["chinatech.in", "www.chinatech.in"]);

export type CustomerStatusLinkParseResult =
  | { kind: "valid"; token: string; href: string }
  | { kind: "invalid" };

export function parseCustomerStatusLink(
  rawValue: string,
  origin = "http://localhost:3000",
): CustomerStatusLinkParseResult | null {
  const raw = rawValue.trim();
  if (!raw) return null;
  if (CUSTOMER_STATUS_TOKEN_PATTERN.test(raw)) {
    return { kind: "valid", token: raw, href: `${CUSTOMER_STATUS_PATH}#${raw}` };
  }
  if (raw.startsWith("v2.")) return { kind: "invalid" };

  try {
    const base = new URL(origin);
    const url = new URL(raw, base);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const fragment = url.hash.replace(/^#/, "").trim();
    if (path !== CUSTOMER_STATUS_PATH) {
      if (CUSTOMER_STATUS_TOKEN_PATTERN.test(fragment) || fragment.startsWith("v2.")) {
        return { kind: "invalid" };
      }
      return null;
    }
    if (/^[\\/]{2}/.test(raw) || containsControlCharacters(raw)) {
      return { kind: "invalid" };
    }

    const isRootRelative = raw.startsWith("/") && !raw.includes("\\");
    const hasExplicitOrigin = /^[a-z][a-z\d+.-]*:/i.test(raw);
    if (!isRootRelative && !hasExplicitOrigin) return { kind: "invalid" };
    if (url.username || url.password) return { kind: "invalid" };
    if (hasExplicitOrigin && url.port && !isLocalDevelopmentOrigin(url)) {
      return { kind: "invalid" };
    }
    if (hasExplicitOrigin && !isTrustedCustomerStatusOrigin(url, base)) {
      return { kind: "invalid" };
    }
    if (url.search) return { kind: "invalid" };

    const token = fragment;
    if (!CUSTOMER_STATUS_TOKEN_PATTERN.test(token)) return { kind: "invalid" };
    return { kind: "valid", token, href: `${CUSTOMER_STATUS_PATH}#${token}` };
  } catch {
    return null;
  }
}

export function isCustomerStatusLinkCandidate(value: unknown) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return parseCustomerStatusLink(trimmed, "https://www.chinatech.in") !== null;
}

function isTrustedCustomerStatusOrigin(url: URL, base: URL) {
  if (url.origin === base.origin) {
    return url.protocol === "https:" || isLocalDevelopmentOrigin(url);
  }
  return (
    url.protocol === "https:" &&
    PRODUCTION_HOSTS.has(url.hostname) &&
    !url.port &&
    ((base.protocol === "https:" && PRODUCTION_HOSTS.has(base.hostname) && !base.port) ||
      isLocalDevelopmentOrigin(base))
  );
}

function isLocalDevelopmentOrigin(url: URL) {
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

function containsControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}
