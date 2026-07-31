"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, LogOut, MailCheck, Store, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { validateNewPassword } from "@/features/auth/model/auth-errors";
import { clearBrowserAuthPersistenceCookie } from "@/features/auth/model/auth-persistence";
import { platformKeys } from "@/features/platform/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import {
  acceptStoreInvitation,
  getOnboardingStatus,
  updateAccountProfile,
} from "@/lib/repairdesk/api";
import { brandGradientStyle } from "@/lib/ui-patterns";
import { createClient } from "@/utils/supabase/client";

const roleLabels = {
  manager: "管理员",
  technician: "维修人员",
  sales: "前台销售",
  viewer: "只读人员",
  owner: "店主",
} as const;

export function InviteRegistrationScreen({
  invitationId,
  mode,
}: {
  invitationId: string;
  mode: "new" | "existing";
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const statusQuery = useQuery({
    queryKey: platformKeys.onboardingStatus,
    queryFn: getOnboardingStatus,
  });
  const invitation = useMemo(
    () => statusQuery.data?.invitations?.find((item) => item.id === invitationId),
    [invitationId, statusQuery.data?.invitations],
  );
  const effectiveName = displayName.trim() || statusQuery.data?.displayName?.trim() || "";

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!invitation) throw new Error("邀请不存在、已过期或已失效");
      if (mode === "new") {
        if (effectiveName.length < 2) throw new Error("请输入至少 2 个字符的员工姓名");
        const passwordError = validateNewPassword(password, confirmation);
        if (passwordError) throw new Error(passwordError);
        const { error } = await createClient().auth.updateUser({
          password,
          data: { display_name: effectiveName },
        });
        if (error) throw new Error("账号密码设置失败，请重新打开最新邀请邮件后重试");
        await updateAccountProfile({ display_name: effectiveName });
      }
      return acceptStoreInvitation({ id: invitation.id });
    },
    onSuccess: async (context) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus }),
        queryClient.invalidateQueries({ queryKey: storesKeys.context }),
      ]);
      toast.success("员工账号已开通");
      router.replace(context.activeStore ? "/" : "/onboarding");
      router.refresh();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "完成邀请失败");
    },
  });

  const switchAccount = async () => {
    await createClient().auth.signOut();
    clearBrowserAuthPersistenceCookie();
    router.replace(
      `/login?next=${encodeURIComponent(`/invite/complete?id=${invitationId}&mode=${mode}`)}`,
    );
    router.refresh();
  };

  if (statusQuery.isLoading) {
    return (
      <main
        className="grid min-h-svh place-items-center bg-background px-2 py-3 sm:px-4 sm:py-8"
        aria-busy="true"
      >
        <section className="w-full max-w-md space-y-2 rounded-lg border border-border/60 bg-card p-3 sm:space-y-3 sm:p-5">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-11 w-full" />
        </section>
      </main>
    );
  }

  if (statusQuery.isError || !invitation) {
    return (
      <InviteShell title="邀请无法继续" icon={<MailCheck className="size-5" />}>
        <p role="alert" className="text-sm leading-6 text-muted-foreground">
          邀请不存在、已经过期、已被撤销，或者当前登录账号与受邀邮箱不一致。
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 min-h-11 w-full"
          onClick={switchAccount}
        >
          <LogOut className="size-4" /> 切换登录账号
        </Button>
      </InviteShell>
    );
  }

  return (
    <InviteShell
      title={`加入 ${invitation.store_name ?? "店铺"}`}
      icon={<UserPlus className="size-5" />}
    >
      <div className="rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3">
        <div className="flex min-w-0 items-start gap-3">
          <Store className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold">
              {invitation.store_name ?? "RepairDesk"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{roleLabels[invitation.role]}</Badge>
              <span className="break-all text-xs text-muted-foreground">{invitation.email}</span>
            </div>
          </div>
        </div>
      </div>

      {mode === "new" ? (
        <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-display-name">员工姓名</Label>
            <Input
              id="invite-display-name"
              className="min-h-11 text-base"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={statusQuery.data?.displayName || "请输入姓名"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-password">设置登录密码</Label>
            <Input
              id="invite-password"
              type="password"
              className="min-h-11 text-base"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby="invite-password-help"
            />
            <p id="invite-password-help" className="text-xs leading-5 text-muted-foreground">
              至少 8 位；以后可以用受邀邮箱和这个密码登录。
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-password-confirmation">再次输入密码</Label>
            <Input
              id="invite-password-confirmation"
              type="password"
              className="min-h-11 text-base"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          邮箱验证已完成。确认后系统才会按邀请角色开通当前店铺权限。
        </p>
      )}

      <p className="mt-3 text-xs leading-4 text-muted-foreground sm:mt-4 sm:leading-5">
        加入前不能查看该店铺的订单、客户、库存或财务数据。
      </p>
      <Button
        type="button"
        className="mt-3 min-h-11 w-full sm:mt-4"
        style={brandGradientStyle}
        disabled={completeMutation.isPending}
        aria-busy={completeMutation.isPending}
        onClick={() => completeMutation.mutate()}
      >
        {completeMutation.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CheckCircle2 className="size-4" />
        )}
        {completeMutation.isPending
          ? "正在开通…"
          : mode === "new"
            ? "创建账号并加入店铺"
            : "接受邀请并进入店铺"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="mt-2 min-h-11 w-full"
        onClick={switchAccount}
      >
        切换登录账号
      </Button>
    </InviteShell>
  );
}

function InviteShell({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-2 py-3 sm:px-4 sm:py-8">
      <section className="w-full max-w-md rounded-lg border border-border/60 bg-card p-3 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2 sm:mb-5 sm:gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">RepairDesk 员工邀请</p>
            <h1 className="break-words font-display text-xl font-semibold sm:text-2xl">{title}</h1>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}
