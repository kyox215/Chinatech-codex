import { BackendPageFrame } from "@/components/backend-page-frame";
import type { Metadata } from "next";
import { RetailDetail } from "@/components/retail/retail-detail";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ sale?: string | string[]; returnTo?: string | string[]; original?: string | string[] }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { id } = await params; return { title: `商品档案 ${id}` }; }
export default async function RetailUnitPage({ params, searchParams }: Props) { const { id } = await params; const { sale, returnTo, original } = await searchParams; const selectedSale = typeof sale === "string" ? sale : undefined; return <BackendPageFrame plan={{ kind: "retail-unit", id }}><RetailDetail id={id} returnTo={typeof returnTo === "string" ? returnTo : undefined} showOriginal={original === "1"} selectedSale={selectedSale} key={id + ":" + (selectedSale ?? "")} /></BackendPageFrame>; }
