import { Boxes, CheckCircle2, Clock3, PackageCheck, Search, Smartphone, Wrench } from "lucide-react";

const previewItems = [
  { icon: Clock3, label: "待报价", value: "8", tone: "violet" },
  { icon: PackageCheck, label: "待到货", value: "5", tone: "amber" },
  { icon: Wrench, label: "维修中", value: "12", tone: "mint" },
];

export function ProductPreview() {
  return (
    <div className="product-preview" aria-label="ChinaTech 工作台演示预览">
      <div className="product-preview__sidebar">
        <span className="preview-logo"><Wrench size={16} /></span>
        <span className="preview-dot preview-dot--active" />
        <span className="preview-dot" />
        <span className="preview-dot" />
        <span className="preview-dot" />
      </div>
      <div className="product-preview__main">
        <div className="preview-toolbar">
          <div>
            <strong>今日门店概览</strong>
            <span>演示数据 · 09:30 更新</span>
          </div>
          <span className="preview-search"><Search size={14} />搜索工单</span>
        </div>
        <div className="preview-stats">
          {previewItems.map((item) => (
            <div className="preview-stat" key={item.label}>
              <span className={`preview-stat__icon preview-stat__icon--${item.tone}`}><item.icon size={15} /></span>
              <div><span>{item.label}</span><strong>{item.value}</strong></div>
            </div>
          ))}
        </div>
        <div className="preview-grid">
          <div className="preview-panel preview-panel--wide">
            <div className="preview-panel__title"><strong>优先处理</strong><span>查看全部</span></div>
            <div className="preview-repair">
              <span className="preview-device"><Smartphone size={16} /></span>
              <div><strong>iPhone 15 Pro · 无法充电</strong><small>CT-2026-0929 · 等待客户确认</small></div>
              <span className="status-pill status-pill--warning">待确认</span>
            </div>
            <div className="preview-repair">
              <span className="preview-device"><Boxes size={16} /></span>
              <div><strong>MacBook Air · 更换电池</strong><small>CT-2026-0927 · 配件部分到货</small></div>
              <span className="status-pill status-pill--info">采购中</span>
            </div>
          </div>
          <div className="preview-panel preview-panel--progress">
            <div className="preview-panel__title"><strong>本周完成</strong><span><CheckCircle2 size={15} /></span></div>
            <div className="progress-ring"><strong>34</strong><span>台设备</span></div>
            <small>较上周 +12%</small>
          </div>
        </div>
      </div>
    </div>
  );
}
