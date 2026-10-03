"use client";
import { createContext, useContext } from "react";
import type { ProcurementRecord, ProcurementEvent } from "@/lib/procurement";
import type { ProcurementBatchItem } from "@/lib/procurement-batch";
import type { RepairUpdates } from "@/lib/repair-list-order";
import type { RetailCommand, RetailEvent, RetailUnit } from "@/lib/retail";

export type ProcurementListView = { query:string;filter:"all"|"draft"|"cart"|"open"|"complete";repairId:string;groupBy:string };
export type ProcurementAction = { type:"create";record:ProcurementRecord } | { type:"create-cart";record:ProcurementRecord;workflowRevision:number;intakeRevision:number } | { type:"edit";record:ProcurementRecord;revision:number } | { type:"append";id:string;event:ProcurementEvent;revision:number } | { type:"link_requirement";id:string;revision:number;requirementId:string;requirementRevision:number;note:string } | { type:"batch";action:"ordered"|"arrival";supplierId:string;items:ProcurementBatchItem[] } | { type:"list-view";view:ProcurementListView } | { type:"clear-feedback" };
export type ProcurementState = {storageError?:string;records:ProcurementRecord[];feedback:{recordId:string;error:boolean;message:string}|null;listView:ProcurementListView;repairUpdates:RepairUpdates};
export const ProcurementContext=createContext<(ProcurementState & {dispatch:(action:ProcurementAction)=>void|Promise<void>})|null>(null);
export type RetailAction={type:"create";unit:RetailUnit;event:RetailEvent}|{type:"command";id:string;command:RetailCommand;event:RetailEvent;version:number}|{type:"remember";url:string;scroll:number};
export type RetailState={units:RetailUnit[];ready:boolean;error:string;returnTo:string;returnScroll:number;feedback:{id:string;error:boolean;message:string}|null};
export const RetailContext=createContext<(RetailState & {dispatch:(action:RetailAction)=>boolean|Promise<boolean>})|null>(null);
export function useProcurement(){const context=useContext(ProcurementContext);if(!context)throw new Error("采购上下文缺失。");return context;}
export function useRetail(){const context=useContext(RetailContext);if(!context)throw new Error("整机上下文缺失。");return context;}
