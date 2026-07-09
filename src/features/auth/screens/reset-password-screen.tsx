"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage, validateNewPassword } from "@/features/auth/model/auth-errors";
import { brandGradientStyle, controls } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

export function ResetPasswordScreen() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateNewPassword(newPassword, newPasswordConfirmation);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setIsSubmitting(false);
      toast.error(authErrorMessage(error));
      return;
    }

    await fetch("/auth/recovery/complete", { method: "POST" }).catch(() => undefined);
    await supabase.auth.signOut();
    toast.success("密码已更新，请使用新密码登录。");
    router.replace("/login?password_updated=1");
    router.refresh();
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
            <h1 className="font-display text-2xl font-semibold">设置新密码</h1>
            <p className="text-sm text-muted-foreground">请设置新的员工账号密码。</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">新密码</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password-confirmation">确认新密码</Label>
            <Input
              id="new-password-confirmation"
              type="password"
              autoComplete="new-password"
              value={newPasswordConfirmation}
              onChange={(event) => setNewPasswordConfirmation(event.target.value)}
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
              <KeyRound className="size-4" />
            )}
            更新密码
          </Button>
        </form>
      </section>
    </main>
  );
}
