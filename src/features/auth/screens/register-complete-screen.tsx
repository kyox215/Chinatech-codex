"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getOnboardingStatus } from "@/lib/repairdesk/api";
import { brandGradientStyle } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { platformKeys } from "@/features/platform/api/query-keys";
import { resolvePostLoginPath } from "@/features/auth/model/post-login-redirect";

export function RegisterCompleteScreen() {
  const router = useRouter();
  const { data: status, isLoading } = useQuery({
    queryKey: platformKeys.onboardingStatus,
    queryFn: getOnboardingStatus,
  });
  const nextPath = useMemo(() => resolvePostLoginPath(status, "/onboarding"), [status]);

  return (
    <main className="min-h-svh bg-background px-4 py-8 lg:grid lg:place-items-center">
      <section className="mx-auto w-full max-w-md rounded-lg border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">注册已完成</h1>
            <p className="text-sm text-muted-foreground">邮箱验证成功，可以继续开通店铺。</p>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] p-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn("grid size-9 shrink-0 place-items-center rounded-md text-white")}
              style={brandGradientStyle}
            >
              <Store className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">下一步</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                继续完成店铺创建、加入申请或邀请确认；未通过店铺审批前不会开放业务数据。
              </p>
            </div>
          </div>
        </div>

        <Button
          type="button"
          className="mt-4 w-full gap-2"
          disabled={isLoading}
          style={brandGradientStyle}
          onClick={() => {
            router.replace(nextPath);
            router.refresh();
          }}
        >
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Store className="size-4" />}
          继续店铺开通
        </Button>
      </section>
    </main>
  );
}
