import type { Metadata } from "next";

import { KioskScreen } from "@/features/kiosk";

export const metadata: Metadata = {
  title: "Customer Kiosk",
  description: "ChinaTech customer intake and pickup confirmation kiosk",
};

export default function Page() {
  return <KioskScreen />;
}
