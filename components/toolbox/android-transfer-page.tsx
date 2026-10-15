"use client";
import {ToolIntegrationPending} from "./tool-integration-pending";

import { useMemo, useState } from "react";
import { NavigationLink as Link } from "@/components/navigation-link";
import { ArrowLeft, ArrowRight, Smartphone } from "lucide-react";
import { PublicHeader } from "@/components/home/public-header";
import { Brand } from "@/components/brand";
import { SelectControl } from "@/components/select-control";
import { useLanguage } from "@/components/language-provider";
import { androidBrands, androidVersions, androidVersionNames, coverageLabels, defaultProfile, planAndroidTransfer, type DeviceProfile, type AndroidSystem } from "@/lib/toolbox/android-transfer";
import { MimoverOriginalDownload } from "./mimover-original-download";
import { SmartSwitchExperimentDownload } from "./smart-switch-experiment-download";
import shared from "./toolbox.module.css";
import home from "@/components/home/home.module.css";
import styles from "./android-transfer.module.css";

function DeviceChoices({ side, value, onChange }: { side: "sender" | "receiver"; value: DeviceProfile; onChange: (value: DeviceProfile) => void }) {
  const { t } = useLanguage();
  return <fieldset className={styles.device}>
    <legend>{t(side === "sender" ? "旧手机 · 发送" : "新手机 · 接收")}</legend>
    <label className="field"><span>{t("设备品牌")}</span><SelectControl value={value.brand} onChange={e => onChange({ ...value, brand: e.target.value })}>{androidBrands.map(brand => <option key={brand} value={brand}>{t(brand)}</option>)}</SelectControl></label>
    <label className="field"><span>{t("系统类型")}</span><SelectControl value={value.system} onChange={e => onChange({ ...value, system: e.target.value as AndroidSystem })}>
      <option value="android">{t("安卓系统")}</option><option value="harmony-apk">{t("支持 APK 的华为系统")}</option><option value="harmony-next">{t("HarmonyOS NEXT（原生鸿蒙）")}</option>
    </SelectControl></label>
    <label className="field"><span>{t("安卓版本")}</span><SelectControl disabled={value.system === "harmony-next"} value={value.sdk ?? ""} onChange={e => onChange({ ...value, sdk: e.target.value === "" ? null : Number(e.target.value) })}>
      <option value="">{t("系统版本待核对")}</option>{androidVersions.map(sdk => <option value={sdk} key={sdk}>{androidVersionNames[sdk]}</option>)}
    </SelectControl></label>
    <label className={styles.check}><input type="checkbox" checked={value.googleServices} onChange={e => onChange({ ...value, googleServices: e.target.checked })} /><span>{t("有 Google 服务")}</span></label>
    <label className={styles.check}><input type="checkbox" checked={value.workProfile} onChange={e => onChange({ ...value, workProfile: e.target.checked })} /><span>{t("包含工作资料夹")}</span></label>
    {side === "sender" && <label className={styles.check}><input type="checkbox" checked={value.partialPhotos} onChange={e => onChange({ ...value, partialPhotos: e.target.checked })} /><span>{t("仅授权部分照片")}</span></label>}
  </fieldset>;
}

export function AndroidTransferPage() {
  const { t } = useLanguage();
  const [sender, setSender] = useState<DeviceProfile>({ ...defaultProfile });
  const [receiver, setReceiver] = useState<DeviceProfile>({ ...defaultProfile });
  const plan = useMemo(() => planAndroidTransfer(sender, receiver), [sender, receiver]);
  return <div className={shared.page}>
    <Link className={home.skipLink} href="#main-content" focusTargetId="main-content">{t("跳到主要内容")}</Link>
    <PublicHeader page="transfer" />
    <main className={`${shared.main} ${styles.main}`} id="main-content" tabIndex={-1}>
      <section className={styles.intro} aria-labelledby="transfer-title">
        <Smartphone size={28} aria-hidden="true" /><h1 id="transfer-title">{t("数据传输")}</h1>
        <p>{t("两部手机，本地迁移资料。")}</p>
      </section>
      <MimoverOriginalDownload />
      <SmartSwitchExperimentDownload />
      <section id="chinatech-assistant" className={`${styles.panel} ${styles.experiment}`} aria-labelledby="chinatech-assistant-title">
        <h2 id="chinatech-assistant-title">{t("ChinaTech 手机助手")}</h2>
        <ToolIntegrationPending/>
      </section>
      <section className={styles.panel} aria-labelledby="steps-title"><h2 id="steps-title">{t("ChinaTech 使用步骤")}</h2>
        <ol className={styles.steps}>
          <li>{t("两机安装同版本助手，旧机先扫描已授权资料，按类别或逐项选择。")}</li>
          <li>{t("选好资料后，新机选择本机保存目录并创建热点；旧机读取新机二维码，核对两端信息后开始发送。")}</li>
          <li>{t("保持两机连接，等待所选资料逐项保存并校验；断线后重新配对恢复，系统导入另行确认。")}</li>
          <li>{t("逐项检查新机资料；未完成项目按官方迁移指引补做。")}</li>
        </ol>
        <p className={styles.muted}>{t("旧机使用内置相机实时扫码；系统连接失败可手动连接 Wi-Fi 后继续。收到照片和视频后，可另行确认导入图库；通讯录在系统应用中核对导入。")}</p>
        <p className={styles.muted}>{t("二维码含临时配对凭据，仅供两机使用。系统相机照片和云文件夹可能由对应应用保存或同步；助手自身不上传资料到网站。")}</p>
        <p className={styles.muted}>{t("旧机由助手申请加入新机热点，首次连接通常需要系统确认；旧版本手动加入，不兼容时使用同一路由器。")}</p>
        <p className={styles.muted}>{t("配对码只在手机助手内使用，请勿粘贴到网页、客服消息或公开截图。首版没有网页远控或云端备份。")}</p>
      </section>
      <section className={styles.panel} aria-labelledby="plan-title"><h2 id="plan-title">{t("两机兼容与权限规划")}</h2>
        <p className={styles.muted}>{t("选择两机情况，查看当前覆盖与需要的权限。这里不会读取手机资料。")}</p>
        <div className={styles.devices}><DeviceChoices side="sender" value={sender} onChange={setSender} /><ArrowRight className={styles.direction} size={24} aria-hidden="true" /><DeviceChoices side="receiver" value={receiver} onChange={setReceiver} /></div>
        <div className={styles.notices} role="status" aria-live="polite"><strong>{t(plan.runnable ? "可以安装首版助手，迁移能力待手机核验。" : "先解决系统兼容性。")}</strong><ul>{plan.notices.map(notice => <li key={notice}>{t(notice)}</li>)}</ul></div>
        {plan.connectionPermissions.length > 0 && <details className={styles.integrity}><summary>{t("热点连接权限")}</summary><ul className={styles.networkPermissions}>{plan.connectionPermissions.map((permission, index) => <li key={index}><strong>{t(permission.side === "sender" ? "旧手机" : "新手机")}</strong><code>{permission.permission}</code><span>{t(permission.explanation)}</span></li>)}</ul></details>}
        <div className={styles.capabilities}>{plan.capabilities.map(capability => <article className={styles.capability} data-coverage={capability.coverage} key={capability.kind}>
          <div className={styles.capabilityHead}><h3>{t(capability.title)}</h3><span className={shared.pending}>{t(coverageLabels[capability.coverage])}</span></div>
          <p>{t(capability.detail)}</p>
          {capability.permissions.length > 0 && <details><summary>{t("权限与处理方式")}</summary><ul>{capability.permissions.map((permission, index) => <li key={index}><strong>{t(permission.side === "sender" ? "旧手机" : "新手机")}</strong><code>{permission.permission}</code><span>{t(permission.explanation)}</span></li>)}</ul></details>}
        </article>)}</div>
      </section>
      <div className={shared.bottomLink}><Link href="/toolbox" className="button button--secondary"><ArrowLeft size={16} aria-hidden="true" />{t("返回工具箱")}</Link></div>
    </main><footer className={shared.footer}><Brand compact /><p>{t("© 2026 ChinaTech · 让门店日常井井有条")}</p></footer>
  </div>;
}
