import { BackendPageFrame } from "@/components/backend-page-frame";
import {procurementListQuery,type ProcurementListQuery} from "@/lib/backend/procurement-list-contract";
import type { Metadata } from "next";
import { ProcurementList } from "@/components/procurement/procurement-list";

export const metadata: Metadata = { title: "采购与到货" };
export default async function ProcurementPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
 const params=await searchParams,value=(key:string)=>typeof params[key]==="string"?params[key] as string:"";
 const repair=(value("repairId")||value("repair")).slice(0,100),q=value("q").length<=160?value("q"):"",filter=value("filter"),groupBy=value("groupBy"),anchor=value("anchor").slice(0,100);
 const query=procurementListQuery({q,repairId:repair,filter:["all","draft","open","complete"].includes(filter)?filter as ProcurementListQuery["filter"]:"all",groupBy:["status","supplier","repair","none"].includes(groupBy)?groupBy as ProcurementListQuery["groupBy"]:"supplier"});
 return <BackendPageFrame plan={{kind:"procurement",query,...(anchor?{anchor}:{})}}><ProcurementList initialRepairId={repair}/></BackendPageFrame>;
}
