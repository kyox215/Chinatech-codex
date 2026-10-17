import { BackendPageFrame } from "@/components/backend-page-frame";
import { CustomerDevices } from "@/components/customers/customer-devices";
export const metadata = { title: "客户设备" };
export default function Page() { return <BackendPageFrame plan={{ kind: "customer-devices" }}><CustomerDevices /></BackendPageFrame>; }
