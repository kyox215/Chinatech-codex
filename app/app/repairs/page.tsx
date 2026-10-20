import { BackendPageFrame } from "@/components/backend-page-frame";
import {parsePageReadPlan} from "@/lib/backend/read-plan";
import {repairListQuery,type RepairListQuery} from "@/lib/backend/repair-list-contract";
import type { Metadata } from "next";
import { RepairList } from "@/components/repairs/repair-list";

export const metadata: Metadata = { title: "维修工单" };

export default async function RepairsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams,values=Object.fromEntries(["q","status","view","partsFilter","noticeFilter","groupBy","sort"].flatMap(key=>typeof params[key]==="string"?[[key,params[key]]]:[]));
  if((values.q?.length??0)>160)values.q="";
  const repairQuery=repairListQuery(values as Partial<RepairListQuery>),group=typeof params.group==="string"?params.group:undefined,anchor=typeof params.anchor==="string"?params.anchor:undefined;
  return <BackendPageFrame plan={parsePageReadPlan({kind:"repairs",repairQuery,...(group?{group}:{}),...(anchor?{anchor}:{})})}><RepairList /></BackendPageFrame>;
}
