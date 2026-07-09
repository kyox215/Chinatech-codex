"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  authErrorMessage,
  normalizeAuthEmail,
  passwordResetSentMessage,
} from "@/features/auth/model/auth-errors";
import { brandGradientStyle, controls } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

export function ForgotPasswordScreen() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const error = searchParams.get("auth_error");
    if (error === "callback") toast.error("重置链接已失效，请重新发送邮件后再试。");
    if (error === "session") toast.error("请先从邮箱中的重置链接进入修改密码页面。");
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = normalizeAuthEmail(email);
    setIsSubmitting(true);
    const redirectUrl = new URL("/auth/callback", window.location.origin);
    redirectUrl.searchParams.set("next", "/reset-password");
    const { error } = await createClient().auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: redirectUrl.toString(),
    });
    setIsSubmitting(false);

    if (error) {
      toast.error(authErrorMessage(error));
      return;
    }

    setEmail(normalizedEmail);
    setSentTo(normalizedEmail);
    toast.success(passwordResetSentMessage());
  }

  return (
    <main className="grid min-h-svh bg-background px-4 py-8 sm:place-items-center">
      <section className="mx-auto w-full max-w-md self-start rounded-lg border border-border/60 bg-card p-5 shadow-sm sm:self-auto">
        <Link
          href="/login"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          返回登录
        </Link>
        <div className="mb-5 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold">找回密码</h1>
            <p className="text-sm text-muted-foreground">输入账号邮箱，继续通过邮件重置。</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="reset-email">邮箱</Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn("w-full gap-2", controls.brandButton)}
            style={brandGradientStyle}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Mail className="size-4" />
            )}
            发送重置邮件
          </Button>
        </form>

        {sentTo ? (
          <p className="mt-4 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel-muted)] px-3 py-2 text-xs leading-5 text-muted-foreground">
            如果 {sentTo} 已注册，重置邮件会发送到该邮箱。请从邮件链接继续修改密码。
          </p>
        ) : null}
      </section>
    </main>
  );
}
