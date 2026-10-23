const legacyRepairSections = new Set(["features", "tutorials", "workflow", "questions"]);

/** Fragments are client-only; migrate only known bookmarks, never arbitrary destinations. */
export function legacyPublicDestination(hash: string, search = ""): string | null {
  let section: string;
  try { section = decodeURIComponent(hash.replace(/^#/, "")); } catch { return null; }
  if (section === "cinema") return `/cinema${search}`;
  return legacyRepairSections.has(section) ? `/repair${search}#${section}` : null;
}

export function isPublicActivityPath(pathname: string): boolean {
  return ["/", "/repair", "/cinema"].includes(pathname) || /^\/toolbox(?:\/|$)/.test(pathname);
}
