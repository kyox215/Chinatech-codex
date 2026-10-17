import { BackendPageFrame } from "@/components/backend-page-frame";
import { CustomerDevices } from "@/components/customers/customer-devices";
export const metadata = { title: "客户设备" };
export default async function Page({searchParams}:{searchParams:Promise<{q?:string|string[];anchor?:string|string[]}>}) { const params=await searchParams,q=typeof params.q==="string"&&params.q.length<=160?params.q:"",anchor=typeof params.anchor==="string"&&/^[a-f0-9]{64}$/.test(params.anchor)?params.anchor:undefined;return <BackendPageFrame plan={{ kind: "customer-devices",...(q?{q}:{}),...(anchor?{anchor}:{}) }}><CustomerDevices /></BackendPageFrame>; }
