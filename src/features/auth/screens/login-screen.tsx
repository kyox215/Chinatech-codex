"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getOnboardingStatus } from "@/lib/repairdesk/api";
import { createClient } from "@/utils/supabase/client";
import { brandGradientStyle, controls } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/", [searchParams]);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (error) {
      toast.error(error.message || "登录失败");
      return;
    }

    const status = await getOnboardingStatus().catch(() => null);
    if (status && !status.activeStore) {
      router.replace(status.isPlatformAdmin ? "/platform" : "/onboarding");
      router.refresh();
      return;
    }

    router.replace(next.startsWith("/") ? next : "/");
    router.refresh();
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName.trim(),
        },
      },
    });
    setIsSubmitting(false);

    if (error) {
      toast.error(error.message || "注册失败");
      return;
    }

    if (!data.session) {
      toast.success("注册已提交，请先完成邮箱确认后再登录");
      setMode("login");
      return;
    }

    router.replace("/onboarding");
    router.refresh();
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background px-4 py-8">
      <section className="w-full max-w-sm rounded-lg border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">RepairDesk 登录</h1>
            <p className="text-sm text-muted-foreground">员工登录或提交新账号开通申请。</p>
          </div>
        </div>

        <Tabs value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form className="space-y-4" onSubmit={handleLogin}>
              <LoginFields
                email={email}
                password={password}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
              />
              <SubmitButton isSubmitting={isSubmitting} icon="login">
                登录
              </SubmitButton>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form className="space-y-4" onSubmit={handleRegister}>
              <div className="space-y-1.5">
                <Label htmlFor="displayName">姓名</Label>
                <Input
                  id="displayName"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </div>
              <LoginFields
                email={email}
                password={password}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                passwordAutoComplete="new-password"
              />
              <SubmitButton isSubmitting={isSubmitting} icon="register">
                注册并继续申请
              </SubmitButton>
            </form>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}

function LoginFields({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  passwordAutoComplete = "current-password",
}: {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  passwordAutoComplete?: string;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
          type="password"
          autoComplete={passwordAutoComplete}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          required
        />
      </div>
    </>
  );
}

function SubmitButton({
  isSubmitting,
  icon,
  children,
}: {
  isSubmitting: boolean;
  icon: "login" | "register";
  children: React.ReactNode;
}) {
  const Icon = icon === "register" ? UserPlus : LogIn;
  return (
    <Button
      type="submit"
      disabled={isSubmitting}
      className={cn("w-full gap-2", controls.brandButton)}
      style={brandGradientStyle}
    >
      {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      {children}
    </Button>
  );
}
