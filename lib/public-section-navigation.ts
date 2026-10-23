import type { MouseEvent } from "react";

/** Keep repeated same-page section links deterministic without a route refresh. */
export function scrollToPublicSection(event: MouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const destination = new URL(event.currentTarget.href);
  if (destination.origin !== window.location.origin || destination.pathname !== window.location.pathname || destination.search !== window.location.search) return;
  const section = document.getElementById(decodeURIComponent(destination.hash.slice(1)));
  if (!section) return;
  event.preventDefault();
  if (window.location.hash !== destination.hash) window.history.pushState(null, "", destination.hash);
  section.scrollIntoView({ block: "start", behavior: "instant" });
}
