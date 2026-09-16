"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/shared/i18n/locale-provider";
import { useCompactEditorSession } from "@/shared/lib/use-compact-editor-session";

/** Customer CAS adds an explicit rebase boundary without changing other editors. */
export function useCustomerEditorSession<T>(props: {
  open: boolean;
  scopeKey: string;
  initial: T;
  version?: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}) {
  const [epoch, setEpoch] = useState(0);
  const [baselineVersion, setBaselineVersion] = useState(props.version);
  const [conflict, setConflict] = useState(false);
  const opening = useRef<string | null>(null);
  const session = useCompactEditorSession({ ...props, scopeKey: `${props.scopeKey}:${epoch}` });
  useEffect(() => {
    if (!props.open) {
      opening.current = null;
      return;
    }
    if (opening.current !== props.scopeKey) {
      opening.current = props.scopeKey;
      setBaselineVersion(props.version);
      setConflict(false);
      return;
    }
    if (props.version === baselineVersion || conflict) return;
    if (session.dirty || props.busy) setConflict(true);
    else {
      setBaselineVersion(props.version);
      setEpoch((value) => value + 1);
    }
  }, [
    props.open,
    props.scopeKey,
    props.version,
    props.busy,
    baselineVersion,
    conflict,
    session.dirty,
  ]);
  const blocked = !baselineVersion || conflict || props.version !== baselineVersion;
  return {
    ...session,
    blocked,
    conflict,
    reload: () => {
      if (props.busy) return;
      if (!props.version || (conflict && props.version === baselineVersion)) {
        props.onRefresh?.();
        return;
      }
      setBaselineVersion(props.version);
      setConflict(false);
      setEpoch((value) => value + 1);
    },
    save: async (callback: (draft: T) => Promise<unknown>) => {
      if (blocked) return;
      await session.save(async (draft) => {
        try {
          return await callback(draft);
        } catch (error) {
          if (error && typeof error === "object" && "status" in error && error.status === 409) {
            setConflict(true);
            props.onRefresh?.();
          }
          throw error;
        }
      });
    },
  };
}

export function CustomerVersionNotice({
  blocked,
  conflict,
  reload,
  busy,
  deletion = false,
}: {
  deletion?: boolean;
  blocked: boolean;
  conflict: boolean;
  reload: () => void;
  busy: boolean;
}) {
  const { locale } = useLocale();
  const copy = {
    "zh-CN": {
      conflict: "资料已在其他位置更新。草稿已保留，保存已暂停。载入最新版本会替换当前草稿。",
      missing: "缺少资料版本，请刷新后再编辑。",
      deleteConflict: "设备资料已更新，删除已暂停。载入最新版本后请重新确认删除。",
      deleteMissing: "缺少设备版本，请刷新后再删除。",
      reload: "载入最新版本",
    },
    en: {
      conflict:
        "This record changed elsewhere. Your draft is kept and saving is paused. Loading the latest version replaces your draft.",
      missing: "The record version is missing. Refresh before editing.",
      deleteConflict:
        "The device changed. Deletion is paused. Load the latest version and confirm deletion again.",
      deleteMissing: "The device version is missing. Refresh before deleting.",
      reload: "Load latest version",
    },
    "it-IT": {
      conflict:
        "Il record è cambiato altrove. La bozza è conservata e il salvataggio è sospeso. Caricare la versione aggiornata sostituisce la bozza.",
      missing: "Versione del record mancante. Aggiorna prima di modificare.",
      deleteConflict:
        "Il dispositivo è cambiato. Eliminazione sospesa. Carica la versione aggiornata e conferma di nuovo.",
      deleteMissing: "Versione del dispositivo mancante. Aggiorna prima di eliminare.",
      reload: "Carica ultima versione",
    },
  }[locale];
  if (!blocked) return null;
  return (
    <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm">
      <p>
        {deletion
          ? conflict
            ? copy.deleteConflict
            : copy.deleteMissing
          : conflict
            ? copy.conflict
            : copy.missing}
      </p>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 whitespace-normal"
        disabled={busy}
        onClick={reload}
      >
        {copy.reload}
      </Button>
    </div>
  );
}
