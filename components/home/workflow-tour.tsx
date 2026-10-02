"use client";

import { useState } from "react";
import { ArrowRight, Check, ClipboardList, Laptop, PackageCheck, Search, ShieldCheck, Wrench } from "lucide-react";
import styles from "./home.module.css";

const tours = [
  { label: "维修工单", icon: Wrench, title: "一台送修设备，一条完整记录。", body: "接机时记清需求，维修时跟进阶段，交还时核对设备。回头查找，也能知道发生过什么。", steps: [{ icon: ClipboardList, title: "接机登记", text: "客户 · 设备 · 故障" }, { icon: Search, title: "核对需求", text: "维修项目 · 随件 · 签名" }, { icon: Wrench, title: "跟进维修", text: "配件到货 · 维修阶段" }, { icon: Check, title: "确认交还", text: "设备保管 · 交还记录" }] },
  { label: "采购到货", icon: PackageCheck, title: "哪张工单缺什么，随时有据可查。", body: "配件跟着工单走，从准备采购、记录下单到分次到货，进度和更正都有原始记录。", steps: [{ icon: ClipboardList, title: "记录配件", text: "关联工单 · 明确需求" }, { icon: Search, title: "准备采购", text: "供应商 · 配件信息" }, { icon: PackageCheck, title: "分次到货", text: "逐次记录 · 追踪进度" }, { icon: Check, title: "查看历史", text: "追加更正 · 原记录保留" }] },
  { label: "整机销售", icon: Laptop, title: "同一个型号，也有各自的故事。", body: "门店自有单机独立建档，规格、检测、照片和销售记录始终跟随这一台实物。", steps: [{ icon: Laptop, title: "逐台建档", text: "独立编号 · 实物规格" }, { icon: Search, title: "检测拍照", text: "逐项核验 · 留存照片" }, { icon: ShieldCheck, title: "确认可售", text: "检测结果 · 售价" }, { icon: Check, title: "登记销售", text: "买家 · 保修 · 售后来源" }] },
];

export function WorkflowTour() {
  const [selected, setSelected] = useState(0);
  const tour = tours[selected];
  return <div className={styles.tour}>
    <div className={styles.tourTabs} aria-label="选择查看的业务流程">{tours.map((item, index) => <button type="button" key={item.label} aria-pressed={selected === index} aria-controls="workflow-content" onClick={() => setSelected(index)}><item.icon size={18} />{item.label}</button>)}</div>
    <div id="workflow-content" className={styles.tourContent} key={selected} aria-live="polite">
      <div className={styles.tourIntro}><h3>{tour.title}</h3><p>{tour.body}</p></div>
      <ol className={styles.steps}>{tour.steps.map((step, index) => <li key={step.title}><span className={styles.stepIcon}><step.icon size={23} /></span><small>0{index + 1}</small><h4>{step.title}</h4><p>{step.text}</p>{index < 3 ? <ArrowRight className={styles.stepArrow} size={19} aria-hidden="true" /> : null}</li>)}</ol>
    </div>
  </div>;
}
