"use client";
import { useBackendState } from "@/lib/backend/react";
import { useSyncExternalStore } from "react";
import { readStaffSnapshot, staffServerSnapshot, subscribeStaff } from "@/lib/staff-client";
import { can, type Permission } from "@/lib/staff";
export function useStaff() { const state=useSyncExternalStore(subscribeStaff,readStaffSnapshot,()=>staffServerSnapshot);const backend=useBackendState();const current=backend?{data:backend.staff,member:backend.staff.members.find(row=>row.id===backend.staff.currentId)??null,ready:true,error:""}:state;return {...current,can:(permission:Permission)=>can(current.member,permission)}; }
