'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SelectControl } from '@/components/select-control';
import { useLanguage } from '@/components/language-provider';
import styles from './account-settings.module.css';
import v3Styles from './office-desktop-v3-control.module.css';

type Control = { enabled: boolean; minimumVersion: string; currentVersion: string | null; releaseReady: boolean; signingReady: boolean; revision: string; updatedAt: string | null; accountId: string; sessionId: string; eligibleMinimumVersions: string[] };
type Intent = { enabled: boolean; minimumVersion: string; revision: string; requestId: string; scope: string };
type Job = { jobId: string; action: string; status: string; appVersion: string; architecture: string; createdAt: string; startedAt: string | null; updatedAt: string };
const endpoint = '/api/account/toolbox/office-desktop/v3/';
const errors: Record<string, string> = { SERVICE_UNAVAILABLE: '新版助手管理暂不可用，请刷新后重试。', NO_ACCESS: '你没有新版助手管理权限。', SESSION_EXPIRED: '新版助手管理会话已失效，请重新登录。', SESSION_INVALID: '新版助手管理账号或会话已变化，请刷新账号资料。', REQUEST_CONFLICT: '新版助手设置已变化，请刷新后重新核对。', INVALID_REQUEST: '新版助手管理请求无效。', VERSION_NOT_AVAILABLE: '所选新版尚未完成发布验收，请刷新后重试。' };
const actions: Record<string, string> = { install: 'Office 安装任务', activate: 'Office 激活任务', uninstall: 'Office 卸载任务', close: 'Office 关闭任务', reinstall: 'Office 重装任务' };
const statuses: Record<string, string> = { prepared: '待启动', expired: '启动准备已过期', started: '已启动，尚未回报结果', completed: '任务已完成', failed: '任务失败，恢复资格待核对', cancelled: '任务已取消，恢复资格待核对', paused: '任务已暂停，恢复资格待核对' };
class RequestError extends Error { constructor(readonly code: string) { super(code); } }

export function OfficeDesktopV3Control({ accountId, sessionId }: { accountId: string; sessionId: string }) {
  const { t, locale } = useLanguage(), scope = accountId + ':' + sessionId;
  const [data, setData] = useState<Control | null>(null), [minimum, setMinimum] = useState('1.4.0');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [allowed, setAllowed] = useState(true), [error, setError] = useState(''), [intent, setIntent] = useState<Intent | null>(null);
  const [expanded, setExpanded] = useState(false), [jobs, setJobs] = useState<Job[] | null>(null), [jobsLoading, setJobsLoading] = useState(false), [jobsError, setJobsError] = useState('');
  const active = useRef<AbortController | null>(null), jobsActive = useRef<AbortController | null>(null), generation = useRef(0), jobsGeneration = useRef(0), busy = useRef(false), mounted = useRef(true), refreshAfterSave = useRef(false);
  const headers = useCallback(() => ({ 'X-CT-Account-ID': accountId, 'X-CT-Session-ID': sessionId }), [accountId, sessionId]);
  const clearJobs = useCallback(() => { jobsGeneration.current++; jobsActive.current?.abort(); setJobs(null); setJobsError(''); setJobsLoading(false); }, []);
  const load = useCallback(async () => {
    if (busy.current) return;
    active.current?.abort(); const controller = new AbortController(); active.current = controller; const attempt = ++generation.current;
    setLoading(true); setIntent(null); clearJobs();
    try {
      const response = await fetch(endpoint + 'control', { cache: 'no-store', headers: headers(), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }), body = await response.json();
      if (controller.signal.aborted || attempt !== generation.current) return;
      if ([401, 403].includes(response.status)) { setAllowed(false); setData(null); return; }
      if (!response.ok) throw new RequestError(body.code || 'SERVICE_UNAVAILABLE');
      if (body.accountId + ':' + body.sessionId !== scope) { setData(null); setIntent(null); throw new RequestError('SESSION_INVALID'); }
      setData(body); setMinimum(body.minimumVersion); setAllowed(true); setError('');
    } catch (reason) { if (!controller.signal.aborted && attempt === generation.current) setError(reason instanceof RequestError ? reason.code : 'SERVICE_UNAVAILABLE'); }
    finally { if (!controller.signal.aborted && attempt === generation.current) setLoading(false); }
  }, [clearJobs, headers, scope]);
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
  useEffect(() => {
    if (expanded && data && jobs === null && !jobsLoading && !jobsError && !loading && !saving) void Promise.resolve().then(() => { if (mounted.current) void loadJobs(); });
  }, [data, expanded, jobs, jobsError, jobsLoading, loadJobs, loading, saving]);
  useEffect(() => {
    mounted.current = true; void Promise.resolve().then(() => { if (mounted.current) void load(); });
    const refresh = (event: Event) => {
      if (event.type === 'ct-auth-changed') { generation.current++; active.current?.abort(); setData(null); setIntent(null); clearJobs(); }
      if (document.visibilityState !== 'visible') return;
      setIntent(null); clearJobs();
      if (busy.current) { generation.current++; setData(null); setLoading(true); refreshAfterSave.current = true; } else void load();
    };
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh); window.addEventListener('ct-auth-changed', refresh);
    const requests = { generation, jobsGeneration, active, jobsActive };
    return () => { mounted.current = false; requests.generation.current++; requests.jobsGeneration.current++; requests.active.current?.abort(); requests.jobsActive.current?.abort(); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); window.removeEventListener('ct-auth-changed', refresh); };
  }, [clearJobs, load]);
  async function save() {
    if (!data || !intent || busy.current || intent.scope !== scope || data.accountId + ':' + data.sessionId !== scope) return;
    busy.current = true; setSaving(true); setError(''); const attempt = ++generation.current;
    try {
      const response = await fetch(endpoint + 'control', { method: 'PATCH', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...headers() }, body: JSON.stringify({ enabled: intent.enabled, minimumVersion: intent.minimumVersion, expectedRevision: intent.revision, requestId: intent.requestId }), signal: AbortSignal.timeout(15000) }), body = await response.json();
      if (attempt !== generation.current) return;
      if (!response.ok) {
        if ([401, 403].includes(response.status)) { setAllowed(false); setData(null); setIntent(null); clearJobs(); }
        if (response.status === 409) { setIntent(null); clearJobs(); }
        throw new RequestError(body.code || 'SAVE_UNKNOWN');
      }
      if (body.accountId + ':' + body.sessionId !== scope) { setData(null); setIntent(null); clearJobs(); throw new RequestError('SESSION_INVALID'); }
      setData(body); setMinimum(body.minimumVersion); setIntent(null); clearJobs();
    } catch (reason) { if (attempt === generation.current) setError(reason instanceof RequestError ? reason.code : 'SAVE_UNKNOWN'); }
    finally { busy.current = false; if (mounted.current) { setSaving(false); if (refreshAfterSave.current) { refreshAfterSave.current = false; void load(); } } }
  }
  function prepare(enabled: boolean, minimumVersion: string) {
    if (data) setIntent({ enabled, minimumVersion, revision: data.revision, requestId: crypto.randomUUID(), scope });
  }
  const date = (value: string) => new Date(value).toLocaleString(locale);
  if (!allowed) return null;
  return <section id="office-desktop-v3-control" className={`panel ${styles.card}`} aria-labelledby="office-desktop-v3-title" aria-busy={loading || saving}>
    <div className={styles.cardHead}><h2 id="office-desktop-v3-title">{t('新版 Office 助手')}</h2></div>
    <div className={styles.form}>
      <p className={styles.muted}>{t('暂停或提高最低版本只影响尚未启动的新任务；已启动任务可在有效期内按原范围完成或恢复。')}</p>
      {loading && !data ? <p role="status">{t('正在读取新版助手设置…')}</p> : null}
      {data ? <>
        <div>{t('新版任务开关')}：<strong>{t(data.enabled ? '已开启' : '已关闭')}</strong></div>
        <div>{t('新版发布验收')}：<strong>{t(data.releaseReady ? '新版发布验收已完成' : '新版发布验收未完成')}</strong></div>
        <div>{t('新版许可签名')}：<strong>{t(data.signingReady ? '新版许可签名已配置' : '新版许可签名未配置')}</strong></div>
        <div>{t('新版已验证版本')}：<strong>{data.currentVersion ?? t('暂无已验证的新版')}</strong></div>
        {data.updatedAt ? <p className={styles.muted}>{t('新版设置更新时间')}：{date(data.updatedAt)}</p> : null}
        <div className={styles.actions}><button type="button" className="button button--primary" disabled={loading || saving || !!error || (!data.enabled && (!data.releaseReady || !data.signingReady))} onClick={() => prepare(!data.enabled, data.minimumVersion)}>{t(data.enabled ? '暂停新版新任务' : '允许新版新任务')}</button></div>
        <label className="field"><span>{t('新版最低可用版本')}</span><SelectControl aria-label={t('新版最低可用版本')} value={minimum} disabled={loading || saving || !!error} onChange={event => { setMinimum(event.target.value); setIntent(null); }}>{data.eligibleMinimumVersions.map(version => <option key={version} value={version}>{version}</option>)}</SelectControl></label>
        <div className={styles.actions}><button type="button" className="button button--primary" disabled={loading || saving || !!error || minimum === data.minimumVersion} onClick={() => prepare(data.enabled, minimum)}>{t('保存新版最低版本')}</button></div>
      </> : null}
      {error ? <p role="alert" className="form-error">{t(errors[error] || '新版助手保存结果尚未确认，请重试原请求或刷新核对。')}</p> : null}
      <div className={styles.actions}><button type="button" className="button button--secondary" disabled={loading || saving} onClick={() => void load()}>{t('刷新新版设置')}</button></div>
      {intent ? <div className={styles.form} role="group" aria-label={t('确认新版任务设置')}>
        <p>{t('将保存新版任务开关和最低版本；已启动任务的原范围与恢复期限保持不变。')}</p>
        <p>{t('新版任务开关')}：{t(intent.enabled ? '已开启' : '已关闭')} · {t('新版最低可用版本')}：{intent.minimumVersion}</p>
        <div className={styles.actions}><button type="button" className="button button--primary" disabled={saving} onClick={() => void save()}>{t(saving ? '正在保存…' : error ? '重试原新版设置请求' : '确认变更')}</button><button type="button" className="button button--secondary" disabled={saving} onClick={() => setIntent(null)}>{t('取消')}</button></div>
      </div> : null}
      {data ? <button type="button" className="button button--secondary" disabled={loading || saving} aria-expanded={expanded} aria-controls="office-desktop-v3-jobs" onClick={() => { if (expanded) { jobsGeneration.current++; jobsActive.current?.abort(); setJobsLoading(false); } else void loadJobs(); setExpanded(!expanded); }}>{t(expanded ? '收起新版任务状态' : '查看最近 20 条新版任务')}</button> : null}
      {expanded && data ? <div id="office-desktop-v3-jobs" className={styles.form} aria-busy={jobsLoading}>
        <p className={styles.muted}>{t('以下为客户端回报的任务状态；未回报不代表安装或激活成功。')}</p>
        {jobsLoading ? <p role="status">{t('正在读取新版任务状态…')}</p> : null}
        {jobsError ? <p className="form-error" role="alert">{t(errors[jobsError] || '新版任务状态暂不可用，请重试。')}</p> : null}
        {jobs?.length === 0 ? <p>{t('暂无新版任务记录。')}</p> : null}
        {jobs?.length ? <div className={`module-table-scroll ${styles.desktopTable} ${v3Styles.jobs}`} role="region" aria-label={t('最近新版任务状态')} tabIndex={0}><table>
          <thead><tr>{['新版任务操作', '新版任务编号', '新版任务状态', '新版程序版本', '新版任务时间', '新版程序架构'].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead>
          <tbody>{jobs.map(job => <tr key={job.jobId}><td>{t(actions[job.action] || '未知新版任务操作')}</td><td>{job.jobId}</td><td>{t(statuses[job.status] || '新版任务状态未知')}</td><td>{job.appVersion}</td><td><div>{t('新版任务创建时间')}：{date(job.createdAt)}</div><div>{t('新版任务启动时间')}：{job.startedAt ? date(job.startedAt) : t('新版任务尚未启动')}</div><div>{t('新版任务更新时间')}：{date(job.updatedAt)}</div></td><td>{t(job.architecture === 'win-x64' ? 'Windows x64' : job.architecture === 'win-arm64' ? 'Windows ARM64' : '新版程序架构未知')}</td></tr>)}</tbody>
        </table></div> : null}
        <div className={styles.actions}><button type="button" className="button button--secondary" disabled={jobsLoading || loading || saving} onClick={() => void loadJobs()}>{t('刷新新版任务状态')}</button></div>
      </div> : null}
    </div>
  </section>;
}
