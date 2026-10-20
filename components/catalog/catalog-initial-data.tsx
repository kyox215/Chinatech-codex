"use client";
import { createContext, useContext } from "react";
import type { CatalogInitialData } from "@/lib/device-catalog";
const CatalogInitial = createContext<CatalogInitialData | undefined>(undefined);
// This is a page-tree value, never a server module cache or browser global.
export function CatalogInitialDataProvider({ initial, children }: { initial?: CatalogInitialData; children: React.ReactNode }) {
  return <CatalogInitial.Provider value={initial}>{children}</CatalogInitial.Provider>;
}
export function useCatalogInitialData() { return useContext(CatalogInitial); }
