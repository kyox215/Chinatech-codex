import { Construction } from "lucide-react";

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <Construction className="size-5" />
      </div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        该模块即将上线 —— 当前演示聚焦于工单页面的视觉与交互。
      </p>
    </div>
  );
}
