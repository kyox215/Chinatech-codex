import Link from "next/link";
import { ArrowDown, ArrowRight, Check, CheckCheck, ChevronDown, ClipboardList, History, Laptop, PackageCheck, ShieldCheck, Smartphone, Wrench } from "lucide-react";
import { Brand } from "@/components/brand";
import { ProductPreview } from "@/components/home/product-preview";
import { WorkflowTour } from "@/components/home/workflow-tour";
import { TutorialLibrary } from "@/components/home/tutorial-library";
import styles from "@/components/home/home.module.css";

const faqs = [
  ["注册后可以直接进入门店吗？", "邮箱注册需要先完成验证，使用 Google 登录则由 Google 验证身份。两种方式都需要门店老板授予成员权限后，才能访问门店业务。注册不会自动创建门店或管理员。"],
  ["手机和电脑都能使用吗？", "可以。使用浏览器打开 ChinaTech 即可。电脑适合查看完整列表和详情，手机适合接机登记、拍照和随时跟进工单。"],
  ["客户送修的设备和待售整机会混在一起吗？", "不会。客户设备和门店自有待售整机分别管理。整机逐台建档，相同型号也保留各自的规格、检测和销售历史。"],
  ["采购功能可以记录什么？", "可以记录与工单关联的配件需求、供应商、下单和分次到货，并保留追加更正的历史。采购记录不代表配件库存，也不会向供应商自动下单。"],
];

export default function HomePage() {
  return <main className={styles.page}>
    <a className={styles.skipLink} href="#main-content">跳到主要内容</a>
    <header className={styles.header}><div className={styles.headerInner}>
      <div className={styles.headerLeft}><nav className={styles.authNav} aria-label="账户入口"><Link href="/login">登录</Link><Link className="button button--primary" href="/register">注册</Link></nav><span className={styles.divider} /><Brand compact /></div>
      <nav className={styles.navigation} aria-label="主页导航"><a href="#features">功能亮点</a><a href="#tutorials">视频教程</a><a href="#workflow">业务流程</a><a href="#questions">常见问题</a></nav>
      <Link className={styles.workspaceLink} href="/app/dashboard">进入工作台 <ArrowUpRightIcon /></Link>
    </div></header>

    <section className={styles.hero} id="main-content"><div className={styles.heroInner}>
      <div className={styles.heroCopy}><span className={styles.pill}><span />为维修门店的每一天</span><h1>让繁忙有序，<br />让维修<span>更简单。</span></h1><p>从接机、配件到货，到整机销售。<br className={styles.desktopBreak} />把门店的日常，整理在一个清晰的工作台。</p><div className={styles.heroActions}><Link className="button button--primary" href="/login">开始使用 <ArrowRight size={18} /></Link><a className="button button--secondary" href="#tutorials">观看使用教程 <ArrowDown size={16} /></a></div><div className={styles.heroFoot}><span><Check size={15} />电脑与手机皆可用</span><span><ShieldCheck size={15} />按门店授权访问</span></div></div>
      <div className={styles.heroVisual}><div className={styles.orbit} aria-hidden="true" /><ProductPreview /></div>
    </div><div className={styles.moduleStrip}><span>一个工作台，串起门店日常</span><div><span><Wrench size={19} />维修工单</span><i /><span><PackageCheck size={19} />采购到货</span><i /><span><Laptop size={19} />整机档案</span><i /><span><History size={19} />客户与历史</span></div></div></section>

    <section className={styles.section} id="features"><div className={styles.sectionHeading}><span className={styles.sectionLabel}>各司其职，彼此相连</span><h2>少一点翻找，<br />多一点心中有数。</h2><p>客户、设备、配件与进度，放在该在的位置。</p></div><div className={styles.bento}>
      <article className={`${styles.feature} ${styles.featureWide}`}><div className={styles.featureCopy}><span className={styles.featureIcon}><ClipboardList size={23} /></span><h3>每张工单，都有清楚的下一步。</h3><p>从接机资料到维修进度，配件到货、设备保管和交还记录，一处查看，随时跟进。</p><a href="#workflow">查看维修流程 <ArrowRight size={16} /></a></div><div className={styles.repairGraphic} aria-label="维修阶段示意"><div><span><Smartphone size={26} /></span><strong>设备维修记录<small>接机 · 需求 · 进度</small></strong><span className="status-pill status-pill--progress">维修中</span></div><ul><li><Check size={14} />接机资料已登记<span>01</span></li><li><Check size={14} />维修需求已核对<span>02</span></li><li><PackageCheck size={14} />配件已到货<span>03</span></li><li><Wrench size={14} />跟进维修与交还<span>04</span></li></ul></div></article>
      <article className={`${styles.feature} ${styles.procurementFeature}`}><span className={styles.featureIcon}><PackageCheck size={23} /></span><h3>配件到了，<br />工单接着走。</h3><p>按工单追踪采购与分次到货，保留每一次更正。</p><div className={styles.packageGraphic} aria-hidden="true"><div><PackageCheck size={42} /><span>采购记录</span></div><span className={styles.connector} /><div><Wrench size={30} /><span>关联工单</span></div></div></article>
      <article className={`${styles.feature} ${styles.retailFeature}`}><span className={styles.featureIcon}><Laptop size={23} /></span><h3>每一台实物，<br />都有自己的档案。</h3><p>规格、照片、检测、成本和销售历史，逐台记录。</p><div className={styles.deviceCards} aria-label="单机档案示意"><div><Smartphone size={39} /><span>手机<small>独立编号 · 独立检测</small></span></div><div><Laptop size={44} /><span>笔记本<small>规格记录 · 销售历史</small></span></div></div></article>
      <article className={`${styles.feature} ${styles.accessFeature}`}><div><span className={styles.featureIcon}><ShieldCheck size={23} /></span><h3>协作有分工，<br />访问有边界。</h3><p>成员按授权访问门店。关键变更留下记录，历史可追溯。</p></div><div className={styles.accessGraphic} aria-hidden="true"><span><ShieldCheck size={45} /></span><div><i /><i /><i /></div><small>身份验证 → 门店授权 → 工作台</small></div></article>
    </div></section>

    <section className={styles.section} id="tutorials" aria-labelledby="tutorials-title"><div className={styles.sectionHeading}><h2 id="tutorials-title">视频教程</h2><p>中文配音与字幕，一集学会一个日常操作。</p></div><TutorialLibrary /></section>

    <section className={styles.workflowSection} id="workflow"><div className={styles.section}><div className={styles.sectionHeading}><span className={styles.sectionLabel}>从第一步，到下一步</span><h2>流程清楚，工作自然顺手。</h2><p>点击切换，看看每一条业务如何展开。</p></div><WorkflowTour /></div></section>

    <section className={`${styles.section} ${styles.devicesSection}`}><div className={styles.devicesCopy}><span className={styles.sectionLabel}>在柜台，也在手边</span><h2>电脑上看全局，<br />手机上接着做。</h2><p>同一个网站，适合不同的工作时刻。坐下来处理列表，拿起手机记录设备与照片。</p><ul><li><CheckCheck size={20} />桌面完整列表，查看更从容</li><li><Smartphone size={20} />手机单栏操作，接机更顺手</li><li><ShieldCheck size={20} />两端沿用相同的门店权限</li></ul></div><div className={styles.devicesGraphic} aria-label="电脑与手机界面示意"><div className={styles.miniDesktop}><div><Laptop size={18} /><strong>门店工作台</strong><span>示意</span></div><div className={styles.miniColumns}><span>待处理<i /><i /><i /></span><span>进行中<i /><i /></span><span>已完成<i /><i /><i /></span></div></div><div className={styles.miniPhone}><span /><small>ChinaTech</small><strong>随手，记清楚。</strong><div><Smartphone size={29} /><b>接机登记</b><small>客户设备 · 维修需求</small></div><div><Check size={17} />资料已记录</div><div><PackageCheck size={17} />继续跟进</div></div></div></section>

    <section className={`${styles.section} ${styles.faqSection}`} id="questions"><div><span className={styles.sectionLabel}>开始之前</span><h2>你可能想了解</h2><p>关于账号、设备与日常使用。</p></div><div className={styles.faqList}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>)}</div></section>
    <section className={styles.finalCta}><span className={styles.ctaIcon}><Wrench size={28} /></span><h2>下一步，从这里开始。</h2><p>登录 ChinaTech，继续门店今天的工作。</p><div><Link className="button button--primary" href="/login">登录工作台 <ArrowRight size={17} /></Link><Link className="button button--secondary" href="/register">创建账号</Link></div></section>
    <footer className={styles.footer}><Brand /><p>© 2026 ChinaTech · 让门店日常井井有条</p><div><a href="#tutorials">使用帮助</a><Link href="/login">登录</Link><Link href="/register">注册</Link></div></footer>
  </main>;
}
function ArrowUpRightIcon() { return <ArrowRight size={16} aria-hidden="true" />; }
