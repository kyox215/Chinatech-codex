"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { legacyPublicDestination } from "@/lib/public-routes";

export function LegacyHomeBookmarks() {
  const router = useRouter();
  useEffect(() => {
    const migrate = () => {
      if (window.location.pathname !== "/") return;
      const destination = legacyPublicDestination(window.location.hash, window.location.search);
      if (destination) router.replace(destination);
    };
    migrate();
    window.addEventListener("hashchange", migrate);
    window.addEventListener("popstate", migrate);
    return () => {
      window.removeEventListener("hashchange", migrate);
      window.removeEventListener("popstate", migrate);
    };
  }, [router]);
  return null;
}
