"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { PhotoCapture } from "@/components/photo-capture";
import { intakePhotoError } from "@/lib/repair-intake";
import { validIntakePhotos, type IntakePhotoAttachment, type IntakePhotoReference } from "@/lib/repair-intake-record";
type DraftPhotoFile = {name:string;type:string;lastModified:number;bytes:ArrayBuffer};
export type IntakePhoto = { id: string; url: string; name: string; file?: File; draftFile?:DraftPhotoFile; slot: "front" | "back" | "other" };
const slots = [{ value: "front", label: "正面" }, { value: "back", label: "背面" }, { value: "other", label: "其他" }] as const;
const maxPhotoBytes = 240000;

function memoryImageUrl(bytes:ArrayBuffer,type:string) {
  const input=new Uint8Array(bytes);const chunks:string[]=[];
  for(let offset=0;offset<input.length;offset+=8192)chunks.push(String.fromCharCode(...input.subarray(offset,offset+8192)));
  return `data:${type};base64,${btoa(chunks.join(""))}`;
}
async function readPhotoBytes(file:File):Promise<ArrayBuffer> {
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([file.arrayBuffer(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("照片读取超时，请重新选择。")),5000);})]);}
  finally{clearTimeout(timer);}
}

async function encodeJpeg(file: File, photo: IntakePhotoReference, stored?:DraftPhotoFile): Promise<IntakePhotoAttachment> {
  const bitmap=new window.Image();
  const sourceUrl=memoryImageUrl(stored?.bytes??await readPhotoBytes(file),stored?.type??file.type);
  let decodeTimer:ReturnType<typeof setTimeout>|undefined;
  try {
    bitmap.src=sourceUrl;
    await Promise.race([bitmap.decode(),new Promise<never>((_,reject)=>{decodeTimer=setTimeout(()=>reject(new Error("照片读取超时，请重试。")),5000);})]).catch(()=>{throw new Error("照片无法处理，请改用 JPG / PNG 后重试。");});
    clearTimeout(decodeTimer);
    if (!bitmap.width || !bitmap.height) throw new Error("照片无法读取。");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法处理照片。");
    let scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 4; attempt++, scale *= 0.75) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.65, 0.5, 0.35]) {
        const encoded=canvas.toDataURL("image/jpeg",quality);
        if(!encoded.startsWith("data:image/jpeg;base64,"))throw new Error("当前浏览器无法生成 JPG 照片。");
        const base64=encoded.slice("data:image/jpeg;base64,".length);
        const byteLength=atob(base64).length;
        if(!byteLength)throw new Error("照片压缩失败，请重新选择。");
        if(byteLength>maxPhotoBytes)continue;
        return {...photo,mime:"image/jpeg",base64};
      }
    }
    throw new Error("压缩后照片仍过大，请选择较小的照片。");
  } finally { clearTimeout(decodeTimer);bitmap.src="";URL.revokeObjectURL(sourceUrl); }
}

export function useIntakePhotos() {
  const [photos, setPhotos] = useState<IntakePhoto[]>([]);
  const urls = useRef(new Set<string>());
  const sourceFiles = useRef(new Map<string, File>());
  const generation = useRef({ version: 0 });
  const slotsVersion = useRef({ front: 0, back: 0, other: 0 });
  const [error, setError] = useState("");
  const [pending, setPending] = useState<IntakePhoto["slot"][]>([]);
  useEffect(() => { const current = urls.current; const sources = sourceFiles.current; const lifecycle = generation.current; return () => { lifecycle.version++; current.forEach(url => URL.revokeObjectURL(url)); current.clear(); sources.clear(); }; }, []);
  const revoke = (url: string) => { URL.revokeObjectURL(url); urls.current.delete(url); };
  const remove = (photo: IntakePhoto) => { revoke(photo.url); sourceFiles.current.delete(photo.id); setPhotos(current => current.filter(item => item.id !== photo.id)); setError(""); };
  const clear = () => { generation.current.version++; urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); sourceFiles.current.clear(); setPhotos([]); setPending([]); setError(""); };
  const add = async (slot: IntakePhoto["slot"], files: File[]) => {
    setError("");
    const selected = slot === "other" ? files : files.slice(0,1);
    const failure = selected.map(intakePhotoError).find(Boolean);
    if (failure) { setError(failure); return; }
    if (slot === "other" && photos.filter(photo => photo.slot === "other").length + selected.length > 4) { setError("其他照片最多 4 张。"); return; }
    if (!selected.length) return;
    const epoch = generation.current.version;
    const attempt = ++slotsVersion.current[slot];
    setPending(current => [...current.filter(item => item !== slot),slot]);
    const candidates: IntakePhoto[] = [];
    try {
      candidates.push(...await Promise.all(selected.map(async file=>{
        const bytes=await readPhotoBytes(file);const url=memoryImageUrl(bytes,file.type);urls.current.add(url);
        return {id:crypto.randomUUID(),url,name:file.name,file,slot,draftFile:{name:file.name,type:file.type,lastModified:file.lastModified,bytes}};
      })));
      await Promise.all(candidates.map(photo => new Promise<void>((resolve,reject) => {
        const image = new window.Image();
        const timeout = window.setTimeout(() => { image.src = ""; reject(new Error("照片读取超时，请重新选择。")); },5000);
        image.src = photo.url;
        image.decode().then(() => { if (image.naturalWidth && image.naturalHeight) resolve(); else reject(new Error("照片无法读取。")); },() => reject(new Error("照片损坏或格式无法预览，请改用 JPG / PNG。"))).finally(() => window.clearTimeout(timeout));
      })));
      if (epoch !== generation.current.version || attempt !== slotsVersion.current[slot]) { candidates.forEach(photo => revoke(photo.url)); return; }
      // Revoke previous previews only after all replacement images decode successfully.
      const replacing = slot === "other" ? [] : photos.filter(photo => photo.slot === slot);
      replacing.forEach(photo => { revoke(photo.url); sourceFiles.current.delete(photo.id); });
      candidates.forEach((photo, index) => sourceFiles.current.set(photo.id, selected[index]));
      setPhotos(current => [...current.filter(photo => !replacing.some(old => old.id === photo.id)), ...candidates]);
    } catch (failure) {
      candidates.forEach(photo => revoke(photo.url));
      if (epoch === generation.current.version && attempt === slotsVersion.current[slot]) setError(failure instanceof Error ? failure.message : "照片无法读取。");
    } finally {
      if (epoch === generation.current.version && attempt === slotsVersion.current[slot]) setPending(current => current.filter(item => item !== slot));
    }
  };
  const encode = async (): Promise<IntakePhotoAttachment[]> => {
    if (pending.length) throw new Error("照片正在读取，请稍候。");
    const refs = photos.map(({ id, slot }) => ({ id, slot }));
    if (!validIntakePhotos(refs)) throw new Error("请重新核对照片数量与位置。");
    const epoch = generation.current.version;
    const attachments: IntakePhotoAttachment[] = [];
    for (const photo of refs) {
      const file = sourceFiles.current.get(photo.id);
      if (!file) throw new Error("照片来源已变化，请重新选择。");
      attachments.push(await encodeJpeg(file, photo,photos.find(value=>value.id===photo.id)?.draftFile));
      if (epoch !== generation.current.version) throw new Error("接机页面已关闭或重置，请重新核对。");
    }
    return attachments;
  };
  const draftPhotos=photos.map(({id,name,slot,draftFile})=>({id,name,slot,file:draftFile}));
  const restore=(saved:typeof draftPhotos)=>{
    if(!Array.isArray(saved) || !validIntakePhotos(saved.map(({id,slot})=>({id,slot}))) || saved.some(photo=>!photo.file || !(photo.file.bytes instanceof ArrayBuffer) || typeof photo.file.type!=="string" || typeof photo.file.name!=="string"))throw new Error("照片草稿无法恢复。");
    clear();
    const next=saved.map(photo=>{const stored=photo.file!;const file=new File([stored.bytes],stored.name,{type:stored.type,lastModified:stored.lastModified});const url=memoryImageUrl(stored.bytes,stored.type);urls.current.add(url);sourceFiles.current.set(photo.id,file);return {...photo,file,draftFile:stored,url};});
    setPhotos(next);
  };
  return { photos, error, pending, add, remove, clear, encode, draftPhotos, restore };
}
export function IntakePhotos({ photos, add, remove, error, pending }: Pick<ReturnType<typeof useIntakePhotos>, "photos" | "add" | "remove" | "error" | "pending">) {
  return <section className="intake-photos" aria-label="接机照片"><strong className="intake-field-title">接机照片</strong><div className="intake-photos__grid">{slots.map(slot => { const selected = photos.filter(photo => photo.slot === slot.value); return <div className="intake-photo-slot" key={slot.value} aria-busy={pending.includes(slot.value)}>
    <label className="intake-photo-slot__upload">{selected.length ? <><span className="intake-photo-slot__images">{selected.map(photo => <span key={photo.id}><Image unoptimized width={240} height={160} src={photo.url} alt={`${slot.label}照片 ${photo.name}`} onError={event => { event.currentTarget.alt = "此格式无法预览，请改用 JPG / PNG"; }} /></span>)}</span><span>{slot.label} · {pending.includes(slot.value) ? "读取中…" : `${selected.length} 张`}</span></> : <><ImagePlus size={27} /><span>{slot.label}{pending.includes(slot.value) ? " · 读取中…" : ""}</span></>}<input type="file" className="visually-hidden" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple={slot.value === "other"} disabled={pending.includes(slot.value)} aria-label={`上传${slot.label}照片`} onChange={event => { void add(slot.value,Array.from(event.target.files ?? [])); event.target.value = ""; }} /></label>
    <PhotoCapture label={`拍摄${slot.label}照片`} triggerClassName="intake-photo-slot__camera" disabled={pending.includes(slot.value)} onConfirm={file => add(slot.value,[file])} />
    {selected.map(photo => <button className="intake-photo-slot__remove" type="button" key={photo.id} aria-label={`删除${slot.label}照片 ${photo.name}`} onClick={() => remove(photo)}><X size={15} /><span>{photo.name}</span></button>)}
  </div>; })}</div>{error ? <p className="form-error" role="alert">{error}</p> : null}</section>;
}
