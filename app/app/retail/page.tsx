import type { Metadata } from "next";
import { Suspense } from "react";
import { RetailList } from "@/components/retail/retail-list";
import RetailLoading from "./loading";

export const metadata: Metadata = { title: "整机商品" };
export default function RetailPage() { return <Suspense fallback={<RetailLoading />}><RetailList /></Suspense>; }
