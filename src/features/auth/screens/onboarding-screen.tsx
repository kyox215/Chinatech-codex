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
import { brandGradientStyle, controls, formLayout, pageHeader, pageShell } from "@/lib/ui-patterns";
import { createClient } from "@/utils/supabase/client";
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

  const latestRequest = useMemo(
    () => statusQuery.data?.requests.find((request) => request.status === "pending"),
    [statusQuery.data?.requests],
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
    submitMutation.mutate(
      mode === "create_store"
        ? { request_type: "create_store", desired_store_name: storeName }
        : {
            request_type: "join_store",
            target_store_id: targetStoreId,
            requested_role: requestedRole,
          },
    );
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
    <main className="min-h-svh bg-background px-3 py-6 sm:px-6">
      <div className={pageShell.form}>
        <header className={pageHeader.root}>
          <div>
            <p className={pageHeader.eyebrow}>RepairDesk / 账号开通</p>
            <h1 className={pageHeader.compactTitle}>店铺访问申请</h1>
            <p className={pageHeader.subtitle}>
              {status?.email || "当前账号"} · {status?.displayName}
            </p>
          </div>
          <div className={pageHeader.actions}>
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
        </header>

        {status?.activeStore ? (
          <section className="glass-card mt-5 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 text-status-success-foreground" />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">账号已开通</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  你已加入 {status.activeStore.name}，角色为 {status.activeStore.role}。
                </p>
              </div>
            </div>
          </section>
        ) : latestRequest ? (
          <section className="glass-card mt-5 p-4">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 size-5 text-status-warn-foreground" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">申请待审核</h2>
                  <Badge variant="outline">pending</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {latestRequest.request_type === "create_store"
                    ? `创建店铺：${latestRequest.desired_store_name}`
                    : `加入店铺：${latestRequest.target_store_name || latestRequest.target_store_id}`}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
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
                      <SelectItem value="technician">维修员工</SelectItem>
                      <SelectItem value="sales">销售/前台</SelectItem>
                      <SelectItem value="manager">店铺经理</SelectItem>
                      <SelectItem value="viewer">只读查看</SelectItem>
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
              disabled={submitMutation.isPending}
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
          </form>
        )}
      </div>
    </main>
  );
}
