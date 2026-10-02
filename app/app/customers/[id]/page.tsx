import type { Metadata } from "next";
import { CustomerDetail } from "@/components/customers/customer-detail";
export const metadata: Metadata = { title: "客户档案" };
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <CustomerDetail id={id} key={id} />; }
