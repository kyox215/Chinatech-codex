"use client";
import { ProcurementProvider } from "./procurement/procurement-provider";
import { RetailProvider } from "./retail/retail-provider";
export default function PreviewProviders({children}:{children:React.ReactNode}) {return <ProcurementProvider><RetailProvider>{children}</RetailProvider></ProcurementProvider>;}
