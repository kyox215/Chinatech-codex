"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Battery, Camera, CircuitBoard, Droplets, Fingerprint, Keyboard, Mic, Monitor, Smartphone, Volume2, Cable, Settings2, ChevronDown, Check, BadgeCheck, Layers, ScanLine, BatteryPlus, ArrowLeft, X } from "lucide-react";
import { createPortal } from "react-dom";
import styles from "./intake-fault-picker.module.css";
import { MultiChoice } from "@/components/multi-choice";
import { SingleChoice } from "@/components/single-choice";
import { isAppleBrand, hasIntakeFault, type IntakeServices, type PartQuality } from "@/lib/intake-services";
const groups = [
  { label: "屏幕", icon: Monitor, details: ["碎裂", "不显示", "触摸失灵", "显示异常"] },
  { label: "电池", icon: Battery, details: ["续航差", "不充电", "鼓包", "自动关机"] },
  { label: "尾插", icon: Cable, details: ["接口松动", "无法充电", "无法传输数据"] },
  { label: "摄像头", icon: Camera, details: ["无法拍摄", "模糊", "镜片破损"] },
  { label: "进水", icon: Droplets, details: ["接触液体", "无法开机", "需检查腐蚀"] },
  { label: "主板", icon: CircuitBoard, details: ["无法开机", "重启", "发热", "无信号"] },
  { label: "系统", icon: Settings2, details: ["卡顿", "无法启动", "软件异常"] },
  { label: "后盖", icon: Smartphone, details: ["破损", "开胶", "变形"] },
  { label: "面容/指纹", icon: Fingerprint, details: ["无法识别", "无法录入"] },
  { label: "扬声器", icon: Volume2, details: ["无声音", "杂音", "声音小"] },
  { label: "麦克风", icon: Mic, details: ["无声音", "声音小", "通话异常"] },
  { label: "按键", icon: Keyboard, details: ["电源键", "音量键", "键盘", "摇杆"] },
];
const qualityOptions = [{ value: "", label: "未指定" }, { value: "original", label: "原装", icon: BadgeCheck }, { value: "assembled", label: "组装", icon: Layers }];
export function IntakeFaultPicker({ values, onChange, brand, services, onServicesChange }: { values: string[]; onChange: (values: string[]) => void; brand: string; services: IntakeServices; onServicesChange: (value: IntakeServices) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [technology, setTechnology] = useState(false);
  const [position,setPosition]=useState<CSSProperties>({visibility:"hidden"});
  const anchors=useRef(new Map<string,HTMLButtonElement>());
  const panel=useRef<HTMLDivElement>(null);
  const group = groups.find(group => group.label === expanded);
  const belongs = (value: string, label: string) => value === label || value.startsWith(`${label}：`);
  const close = (focus=false) => {setExpanded(null);setTechnology(false);if(focus && expanded) anchors.current.get(expanded)?.focus();};
  useEffect(()=>{
    if(!expanded) return;
    const place=()=>{
      const bounds=anchors.current.get(expanded)?.getBoundingClientRect();if(!bounds)return;
      const width=Math.min(380,window.innerWidth-24);
      const height=Math.min(panel.current?.scrollHeight??380,window.innerHeight-24);
      const below=window.innerHeight-bounds.bottom-12;
      setPosition({width,left:Math.max(12,Math.min(bounds.right-width,window.innerWidth-width-12)),top:Math.max(12,below>=height?bounds.bottom+6:Math.min(bounds.top-height-6,window.innerHeight-height-12)),maxHeight:window.innerHeight-24});
    };
    const outside=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node) && !anchors.current.get(expanded)?.contains(event.target as Node)){setExpanded(null);setTechnology(false);}};
    const focus=()=>{if(document.activeElement && !panel.current?.contains(document.activeElement) && !anchors.current.get(expanded)?.contains(document.activeElement)){setExpanded(null);setTechnology(false);}};
    place();panel.current?.querySelector<HTMLElement>("[data-panel-heading]")?.focus({preventScroll:true});
    window.addEventListener("resize",place);window.addEventListener("scroll",place,true);document.addEventListener("pointerdown",outside);document.addEventListener("focusin",focus);
    return ()=>{window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);document.removeEventListener("pointerdown",outside);document.removeEventListener("focusin",focus);};
  },[expanded,technology]);
  const ensureGroup=()=>{if(group && !hasIntakeFault(values,group.label)) onChange([...values,group.label]);};
  const quality=group?.label==="屏幕"?services.screen.quality:group?.label==="电池"?services.battery.quality:services.port.quality;
  function changeQuality(value:string) {
    if(!group)return;ensureGroup();const selected=value as PartQuality;
    if(group.label==="屏幕") {onServicesChange({...services,screen:{quality:selected,technology:selected==="assembled"?services.screen.technology:""}});setTechnology(selected==="assembled");}
    else if(group.label==="电池") onServicesChange({...services,battery:{...services.battery,quality:selected}});
    else onServicesChange({...services,port:{quality:selected}});
  }
  return <section className="intake-faults" aria-label="故障选择">
    <strong className="intake-field-title">客户报告的故障 *</strong>
    <div className="intake-faults__grid">{groups.map(item=>{const selected=values.some(value=>belongs(value,item.label));return <div className="intake-faults__category" data-selected={selected} key={item.label}><button type="button" aria-pressed={selected} onClick={()=>{onChange(selected?values.filter(value=>!belongs(value,item.label)):[...values,item.label]);if(selected && expanded===item.label)close();}}><item.icon size={18}/><span>{item.label}</span>{selected?<Check size={14}/>:null}</button><button ref={element=>{if(element)anchors.current.set(item.label,element);else anchors.current.delete(item.label);}} type="button" aria-label={`展开${item.label}细分故障`} aria-expanded={expanded===item.label} aria-haspopup="dialog" onClick={()=>{setPosition({visibility:"hidden"});setTechnology(false);setExpanded(expanded===item.label?null:item.label);}}><ChevronDown size={16}/></button></div>;})}</div>
    {group?createPortal(<div ref={panel} className={styles.popover} style={position} role="dialog" aria-label={`${group.label}细分故障选项`} onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();if(technology)setTechnology(false);else close(true);}}}>
      <header className={styles.heading}>{technology?<button type="button" className="icon-button" aria-label="返回屏幕选项" onClick={()=>setTechnology(false)}><ArrowLeft size={17}/></button>:<group.icon size={18}/>}<strong data-panel-heading tabIndex={-1}>{technology?"组装屏幕类型":group.label+" · 维修需求"}</strong><button type="button" className="icon-button" aria-label="关闭故障选项" onClick={()=>close(true)}><X size={17}/></button></header>
      {technology?<><SingleChoice label="选择组装屏幕技术" value={services.screen.technology} options={[{value:"",label:"未指定"},{value:"incell",label:"Incell"},{value:"tft",label:"TFT"},{value:"oled",label:"OLED"}]} onChange={value=>{onServicesChange({...services,screen:{...services.screen,technology:value as IntakeServices["screen"]["technology"]}});setTechnology(false);}} onRepeatSelect={()=>setTechnology(false)}/><p className={styles.note}>选择后返回屏幕故障；保留已选现象。</p></>:<div className={styles.body}>
        {["屏幕","电池","尾插"].includes(group.label)?<><SingleChoice label={`${group.label} · 配件类型`} value={quality} options={qualityOptions} onChange={changeQuality}/>{group.label==="屏幕" && quality==="assembled"?<button type="button" className="button button--secondary" onClick={()=>setTechnology(true)}><Layers size={17}/>组装类型 · {services.screen.technology?services.screen.technology==="incell"?"Incell":services.screen.technology.toUpperCase():"未指定"}<ChevronDown size={15}/></button>:null}{group.label==="电池" && isAppleBrand(brand)?<SingleChoice label="苹果电池处理" value={services.battery.appleService} options={[{value:"",label:"未指定"},{value:"capacity",label:"扩容",icon:BatteryPlus},{value:"diagnostics",label:"跑诊断",icon:ScanLine},{value:"both",label:"扩容跑诊断",icon:BatteryPlus}]} onChange={value=>{ensureGroup();onServicesChange({...services,battery:{...services.battery,appleService:value as IntakeServices["battery"]["appleService"]}});}}/>:null}</>:null}
        <MultiChoice label={`${group.label} · 故障现象`} values={values.filter(value=>value.startsWith(`${group.label}：`))} options={group.details.map(detail=>({value:`${group.label}：${detail}`,label:detail}))} onChange={details=>onChange([...values.filter(value=>!belongs(value,group.label)),...(details.length?details:[group.label])])}/>
      </div>}
      <footer className={styles.footer}><button type="button" className="button button--primary" onClick={()=>close(true)}><Check size={16}/>完成</button></footer>
    </div>,document.body):null}
    {values.length?<div className="intake-selected-faults" aria-live="polite">{values.map(value=><span key={value}>{value}</span>)}</div>:null}
  </section>;
}
