"use client";
import { NavigationLink as Link } from "@/components/navigation-link";
import {DownloadLink} from "@/components/download-link";

import { Download, Laptop } from "lucide-react";
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
  const { t } = useLanguage();
  return <div className={toolboxStyles.page}>
    <Link className={homeStyles.skipLink} href="#main-content" focusTargetId="main-content">{t("跳到主要内容")}</Link>
    <PublicHeader page="windows" />
    <main className={styles.main} id="main-content" tabIndex={-1}>
      <div className={styles.heading}>
        <span className={styles.headingIcon}><Laptop size={28} aria-hidden="true" /></span>
        <div><h1>{t("Windows 11 Pro 升级")}</h1><p>{t("保留文件与应用的就地升级工具")}</p></div>
      </div>
      <section className={styles.downloadPanel} aria-labelledby="download-title">
        <div className={styles.panelHeading}><h2 id="download-title">{t("Windows 升级检测版")}</h2><span className={styles.status}>{t("自动升级尚未开放")}</span></div>
        <p className={styles.notice} role="status">{t("目前提供只读检测：尚无 Windows 端到端升级验收，不会执行激活、安装或自动重启。")}</p>
        <ol className={styles.steps}>{stages.map((stage, index) => <li key={stage}><span aria-hidden="true">{index + 1}</span>{t(stage)}</li>)}</ol>
        <div className={styles.actions}>
          <DownloadLink className="button button--primary" href={release.archive.path} download><Download size={17} aria-hidden/>{t("下载检测启动器")}</DownloadLink>

        </div>
        <p className={styles.instruction}>{t("启动器版本")} {release.version}</p>
      </section>
      <div className={styles.details}>
        <section className={styles.detailPanel} aria-labelledby="conditions-title"><h2 id="conditions-title">{t("升级条件")}</h2><ul>{requirements.map(requirement => <li key={requirement}>{t(requirement)}</li>)}</ul></section>
        <section className={styles.detailPanel}>
          <a className={styles.textLink} href="https://www.microsoft.com/en-us/software-download/windows11" target="_blank" rel="noopener noreferrer">{t("微软 Windows 下载与安装说明")}</a>
        </section>
      </div>
    </main>
    <footer className={toolboxStyles.footer}><Brand compact /><p>{t("© 2026 ChinaTech · 让门店日常井井有条")}</p></footer>
  </div>;
}
