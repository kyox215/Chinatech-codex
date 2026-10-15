'use client';
import { Toast } from "@/components/toast";
import { useCallback, useEffect, useRef, useState } from 'react';
import { ReadPending } from '@/components/page-recovery';
import { useActivityFeedback } from '@/components/operation-feedback';
import { SelectControl } from '@/components/select-control';
import { useLanguage } from '@/components/language-provider';
import styles from './account-settings.module.css';
import v3Styles from './office-desktop-v3-control.module.css';

type Control = { enabled: boolean; minimumVersion: string; currentVersion: string | null; releaseReady: boolean; signingReady: boolean; sourceReady: boolean; publicRelease: { version: string; websiteControlProtocol: 3 | null; websiteControlled: boolean; authenticodeSigned: boolean; prerelease: boolean }; trustedKeyFingerprints: { kid: string; sha256: string; current: boolean }[]; cleanupEnabled: boolean; revision: string; updatedAt: string | null; accountId: string; sessionId: string; eligibleMinimumVersions: string[] };
type Intent = { enabled: boolean; minimumVersion: string; revision: string; requestId: string; scope: string };
type Job = { jobId: string; action: string; status: string; appVersion: string; architecture: string; createdAt: string; startedAt: string | null; updatedAt: string; stage: string | null; errorCode: string | null; lastActivityAt: string | null; waitingForReport: boolean; recoveryExpiresAt: string | null };
type Cleanup = { retentionDays: number; expiredBefore: string; digest: string; counts: Record<string, number>; dryRun: boolean; accountId: string; sessionId: string };
type CleanupIntent = { digest: string; requestId: string; scope: string };
const endpoint = '/api/account/toolbox/office-desktop/v3/';
const errors: Record<string, string> = { SERVICE_UNAVAILABLE: '新版助手管理暂不可用，请刷新后重试。', NO_ACCESS: '你没有新版助手管理权限。', SESSION_EXPIRED: '新版助手管理会话已失效，请重新登录。', SESSION_INVALID: '新版助手管理账号或会话已变化，请刷新账号资料。', REQUEST_CONFLICT: '新版助手设置已变化，请刷新后重新核对。', INVALID_REQUEST: '新版助手管理请求无效。', CLEANUP_DISABLED: '过期记录清理执行尚未开放，可先预览候选范围。', VERSION_NOT_AVAILABLE: '所选新版尚未完成发布验收，请刷新后重试。' };
const actions: Record<string, string> = { install: 'Office 安装任务', activate: 'Office 激活任务', uninstall: 'Office 卸载任务', close: 'Office 关闭任务', reinstall: 'Office 重装任务' };
const statuses: Record<string, string> = { prepared: '待启动', expired: '启动准备已过期', started: '已启动，尚未回报结果', completed: '任务已完成', failed: '任务失败，恢复资格待核对', cancelled: '任务已取消，恢复资格待核对', paused: '任务已暂停，恢复资格待核对' };
const stages: Record<string, string> = { Detect: '检测', Download: '下载', Remove: '移除', Install: '安装', Components: '核对组件', Activate: '激活', Finished: '结束', CloseApps: '关闭应用', RestoreApps: '恢复应用' };
const cleanupLabels: Record<string, string> = { jobs: '过期任务', outcomes: '任务结果', activity: '任务活动', commits: '过期恢复许可', receipts: '防重放回执', sessions: '过期设备会话', devices: '无依赖设备', adminReceipts: '设置回执', rateBuckets: '过期限流记录' };
class RequestError extends Error { constructor(readonly code: string) { super(code); } }

export function OfficeDesktopV3Control({ accountId, sessionId, technicalOnly=false }: { accountId: string; sessionId: string; technicalOnly?: boolean }) {
  const [manualRead,setManualRead]=useState(false);
  useActivityFeedback(manualRead,{kind:"read"});
  const [manualJobs,setManualJobs]=useState<"expand"|"refresh"|null>(null);
  const manualJobsEpoch=useRef(0);
  useActivityFeedback(manualJobs!==null,{kind:"read"});
  const { t, locale } = useLanguage(), scope = accountId + ':' + sessionId;
  const [data, setData] = useState<Control | null>(null), [minimum, setMinimum] = useState('1.4.0');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [allowed, setAllowed] = useState(true), [error, setError] = useState(''), [intent, setIntent] = useState<Intent | null>(null);
  const [expanded, setExpanded] = useState(false), [jobs, setJobs] = useState<Job[] | null>(null), [jobsLoading, setJobsLoading] = useState(false), [jobsError, setJobsError] = useState('');
  const [cleanup, setCleanup] = useState<Cleanup | null>(null), [cleanupIntent, setCleanupIntent] = useState<CleanupIntent | null>(null), [cleanupError, setCleanupError] = useState(''), [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupNotice, setCleanupNotice] = useState("");
  const cleanupActive = useRef<AbortController | null>(null), cleanupGeneration = useRef(0);
  const active = useRef<AbortController | null>(null), jobsActive = useRef<AbortController | null>(null), generation = useRef(0), jobsGeneration = useRef(0), busy = useRef(false), mounted = useRef(true), refreshAfterSave = useRef(false);
  const headers = useCallback(() => ({ 'X-CT-Account-ID': accountId, 'X-CT-Session-ID': sessionId }), [accountId, sessionId]);
  const clearCleanup = useCallback(() => { cleanupGeneration.current++; cleanupActive.current?.abort(); setCleanup(null); setCleanupIntent(null); setCleanupError(''); setCleanupLoading(false); setCleanupNotice(""); }, []);
  const clearJobs = useCallback(() => { jobsGeneration.current++; jobsActive.current?.abort(); setJobs(null); setJobsError(''); setJobsLoading(false); }, []);
  const load = useCallback(async () => {
    if (busy.current) return;
    active.current?.abort(); const controller = new AbortController(); active.current = controller; const attempt = ++generation.current;
    setLoading(true); setIntent(null); clearJobs(); clearCleanup();
    try {
      const response = await fetch(endpoint + 'control', { cache: 'no-store', headers: headers(), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }), body = await response.json();
      if (controller.signal.aborted || attempt !== generation.current) return;
      if ([401, 403].includes(response.status)) { setAllowed(false); setData(null); return; }
      if (!response.ok) throw new RequestError(body.code || 'SERVICE_UNAVAILABLE');
      if (body.accountId + ':' + body.sessionId !== scope) { setData(null); setIntent(null); throw new RequestError('SESSION_INVALID'); }
      setData(body); setMinimum(body.minimumVersion); setAllowed(true); setError('');
    } catch (reason) { if (!controller.signal.aborted && attempt === generation.current) setError(reason instanceof RequestError ? reason.code : 'SERVICE_UNAVAILABLE'); }
    finally { if (!controller.signal.aborted && attempt === generation.current) setLoading(false); }
  }, [clearCleanup, clearJobs, headers, scope]);
  const loadJobs = useCallback(async () => {
    if (!data || data.accountId + ':' + data.sessionId !== scope || loading || saving) return;
    jobsActive.current?.abort(); const controller = new AbortController(); jobsActive.current = controller; const attempt = ++jobsGeneration.current;
    setJobsLoading(true); setJobsError('');
    try {
      const response = await fetch(endpoint + 'jobs', { cache: 'no-store', headers: headers(), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }), body = await response.json();
      if (controller.signal.aborted || attempt !== jobsGeneration.current) return;
      if ([401, 403, 409].includes(response.status)) { setData(null); setIntent(null); setJobs(null); setError(body.code || 'SESSION_INVALID'); throw new RequestError(body.code || 'SESSION_INVALID'); }
      if (!response.ok || !Array.isArray(body.jobs) || body.jobs.length > 20) throw new RequestError(body.code || 'SERVICE_UNAVAILABLE');
      setJobs(body.jobs);
    } catch (reason) { if (!controller.signal.aborted && attempt === jobsGeneration.current) setJobsError(reason instanceof RequestError ? reason.code : 'SERVICE_UNAVAILABLE'); }
    finally { if (!controller.signal.aborted && attempt === jobsGeneration.current) setJobsLoading(false); }
  }, [data, headers, loading, saving, scope]);
  function readJobs(origin:"expand"|"refresh") {
    const ticket=++manualJobsEpoch.current;setManualJobs(origin);
    void loadJobs().finally(()=>{if(ticket===manualJobsEpoch.current)setManualJobs(null);});
  }
  useEffect(() => {
    if (expanded && data && jobs === null && !jobsLoading && !jobsError && !loading && !saving) void Promise.resolve().then(() => { if (mounted.current) void loadJobs(); });
  }, [data, expanded, jobs, jobsError, jobsLoading, loadJobs, loading, saving]);
  useEffect(() => {
    if (!expanded || !data || loading || saving) return;
    const timer = window.setInterval(() => { if (mounted.current && document.visibilityState === 'visible' && !busy.current) void loadJobs(); }, 60000);
    return () => window.clearInterval(timer);
  }, [data, expanded, loadJobs, loading, saving]);
  useEffect(() => {
    mounted.current = true; void Promise.resolve().then(() => { if (mounted.current) void load(); });
    const refresh = (event: Event) => {
      if (event.type === 'ct-auth-changed') { generation.current++; active.current?.abort(); setData(null); setIntent(null); clearJobs(); clearCleanup(); }
      if (document.visibilityState !== 'visible') return;
      setIntent(null); clearJobs(); clearCleanup();
      if (busy.current) { generation.current++; setData(null); setLoading(true); refreshAfterSave.current = true; } else void load();
    };
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh); window.addEventListener('ct-auth-changed', refresh);
    const requests = { generation, jobsGeneration, active, jobsActive, cleanupGeneration, cleanupActive };
    return () => { mounted.current = false; requests.generation.current++; requests.jobsGeneration.current++; requests.active.current?.abort(); requests.jobsActive.current?.abort(); requests.cleanupGeneration.current++; requests.cleanupActive.current?.abort(); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); window.removeEventListener('ct-auth-changed', refresh); };
  }, [clearCleanup, clearJobs, load]);
  async function save() {
    if (!data || !intent || busy.current || intent.scope !== scope || data.accountId + ':' + data.sessionId !== scope) return;
    busy.current = true; setSaving(true); setError(''); const attempt = ++generation.current;
    try {
      const response = await fetch(endpoint + 'control', { method: 'PATCH', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...headers() }, body: JSON.stringify({ enabled: intent.enabled, minimumVersion: intent.minimumVersion, expectedRevision: intent.revision, requestId: intent.requestId }), signal: AbortSignal.timeout(15000) }), body = await response.json();
      if (attempt !== generation.current) return;
      if (!response.ok) {
        if ([401, 403].includes(response.status)) { setAllowed(false); setData(null); setIntent(null); clearJobs(); clearCleanup(); }
        if (response.status === 409) { setIntent(null); clearJobs(); }
        throw new RequestError(body.code || 'SAVE_UNKNOWN');
      }
      if (body.accountId + ':' + body.sessionId !== scope) { setData(null); setIntent(null); clearJobs(); throw new RequestError('SESSION_INVALID'); }
      setData(body); setMinimum(body.minimumVersion); setIntent(null); clearJobs();
    } catch (reason) { if (attempt === generation.current) setError(reason instanceof RequestError ? reason.code : 'SAVE_UNKNOWN'); }
    finally { busy.current = false; if (mounted.current) { setSaving(false); if (refreshAfterSave.current) { refreshAfterSave.current = false; void load(); } } }
  }
  async function requestCleanup(execute: boolean) {
    if (!data || loading || saving || busy.current || data.accountId + ':' + data.sessionId !== scope || execute && (!cleanupIntent || cleanupIntent.scope !== scope)) return;
    const controller = new AbortController(); cleanupActive.current?.abort(); cleanupActive.current = controller; const attempt = ++cleanupGeneration.current;
    setCleanupLoading(true); setCleanupError('');
    if (execute) { busy.current = true; setSaving(true); }
    try {
      const response = await fetch(endpoint + 'cleanup', { method: execute ? 'POST' : 'GET', cache: 'no-store', headers: { ...headers(), ...(execute ? { 'Content-Type': 'application/json' } : {}) },
        ...(execute ? { body: JSON.stringify({ expectedDigest: cleanupIntent!.digest, requestId: cleanupIntent!.requestId }) } : {}), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }), body = await response.json();
      if (controller.signal.aborted || attempt !== cleanupGeneration.current) return;
      if (!response.ok) {
        if ([401, 403, 409].includes(response.status)) setCleanupIntent(null);
        if (response.status === 409) setCleanup(null);
        throw new RequestError(body.code || 'SERVICE_UNAVAILABLE');
      }
      if (body.accountId + ':' + body.sessionId !== scope) { setCleanup(null); setCleanupIntent(null); throw new RequestError('SESSION_INVALID'); }
      setCleanup(body); setCleanupIntent(null); if (execute) setCleanupNotice(crypto.randomUUID());
    } catch (reason) { if (!controller.signal.aborted && attempt === cleanupGeneration.current) setCleanupError(reason instanceof RequestError ? reason.code : 'SERVICE_UNAVAILABLE'); }
    finally {
      if (!controller.signal.aborted && attempt === cleanupGeneration.current) setCleanupLoading(false);
      if (execute) { busy.current = false; if (mounted.current) { setSaving(false); if (refreshAfterSave.current) { refreshAfterSave.current = false; void load(); } } }
    }
  }
  function prepare(enabled: boolean, minimumVersion: string) {
    if (data) setIntent({ enabled, minimumVersion, revision: data.revision, requestId: crypto.randomUUID(), scope });
  }
  const date = (value: string) => new Date(value).toLocaleString(locale);
  if (!allowed) return <section id="office-desktop-v3-control" className={`panel ${styles.card}`}><p role="alert">{t('你没有新版助手管理权限。')}</p><button type="button" className="button button--secondary" disabled={loading} aria-busy={manualRead} onClick={()=>{setManualRead(true);void load().finally(()=>setManualRead(false));}}>{t('刷新新版设置')}</button></section>;
  return <section id="office-desktop-v3-control" className={`panel ${styles.card}`} aria-labelledby="office-desktop-v3-title" aria-busy={loading || saving}>
    <div hidden={technicalOnly} className={styles.cardHead}><h2 id="office-desktop-v3-title">{t('新版 Office 助手')}</h2></div>
    <div className={styles.form}>
      {!technicalOnly ? <><p className={styles.muted}>{t('暂停或提高最低版本只影响尚未启动的新任务；已启动任务可在有效期内按原范围完成或恢复。')}</p>
      {loading && !data ? <ReadPending label="正在读取新版助手设置…" /> : null}
      {data ? <>
        <div>{t('新版任务开关')}：<strong>{t(data.enabled ? '已开启' : '已关闭')}</strong></div>
        <div>{t('当前公开版本')}：<strong>{data.publicRelease?.version ?? t('未知')}</strong></div>
        <div>{t('当前公开版网站控制')}：<strong>{t(data.publicRelease?.websiteControlled ? '已受网站控制' : data.publicRelease?.websiteControlProtocol === 3 ? '网站准入尚未开放' : '本地执行，网站无法远程停用')}</strong></div>
        <div>{t('EXE 可信签名')}：<strong>{t(data.publicRelease?.authenticodeSigned ? 'EXE 可信签名已验证' : 'EXE 尚无可信签名')}</strong></div>
        <div>{t('新版发布验收')}：<strong>{t(data.releaseReady ? '新版发布验收已完成' : '新版发布验收未完成')}</strong></div>
        <div>{t('网站协议签名')}：<strong>{t(data.signingReady ? '网站协议签名已配置' : '网站协议签名未配置')}</strong></div>
        <p className={styles.muted}>{t('网站协议签名仅验证任务许可和更新元数据，不能证明 EXE 已获可信签名或已完成 Windows 实测。')}</p>
        <div>{t('新版来源限流')}：<strong>{t(data.sourceReady ? '新版来源限流已配置' : '新版来源限流未配置')}</strong></div>
        <div>{t('新版已验证版本')}：<strong>{data.currentVersion ?? t('暂无已验证的新版')}</strong></div>
        {data.updatedAt ? <p className={styles.muted}>{t('新版设置更新时间')}：{date(data.updatedAt)}</p> : null}
        <div className={styles.actions}><button type="button" className="button button--primary" disabled={loading || saving || !!error || (!data.enabled && (!data.releaseReady || !data.signingReady || !data.sourceReady))} onClick={() => prepare(!data.enabled, data.minimumVersion)}>{t(data.enabled ? '暂停新版新任务' : '允许新版新任务')}</button></div>
        <label className="field"><span>{t('新版最低可用版本')}</span><SelectControl aria-label={t('新版最低可用版本')} value={minimum} disabled={loading || saving || !!error} onChange={event => { setMinimum(event.target.value); setIntent(null); }}>{data.eligibleMinimumVersions.map(version => <option key={version} value={version}>{version}</option>)}</SelectControl></label>
        <div className={styles.actions}><button type="button" className="button button--primary" disabled={loading || saving || !!error || minimum === data.minimumVersion} onClick={() => prepare(data.enabled, minimum)}>{t('保存新版最低版本')}</button></div>
      </> : null}
      {error ? <p role="alert" className="form-error">{t(errors[error] || '新版助手保存结果尚未确认，请重试原请求或刷新核对。')}</p> : null}
      <div className={styles.actions}><button type="button" className="button button--secondary" disabled={loading || saving} aria-busy={manualRead} onClick={()=>{setManualRead(true);void load().finally(()=>setManualRead(false));}}>{t('刷新新版设置')}</button></div>
      {intent ? <div className={styles.form} role="group" aria-label={t('确认新版任务设置')}>
        <p>{t('将保存新版任务开关和最低版本；已启动任务的原范围与恢复期限保持不变。')}</p>
        <p>{t('新版任务开关')}：{t(intent.enabled ? '已开启' : '已关闭')} · {t('新版最低可用版本')}：{intent.minimumVersion}</p>
        <div className={styles.actions}><button type="button" className="button button--primary" disabled={saving} aria-busy={saving} onClick={() => void save()}>{t(saving ? '正在保存…' : error ? '重试原新版设置请求' : '确认变更')}</button><button type="button" className="button button--secondary" disabled={saving} onClick={() => setIntent(null)}>{t('取消')}</button></div>
      </div> : null}
      </> : null}{data?.trustedKeyFingerprints?.length ? <details className={v3Styles.keys}><summary>{t('可信公钥指纹')}</summary><p className={styles.muted}>{t('客户端仅信任预嵌公钥；此处公钥元数据用于审计，不会替换客户端根信任。')}</p>{data.trustedKeyFingerprints.map(key => <p key={key.kid}><strong>{key.kid}</strong>{key.current ? ' · ' + t('当前签名公钥') : ''}<br /><code>{key.sha256}</code></p>)}</details> : null}
      {data ? <button type="button" className="button button--secondary" disabled={loading || saving} aria-expanded={expanded} aria-busy={manualJobs==="expand"} aria-controls="office-desktop-v3-jobs" onClick={() => { if (expanded) { jobsGeneration.current++; jobsActive.current?.abort(); setJobsLoading(false);manualJobsEpoch.current++;setManualJobs(null); } else readJobs("expand"); setExpanded(!expanded); }}>{t(expanded ? '收起新版任务状态' : '查看最近 20 条新版任务')}</button> : null}
      {expanded && data ? <div id="office-desktop-v3-jobs" className={styles.form} aria-busy={jobsLoading}>
        <p className={styles.muted}>{t('以下为客户端回报的任务状态；未回报不代表安装或激活成功。')}</p>
        <p className={styles.muted}>{t('活动回报只包含阶段和受限错误码，至少间隔 60 秒合并；离线或等待回报不会被判为失败。')}</p>
        {jobsLoading ? <p role="status">{t('正在读取新版任务状态…')}</p> : null}
        {jobsError ? <p className="form-error" role="alert">{t(errors[jobsError] || '新版任务状态暂不可用，请重试。')}</p> : null}
        {jobs?.length === 0 ? <p>{t('暂无新版任务记录。')}</p> : null}
        {jobs?.length ? <div className={`module-table-scroll ${styles.desktopTable} ${v3Styles.jobs}`} role="region" aria-label={t('最近新版任务状态')} tabIndex={0}><table>
          <thead><tr>{['新版任务操作', '新版任务编号', '新版任务状态', '新版程序版本', '新版任务时间', '新版程序架构'].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead>
          <tbody>{jobs.map(job => <tr key={job.jobId}><td>{t(actions[job.action] || '未知新版任务操作')}</td><td>{job.jobId}</td><td><div>{t(statuses[job.status] || '新版任务状态未知')}</div><div>{t('当前任务阶段')}：{job.stage ? t(stages[job.stage] || '未知') : t('暂无活动回报')}</div>{job.errorCode ? <div>{t('任务错误码')}：<code>{job.errorCode}</code></div> : null}{job.waitingForReport ? <div>{t('等待客户端回报，任务结果待核对')}</div> : null}</td><td>{job.appVersion}</td><td><div>{t('新版任务创建时间')}：{date(job.createdAt)}</div><div>{t('新版任务启动时间')}：{job.startedAt ? date(job.startedAt) : t('新版任务尚未启动')}</div><div>{t('新版任务更新时间')}：{date(job.updatedAt)}</div><div>{t('最近活动回报')}：{job.lastActivityAt ? date(job.lastActivityAt) : t('暂无活动回报')}</div><div>{t('恢复资格到期')}：{job.recoveryExpiresAt ? date(job.recoveryExpiresAt) : t('新版任务尚未启动')}</div></td><td>{t(job.architecture === 'win-x64' ? 'Windows x64' : job.architecture === 'win-arm64' ? 'Windows ARM64' : '新版程序架构未知')}</td></tr>)}</tbody>
        </table></div> : null}
        {jobs?.length ? <div className={v3Styles.mobileJobs}>{jobs.map(job => <article key={job.jobId} className={v3Styles.mobileJob}>
          <h4>{t(actions[job.action] || '未知新版任务操作')}</h4><p><strong>{t(statuses[job.status] || '新版任务状态未知')}</strong></p>
          <p>{t('当前任务阶段')}：{job.stage ? t(stages[job.stage] || '未知') : t('暂无活动回报')}</p>
          {job.errorCode ? <p>{t('任务错误码')}：<code>{job.errorCode}</code></p> : null}
          {job.waitingForReport ? <p>{t('等待客户端回报，任务结果待核对')}</p> : null}
          <dl><div><dt>{t('新版任务编号')}</dt><dd><code>{job.jobId}</code></dd></div><div><dt>{t('新版程序版本')}</dt><dd>{job.appVersion} · {t(job.architecture === 'win-x64' ? 'Windows x64' : job.architecture === 'win-arm64' ? 'Windows ARM64' : '新版程序架构未知')}</dd></div>
          <div><dt>{t('新版任务创建时间')}</dt><dd>{date(job.createdAt)}</dd></div><div><dt>{t('新版任务启动时间')}</dt><dd>{job.startedAt ? date(job.startedAt) : t('新版任务尚未启动')}</dd></div><div><dt>{t('最近活动回报')}</dt><dd>{job.lastActivityAt ? date(job.lastActivityAt) : t('暂无活动回报')}</dd></div><div><dt>{t('新版任务更新时间')}</dt><dd>{date(job.updatedAt)}</dd></div><div><dt>{t('恢复资格到期')}</dt><dd>{job.recoveryExpiresAt ? date(job.recoveryExpiresAt) : t('新版任务尚未启动')}</dd></div></dl>
        </article>)}</div> : null}
        <div className={styles.actions}><button type="button" className="button button--secondary" disabled={jobsLoading || loading || saving} aria-busy={manualJobs==="refresh"} onClick={() => readJobs("refresh")}>{t('刷新新版任务状态')}</button></div>
      </div> : null}
      {data ? <div className={styles.form} aria-busy={cleanupLoading}>
        <h3>{t('Office 过期记录清理')}</h3>
        <p className={styles.muted}>{t('只处理已过期至少 90 天的 Office v3 技术记录；有效恢复许可、关联回执和候选授予审计继续保留。')}</p><p className={styles.muted}>{t('每次仅预览和执行一个受限批次；完成后可重新预览剩余记录。')}</p>
        <button type="button" className="button button--secondary" disabled={loading || saving || cleanupLoading} aria-busy={cleanupLoading} onClick={() => void requestCleanup(false)}>{t(cleanupLoading ? '正在核对清理范围…' : '预览过期记录范围')}</button>
        {cleanupError ? <p role="alert" className="form-error">{t(errors[cleanupError] || '过期记录清理结果未确认，请重试原请求或重新预览。')}</p> : null}
        {cleanup ? <>{cleanup.dryRun ? <p role="status">{t('清理预览，尚未删除记录')}</p> : cleanupNotice ? <Toast message={t('已完成本次过期记录清理')} noticeId={cleanupNotice} onDismiss={() => setCleanupNotice("")} /> : null}<dl className={v3Styles.counts}>{Object.entries(cleanup.counts).map(([key, value]) => <div key={key}><dt>{t(cleanupLabels[key] || '未知')}</dt><dd>{value}</dd></div>)}</dl></> : null}
        {!data.cleanupEnabled ? <p className={styles.muted}>{t('过期记录清理执行尚未开放，可先预览候选范围。')}</p> : null}
        {cleanup?.dryRun && data.cleanupEnabled && !cleanupIntent ? <button type="button" className="button button--secondary" disabled={loading || saving || cleanupLoading || !!cleanupError || !Object.values(cleanup.counts).some(count => count > 0)} onClick={() => setCleanupIntent({ digest: cleanup.digest, requestId: crypto.randomUUID(), scope })}>{t('核对并清理上述范围')}</button> : null}
        {cleanupIntent ? <div role="group" aria-label={t('确认过期记录清理')}><p>{t('仅删除上述已核对的技术记录；范围发生变化会停止并要求重新预览。')}</p><div className={styles.actions}><button type="button" className="button button--primary" disabled={saving || cleanupLoading} aria-busy={cleanupLoading} onClick={() => void requestCleanup(true)}>{t(cleanupError ? '重试原清理请求' : '确认清理')}</button><button type="button" className="button button--secondary" disabled={saving || cleanupLoading} onClick={() => setCleanupIntent(null)}>{t('取消')}</button></div></div> : null}
      </div> : null}
    </div>
  </section>;
}
