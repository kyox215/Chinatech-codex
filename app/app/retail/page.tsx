import { BackendPageFrame } from "@/components/backend-page-frame";
import type { Metadata } from "next";
import { RetailList } from "@/components/retail/retail-list";

export const metadata: Metadata = { title: "整机商品" };
export default function RetailPage() { return <BackendPageFrame plan={{ kind: "retail" }}><RetailList /></BackendPageFrame>; }
