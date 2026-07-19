"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  lifecycleMfaRequired,
  verifyRecentLifecycleAal2,
} from "@/features/settings/model/store-lifecycle-mfa";
import { refreshStoreContextQueries } from "@/features/stores/api/tenant-cache";
import { storesKeys } from "@/features/stores/api/query-keys";
import {
  getStoreLifecycleState,
  issueStoreLifecycleChallenge,
  renameStoreWorkspace,
} from "@/lib/repairdesk/api";
import type { ActorStoreMembership, StoreLifecycleActionCapability } from "@/lib/repairdesk/types";
import { componentOverlay } from "@/lib/component-patterns";

export function StoreRenameOverlay({
  store,
  capability,
  hasUnsavedProfileDraft,
}: {
  store: ActorStoreMembership;
  capability: StoreLifecycleActionCapability;
  hasUnsavedProfileDraft: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(store.name);
  const [syncCustomerName, setSyncCustomerName] = useState(!hasUnsavedProfileDraft);
  const [totpCode, setTotpCode] = useState("");
  const [operationId, setOperationId] = useState("");
  const lifecycleQuery = useQuery({
    queryKey: storesKeys.lifecycle(store.id),
    queryFn: () => getStoreLifecycleState(store.id),
    enabled: open && capability.allowed,
  });

  useEffect(() => {
    if (!open) return;
    setName(store.name);
    setSyncCustomerName(!hasUnsavedProfileDraft);
    setTotpCode("");
    setOperationId(crypto.randomUUID());
  }, [hasUnsavedProfileDraft, open, store.name]);

  const mutation = useMutation({
    mutationFn: async () => {
      const lifecycle = lifecycleQuery.data;
      if (!lifecycle) throw new Error("店铺状态还没有读取完成");
      await verifyRecentLifecycleAal2(totpCode);
      const challenge = await issueStoreLifecycleChallenge({
        expectedStoreId: store.id,
        expectedRevision: lifecycle.revision,
        operationKind: "rename",
      });
      return renameStoreWorkspace({
        expectedStoreId: store.id,
        expectedRevision: lifecycle.revision,
        operationId,
        reauthChallengeId: challenge.id,
        name: name.trim(),
        syncCustomerFacingName: syncCustomerName,
      });
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(storesKeys.lifecycle(store.id), result.lifecycle);
      await refreshStoreContextQueries(queryClient);
      toast.success("店铺名称已修改");
      setOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "修改店铺名称失败"),
    onSettled: () => setTotpCode(""),
  });

  const requiresTotp = lifecycleMfaRequired();
  const ready =
    capability.allowed &&
    Boolean(lifecycleQuery.data) &&
    name.trim().length >= 2 &&
    name.trim() !== store.name &&
    Boolean(operationId) &&
    (!requiresTotp || totpCode.length === 6) &&
    !mutation.isPending;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-10 gap-1.5"
        disabled={!capability.allowed}
        onClick={() => setOpen(true)}
      >
        <PencilLine className="size-3.5" aria-hidden="true" />
        修改名称
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!mutation.isPending) setOpen(next);
        }}
      >
        <DialogContent
          className={componentOverlay.modalSm}
          showCloseButton={!mutation.isPending}
          onEscapeKeyDown={(event) => {
            if (mutation.isPending) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (mutation.isPending) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>修改店铺名称</DialogTitle>
            <DialogDescription>只修改名称，不会关闭店铺或移动任何资料。</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-4 overflow-y-auto">
            <div className="rounded-xl border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2.5">
              <p className="text-xs text-muted-foreground">当前名称</p>
              <p className="mt-1 break-words text-sm font-semibold">{store.name}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-workspace-new-name">新名称</Label>
              <Input
                id="store-workspace-new-name"
                value={name}
                maxLength={80}
                autoFocus
                disabled={mutation.isPending}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <label className="flex items-start gap-2 text-sm leading-5">
              <input
                type="checkbox"
                className="mt-1"
                checked={syncCustomerName}
                disabled={hasUnsavedProfileDraft || mutation.isPending}
                onChange={(event) => setSyncCustomerName(event.target.checked)}
              />
              <span>同时更新收据和客户消息显示名称</span>
            </label>
            {hasUnsavedProfileDraft ? (
              <p className="text-xs leading-5 text-status-warn-foreground">
                店铺资料还有未保存修改。请先保存或放弃修改，再同步客户显示名称。
              </p>
            ) : null}
            {requiresTotp ? (
              <div className="space-y-1.5">
                <Label htmlFor="store-rename-totp">身份验证器中的 6 位安全验证码</Label>
                <Input
                  id="store-rename-totp"
                  value={totpCode}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="例如 Google Authenticator 中的验证码"
                  disabled={mutation.isPending}
                  onChange={(event) =>
                    setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </div>
            ) : null}
            {mutation.isError ? (
              <p role="alert" className="text-sm text-status-danger-foreground">
                {mutation.error instanceof Error ? mutation.error.message : "修改失败"}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button type="button" disabled={!ready} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "正在修改…" : "确认修改名称"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
