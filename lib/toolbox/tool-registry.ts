/** Public identities are opaque release IDs; display versions are never ordered. */
export const toolIds = ['office', 'windows-check', 'phone-assistant', 'smart-switch-lab', 'mimover-original'] as const;
export type ToolId = typeof toolIds[number];
export const toolNames: Record<ToolId,string> = {office:'Office 助手','windows-check':'Windows 检测工具','phone-assistant':'安卓手机助手','smart-switch-lab':'Smart Switch 实验版','mimover-original':'Mi Mover 实验版'};
export function isToolId(value: unknown): value is ToolId { return typeof value === 'string' && toolIds.includes(value as ToolId); }
export type ToolRelease = {releaseId:string;version:string;files:readonly {architecture:string;bytes:number;sha256:string;href:string}[];authenticodeSigned:boolean;publisherCertificateSha256?:string|null;websiteControlProtocol?:number;prerelease:boolean};
export type ToolState = {toolId:ToolId;activeReleaseId:string|null;enabled:boolean;ready:boolean;revision:string;release:ToolRelease|null};
export function acceptsRelease(tool:ToolState,releaseId:unknown):boolean { return tool.enabled && tool.ready && tool.activeReleaseId!==null && tool.release?.releaseId===tool.activeReleaseId && releaseId===tool.activeReleaseId; }
