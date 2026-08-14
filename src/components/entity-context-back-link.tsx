import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EntityContextBack } from "@/shared/config/entity-context-routes";

export function EntityContextBackLink({
  context,
  className,
}: {
  context: EntityContextBack;
  className?: string;
}) {
  return (
    <Link
      href={context.href}
      aria-label={context.label}
      title={context.label}
      data-entity-context-back={context.kind}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
    </Link>
  );
}
