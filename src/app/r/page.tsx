import type { Metadata } from "next";

import { CustomerStatusScreen } from "@/features/customer-status/screens/customer-status-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stato riparazione | RepairDesk",
  description: "Consulta lo stato essenziale della riparazione comunicato dal negozio.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function CustomerStatusPage() {
  return <CustomerStatusScreen />;
}
