import { BackendPageFrame } from "@/components/backend-page-frame";
import type { Metadata } from "next";
import { CustomerDetail } from "@/components/customers/customer-detail";
export const metadata: Metadata = { title: "客户档案" };
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <BackendPageFrame plan={{ kind: "customer", id }}><CustomerDetail id={id} key={id} /></BackendPageFrame>; }
