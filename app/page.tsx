import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Check,
  ClipboardList,
  History,
  Laptop,
  PackageSearch,
  ShieldCheck,
  Smartphone,
  Wrench,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ProductPreview } from "@/components/home/product-preview";

const features = [
  {
    icon: ClipboardList,
    eyebrow: "维修工单",
    title: "从接机到交付，一条记录走到底",
    body: "集中管理故障、报价版本、维修步骤、测试结果和交机记录，旧历史不会被新操作覆盖。",
  },
  {
    icon: PackageSearch,
    eyebrow: "采购跟进",
    title: "跟着工单记录下单与到货",
    body: "按供应商和工单查看采购进度，支持分次到货与更正记录，但不会虚构配件库存。",
  },
  {
    icon: Boxes,
    eyebrow: "整机商品",
    title: "一机一档，成本与检测独立",
    body: "手机、电脑、平板和游戏机逐台建档；颜色、RAM、存储、多块硬盘与照片分别保存。",
  },
  {
    icon: ShieldCheck,
    eyebrow: "权限与历史",
    title: "敏感数据只给真正需要的人",
    body: "成员、门店和角色范围分开校验。注册不等于进入后台，关键变更保留审计轨迹。",
  },
];

const repairSteps = ["登记客户与设备", "诊断并生成报价", "采购、维修与测试", "核对收款并交机"];
const retailSteps = ["扫码或手工建档", "逐项检测与拍照", "确认可售与定价", "登记出售或实物退回"];

export default function HomePage() {
  return (
    <main className="marketing-page">
      <header className="public-header">
        <div className="public-header__inner">
          <div className="public-header__left">
            <nav className="auth-nav" aria-label="账户入口">
              <Link className="text-link" href="/login">登录</Link>
              <Link className="button button--small" href="/register">注册</Link>
            </nav>
            <span className="header-divider" aria-hidden="true" />
            <Brand compact />
          </div>
          <nav className="public-nav" aria-label="主页导航">
            <a href="#features">功能</a>
            <a href="#workflow">流程</a>
            <a href="#responsive">多端使用</a>
          </nav>
          <Link className="header-dashboard-link" href="/app/dashboard">工作台样板 <ArrowRight size={16} /></Link>
        </div>
      </header>

      <section className="hero section-shell">
        <div className="hero__copy">
          <span className="eyebrow"><span className="eyebrow__dot" />为维修门店重新整理每天的工作</span>
          <h1><span>让维修、采购与</span><span>整机销售，回到</span><span className="hero-title__accent">同一条清晰流程。</span></h1>
          <p className="hero__lead">ChinaTech 把客户设备、维修工单、采购到货和自有待售整机分开管理，再在一个响应式工作台里串起真正需要的下一步。</p>
          <div className="hero__actions">
            <a className="button button--primary" href="#features">了解功能 <ArrowRight size={17} /></a>
            <Link className="button button--secondary" href="/login">登录使用</Link>
          </div>
          <ul className="hero__checks" aria-label="产品原则">
            <li><Check size={15} />配件采购不冒充库存</li>
            <li><Check size={15} />整机坚持一机一档</li>
            <li><Check size={15} />电脑与手机使用同一套业务规则</li>
          </ul>
        </div>
        <div className="hero__visual">
          <div className="hero__glow" aria-hidden="true" />
          <ProductPreview />
          <div className="floating-note floating-note--top"><History size={16} /><span><strong>完整历史</strong>报价与状态变化可追溯</span></div>
          <div className="floating-note floating-note--bottom"><ShieldCheck size={16} /><span><strong>受控访问</strong>注册后仍需门店授权</span></div>
        </div>
      </section>

      <section className="trust-strip">
        <div className="section-shell trust-strip__inner">
          <span>围绕真实门店流程设计</span>
          <strong><Wrench size={17} />维修闭环</strong>
          <strong><PackageSearch size={17} />采购事实</strong>
          <strong><Smartphone size={17} />单机档案</strong>
          <strong><History size={17} />变更留痕</strong>
        </div>
      </section>

      <section className="feature-section section-shell" id="features">
        <div className="section-heading">
          <span className="eyebrow">核心能力</span>
          <h2>不是把旧表格搬上网页，<br />而是让每一步都有明确归属。</h2>
          <p>同一套设计语言承载不同业务模块，数据身份和操作边界保持清楚。</p>
        </div>
        <div className="feature-grid">
          {features.map((feature, index) => (
            <article className="feature-card" key={feature.title}>
              <div className="feature-card__top">
                <span className="feature-card__icon"><feature.icon size={21} /></span>
                <span className="feature-card__number">0{index + 1}</span>
              </div>
              <span className="feature-card__eyebrow">{feature.eyebrow}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="workflow-section" id="workflow">
        <div className="section-shell workflow-section__inner">
          <div className="section-heading section-heading--left">
            <span className="eyebrow">两条独立流程</span>
            <h2><span>客户送修设备与</span><span>门店待售商品，</span><span>从一开始就不混在一起。</span></h2>
          </div>
          <div className="workflow-grid">
            <article className="workflow-card">
              <div className="workflow-card__header"><span><Wrench size={20} /></span><div><small>客户设备</small><h3>维修主流程</h3></div></div>
              <ol>{repairSteps.map((step, index) => <li key={step}><span>{index + 1}</span><strong>{step}</strong></li>)}</ol>
            </article>
            <article className="workflow-card workflow-card--violet">
              <div className="workflow-card__header"><span><Laptop size={20} /></span><div><small>自有商品</small><h3>整机销售流程</h3></div></div>
              <ol>{retailSteps.map((step, index) => <li key={step}><span>{index + 1}</span><strong>{step}</strong></li>)}</ol>
            </article>
          </div>
        </div>
      </section>

      <section className="responsive-section section-shell" id="responsive">
        <div className="responsive-copy">
          <span className="eyebrow">响应式网站</span>
          <h2><span>柜台电脑看全局，</span><span>手机随手处理下一步。</span></h2>
          <p>桌面保留紧凑表格与详情组合；手机改用摘要行、抽屉菜单和适合触控的短动作。两端使用同一套权限和业务规则，不宣称已有独立原生 App。</p>
          <ul>
            <li><Check size={16} />桌面、平板、手机内容驱动响应</li>
            <li><Check size={16} />关键操作不藏在 hover 里</li>
            <li><Check size={16} />长机型、中文与意大利语都可扩展</li>
          </ul>
        </div>
        <div className="device-composition" aria-label="桌面与手机工作台示意">
          <div className="device-window device-window--desktop"><ProductPreview /></div>
          <div className="device-window device-window--phone">
            <div className="phone-notch" />
            <div className="phone-stat"><span>待报价</span><strong>8</strong></div>
            <div className="phone-stat"><span>待采购</span><strong>5</strong></div>
            <div className="phone-list"><span /><div><strong>iPhone 15 Pro</strong><small>等待客户确认</small></div></div>
            <div className="phone-list"><span /><div><strong>MacBook Air</strong><small>配件部分到货</small></div></div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="section-shell cta-section__inner">
          <div><span className="eyebrow eyebrow--light">当前为视觉样板</span><h2>先确认结构、密度与交互，再接入真实业务数据。</h2></div>
          <div className="cta-section__actions"><Link className="button button--white" href="/login">查看登录样板</Link><Link className="button button--ghost-light" href="/register">查看注册流程</Link></div>
        </div>
      </section>

      <footer className="public-footer">
        <div className="section-shell public-footer__inner"><Brand compact /><p>ChinaTech 新系统 · M1 视觉样板 · 不包含真实客户数据</p><div><a href="#features">功能</a><Link href="/login">登录</Link></div></div>
      </footer>
    </main>
  );
}
