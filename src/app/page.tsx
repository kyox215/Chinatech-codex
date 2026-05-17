import type { Metadata } from "next";
import Dashboard from "@/routes/index";

export const metadata: Metadata = {
  title: "概览",
  description: "门店当日维修工单与营收概览",
};

export default function Page() {
  return <Dashboard />;
}
