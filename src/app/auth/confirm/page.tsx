import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "确认安全邀请",
  description: "确认 RepairDesk 一次性邮箱邀请",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function AuthConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tokenHash = firstValue(params.token_hash);
  const type = firstValue(params.type);
  const next = firstValue(params.next);
  const valid =
    /^[a-f0-9]{64}$/i.test(tokenHash) &&
    (type === "invite" || type === "magiclink") &&
    Boolean(next);

  return (
    <main className="grid min-h-svh place-items-center bg-background px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-border/60 bg-card p-5 shadow-sm">
        <h1 className="font-display text-2xl font-semibold">
          {valid ? "确认打开员工邀请" : "邀请链接无效"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {valid
            ? "为了避免邮箱安全扫描器提前使用一次性链接，请由你本人点击下面的按钮继续。"
            : "该链接不完整、已经失效或不是 RepairDesk 支持的邀请链接。"}
        </p>

        {valid ? (
          <form action="/auth/confirm/complete" method="post" className="mt-5">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={next} />
            <Button type="submit" className="min-h-11 w-full">
              继续验证邮箱
            </Button>
          </form>
        ) : (
          <Button asChild variant="outline" className="mt-5 min-h-11 w-full">
            <Link href="/login">返回登录</Link>
          </Button>
        )}

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          继续后只会验证你的登录邮箱；店铺权限仍需有效邀请并由你明确接受。
        </p>
      </section>
    </main>
  );
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
