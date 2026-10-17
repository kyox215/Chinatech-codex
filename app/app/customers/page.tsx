import { BackendPageFrame } from "@/components/backend-page-frame";
import { parsePageReadPlan } from "@/lib/backend/read-plan";
import type { Metadata } from "next";
import { CustomerList } from "@/components/customers/customer-list";
export const metadata: Metadata = { title: "客户管理" };
export default async function CustomerPage({searchParams}:{searchParams:Promise<{q?:string|string[];anchor?:string|string[]}>}) { const raw=await searchParams,q=typeof raw.q==="string"?raw.q.slice(0,160):"",anchor=typeof raw.anchor==="string"&&/^\+[1-9]\d{6,14}$/.test(raw.anchor)?raw.anchor:undefined;return <BackendPageFrame plan={parsePageReadPlan({kind:"customers",...(q?{q}:{}),...(anchor?{anchor}:{})})}><CustomerList /></BackendPageFrame>; }
