"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, Loader2, LogOut, Store, UserPlus } from "lucide-react";
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
import {
  getOnboardingStatus,
  submitOnboardingRequest,
  type OnboardingRequestInput,
} from "@/lib/repairdesk/api";
import { brandGradientStyle, controls, formLayout } from "@/lib/ui-patterns";
import { createClient } from "@/utils/supabase/client";
import { clearBrowserAuthPersistenceCookie } from "@/features/auth/model/auth-persistence";
import {
  buildOnboardingRequestInput,
  getOnboardingRequestSummary,
  getPendingOnboardingRequest,
  onboardingRoleLabels,
  validateOnboardingForm,
} from "@/features/auth/model/onboarding-flow";
import { platformKeys } from "@/features/platform/api/query-keys";

export function OnboardingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<OnboardingRequestInput["request_type"]>("join_store");
  const [storeName, setStoreName] = useState("");
  const [targetStoreId, setTargetStoreId] = useState("");
  const [requestedRole, setRequestedRole] =
    useState<NonNullable<OnboardingRequestInput["requested_role"]>>("technician");

  const statusQuery = useQuery({
    queryKey: platformKeys.onboardingStatus,
    queryFn: getOnboardingStatus,
  });

  const formState = useMemo(
    () => ({ mode, storeName, targetStoreId, requestedRole }),
    [mode, requestedRole, storeName, targetStoreId],
  );
  const latestRequest = useMemo(
    () => getPendingOnboardingRequest(statusQuery.data?.requests),
    [statusQuery.data?.requests],
  );
  const formValidation = useMemo(
    () => validateOnboardingForm(formState, statusQuery.data),
    [formState, statusQuery.data],
  );

  const submitMutation = useMutation({
    mutationFn: (input: OnboardingRequestInput) => submitOnboardingRequest(input),
    onSuccess: async () => {
      toast.success("申请已提交");
      await queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "提交失败"),
  });

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
    submitMutation.mutate(buildOnboardingRequestInput(formState));
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
                {status?.activeStore?.name ?? latestRequest?.target_store_name ?? "RepairDesk"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3">
            <p className="text-xs text-muted-foreground">当前状态</p>
            <p className="mt-1 text-sm font-semibold">
              {status?.activeStore ? "账号已开通" : latestRequest ? "申请待审核" : "等待提交"}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {status?.activeStore
                ? `角色：${status.activeStore.role}`
                : latestRequest
                  ? getOnboardingRequestSummary(latestRequest)
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
        ) : latestRequest ? (
          <section className="glass-card min-w-0 p-4">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 size-5 text-status-warn-foreground" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">申请待审核</h2>
                  <Badge variant="outline">pending</Badge>
                </div>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {getOnboardingRequestSummary(latestRequest)}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <form className="min-w-0 space-y-4" onSubmit={handleSubmit}>
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
                {!status?.availableStores.length ? (
                  <div className="rounded-[var(--radius-lg)] border border-status-warn-foreground/20 bg-status-warn px-3 py-2 text-xs leading-5 text-status-warn-foreground">
                    当前没有可申请加入的店铺。可以创建新店铺，或联系平台管理员先创建店铺。
                  </div>
                ) : null}
                <div className={formLayout.field}>
                  <Label className={formLayout.label}>选择店铺</Label>
                  <Select value={targetStoreId} onValueChange={setTargetStoreId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择已有店铺" />
                    </SelectTrigger>
                    <SelectContent>
                      {(status?.availableStores ?? []).map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    placeholder="例如 ChinaTech Roma"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <Button
              type="submit"
              disabled={submitMutation.isPending || !formValidation.canSubmit}
              className={controls.brandButton}
              style={brandGradientStyle}
            >
              {submitMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Clock3 className="size-4" />
              )}
              提交平台审核
            </Button>
            <p className="text-xs text-muted-foreground">{formValidation.reason}</p>
          </form>
        )}
      </div>
    </main>
  );
}
