"use client";
import { useBackendStore } from "@/components/backend-snapshot";
import { isActiveMember } from "@/lib/staff";
import { readStaffSnapshot, staffServerSnapshot, subscribeStaff } from "@/lib/staff-client";
import { can, type Permission } from "@/lib/staff";
export function useStaff() { const state=useBackendStore(subscribeStaff,readStaffSnapshot,staffServerSnapshot,current=>{const data=current?.staff;if(!data)return {...staffServerSnapshot,ready:true,error:"后台资料暂不可用。"};const member=data.members.find(row=>row.id===data.currentId);return {data,member:isActiveMember(member)?member:null,ready:true,error:""};});return {...state,can:(permission:Permission)=>can(state.member,permission)}; }
