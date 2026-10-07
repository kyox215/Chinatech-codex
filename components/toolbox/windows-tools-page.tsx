"use client";

import { Download, ExternalLink, FileText, Laptop, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { PublicHeader } from "@/components/home/public-header";
import { useLanguage } from "@/components/language-provider";
import release from "@/lib/toolbox/windows-release.json";
import homeStyles from "@/components/home/home.module.css";
import toolboxStyles from "./toolbox.module.css";
import styles from "./windows-tools.module.css";

const stages = ["下载并解压完整包", "打开对应语言的启动器", "读取本机检测结果"];
const requirements = [
  "支持识别 Windows 7、8、8.1、10、11；识别系统不代表能够升级。",
  "32 位系统无法通过就地升级转换为 64 位并保留应用。",
  "Home 转 Pro、旧系统分阶段升级及不受官方支持的硬件，需要各自完成 Windows 验收。",
  "正式升级只允许保留个人文件、应用和设置；无法保留时停止。开始前仍需备份重要资料。",
];

export function WindowsToolsPage() {
  const { t, locale } = useLanguage();
  return <div className={toolboxStyles.page}>
    <a className={homeStyles.skipLink} href="#main-content">{t("跳到主要内容")}</a>
    <PublicHeader page="windows" />
    <main className={styles.main} id="main-content">
      <div className={styles.heading}>
        <span className={styles.headingIcon}><Laptop size={28} aria-hidden="true" /></span>
        <div><h1>{t("Windows 11 Pro 升级")}</h1><p>{t("保留文件与应用的就地升级工具")}</p></div>
      </div>
      <section className={styles.downloadPanel} aria-labelledby="download-title">
        <div className={styles.panelHeading}><h2 id="download-title">{t("Windows 升级检测版")}</h2><span className={styles.status}>{t("自动升级尚未开放")}</span></div>
        <p className={styles.notice} role="status">{t("目前提供只读检测：尚无 Windows 端到端升级验收，不会执行激活、安装或自动重启。")}</p>
        <ol className={styles.steps}>{stages.map((stage, index) => <li key={stage}><span aria-hidden="true">{index + 1}</span>{t(stage)}</li>)}</ol>
        <div className={styles.actions}>
          <a className="button button--primary" href={release.archive.path} download><Download size={17} aria-hidden="true" />{t("下载检测启动器")}</a>
          <a className="button button--secondary" href="/toolbox/windows/ChinaTech-Windows.ps1.txt" target="_blank" rel="noopener noreferrer"><FileText size={17} aria-hidden="true" />{t("查看检测脚本源码")}</a>
        </div>
        <p className={styles.instruction}>{t("解压后打开 {file}。浏览器下载不会直接运行 Windows 程序。", { file: `Start-${locale}.cmd` })}</p>
        <dl className={styles.digest}><div><dt>{t("启动器版本")}</dt><dd>{release.version}</dd></div><div><dt>{t("SHA256")}</dt><dd><code>{release.archive.sha256}</code></dd></div></dl>
        <a className={styles.textLink} href="/toolbox/windows/checksums.json" target="_blank" rel="noopener noreferrer"><ShieldCheck size={16} aria-hidden="true" />{t("查看文件校验清单")}</a>
      </section>
      <div className={styles.details}>
        <section className={styles.detailPanel} aria-labelledby="conditions-title"><h2 id="conditions-title">{t("升级条件")}</h2><ul>{requirements.map(requirement => <li key={requirement}>{t(requirement)}</li>)}</ul></section>
        <section className={styles.detailPanel} aria-labelledby="sources-title">
          <h2 id="sources-title">{t("项目来源与激活方式")}</h2>
          <p>{t("计划接入 AveYo 的安装流程与 KMS 项目的 Windows 本地模拟激活。当前包仅记录固定源码版本，不包含或执行第三方脚本。")}</p>
          <p>{t("本地模拟会写入授权 Hook 和 Defender 排除，需要单独验收；不能替代有效许可证，也不代表永久激活。已有授权组件可能冲突，不能直接串联执行。")}</p>
          <div className={styles.sources}>{release.sources.map(source => <a key={source.id} href={`https://github.com/${source.repository}/blob/${source.commit}/${source.path}`} target="_blank" rel="noopener noreferrer">{source.path}<ExternalLink size={14} aria-hidden="true" /></a>)}</div>
          <a className={styles.textLink} href="https://www.microsoft.com/en-us/software-download/windows11" target="_blank" rel="noopener noreferrer">{t("微软 Windows 下载与安装说明")}<ExternalLink size={14} aria-hidden="true" /></a>
        </section>
      </div>
    </main>
    <footer className={toolboxStyles.footer}><Brand compact /><p>{t("© 2026 ChinaTech · 让门店日常井井有条")}</p></footer>
  </div>;
}
