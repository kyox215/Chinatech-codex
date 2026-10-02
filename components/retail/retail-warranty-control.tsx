"use client";

import { useId, useState } from "react";
import { SelectControl } from "@/components/select-control";
import { RetailNumberControl } from "./retail-input-controls";
import styles from "./retail-warranty-control.module.css";

const quickMonths = [6, 12, 24];

export function RetailWarrantyControl({ value, onChange, disabled = false }: { value: number | null; onChange: (value: number | null) => void; disabled?: boolean }) {
  const [custom, setCustom] = useState(() => value !== null && !quickMonths.includes(value));
  const descriptionId = useId();
  const selected = custom ? "custom" : value === null ? "none" : String(value);

  function selectWarranty(selectedValue: string) {
    if (selectedValue === "custom") {
      const initial = value !== null && Number.isFinite(value) ? String(value) : "";
      setCustom(true);
      onChange(initial ? Number(initial) : Number.NaN);
    } else {
      setCustom(false);
      onChange(selectedValue === "none" ? null : Number(selectedValue));
    }
  }

  return <div className={styles.control}>
    <label className="field"><span>商家保修期限</span><SelectControl aria-label="商家保修期限" disabled={disabled} aria-describedby={descriptionId} value={selected} onChange={event => selectWarranty(event.target.value)}><option value="6">6 个月</option><option value="12">1 年</option><option value="24">2 年</option><option value="custom">自定义月数</option><option value="none">不提供额外商家保修</option></SelectControl></label>
    {custom ? <RetailNumberControl label="自定义商家保修月数" value={value} onChange={next => onChange(next === null ? Number.NaN : next)} min={1} max={120} unit="个月" disabled={disabled} optional={false} /> : null}
    <p id={descriptionId} className={styles.note}>{value === null ? "不提供额外商家保修，法定权利不受影响。" : "商家保修从实际交付日起计算。"}</p>
  </div>;
}
