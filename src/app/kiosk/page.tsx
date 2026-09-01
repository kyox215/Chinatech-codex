import type { Metadata } from "next";

import { KioskScreen } from "@/features/kiosk";

export const metadata: Metadata = {
  title: "Kiosk clienti",
  description: "Kiosk clienti per raccolta dati e conferma del ritiro",
};

export default function Page() {
  return <KioskScreen />;
}
