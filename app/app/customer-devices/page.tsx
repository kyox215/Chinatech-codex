import { BackendPage } from "@/components/backend-page";
import { CustomerDevices } from "@/components/customers/customer-devices";
export const metadata = { title: "客户设备" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const pageQuery=await searchParams;
 return <BackendPage scope={`/app/customer-devices` + (()=>{const queryParams=new URLSearchParams();for(const [key,value] of Object.entries(pageQuery))if(typeof value==="string")queryParams.set(key,value);return queryParams.size?`?${queryParams}`:"";})()}><CustomerDevices /></BackendPage>; }
