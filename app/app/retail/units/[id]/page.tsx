import type { Metadata } from "next";
import { RetailDetail } from "@/components/retail/retail-detail";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { id } = await params; return { title: `单机 ${id}` }; }
export default async function RetailUnitPage({ params }: Props) { const { id } = await params; return <RetailDetail id={id} key={id} />; }
