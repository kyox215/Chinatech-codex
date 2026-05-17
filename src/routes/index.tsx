"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { ArrowUpRight, ClipboardList, Clock, DollarSign, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listOrders } from "@/lib/repairdesk/api";
import { MoneyText, StatusBadge } from "@/components/orders/badges";
import { statusGroups, statusMeta } from "@/lib/mock/enums";
import { AnimatedNumber } from "@/components/animated-number";
import { Sparkline } from "@/components/sparkline";
import { fadeUp, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 18) return "下午好";
  return "晚上好";
};

const sparklines = [
  [4, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16],
  [2, 3, 2, 4, 3, 5, 4, 6, 5, 5, 6, 7],
  [8, 9, 8, 10, 12, 11, 13, 14, 12, 15, 16, 18],
  [120, 200, 180, 260, 240, 320, 300, 380, 360, 440, 420, 520],
];

const weekRevenue = [
  { day: "周一", v: 2400 },
  { day: "周二", v: 1380 },
  { day: "周三", v: 4200 },
  { day: "周四", v: 3100 },
  { day: "周五", v: 5400 },
  { day: "周六", v: 6200 },
  { day: "周日", v: 4800 },
];

export default function Dashboard() {
  const { data = [] } = useQuery({
    queryKey: ["orders", {}],
    queryFn: () => listOrders(),
  });

  const inProgress = data.filter((o) => statusGroups.in_progress.includes(o.status)).length;
  const waitingApproval = data.filter((o) => o.status === "waiting_approval").length;
  const waitingPickup = data.filter((o) => statusGroups.awaiting_pickup.includes(o.status)).length;
  const revenue = data.filter((o) => o.is_paid).reduce((s, o) => s + o.quotation_amount, 0);

  const recent = data.slice(0, 8);

  // Status distribution donut
  const groupColors: Record<string, string> = {
    进行中: "oklch(0.7 0.2 285)",
    待审批: "oklch(0.78 0.18 75)",
    待取机: "oklch(0.78 0.16 200)",
    已完成: "oklch(0.78 0.18 145)",
    已取消: "oklch(0.6 0.02 270)",
  };
  const donut = [
    { name: "进行中", value: inProgress },
    { name: "待审批", value: waitingApproval },
    { name: "待取机", value: waitingPickup },
    { name: "已完成", value: data.filter((o) => o.status === "completed").length },
    { name: "已取消", value: data.filter((o) => o.status === "cancelled").length },
  ].filter((d) => d.value > 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-3 py-6 sm:px-6">
      {/* Hero greeting */}
      <motion.div
        variants={stagger(0.06)}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
      >
        <motion.div variants={fadeUp}>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
            {new Date().toLocaleDateString("zh-CN", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {greeting()}，<span className="gradient-text">华强北旗舰店</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">今日工单概览与近期表现一目了然。</p>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Button
            asChild
            className="h-10 gap-1.5 border-0 text-white shadow-[0_8px_28px_-10px_oklch(0.7_0.2_285_/_0.7)]"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Link href="/orders/new">
              <ArrowUpRight className="size-4" />
              新建工单
            </Link>
          </Button>
        </motion.div>
      </motion.div>

      {/* KPI cards */}
      <motion.div
        variants={stagger(0.06)}
        initial="hidden"
        animate="show"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          icon={Wrench}
          label="进行中"
          value={inProgress}
          spark={sparklines[0]}
          tone="violet"
          hint="包含检测、维修、配件等"
        />
        <KpiCard
          icon={Clock}
          label="待审批"
          value={waitingApproval}
          spark={sparklines[1]}
          tone="amber"
          hint="客户尚未确认报价"
        />
        <KpiCard
          icon={ClipboardList}
          label="待取机"
          value={waitingPickup}
          spark={sparklines[2]}
          tone="cyan"
          hint="已修复 / 已通知"
        />
        <KpiCard
          icon={DollarSign}
          label="累计已结清营收"
          value={revenue}
          isMoney
          spark={sparklines[3]}
          tone="emerald"
          hint="基于近期工单"
        />
      </motion.div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="glass-card overflow-hidden p-5 lg:col-span-2"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">本周营收</h2>
              <p className="text-xs text-muted-foreground">已结清工单的金额（mock）</p>
            </div>
            <span className="rounded-md bg-status-success px-2 py-0.5 text-xs text-status-success-foreground">
              +18.2%
            </span>
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={weekRevenue}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.2 285)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="oklch(0.78 0.16 200)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="revStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="oklch(0.7 0.2 285)" />
                    <stop offset="100%" stopColor="oklch(0.78 0.16 200)" />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ stroke: "oklch(1 0 0 / 0.1)" }}
                  contentStyle={{
                    background: "oklch(0.22 0.03 270 / 0.9)",
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "white",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="url(#revStroke)"
                  strokeWidth={2}
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          transition={{ delay: 0.1 }}
          className="glass-card p-5"
        >
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold">状态分布</h2>
            <p className="text-xs text-muted-foreground">当前所有工单</p>
          </div>
          <div className="relative h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={donut}
                  innerRadius={56}
                  outerRadius={84}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {donut.map((d) => (
                    <Cell key={d.name} fill={groupColors[d.name]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.22 0.03 270 / 0.9)",
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "white",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-2xl font-semibold tabular-nums">
                <AnimatedNumber value={data.length} />
              </div>
              <div className="text-[11px] text-muted-foreground">总工单</div>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs">
            {donut.map((d) => (
              <li key={d.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: groupColors[d.name] }}
                  />
                  {d.name}
                </span>
                <span className="font-mono text-muted-foreground">{d.value}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Recent orders */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="glass-card overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
          <h2 className="font-display text-base font-semibold">最新工单</h2>
          <Button variant="ghost" size="sm" className="gap-1 text-xs" asChild>
            <Link href="/orders">
              查看全部 <ArrowUpRight className="size-3" />
            </Link>
          </Button>
        </div>
        <motion.ul
          variants={stagger(0.04)}
          initial="hidden"
          animate="show"
          className="divide-y divide-border/30"
        >
          {recent.map((o) => (
            <motion.li key={o.id} variants={fadeUp}>
              <Link
                href={`/orders/${o.id}`}
                className="group relative flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-accent/30"
              >
                <span
                  className="absolute inset-y-0 left-0 w-[2px] origin-top scale-y-0 transition-transform duration-300 group-hover:scale-y-100"
                  style={{ background: "var(--gradient-brand)" }}
                />
                <div className="flex min-w-0 items-center gap-3">
                  <span className="font-mono text-xs font-medium text-primary">{o.public_no}</span>
                  <span className="truncate font-medium">{o.customer_name}</span>
                  <span className="hidden text-muted-foreground sm:inline">· {o.device_label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MoneyText amount={o.quotation_amount} className="text-xs" />
                  <StatusBadge status={o.status} />
                </div>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      </motion.div>
    </div>
  );
}

const toneAccent: Record<string, string> = {
  violet: "oklch(0.7 0.2 285)",
  amber: "oklch(0.78 0.18 75)",
  cyan: "oklch(0.78 0.16 200)",
  emerald: "oklch(0.78 0.18 145)",
};

function KpiCard({
  icon: Icon,
  label,
  value,
  spark,
  tone,
  hint,
  isMoney,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  spark: number[];
  tone: keyof typeof toneAccent;
  hint: string;
  isMoney?: boolean;
}) {
  const color = toneAccent[tone];
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="glass-card group relative overflow-hidden p-4"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-80"
        style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
      />
      <div className="relative flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div
          className={cn("grid size-7 place-items-center rounded-md")}
          style={{
            background: `linear-gradient(135deg, ${color}, transparent)`,
            color: "white",
          }}
        >
          <Icon className="size-3.5" />
        </div>
      </div>
      <div className="relative mt-2 font-display text-3xl font-semibold tracking-tight tabular-nums">
        {isMoney ? (
          <>
            <span className="text-base text-muted-foreground">¥</span>
            <AnimatedNumber value={value} />
          </>
        ) : (
          <AnimatedNumber value={value} />
        )}
      </div>
      <p className="relative mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      <div className="relative mt-3 -mb-1">
        <Sparkline data={spark} color={color} height={40} />
      </div>
    </motion.div>
  );
}
