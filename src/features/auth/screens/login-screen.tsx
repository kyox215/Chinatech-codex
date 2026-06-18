"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, LogIn, MapPin, Store, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getOnboardingStatus } from "@/lib/repairdesk/api";
import { createClient } from "@/utils/supabase/client";
import { brandGradientStyle, controls } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";
import {
  DEFAULT_REMEMBER_LOGIN,
  persistBrowserAuthPreference,
  readRememberLoginPreference,
} from "@/features/auth/model/auth-persistence";
import { resolvePostLoginPath } from "@/features/auth/model/post-login-redirect";

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/", [searchParams]);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [rememberMe, setRememberMe] = useState(DEFAULT_REMEMBER_LOGIN);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setRememberMe(readRememberLoginPreference());
  }, []);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    persistBrowserAuthPreference(rememberMe);
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
    router.replace(resolvePostLoginPath(status, next));
    router.refresh();
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    persistBrowserAuthPreference(rememberMe);
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
    <main className="min-h-svh bg-background px-4 py-8 lg:grid lg:place-items-center">
      <div className="mx-auto grid w-full max-w-5xl min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:items-center">
        <section className="hidden min-w-0 lg:block">
          <div className="max-w-xl space-y-5">
            <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <Store className="size-6" />
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium text-primary">Chinatech</p>
              <h2 className="font-display text-4xl font-semibold tracking-tight text-foreground">
                RepairDesk
              </h2>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                Viale Vittorio Veneto 7, 96014 Floridia, Siracusa
              </p>
            </div>
            <div className="grid max-w-lg grid-cols-2 gap-3 text-sm">
              <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel)] p-3">
                <p className="text-xs text-muted-foreground">门店</p>
                <p className="mt-1 truncate font-medium">Chinatech</p>
              </div>
              <div className="min-w-0 rounded-lg border border-[var(--border-panel)] bg-[var(--surface-panel)] p-3">
                <p className="text-xs text-muted-foreground">地区</p>
                <p className="mt-1 flex min-w-0 items-center gap-1.5 font-medium">
                  <MapPin className="size-3.5 shrink-0 text-primary" />
                  <span className="truncate">Floridia</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full rounded-lg border border-border/60 bg-card p-5 shadow-sm lg:justify-self-end">
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
                <RememberLoginCheckbox checked={rememberMe} onCheckedChange={setRememberMe} />
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
                <RememberLoginCheckbox checked={rememberMe} onCheckedChange={setRememberMe} />
                <SubmitButton isSubmitting={isSubmitting} icon="register">
                  注册并继续申请
                </SubmitButton>
              </form>
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </main>
  );
}

function RememberLoginCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="remember-login"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <Label htmlFor="remember-login" className="cursor-pointer text-sm font-normal">
        记住登录状态
      </Label>
    </div>
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
