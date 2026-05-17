import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="glass-card max-w-md p-8 text-center">
        <h1 className="gradient-text font-display text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">页面未找到</h2>
        <p className="mt-2 text-sm text-muted-foreground">您访问的页面不存在或已被移除。</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-primary-foreground"
          style={{ background: "var(--gradient-brand)" }}
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
