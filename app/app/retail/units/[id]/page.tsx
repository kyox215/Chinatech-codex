import type { Metadata } from "next";
import { RetailDetail } from "@/components/retail/retail-detail";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ sale?: string | string[] }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { id } = await params; return { title: `单机 ${id}` }; }
export default async function RetailUnitPage({ params, searchParams }: Props) { const { id } = await params; const { sale } = await searchParams; const selectedSale = typeof sale === "string" ? sale : undefined; return <RetailDetail id={id} selectedSale={selectedSale} key={id + ":" + (selectedSale ?? "")} />; }
