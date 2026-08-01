"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Route } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrderWorkflowStatus, OrderWorkflowTransition } from "@/lib/repairdesk/types";
import { cn } from "@/lib/utils";

export interface OrderWorkflowTransitionsPanelProps {
  statuses: OrderWorkflowStatus[];
  transitions: OrderWorkflowTransition[];
  canEdit: boolean;
  onUpdate: (
    fromStatusCode: string,
    toStatusCode: string,
    patch: { enabled?: boolean; is_primary?: boolean },
  ) => void;
}

export function OrderWorkflowTransitionsPanel({
  statuses,
  transitions,
  canEdit,
  onUpdate,
}: OrderWorkflowTransitionsPanelProps) {
  const [sourceCode, setSourceCode] = useState(statuses[0]?.code ?? "");

  useEffect(() => {
    if (sourceCode && statuses.some((status) => status.code === sourceCode)) return;
    setSourceCode(statuses[0]?.code ?? "");
  }, [sourceCode, statuses]);

  const enabledCount = useMemo(
    () => transitions.filter((transition) => transition.enabled).length,
    [transitions],
  );

  if (!canEdit) {
    return (
      <ReadonlyTransitionSummary
        statuses={statuses}
        transitions={transitions}
        count={enabledCount}
      />
    );
  }

  const panel = (id: string) => (
    <TransitionEditor
      id={id}
      statuses={statuses}
      transitions={transitions}
      sourceCode={sourceCode}
      onSourceChange={setSourceCode}
      onUpdate={onUpdate}
    />
  );

  return (
    <aside className="min-w-0" aria-label="推荐与自动流转规则">
      <details
        data-ui="settings-workflow-transitions"
        className="group rounded-xl border border-[var(--border-panel)] bg-card xl:hidden"
      >
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            <Route className="size-4 shrink-0 text-primary" />
            推荐 / 自动流转规则
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Badge variant="outline">{enabledCount} 条</Badge>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="border-t border-[var(--border-panel)] p-3">
          {panel("workflow-source-compact")}
        </div>
      </details>

      <div
        data-ui="settings-workflow-transitions"
        className="hidden rounded-xl border border-[var(--border-panel)] bg-card p-3 xl:block"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">推荐 / 自动流转规则</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              这些规则驱动推荐动作和自动路径；人工流转仍保留现有可用状态覆盖。
            </p>
          </div>
          <Badge variant="outline" className="shrink-0">
            {enabledCount} 条
          </Badge>
        </div>
        {panel("workflow-source-desktop")}
      </div>
    </aside>
  );
}

function TransitionEditor({
  id,
  statuses,
  transitions,
  sourceCode,
  onSourceChange,
  onUpdate,
}: {
  id: string;
  statuses: OrderWorkflowStatus[];
  transitions: OrderWorkflowTransition[];
  sourceCode: string;
  onSourceChange: (code: string) => void;
  onUpdate: OrderWorkflowTransitionsPanelProps["onUpdate"];
}) {
  const source = statuses.find((status) => status.code === sourceCode);
  const targets = statuses.filter((status) => status.code !== sourceCode);

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={id} className="mb-1.5 block text-xs font-medium">
          来源状态
        </label>
        <Select value={sourceCode} onValueChange={onSourceChange}>
          <SelectTrigger id={id} className="h-[38px] text-base sm:text-sm">
            <SelectValue placeholder="选择来源状态" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((status) => (
              <SelectItem key={status.code} value={status.code}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        为「{source?.label ?? "当前状态"}」勾选推荐目标；每个来源最多一个“推荐下一步”。
      </p>

      <div className="grid gap-2">
        {targets.map((status) => {
          const transition = transitions.find(
            (item) => item.from_status_code === sourceCode && item.to_status_code === status.code,
          );
          const enabled = Boolean(transition?.enabled);
          const primary = Boolean(enabled && transition?.is_primary);
          const unavailable = !status.enabled && !enabled;
          return (
            <div
              key={status.code}
              className={cn(
                "grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[var(--border-panel)] px-3 py-2",
                enabled ? "bg-primary/5" : "bg-surface-muted/35",
              )}
            >
              <Checkbox
                checked={enabled}
                disabled={unavailable}
                className="size-5"
                aria-label={`允许从${source?.label ?? sourceCode}流转到${status.label}`}
                onCheckedChange={(checked) =>
                  onUpdate(sourceCode, status.code, { enabled: Boolean(checked) })
                }
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{status.label}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {status.code}
                  {!status.enabled ? " · 状态已停用" : ""}
                </p>
              </div>
              <Button
                type="button"
                variant={primary ? "default" : "outline"}
                className="min-h-9 px-3"
                disabled={!enabled}
                aria-pressed={primary}
                aria-label={`将${status.label}设为${source?.label ?? sourceCode}的推荐下一步`}
                onClick={() =>
                  onUpdate(sourceCode, status.code, { enabled: true, is_primary: true })
                }
              >
                {primary ? "已推荐" : "设为推荐"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReadonlyTransitionSummary({
  statuses,
  transitions,
  count,
}: {
  statuses: OrderWorkflowStatus[];
  transitions: OrderWorkflowTransition[];
  count: number;
}) {
  const labels = new Map(statuses.map((status) => [status.code, status.label]));
  const enabled = transitions.filter((transition) => transition.enabled);
  return (
    <aside className="rounded-xl border border-[var(--border-panel)] bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">推荐 / 自动流转规则</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            当前账号仅可查看已启用路径。
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {count} 条
        </Badge>
      </div>
      {enabled.length ? (
        <ul className="mt-3 grid gap-2 text-sm">
          {enabled.map((transition) => (
            <li
              key={`${transition.from_status_code}:${transition.to_status_code}`}
              className="rounded-lg bg-surface-muted/50 px-3 py-2"
            >
              {labels.get(transition.from_status_code) ?? transition.from_status_code}
              <span aria-hidden className="px-2 text-muted-foreground">
                →
              </span>
              {labels.get(transition.to_status_code) ?? transition.to_status_code}
              {transition.is_primary ? (
                <Badge variant="outline" className="ml-2">
                  推荐
                </Badge>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-[var(--border-panel)] px-3 py-4 text-center text-xs text-muted-foreground">
          当前没有已启用的推荐流转规则。
        </p>
      )}
    </aside>
  );
}
