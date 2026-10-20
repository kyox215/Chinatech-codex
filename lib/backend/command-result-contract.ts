import type {CommandResult,CommandEffectDomain} from './command-result';
import type {BackendCommand} from './contracts';
const domains:CommandEffectDomain[]=['repairs','procurement','retail','customers','settings','staff'];
/** Wire validation only. A matching requestId never grants authorization; the
 * server still validates its current session, member and original digest. */
export function parseCommandResult(value:unknown,command:Pick<BackendCommand,'storeId'|'kind'|'requestId'>):CommandResult{
 const result=value as CommandResult,operation=result?.operation;
 if(!result||result.formatVersion!==2||result.storeId!==command.storeId||result.revision!==null&&(!Number.isSafeInteger(result.revision)||result.revision<0)||!operation||operation.requestId!==command.requestId||operation.kind!==command.kind||typeof operation.entityId!=='string'||operation.entityId.length>100||command.kind!=='customer.save'&&!operation.entityId||typeof operation.committedAt!=='string'||!Number.isFinite(Date.parse(operation.committedAt))||typeof operation.replayed!=='boolean'||!result.effects||typeof result.effects.available!=='boolean'||!Number.isSafeInteger(result.effects.count)||result.effects.count<0||result.effects.count>500||!Array.isArray(result.effects.domains)||new Set(result.effects.domains).size!==result.effects.domains.length||result.effects.domains.some(domain=>!domains.includes(domain))||result.revision===null&&result.effects.available||['snapshot','staff','settings','intakes','signatures','workflows','procurement','retail','retailHistory','customers','read'].some(key=>Object.hasOwn(result,key)))throw new Error('提交回执尚未确认，请核对原请求。');
 return result;
}
