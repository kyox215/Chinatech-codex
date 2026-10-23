"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Search } from "lucide-react";
import { NavigationLink as Link } from "@/components/navigation-link";
import { InputControl } from "@/components/input-control";
import { useLanguage } from "@/components/language-provider";
import { portalFeatures } from "@/lib/portal-features";
import { PublicHeader } from "./public-header";
import { LegacyHomeBookmarks } from "./legacy-home-bookmarks";
import home from "./home.module.css";
import styles from "./modern-portal.module.css";

type Feature = (typeof portalFeatures)[number];
const categories = [
  { id: "all", label: "全部" },
  { id: "work", label: "工作管理" },
  { id: "entertainment", label: "影音娱乐" },
  { id: "opensource", label: "我的开源" },
] as const;
type Category = (typeof categories)[number]["id"];

function FeatureEntrance({ feature }: { feature: Feature }) {
  const { t } = useLanguage();
  const Icon = feature.icon;
  return <article className={styles.card} data-feature={feature.id} aria-labelledby={`feature-${feature.id}`} aria-describedby={`summary-${feature.id}`}>
    <div className={styles.iconRow}><span className={styles.appIcon} data-kind={feature.id}><Icon size={40} aria-hidden="true" /></span></div>
    <div className={styles.cardBody}>
      <h3 id={`feature-${feature.id}`}>{t(feature.title)}</h3>
      <p id={`summary-${feature.id}`}>{t(feature.description)}</p>
      {feature.platform && <span className={styles.platform}>{t(feature.platform)}</span>}
    </div>
    <div className={styles.cardFooter}>
      <span className={styles.categoryLabel}>{t(feature.categoryLabel)}</span>
      <Link className={styles.enter} href={feature.href} target={feature.external ? "_blank" : undefined} rel={feature.external ? "noopener noreferrer" : undefined} aria-label={t(feature.action)} title={t(feature.description)} icon={feature.external ? <ArrowUpRight size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />} iconPosition="end">{t(feature.primaryLabel)}</Link>
      {feature.downloadHref && <Link className={styles.download} href={feature.downloadHref} target="_blank" rel="noopener noreferrer" aria-label={t(feature.downloadAction)}>{t("下载")}</Link>}
    </div>
  </article>;
}

export function PortalPage() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const searchRoot = useRef<HTMLDivElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const normalized = query.trim().toLocaleLowerCase();
  const features = portalFeatures.filter(feature => (category === "all" || feature.category === category)
    && [feature.title, feature.summary, feature.description, feature.categoryLabel, t(feature.title), t(feature.summary), t(feature.description), t(feature.categoryLabel), ...feature.keywords]
      .some(value => value.toLocaleLowerCase().includes(normalized)));

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !event.isComposing) {
        event.preventDefault(); setSearchOpen(true); input.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  useEffect(() => {
    if (!searchOpen) return;
    input.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.isComposing) {
        setSearchOpen(false); searchTrigger.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !searchRoot.current?.contains(event.target)) setSearchOpen(false);
    };
    window.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [searchOpen]);

  const reset = () => { setQuery(""); setCategory("all"); searchTrigger.current?.focus(); };
  const search = <div className={styles.headerSearch} ref={searchRoot}>
    <button className={styles.searchTrigger} ref={searchTrigger} type="button" aria-label={t("搜索首页功能")} aria-expanded={searchOpen} aria-controls="portal-search-panel" onClick={() => setSearchOpen(open => !open)}>
      <Search size={18} aria-hidden="true" /><span>{t("搜索首页功能")}</span><kbd className={styles.shortcut} aria-hidden="true">{t("⌘ K")}</kbd>
    </button>
    <form className={styles.search} id="portal-search-panel" data-open={searchOpen} role="search" onSubmit={event => event.preventDefault()}>
      <label className="visually-hidden" htmlFor="portal-search">{t("搜索首页功能")}</label>
      <InputControl id="portal-search" ref={input} type="search" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} onClear={() => setQuery("")} leading={<Search size={19} aria-hidden="true" />} placeholder={t("搜索首页功能")} aria-controls="portal-results" />
    </form>
  </div>;

  return <div className={styles.hub}>
    <LegacyHomeBookmarks />
    <Link className={home.skipLink} href="#main-content" focusTargetId="main-content">{t("跳到主要内容")}</Link>
    <PublicHeader page="portal" portalSearch={search} />
    <main className={styles.main} id="main-content" tabIndex={-1}>
      <section className={styles.hero} aria-labelledby="portal-title">
        <div className={styles.introduction}>
          <h1 id="portal-title"><span className={styles.gradientTitle}>{t("我的数字空间")}</span>{" "}<span>{t("发现好用功能")}</span></h1>
          <p>{t("把工作与生活中的常用功能，放在一个地方。")}</p>
          <div className={styles.heroActions}>{portalFeatures.filter(feature => feature.featured).map(feature => <Link key={feature.id} href={feature.href}>{t(feature.action)}</Link>)}</div>
        </div>
        <div className={styles.artwork} aria-hidden="true"><Image className={styles.laptop} src="/images/portal/hub-laptop.svg" alt="" width={960} height={600} sizes="(max-width: 959px) 320px, 480px" loading="eager" /></div>
      </section>
      <section className={styles.features} id="portal-features" aria-labelledby="features-title">
        <h2 className="visually-hidden" id="features-title">{t("全部功能")}</h2>
        <div className={styles.categories}>
          <div className={styles.categoryButtons} role="group" aria-label={t("功能分类")}>
            {categories.map(({ id, label }) => <button key={id} type="button" aria-pressed={category === id} onClick={() => setCategory(id)}>{t(label)}</button>)}
          </div>
          <span className={styles.resultsCount} role="status" aria-live="polite">{t("找到 {count} 个功能", { count: features.length })}</span>
        </div>
        <div id="portal-results">{features.length ? <div className={styles.grid}>{features.map(feature => <FeatureEntrance key={feature.id} feature={feature} />)}</div>
          : <div className={styles.empty}><Search size={28} aria-hidden="true" /><h3>{t("没有找到匹配的功能")}</h3><p>{t("试试其他关键词，或查看全部功能。")}</p><button type="button" className="button button--secondary" onClick={reset}>{t("查看全部功能")}</button></div>}</div>
        <p className={styles.more}>{t("更多功能陆续加入")}</p>
      </section>
    </main>
    <footer className={styles.footer}><span>{t("© 2026 kyox215")}</span><span><a href="https://arch3rpro.github.io/appstore" rel="noreferrer">{t("视觉参考：Arch3rPro")}</a></span></footer>
  </div>;
}
