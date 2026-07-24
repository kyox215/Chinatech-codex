"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, Loader2, LogOut, RotateCcw, Store, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptStoreInvitation,
  cancelOnboardingRequest,
  createStore,
  getOnboardingStatus,
  redeemStoreInviteLink,
  submitOnboardingRequest,
  type OnboardingRequestInput,
  type StoreCreateInput,
} from "@/lib/repairdesk/api";
import { brandGradientStyle, controls, formLayout } from "@/lib/ui-patterns";
import { createClient } from "@/utils/supabase/client";
import { clearBrowserAuthPersistenceCookie } from "@/features/auth/model/auth-persistence";
import {
  buildOnboardingRequestInput,
  getLatestOnboardingRequest,
  getOnboardingRequestSummary,
  getOnboardingRequestStatusLabel,
  getPendingOnboardingRequest,
  onboardingRoleLabels,
  validateOnboardingForm,
} from "@/features/auth/model/onboarding-flow";
import { platformKeys } from "@/features/platform/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import { CACHE_TIMES } from "@/lib/query-performance";

export function OnboardingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<OnboardingRequestInput["request_type"]>("join_store");
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [targetOwnerEmail, setTargetOwnerEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestedRole, setRequestedRole] =
    useState<NonNullable<OnboardingRequestInput["requested_role"]>>("technician");

  const statusQuery = useQuery({
    queryKey: platformKeys.onboardingStatus,
    queryFn: ({ signal }) => getOnboardingStatus({ signal }),
    staleTime: CACHE_TIMES.shell,
  });

  const formState = useMemo(
    () => ({ mode, storeName, targetOwnerEmail, note: requestNote, requestedRole }),
    [mode, requestNote, requestedRole, storeName, targetOwnerEmail],
  );
  const pendingRequest = useMemo(
    () => getPendingOnboardingRequest(statusQuery.data?.requests),
    [statusQuery.data?.requests],
  );
  const latestRequest = useMemo(
    () => getLatestOnboardingRequest(statusQuery.data?.requests),
    [statusQuery.data?.requests],
  );
  const latestInvitation = statusQuery.data?.invitations?.[0];
  const formValidation = useMemo(
    () => validateOnboardingForm(formState, statusQuery.data),
    [formState, statusQuery.data],
  );

  const joinStoreMutation = useMutation({
    mutationFn: (input: OnboardingRequestInput) => submitOnboardingRequest(input),
    onSuccess: async () => {
      toast.success("申请已提交");
      await queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "提交失败"),
  });
  const createStoreMutation = useMutation({
    mutationFn: (input: StoreCreateInput) => createStore(input),
    onSuccess: async () => {
      removeStoreCreateRequestId();
      toast.success("店铺已创建");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus }),
        queryClient.invalidateQueries({ queryKey: storesKeys.context }),
      ]);
      enterSystem();
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "店铺资料已改变，请重新提交") {
        removeStoreCreateRequestId();
      }
      toast.error(error instanceof Error ? error.message : "创建失败");
    },
  });
  const cancelRequestMutation = useMutation({
    mutationFn: (id: string) => cancelOnboardingRequest({ id }),
    onSuccess: async () => {
      toast.success("申请已撤回");
      await queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "撤回失败"),
  });
  const acceptInvitationMutation = useMutation({
    mutationFn: (id: string) => acceptStoreInvitation({ id }),
    onSuccess: async () => {
      toast.success("邀请已接受");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus }),
        queryClient.invalidateQueries({ queryKey: storesKeys.context }),
      ]);
      enterSystem();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "接受邀请失败"),
  });
  const redeemInviteLinkMutation = useMutation({
    mutationFn: (code: string) => redeemStoreInviteLink({ code }),
    onSuccess: async () => {
      toast.success("邀请码已兑换，请接受邀请");
      setInviteCode("");
      await queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "兑换邀请码失败"),
  });
  const isSubmitting =
    joinStoreMutation.isPending ||
    createStoreMutation.isPending ||
    cancelRequestMutation.isPending ||
    acceptInvitationMutation.isPending ||
    redeemInviteLinkMutation.isPending;

  const signOut = async () => {
    await createClient().auth.signOut();
    clearBrowserAuthPersistenceCookie();
    router.replace("/login");
    router.refresh();
  };

  const enterSystem = () => {
    router.replace(
      statusQuery.data?.isPlatformAdmin && !statusQuery.data.activeStore ? "/platform" : "/",
    );
    router.refresh();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formValidation.canSubmit) {
      toast.error(formValidation.reason);
      return;
    }
    if (formState.mode === "create_store") {
      const requestId = getOrCreateStoreCreateRequestId();
      createStoreMutation.mutate({
        request_id: requestId,
        name: formState.storeName.trim(),
        address: storeAddress.trim() || undefined,
        currency_code: "EUR",
      });
      return;
    }
    joinStoreMutation.mutate(buildOnboardingRequestInput(formState));
  };

  if (statusQuery.isLoading) {
    return (
      <main className="grid min-h-svh place-items-center bg-background px-4 py-8">
        <section className="w-full max-w-xl space-y-3 rounded-lg border border-border/60 bg-card p-5">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </section>
      </main>
    );
  }

  if (statusQuery.isError) {
    return (
      <main className="grid min-h-svh place-items-center bg-background px-4 py-8">
        <section className="w-full max-w-md rounded-lg border border-border/60 bg-card p-5">
          <h1 className="font-display text-xl font-semibold">无法读取账号状态</h1>
          <p className="mt-2 text-sm text-status-danger-foreground">
            {statusQuery.error instanceof Error ? statusQuery.error.message : "请重新登录后再试"}
          </p>
          <Button className="mt-4" variant="outline" onClick={signOut}>
            重新登录
          </Button>
        </section>
      </main>
    );
  }

  const status = statusQuery.data;
  const canEnter = Boolean(status?.activeStore || status?.isPlatformAdmin);

  return (
    <main className="min-h-svh bg-background px-3 py-6 sm:px-6 lg:py-8">
      <div className="mx-auto grid w-full max-w-5xl min-w-0 gap-4 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)] lg:items-start">
        <aside className="glass-card min-w-0 p-4 lg:sticky lg:top-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <Store className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold">账号开通</h1>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {status?.activeStore?.name ??
                  latestInvitation?.store_name ??
                  latestRequest?.target_store_name ??
                  "RepairDesk"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3">
            <p className="text-xs text-muted-foreground">当前状态</p>
            <p className="mt-1 text-sm font-semibold">
              {status?.activeStore
                ? "账号已开通"
                : latestInvitation
                  ? "待接受邀请"
                  : latestRequest
                    ? getOnboardingRequestStatusLabel(latestRequest)
                    : "等待提交"}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {status?.activeStore
                ? `角色：${status.activeStore.role}`
                : latestInvitation
                  ? `邀请加入：${latestInvitation.store_name ?? "店铺"}`
                  : pendingRequest
                    ? getOnboardingRequestSummary(pendingRequest)
                    : latestRequest
                      ? `${getOnboardingRequestStatusLabel(latestRequest)}：${getOnboardingRequestSummary(latestRequest)}`
                      : formValidation.reason}
            </p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {canEnter && (
              <Button
                className={controls.brandButton}
                style={brandGradientStyle}
                onClick={enterSystem}
              >
                <CheckCircle2 className="size-4" />
                进入系统
              </Button>
            )}
            <Button variant="outline" onClick={signOut}>
              <LogOut className="size-4" />
              退出
            </Button>
          </div>
        </aside>

        {status?.activeStore ? (
          <section className="glass-card min-w-0 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 text-status-success-foreground" />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">账号已开通</h2>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  你已加入 {status.activeStore.name}，角色为 {status.activeStore.role}。
                </p>
              </div>
            </div>
          </section>
        ) : latestInvitation ? (
          <section className="glass-card min-w-0 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <UserPlus className="mt-0.5 size-5 text-primary" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">待接受邀请</h2>
                  <Badge variant="outline">
                    {latestInvitation.role === "owner"
                      ? "owner"
                      : (onboardingRoleLabels[latestInvitation.role] ?? latestInvitation.role)}
                  </Badge>
                </div>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {latestInvitation.store_name ?? "店铺"} 邀请你加入。接受前不会开通店铺权限。
                </p>
              </div>
              <Button
                type="button"
                className="w-full shrink-0 sm:ml-auto sm:w-auto"
                disabled={acceptInvitationMutation.isPending}
                onClick={() => acceptInvitationMutation.mutate(latestInvitation.id)}
              >
                {acceptInvitationMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                接受邀请
              </Button>
            </div>
          </section>
        ) : pendingRequest ? (
          <section className="glass-card min-w-0 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <Clock3 className="mt-0.5 size-5 text-status-warn-foreground" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">申请待审核</h2>
                  <Badge variant="outline">pending</Badge>
                </div>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {getOnboardingRequestSummary(pendingRequest)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full shrink-0 sm:ml-auto sm:w-auto"
                disabled={cancelRequestMutation.isPending}
                onClick={() => cancelRequestMutation.mutate(pendingRequest.id)}
              >
                {cancelRequestMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                撤回申请
              </Button>
            </div>
          </section>
        ) : (
          <form className="min-w-0 space-y-4" onSubmit={handleSubmit}>
            {latestRequest && latestRequest.status !== "approved" && (
              <section className="glass-card min-w-0 p-4">
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 size-5 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold">
                        {getOnboardingRequestStatusLabel(latestRequest)}
                      </h2>
                      <Badge variant="outline">{latestRequest.status}</Badge>
                    </div>
                    <p className="mt-1 break-words text-sm text-muted-foreground">
                      {getOnboardingRequestSummary(latestRequest)}
                    </p>
                    {latestRequest.decision_note && (
                      <p className="mt-2 rounded-[var(--radius-lg)] border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2 text-sm text-foreground">
                        {latestRequest.decision_note}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}
            <Tabs value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="join_store">
                  <UserPlus className="mr-1.5 size-4" />
                  加入店铺
                </TabsTrigger>
                <TabsTrigger value="create_store">
                  <Store className="mr-1.5 size-4" />
                  创建店铺
                </TabsTrigger>
              </TabsList>

              <TabsContent value="join_store" className="glass-card space-y-4 p-4">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <Label htmlFor="inviteCode" className={formLayout.label}>
                    邀请码
                  </Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Input
                      id="inviteCode"
                      value={inviteCode}
                      onChange={(event) => setInviteCode(event.target.value)}
                      placeholder="粘贴店铺邀请码"
                      autoComplete="off"
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        const code = inviteCode.trim();
                        if (code) redeemInviteLinkMutation.mutate(code);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={redeemInviteLinkMutation.isPending || inviteCode.trim().length < 12}
                      onClick={() => redeemInviteLinkMutation.mutate(inviteCode.trim())}
                    >
                      {redeemInviteLinkMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      兑换
                    </Button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    兑换后会生成待接受邀请，不会直接开通店铺权限。
                  </p>
                </div>
                <div className={formLayout.field}>
                  <Label htmlFor="targetOwnerEmail" className={formLayout.label}>
                    店铺负责人邮箱
                  </Label>
                  <Input
                    id="targetOwnerEmail"
                    type="email"
                    value={targetOwnerEmail}
                    onChange={(event) => setTargetOwnerEmail(event.target.value)}
                    placeholder="例如 owner@example.com"
                    autoComplete="email"
                  />
                </div>
                <div className={formLayout.field}>
                  <Label className={formLayout.label}>申请角色</Label>
                  <Select
                    value={requestedRole}
                    onValueChange={(value) => setRequestedRole(value as typeof requestedRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(onboardingRoleLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={formLayout.field}>
                  <Label htmlFor="requestNote" className={formLayout.label}>
                    申请备注
                  </Label>
                  <Textarea
                    id="requestNote"
                    value={requestNote}
                    onChange={(event) => setRequestNote(event.target.value)}
                    placeholder="说明你是谁、要加入哪家店，方便负责人确认"
                    rows={3}
                  />
                </div>
                <div className="rounded-[var(--radius-lg)] border border-primary/15 bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  系统不会展示已有店铺列表。申请提交后等待店铺负责人确认；如果负责人看不到申请，请让负责人发送邀请或邀请码。
                </div>
              </TabsContent>

              <TabsContent value="create_store" className="glass-card space-y-4 p-4">
                <div className={formLayout.field}>
                  <Label htmlFor="storeName" className={formLayout.label}>
                    店铺名称
                  </Label>
                  <Input
                    id="storeName"
                    value={storeName}
                    onChange={(event) => setStoreName(event.target.value)}
                    placeholder="例如 Centro Riparazioni Roma"
                  />
                </div>
                <div className={formLayout.field}>
                  <Label htmlFor="storeAddress" className={formLayout.label}>
                    默认打印地址（可选）
                  </Label>
                  <Textarea
                    id="storeAddress"
                    value={storeAddress}
                    maxLength={500}
                    onChange={(event) => setStoreAddress(event.target.value)}
                    placeholder="例如 Via Roma 12, Siracusa"
                    rows={2}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    维修工单、批量工单和二手销售票据使用此地址；留空时客户输出保持暂停，创建后可在设置中补充。
                  </p>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-primary/15 bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  创建后你会成为该店铺 owner。店铺资料默认只对本店成员可见，不进入平台审核队列。
                </div>
              </TabsContent>
            </Tabs>

            <Button
              type="submit"
              disabled={isSubmitting || !formValidation.canSubmit}
              className={controls.brandButton}
              style={brandGradientStyle}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {mode === "create_store" ? "创建店铺" : latestRequest ? "重新提交申请" : "提交申请"}
            </Button>
            <p className="text-xs text-muted-foreground">{formValidation.reason}</p>
          </form>
        )}
      </div>
    </main>
  );
}

const STORE_CREATE_REQUEST_ID_KEY = "repairdesk-create-store-request-id";

function getOrCreateStoreCreateRequestId() {
  try {
    const existing = window.sessionStorage.getItem(STORE_CREATE_REQUEST_ID_KEY);
    if (existing) return existing;
    const requestId = crypto.randomUUID();
    window.sessionStorage.setItem(STORE_CREATE_REQUEST_ID_KEY, requestId);
    return requestId;
  } catch {
    return crypto.randomUUID();
  }
}

function removeStoreCreateRequestId() {
  try {
    window.sessionStorage.removeItem(STORE_CREATE_REQUEST_ID_KEY);
  } catch {
    // Storage may be unavailable in restricted/private browser contexts.
  }
}
