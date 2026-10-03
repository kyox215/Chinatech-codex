import { BackendPage } from "@/components/backend-page";
import type { Metadata } from "next";
import { CustomerDetail } from "@/components/customers/customer-detail";
export const metadata: Metadata = { title: "客户档案" };
export default async function CustomerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const values = await searchParams;
  const query = new URLSearchParams(Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  return <BackendPage scope={`/app/customers/${encodeURIComponent(id)}${query.size ? `?${query}` : ""}`}><CustomerDetail id={id} key={id} /></BackendPage>;
}
