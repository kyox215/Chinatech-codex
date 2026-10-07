import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { OfficeAction, OfficeTerminal } from "./office-commands";

export type OfficeToken = { v: 1; action: OfficeAction; epoch: string; digest: string };
export class OfficeError extends Error {
  constructor(message: string, readonly status = 503) { super(message); }
}
export function officeAction(value: unknown): OfficeAction {
  if (typeof value !== 'string' || !['install','activate','uninstall','reinstall'].includes(value)) throw new OfficeError("Office 操作无效。", 400);
  return value as OfficeAction;
}
export function officeTerminal(value: unknown): OfficeTerminal {
  if (value !== 'cmd' && value !== 'powershell') throw new OfficeError("终端类型无效。", 400);
  return value;
}
export function officeKey(value = process.env.OFFICE_COMMAND_SIGNING_KEY): Buffer {
  if (!value || !/^[a-f0-9]{64}$/.test(value)) throw new OfficeError("Office 服务暂不可用，请稍后重试。");
  return Buffer.from(value, 'hex');
}
export function officeSigningReady(): boolean { try { officeKey(); return true; } catch { return false; } }
export function scriptDigest(body: Buffer): string { return createHash('sha256').update(body).digest('hex'); }
function mac(part: string, key: Buffer) { return createHmac('sha256', key).update('chinatech:office:v1\0').update(part).digest(); }
export function signOfficeToken(payload: OfficeToken, key = officeKey()): string {
  const part = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return part + '.' + mac(part, key).toString('base64url');
}
export function readOfficeToken(value: unknown, key = officeKey()): OfficeToken {
  const invalid = () => new OfficeError("命令无效，请重新生成。", 400);
  if (typeof value !== 'string' || value.length > 1024) throw invalid();
  const [part, signature, extra] = value.split('.');
  if (!part || !signature || extra || !/^[A-Za-z0-9_-]+$/.test(part) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) throw invalid();
  const actual = Buffer.from(signature, 'base64url'), expected = mac(part, key);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || actual.toString('base64url') !== signature) throw invalid();
  let p: OfficeToken;
  try { const raw=Buffer.from(part,'base64url'); if(raw.toString('base64url')!==part)throw invalid(); p=JSON.parse(raw.toString('utf8')); } catch { throw invalid(); }
  if (!p || Object.keys(p).sort().join(',') !== 'action,digest,epoch,v' || p.v !== 1 || typeof p.epoch !== 'string' || typeof p.digest !== 'string' || !/^[1-9][0-9]{0,18}$/.test(p.epoch) || !/^[a-f0-9]{64}$/.test(p.digest)) throw invalid();
  try { officeAction(p.action); } catch { throw invalid(); }
  return p;
}
export function assertOfficePermission(state: { enabled: boolean; version: string }, payload: OfficeToken) {
  if (!state.enabled) throw new OfficeError("Office 命令已停用。", 403);
  if (state.version !== payload.epoch) throw new OfficeError("命令已失效，请重新生成。", 410);
}
export function officeOrigin(value = process.env.APP_ORIGIN): string {
  try {
    const u=new URL(value || '');
    const local=process.env.VERCEL!=='1' && ['localhost','127.0.0.1'].includes(u.hostname);
    if (u.username || u.password || u.pathname!=='/' || u.search || u.hash || (u.protocol!=='https:' && !(local && u.protocol==='http:'))) throw new Error();
    return u.origin;
  } catch { throw new OfficeError("Office 服务暂不可用，请稍后重试。"); }
}
export function buildOfficeCommand(origin: string, token: string, digest: string, terminal: OfficeTerminal, language: string): string {
  const messages: Record<string,string> = {
    'zh-CN':'命令已失效、已停用或下载校验失败。请回网站重新生成；尚未开始执行。',
    it:'Comando revocato, disabilitato o download non verificato. Torna al sito e rigenera il comando. Esecuzione non iniziata.',
    en:'Command revoked, disabled or download verification failed. Return to the website and regenerate. Execution has not started.',
  };
  const url=new URL('/api/toolbox/office/script',officeOrigin(origin));url.searchParams.set('token',token);
  const notice=messages[language] || messages['zh-CN'];
  // Only this HTTPS loader is encoded, never the executable Office payload or signing key.
  const script=`$ErrorActionPreference='Stop'\n[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12\n$f=Join-Path $env:TEMP ('chinatech-launch-'+[guid]::NewGuid().ToString('N')+'.ps1')\n$verified=$false\ntry {\n Invoke-WebRequest -UseBasicParsing -Uri '${url.href}' -OutFile $f -TimeoutSec 30 -Headers @{'Cache-Control'='no-cache'}\n if((Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash.ToLowerInvariant() -ne '${digest}') { throw 'hash' }\n $verified=$true\n $LASTEXITCODE=0\n & $f\n exit $LASTEXITCODE\n} catch {\n if(-not $verified) { Write-Error '${notice.replaceAll("'","''")}' -ErrorAction Continue } else { Write-Error $_ -ErrorAction Continue }\n exit 1\n} finally { if(Test-Path -LiteralPath $f) { Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue } }\n`;
  officeTerminal(terminal);
  return 'powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ' + Buffer.from(script,'utf16le').toString('base64');
}
