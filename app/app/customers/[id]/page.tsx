import { BackendPageFrame } from "@/components/backend-page-frame";
import type { Metadata } from "next";
import { CustomerDetail } from "@/components/customers/customer-detail";
export const metadata: Metadata = { title: "客户档案" };
export default async function CustomerDetailPage({ params,searchParams }: { params: Promise<{ id: string }>;searchParams:Promise<Record<string,string|string[]|undefined>> }) { const { id } = await params,values=await searchParams,kind=["repairs","sales","history"].includes(String(values.records))?values.records as "repairs"|"sales"|"history":"auto",q=typeof values.q==="string"&&values.q.length<=160?values.q:"",anchor=typeof values.anchor==="string"&&values.anchor.length<=1024?values.anchor:undefined;return <BackendPageFrame plan={{ kind: "customer", id,customerQuery:{id,kind,q},...(anchor?{anchor}:{}) }}><CustomerDetail id={id} key={id} /></BackendPageFrame>; }
