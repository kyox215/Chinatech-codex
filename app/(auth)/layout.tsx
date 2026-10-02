import { Brand } from "@/components/brand";
import { ClipboardList, PackageCheck, ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-page__left">
        <Brand />
        <div className="auth-page__form-wrap">{children}</div>
        <p className="auth-page__footnote">© 2026 ChinaTech · 当前为本地视觉样板</p>
      </div>
      <aside className="auth-showcase" aria-label="产品能力介绍">
        <div className="dot-field" aria-hidden="true" />
        <div className="auth-showcase__copy">
          <span>维修门店的一体化工作台</span>
          <h2>把下一步放在最清楚的位置。</h2>
          <p>工单、采购与自有整机保持独立身份，再通过同一套界面与权限串联。</p>
        </div>
        <div className="auth-dashboard-card">
          <div className="auth-dashboard-card__head"><Brand compact /><span>工作台预览</span></div>
          <div className="auth-dashboard-card__stats"><div><ClipboardList size={18} /><span>待报价</span><strong>8</strong></div><div><PackageCheck size={18} /><span>待到货</span><strong>5</strong></div><div><ShieldCheck size={18} /><span>待授权</span><strong>2</strong></div></div>
          <div className="auth-dashboard-card__chart"><span /><span /><span /><span /><span /><span /><span /></div>
        </div>
      </aside>
    </main>
  );
}
