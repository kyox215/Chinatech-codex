"use client";

import { useLanguage } from "@/components/language-provider";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, CheckCheck, ChevronDown, ClipboardList, History, Laptop, PackageCheck, ShieldCheck, Smartphone, Wrench } from "lucide-react";
import { Brand } from "@/components/brand";
import { ProductPreview } from "@/components/home/product-preview";
import { WorkflowTour } from "@/components/home/workflow-tour";
import { TutorialLibrary } from "@/components/home/tutorial-library";
import { PublicHeader } from "@/components/home/public-header";
import styles from "./home.module.css";

const faqs = [
  ["注册后可以直接进入门店吗？", "邮箱注册需要先完成验证，使用 Google 登录则由 Google 验证身份。两种方式都需要门店老板授予成员权限后，才能访问门店业务。注册不会自动创建门店或管理员。"],
  ["手机和电脑都能使用吗？", "可以。使用浏览器打开 ChinaTech 即可。电脑适合查看完整列表和详情，手机适合接机登记、拍照和随时跟进工单。"],
  ["客户送修的设备和待售整机会混在一起吗？", "不会。客户设备和门店自有待售整机分别管理。整机逐台建档，相同型号也保留各自的规格、检测和销售历史。"],
  ["采购功能可以记录什么？", "可以记录与工单关联的配件需求、供应商、下单和分次到货，并保留追加更正的历史。采购记录不代表配件库存，也不会向供应商自动下单。"],
];

export default function HomePageContent() {
  const { t } = useLanguage();
  return <main className={styles.page}>
    <a className={styles.skipLink} href="#main-content">{t("跳到主要内容")}</a>
    <PublicHeader />

    <section className={styles.hero} id="main-content"><div className={styles.heroInner}>
      <div className={styles.heroCopy}><span className={styles.pill}><span />{t("为维修门店的每一天")}</span><h1>{t("让繁忙有序，")}<br />{t("让维修")}<span>{t("更简单。")}</span></h1><p>{t("从接机、配件到货，到整机销售。")}<br className={styles.desktopBreak} />{t("把门店的日常，整理在一个清晰的工作台。")}</p><div className={styles.heroActions}><Link className="button button--primary" href="/login">{t("开始使用")}<ArrowRight size={18} /></Link><a className="button button--secondary" href="#tutorials">{t("观看使用教程")}<ArrowDown size={16} /></a></div><div className={styles.heroFoot}><span><Check size={15} />{t("电脑与手机皆可用")}</span><span><ShieldCheck size={15} />{t("按门店授权访问")}</span></div></div>
      <div className={styles.heroVisual}><div className={styles.orbit} aria-hidden="true" /><ProductPreview /></div>
    </div><div className={styles.moduleStrip}><span>{t("一个工作台，串起门店日常")}</span><div><span><Wrench size={19} />{t("维修工单")}</span><i /><span><PackageCheck size={19} />{t("采购到货")}</span><i /><span><Laptop size={19} />{t("整机档案")}</span><i /><span><History size={19} />{t("客户与历史")}</span></div></div></section>

    <section className={styles.section} id="features"><div className={styles.sectionHeading}><span className={styles.sectionLabel}>{t("各司其职，彼此相连")}</span><h2>{t("少一点翻找，")}<br />{t("多一点心中有数。")}</h2><p>{t("客户、设备、配件与进度，放在该在的位置。")}</p></div><div className={styles.bento}>
      <article className={`${styles.feature} ${styles.featureWide}`}><div className={styles.featureCopy}><span className={styles.featureIcon}><ClipboardList size={23} /></span><h3>{t("每张工单，都有清楚的下一步。")}</h3><p>{t("从接机资料到维修进度，配件到货、设备保管和交还记录，一处查看，随时跟进。")}</p><a href="#workflow">{t("查看维修流程")}<ArrowRight size={16} /></a></div><div className={styles.repairGraphic} aria-label={t("维修阶段示意")}><div><span><Smartphone size={26} /></span><strong>{t("设备维修记录")}<small>{t("接机 · 需求 · 进度")}</small></strong><span className="status-pill status-pill--progress">{t("维修中")}</span></div><ul><li><Check size={14} />{t("接机资料已登记")}<span>01</span></li><li><Check size={14} />{t("维修需求已核对")}<span>02</span></li><li><PackageCheck size={14} />{t("配件已到货")}<span>03</span></li><li><Wrench size={14} />{t("跟进维修与交还")}<span>04</span></li></ul></div></article>
      <article className={`${styles.feature} ${styles.procurementFeature}`}><span className={styles.featureIcon}><PackageCheck size={23} /></span><h3>{t("配件到了，")}<br />{t("工单接着走。")}</h3><p>{t("按工单追踪采购与分次到货，保留每一次更正。")}</p><div className={styles.packageGraphic} aria-hidden="true"><div><PackageCheck size={42} /><span>{t("采购记录")}</span></div><span className={styles.connector} /><div><Wrench size={30} /><span>{t("关联工单")}</span></div></div></article>
      <article className={`${styles.feature} ${styles.retailFeature}`}><span className={styles.featureIcon}><Laptop size={23} /></span><h3>{t("每一台实物，")}<br />{t("都有自己的档案。")}</h3><p>{t("规格、照片、检测、成本和销售历史，逐台记录。")}</p><div className={styles.deviceCards} aria-label={t("单机档案示意")}><div><Smartphone size={39} /><span>{t("手机")}<small>{t("独立编号 · 独立检测")}</small></span></div><div><Laptop size={44} /><span>{t("笔记本")}<small>{t("规格记录 · 销售历史")}</small></span></div></div></article>
      <article className={`${styles.feature} ${styles.accessFeature}`}><div><span className={styles.featureIcon}><ShieldCheck size={23} /></span><h3>{t("协作有分工，")}<br />{t("访问有边界。")}</h3><p>{t("成员按授权访问门店。关键变更留下记录，历史可追溯。")}</p></div><div className={styles.accessGraphic} aria-hidden="true"><span><ShieldCheck size={45} /></span><div><i /><i /><i /></div><small>{t("身份验证 → 门店授权 → 工作台")}</small></div></article>
    </div></section>

    <section className={styles.section} id="tutorials" aria-labelledby="tutorials-title"><div className={styles.sectionHeading}><h2 id="tutorials-title">{t("视频教程")}</h2><p>{t("鼠标指引、配音与字幕，一集学会一个日常操作。")}</p></div><TutorialLibrary /></section>

    <section className={styles.workflowSection} id="workflow"><div className={styles.section}><div className={styles.sectionHeading}><span className={styles.sectionLabel}>{t("从第一步，到下一步")}</span><h2>{t("流程清楚，工作自然顺手。")}</h2><p>{t("点击切换，看看每一条业务如何展开。")}</p></div><WorkflowTour /></div></section>

    <section className={`${styles.section} ${styles.devicesSection}`}><div className={styles.devicesCopy}><span className={styles.sectionLabel}>{t("在柜台，也在手边")}</span><h2>{t("电脑上看全局，")}<br />{t("手机上接着做。")}</h2><p>{t("同一个网站，适合不同的工作时刻。坐下来处理列表，拿起手机记录设备与照片。")}</p><ul><li><CheckCheck size={20} />{t("桌面完整列表，查看更从容")}</li><li><Smartphone size={20} />{t("手机单栏操作，接机更顺手")}</li><li><ShieldCheck size={20} />{t("两端沿用相同的门店权限")}</li></ul></div><div className={styles.devicesGraphic} aria-label={t("电脑与手机界面示意")}><div className={styles.miniDesktop}><div><Laptop size={18} /><strong>{t("门店工作台")}</strong><span>{t("示意")}</span></div><div className={styles.miniColumns}><span>{t("待处理")}<i /><i /><i /></span><span>{t("进行中")}<i /><i /></span><span>{t("已完成")}<i /><i /><i /></span></div></div><div className={styles.miniPhone}><span /><small>ChinaTech</small><strong>{t("随手，记清楚。")}</strong><div><Smartphone size={29} /><b>{t("接机登记")}</b><small>{t("客户设备 · 维修需求")}</small></div><div><Check size={17} />{t("资料已记录")}</div><div><PackageCheck size={17} />{t("继续跟进")}</div></div></div></section>

    <section className={`${styles.section} ${styles.faqSection}`} id="questions"><div><span className={styles.sectionLabel}>{t("开始之前")}</span><h2>{t("你可能想了解")}</h2><p>{t("关于账号、设备与日常使用。")}</p></div><div className={styles.faqList}>{faqs.map(([question, answer]) => <details key={question}><summary>{t(question)}<ChevronDown size={18} /></summary><p>{t(answer)}</p></details>)}</div></section>
    <section className={styles.finalCta}><span className={styles.ctaIcon}><Wrench size={28} /></span><h2>{t("下一步，从这里开始。")}</h2><p>{t("登录 ChinaTech，继续门店今天的工作。")}</p><div><Link className="button button--primary" href="/login">{t("登录工作台")}<ArrowRight size={17} /></Link><Link className="button button--secondary" href="/register">{t("创建账号")}</Link></div></section>
    <footer className={styles.footer}><Brand /><p>{t("© 2026 ChinaTech · 让门店日常井井有条")}</p><div><Link href="/toolbox">{t("工具箱")}</Link><a href="#tutorials">{t("使用帮助")}</a><Link href="/login">{t("登录")}</Link><Link href="/register">{t("注册")}</Link></div></footer>
  </main>;
}
