"use client";
import { useLanguage } from "@/components/language-provider";
import { InputControl } from "@/components/input-control";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, Palette } from "lucide-react";
import { SingleChoice } from "./single-choice";

export const deviceColors = [
  { value: "黑色", hex: "#282a30" }, { value: "白色", hex: "#fafafa" },
  { value: "银色", hex: "#d3d6da" }, { value: "灰色", hex: "#858991" },
  { value: "午夜色", hex: "#252a34" }, { value: "钛灰", hex: "#8d8981" },
  { value: "蓝色", hex: "#7aa7d7" }, { value: "深蓝色", hex: "#2d4466" },
  { value: "绿色", hex: "#89a58a" }, { value: "紫色", hex: "#b5a1ce" },
  { value: "粉色", hex: "#efc2cd" }, { value: "红色", hex: "#c8474d" },
  { value: "金色", hex: "#d4be94" }, { value: "原色钛金属", hex: "#a59f95" },
  { value: "黑色钛金属", hex: "#4e4e4c" }, { value: "白色钛金属", hex: "#e2ded6" },
  { value: "蓝色钛金属", hex: "#657385" },
];
export function ColorSwatch({ value }: { value: string }) {
  const color = deviceColors.find(item => item.value === value);
  return color ? <span className="color-swatch" style={{ "--swatch": color.hex } as CSSProperties} aria-hidden="true" /> : <Palette size={17} aria-hidden="true" />;
}
export function ColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useLanguage();
  const disclosure = useRef<HTMLDetailsElement>(null);
  const palette = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const [custom, setCustom] = useState(Boolean(value && !deviceColors.some(item => item.value === value)));
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const bounds = disclosure.current?.querySelector("summary")?.getBoundingClientRect();
      if (!bounds) return;
      const width = Math.min(360, window.innerWidth - 24);
      const above = Math.max(0, bounds.top - 12), below = Math.max(0, window.innerHeight - bounds.bottom - 12);
      const down = below >= 360 || below >= above;
      const maxHeight = Math.min(440, Math.max(160, down ? below : above));
      const height = Math.min(palette.current?.scrollHeight || 400, maxHeight);
      setPosition({ width, left: Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12)), top: down ? bounds.bottom + 6 : Math.max(12, bounds.top - height - 6), maxHeight });
    };
    const outside = (event: PointerEvent) => { if (!disclosure.current?.contains(event.target as Node)) { if (disclosure.current) disclosure.current.open = false; } };
    place(); window.addEventListener("resize", place); window.addEventListener("scroll", place, true); document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  function close() {
    if (disclosure.current) { disclosure.current.open = false; disclosure.current.querySelector("summary")?.focus(); }
  }
  function select(selected: string) {
    setCustom(selected === "custom"); onChange(selected === "custom" ? "" : selected);
    close();
  }
  const options = (metal: boolean) => deviceColors.filter(item => item.value.includes("钛金属") === metal).map(item => ({ value: item.value, label: item.value, graphic: <ColorSwatch value={item.value} /> }));
  return <div className="field color-picker"><span>{t("颜色")}</span><details ref={disclosure} onToggle={event => setOpen(event.currentTarget.open)} onKeyDown={event => { if (event.key === "Escape" && disclosure.current?.open) { event.preventDefault(); event.stopPropagation(); disclosure.current.open = false; disclosure.current.querySelector("summary")?.focus(); } }}>
    <summary aria-label={t("选择设备颜色")}><ColorSwatch value={value} /><span>{custom ? value || t("其他颜色") : t(value || "未记录")}</span><ChevronDown size={16} /></summary>
    <div ref={palette} className="color-picker__palette" style={position}><SingleChoice label={t("常规颜色")} className="single-choice--colors" value={custom ? "custom" : value} options={options(false)} onChange={select} onRepeatSelect={close} /><SingleChoice label={t("钛金属")} className="single-choice--colors" value={custom ? "custom" : value} options={options(true)} onChange={select} onRepeatSelect={close} /><SingleChoice label={t("其他")} className="single-choice--color-actions" value={custom ? "custom" : value} options={[{value:"",label:"未记录",icon:Palette},{value:"custom",label:"其他颜色",icon:Palette}]} onChange={select} onRepeatSelect={close} /></div>
  </details>{custom ? <InputControl onClear={() => onChange("")} clearLabel={t("清空其他颜色")} aria-label={t("其他颜色")} value={value} onChange={event => onChange(event.target.value)} placeholder={t("填写颜色")} maxLength={60} /> : null}</div>;
}
