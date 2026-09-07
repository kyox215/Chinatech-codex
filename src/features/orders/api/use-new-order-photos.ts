"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOrder, uploadOrderAttachment } from "@/lib/repairdesk/api";
import {
  revokeAttachmentDraft,
  type AttachmentDraft,
} from "@/features/capture/model/attachment-rules";

export type NewOrderPhoto = AttachmentDraft & {
  uploadState: "pending" | "uploading" | "uploaded" | "failed" | "uncertain";
};
export type NewOrderPhotoState = "idle" | "uploading" | "blocked" | "partial" | "complete";

/** Files stay in this mounted form; neither its serializable draft nor the offline outbox owns them. */
export function useNewOrderPhotos(scope: string | null, sessionActive: boolean) {
  const [photos, setPhotos] = useState<NewOrderPhoto[]>([]);
  const [state, setState] = useState<NewOrderPhotoState>("idle");
  const photosRef = useRef(photos);
  const orderIdRef = useRef<string | null>(null);
  const scopeRef = useRef(scope);
  const activeRef = useRef(sessionActive);
  const mounted = useRef(true);
  const running = useRef(false);
  const generation = useRef(0);
  if (scopeRef.current !== scope || activeRef.current !== sessionActive) generation.current += 1;
  scopeRef.current = scope;
  activeRef.current = sessionActive;
  const update = useCallback((next: NewOrderPhoto[]) => {
    photosRef.current = next;
    if (mounted.current) setPhotos(next);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      photosRef.current.forEach(revokeAttachmentDraft);
    };
  }, []);
  const add = useCallback(
    (draft: AttachmentDraft) => {
      if (!activeRef.current || orderIdRef.current || running.current) {
        revokeAttachmentDraft(draft);
        return;
      }
      update([...photosRef.current, { ...draft, uploadState: "pending" }]);
    },
    [update],
  );
  const remove = useCallback(
    (id: string) => {
      if (running.current || orderIdRef.current) return;
      const photo = photosRef.current.find((item) => item.id === id);
      if (photo) revokeAttachmentDraft(photo);
      update(photosRef.current.filter((item) => item.id !== id));
    },
    [update],
  );
  const discard = useCallback(() => {
    if (running.current) return;
    photosRef.current.forEach(revokeAttachmentDraft);
    update([]);
  }, [update]);
  const upload = useCallback(
    async (orderId: string): Promise<boolean> => {
      if (running.current || (orderIdRef.current && orderIdRef.current !== orderId)) return false;
      orderIdRef.current = orderId;
      const runScope = scopeRef.current;
      const runGeneration = generation.current;
      const current = () =>
        mounted.current &&
        activeRef.current &&
        generation.current === runGeneration &&
        Boolean(runScope) &&
        scopeRef.current === runScope;
      if (!current()) return false;
      if (!photosRef.current.length) return true;
      running.current = true;
      setState("uploading");
      const patch = (id: string, uploadState: NewOrderPhoto["uploadState"]) => {
        update(
          photosRef.current.map((photo) => (photo.id === id ? { ...photo, uploadState } : photo)),
        );
      };
      try {
        const detail = await getOrder(orderId);
        if (!current()) return false;
        if (detail.capabilities?.canUploadPhoto !== true) {
          setState("blocked");
          return false;
        }
        for (const photo of photosRef.current) {
          // A dispatched request can have committed even when its response is lost. Never retry it automatically.
          if (photo.uploadState === "uploaded" || photo.uploadState === "uncertain") continue;
          if (!current()) return false;
          let data: string;
          try {
            data = await readNewOrderPhotoBase64(photo.file);
          } catch {
            patch(photo.id, "failed");
            continue;
          }
          if (!current()) return false;
          patch(photo.id, "uploading");
          try {
            await uploadOrderAttachment(orderId, {
              kind: photo.kind,
              file_name: photo.name,
              mime_type: photo.mimeType,
              file_size: photo.size,
              data_base64: data,
            });
            if (!mounted.current) return false;
            patch(photo.id, "uploaded");
          } catch {
            if (!mounted.current) return false;
            patch(photo.id, "uncertain");
            break;
          }
        }
        if (!current()) return false;
        const complete = photosRef.current.every((photo) => photo.uploadState === "uploaded");
        setState(complete ? "complete" : "partial");
        return complete;
      } catch {
        if (mounted.current) setState("blocked");
        return false;
      } finally {
        running.current = false;
        if (mounted.current && !current()) setState("blocked");
      }
    },
    [update],
  );
  return {
    photos,
    state,
    add,
    remove,
    discard,
    upload,
    hasUnsaved: photos.some((photo) => photo.uploadState !== "uploaded"),
    canRetry:
      state !== "uploading" &&
      photos.some((photo) => photo.uploadState === "pending" || photo.uploadState === "failed"),
  };
}

export function readNewOrderPhotoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result ?? "").split(",")[1];
      if (data) resolve(data);
      else reject(new Error("Empty photo"));
    };
    reader.onerror = () => reject(new Error("Photo could not be read"));
    reader.onabort = () => reject(new Error("Photo read interrupted"));
    reader.readAsDataURL(file);
  });
}
