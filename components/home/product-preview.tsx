"use client";

import { useLanguage } from "@/components/language-provider";
import { ArrowUpRight, Check, CheckCheck, ClipboardList, Laptop, LayoutDashboard, PackageCheck, Smartphone, Wrench } from "lucide-react";
import styles from "./product-preview.module.css";

export function ProductPreview() {
  const { t } = useLanguage();
  return (
    <div className={styles.scene} aria-label={t("ChinaTech 工作台示意，所有内容为演示数据")}>
      <div className={styles.window}>
        <div className={styles.topbar}><span className={styles.windowDots}><i /><i /><i /></span><span>{t("ChinaTech · 门店工作台")}</span><span className={styles.demo}>{t("功能示意")}</span></div>
        <div className={styles.workspace}>
          <div className={styles.rail} aria-hidden="true"><span><Wrench size={20} /></span><LayoutDashboard size={19} /><ClipboardList size={19} /><PackageCheck size={19} /><Laptop size={19} /></div>
          <div className={styles.content}>
            <div className={styles.heading}><div><small>{t("每一件事，都有下一步")}</small><h3>{t("今天，井井有条。")}</h3></div><span className={styles.avatar}>CT</span></div>
            <div className={styles.stats}>
              <div><span><Wrench size={15} />{t("维修中")}</span><strong>12<small>{t("台设备")}</small></strong><i /></div>
              <div><span><PackageCheck size={15} />{t("待到货")}</span><strong>05<small>{t("项采购")}</small></strong><i /></div>
              <div><span><CheckCheck size={15} />{t("已修好")}</span><strong>08<small>{t("待交还")}</small></strong><i /></div>
            </div>
            <div className={styles.listHeading}><strong>{t("需要跟进")}</strong><span>{t("工单 · 采购 · 交付")}</span></div>
            <div className={styles.record}><span className={styles.device}><Smartphone size={23} /></span><div><strong>{t("手机 · 屏幕维修")}</strong><small>{t("需求已记录，等待配件")}</small></div><span className="status-pill status-pill--warning">{t("待到货")}</span></div>
            <div className={styles.record}><span className={styles.device}><Laptop size={23} /></span><div><strong>{t("笔记本 · 电池更换")}</strong><small>{t("配件已收到，可继续维修")}</small></div><span className="status-pill status-pill--progress">{t("维修中")}</span></div>
            <div className={styles.timeline}><span><Check size={12} />{t("接机登记")}</span><i /><span><Check size={12} />{t("采购到货")}</span><i /><span>{t("维修交付")}</span></div>
          </div>
        </div>
      </div>
      <div className={styles.notification}><span><PackageCheck size={21} /></span><div><strong>{t("配件到了，进度接上了。")}</strong><small>{t("到货记录关联原工单")}</small></div><ArrowUpRight size={18} /></div>
      <span className={styles.caption}>{t("示意数据 · 不含真实客户信息")}</span>
    </div>
  );
}
