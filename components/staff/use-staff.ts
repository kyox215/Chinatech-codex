"use client";
import { useSyncExternalStore } from "react";
import { readStaffSnapshot, staffServerSnapshot, subscribeStaff } from "@/lib/staff-client";
import { can, type Permission } from "@/lib/staff";
export function useStaff() { const state=useSyncExternalStore(subscribeStaff,readStaffSnapshot,()=>staffServerSnapshot);return {...state,can:(permission:Permission)=>can(state.member,permission)}; }
