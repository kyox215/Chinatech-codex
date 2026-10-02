"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { PhotoCapture } from "@/components/photo-capture";
import { intakePhotoError } from "@/lib/repair-intake";
export type IntakePhoto = { id: string; url: string; name: string; slot: "front" | "back" | "other" };
const slots = [{ value: "front", label: "正面" }, { value: "back", label: "背面" }, { value: "other", label: "其他" }] as const;
export function useIntakePhotos() {
  const [photos, setPhotos] = useState<IntakePhoto[]>([]);
  const urls = useRef(new Set<string>());
  const generation = useRef({ version: 0 });
  const slotsVersion = useRef({ front: 0, back: 0, other: 0 });
  const [error, setError] = useState("");
  const [pending, setPending] = useState<IntakePhoto["slot"][]>([]);
  useEffect(() => { const current = urls.current; const lifecycle = generation.current; return () => { lifecycle.version++; current.forEach(url => URL.revokeObjectURL(url)); current.clear(); }; }, []);
  const revoke = (url: string) => { URL.revokeObjectURL(url); urls.current.delete(url); };
  const remove = (photo: IntakePhoto) => { revoke(photo.url); setPhotos(current => current.filter(item => item.id !== photo.id)); setError(""); };
  const clear = () => { generation.current.version++; urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); setPhotos([]); setPending([]); setError(""); };
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
    const candidates = selected.map(file => { const url = URL.createObjectURL(file); urls.current.add(url); return { id: crypto.randomUUID(), url, name: file.name, slot }; });
    try {
      await Promise.all(candidates.map(photo => new Promise<void>((resolve,reject) => {
        const image = new window.Image();
        const timeout = window.setTimeout(() => { image.src = ""; reject(new Error("照片读取超时，请重新选择。")); },5000);
        image.src = photo.url;
        image.decode().then(() => { if (image.naturalWidth && image.naturalHeight) resolve(); else reject(new Error("照片无法读取。")); },() => reject(new Error("照片损坏或格式无法预览，请改用 JPG / PNG。"))).finally(() => window.clearTimeout(timeout));
      })));
      if (epoch !== generation.current.version || attempt !== slotsVersion.current[slot]) { candidates.forEach(photo => revoke(photo.url)); return; }
      // Revoke previous previews only after all replacement images decode successfully.
      const replacing = slot === "other" ? [] : photos.filter(photo => photo.slot === slot);
      replacing.forEach(photo => revoke(photo.url));
      setPhotos(current => [...current.filter(photo => !replacing.some(old => old.id === photo.id)), ...candidates]);
    } catch (failure) {
      candidates.forEach(photo => revoke(photo.url));
      if (epoch === generation.current.version && attempt === slotsVersion.current[slot]) setError(failure instanceof Error ? failure.message : "照片无法读取。");
    } finally {
      if (epoch === generation.current.version && attempt === slotsVersion.current[slot]) setPending(current => current.filter(item => item !== slot));
    }
  };
  return { photos, error, pending, add, remove, clear };
}
export function IntakePhotos({ photos, add, remove, error, pending }: Pick<ReturnType<typeof useIntakePhotos>, "photos" | "add" | "remove" | "error" | "pending">) {
  return <section className="intake-photos" aria-label="接机照片"><strong className="intake-field-title">接机照片</strong><div className="intake-photos__grid">{slots.map(slot => { const selected = photos.filter(photo => photo.slot === slot.value); return <div className="intake-photo-slot" key={slot.value} aria-busy={pending.includes(slot.value)}>
    <label className="intake-photo-slot__upload">{selected.length ? <><span className="intake-photo-slot__images">{selected.map(photo => <span key={photo.id}><Image unoptimized width={240} height={160} src={photo.url} alt={`${slot.label}照片 ${photo.name}`} onError={event => { event.currentTarget.alt = "此格式无法预览，请改用 JPG / PNG"; }} /></span>)}</span><span>{slot.label} · {pending.includes(slot.value) ? "读取中…" : `${selected.length} 张`}</span></> : <><ImagePlus size={27} /><span>{slot.label}{pending.includes(slot.value) ? " · 读取中…" : ""}</span></>}<input type="file" className="visually-hidden" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple={slot.value === "other"} disabled={pending.includes(slot.value)} aria-label={`上传${slot.label}照片`} onChange={event => { void add(slot.value,Array.from(event.target.files ?? [])); event.target.value = ""; }} /></label>
    <PhotoCapture label={`拍摄${slot.label}照片`} triggerClassName="intake-photo-slot__camera" disabled={pending.includes(slot.value)} onConfirm={file => add(slot.value,[file])} />
    {selected.map(photo => <button className="intake-photo-slot__remove" type="button" key={photo.id} aria-label={`删除${slot.label}照片 ${photo.name}`} onClick={() => remove(photo)}><X size={15} /><span>{photo.name}</span></button>)}
  </div>; })}</div>{error ? <p className="form-error" role="alert">{error}</p> : null}</section>;
}
