"use client";
import { isBackendClient, backendSnapshot, subscribeBackend, backendCommand } from "./backend/client";
import { can, defaultStaffData, isActiveMember, parseStaffData, updateStaffMember, type Permission, type StaffData, type StaffMember } from "./staff";
import { intakeRecordTime } from "./repair-intake-record";
export const staffStorageKey = "chinatech.m1.staff.v1";
export const staffChangeEvent = "chinatech-staff-change";
export const staffServerSnapshot = { data: {revision:0,currentId:"",members:[],audit:[]} as StaffData, member:null as StaffMember|null,ready:false,error:"" };
let snapshot = staffServerSnapshot;
let remoteSource:ReturnType<typeof backendSnapshot>;let remoteSnapshot=staffServerSnapshot;
let cachedRaw: string|null|undefined;
export function readStaffSnapshot() {
  if(isBackendClient()){const current=backendSnapshot();if(current!==remoteSource){remoteSource=current;const data=current?.staff;remoteSnapshot=data?{data,member:data.members.find(row=>row.id===data.currentId)??null,ready:true,error:""}:{...staffServerSnapshot,ready:true,error:"后台资料暂不可用。"};}return remoteSnapshot;}
  if (typeof window === "undefined") return staffServerSnapshot;
  try {
    const raw = window.localStorage.getItem(staffStorageKey);
    if (raw !== cachedRaw || !snapshot.ready) {
      cachedRaw = raw;
      try { const data = parseStaffData(raw); const member = data.members.find(member=>member.id === data.currentId); snapshot={data,member:isActiveMember(member)?member:null,ready:true,error:""}; }
      catch { snapshot={...snapshot,member:null,ready:true,error:"员工预览资料无法读取，已停止业务访问。"}; }
    }
  } catch { cachedRaw=undefined; if (!snapshot.error || !snapshot.ready) snapshot={...snapshot,member:null,ready:true,error:"浏览器禁止员工预览存储，已停止业务访问。"}; }
  return snapshot;
}
export function subscribeStaff(listener:()=>void) { const stop=subscribeBackend(listener); const storage=(event:StorageEvent)=>{if (event.key===staffStorageKey || event.key===null) listener();}; window.addEventListener("storage",storage);window.addEventListener(staffChangeEvent,listener);return()=>{stop();window.removeEventListener("storage",storage);window.removeEventListener(staffChangeEvent,listener);}; }
export function requirePreviewPermission(permission: Permission) {
  const current=readStaffSnapshot();
  if (!current.ready || current.error || !can(current.member,permission)) throw new Error("当前账号没有此操作权限，或员工状态已变化。请重新核对。");
  return current.member!;
}
function persist(data: StaffData) { const raw=JSON.stringify({version:1,data});parseStaffData(raw);try {window.localStorage.setItem(staffStorageKey,raw);} catch {throw new Error("员工预览保存失败，现有资料未改变。");} cachedRaw=raw;snapshot={data,member:data.members.find(member=>member.id===data.currentId) ?? null,ready:true,error:""};window.dispatchEvent(new Event(staffChangeEvent)); }
export function savePreviewMember(draft: StaffMember, revision: number) { if(isBackendClient()) return backendCommand("staff.save",{draft,revision}); const actor=requirePreviewPermission("staff.manage");const data=parseStaffData(window.localStorage.getItem(staffStorageKey));persist(updateStaffMember(data,draft,revision,actor.id,crypto.randomUUID(),intakeRecordTime())); }
// An explicit M1 demo selector, not authentication or a privilege grant to a real account.
export function selectPreviewMember(id: string) {if(isBackendClient()) throw new Error("正式账号不能切换演示身份。"); const current=readStaffSnapshot();if (!current.ready || current.error) throw new Error(current.error || "员工预览尚未就绪。");const data=parseStaffData(window.localStorage.getItem(staffStorageKey));if (!isActiveMember(data.members.find(member=>member.id===id))) throw new Error("该账号或门店成员尚未有效。");persist({...data,currentId:id,revision:data.revision+1}); }
export function resetStaffModuleForTests() { snapshot=staffServerSnapshot;cachedRaw=undefined; }
export { defaultStaffData };
