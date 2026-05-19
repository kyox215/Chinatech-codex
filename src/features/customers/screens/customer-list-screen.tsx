"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowUpRight, Bell, Filter, Mail, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createCustomer,
  listCustomers,
  type CustomerCreateInput,
  type CustomerListFilters,
} from "@/lib/repairdesk/api";
import {
  CustomerKpiCard,
  CustomerMobileCard,
  CustomerRow,
} from "@/features/customers/components/customer-list-items";
import { CustomerFilters } from "@/features/customers/forms/customer-filters";
import { CustomerFormDialog } from "@/features/customers/forms/customer-form-dialog";
import { defaultCustomerForm } from "@/features/customers/model/customer-list";
import { fadeUp, stagger } from "@/lib/motion";
import { brandGradientStyle, pageHeader, pageShell } from "@/lib/ui-patterns";
import { cn } from "@/lib/utils";

export function CustomerListScreen() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<CustomerListFilters>({
    marketing: "all",
    followup: "all",
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", filters],
    queryFn: () => listCustomers(filters),
  });

  const create = useMutation({
    mutationFn: (input: CustomerCreateInput) => createCustomer(input),
    onSuccess: () => {
      toast.success("客户已创建");
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const customers = data?.customers ?? [];
  const tags = data?.tags ?? [];
  const stats = data?.stats;

  const activeFilterCount = useMemo(() => {
    return (
      (filters.tagIds?.length ?? 0) +
      (filters.marketing && filters.marketing !== "all" ? 1 : 0) +
      (filters.followup && filters.followup !== "all" ? 1 : 0)
    );
  }, [filters]);

  return (
    <div className={pageShell.list}>
      <motion.div
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
        className="mb-5 space-y-4"
      >
        <div className={pageHeader.root}>
          <motion.div variants={fadeUp}>
            <p className={pageHeader.eyebrow}>CRM / 客户管理</p>
            <h1 className={pageHeader.title}>
              <span className="gradient-text">客户</span>
              <span className="ml-2 align-middle text-base font-normal text-muted-foreground">
                共 {customers.length} 位
              </span>
            </h1>
            <p className={pageHeader.subtitle}>客户资料、设备、历史工单、营销标签与回访任务。</p>
          </motion.div>
          <motion.div variants={fadeUp} className={pageHeader.actions}>
            <Button
              className="gap-1.5 border-0 text-white"
              style={brandGradientStyle}
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" /> 新建客户
            </Button>
          </motion.div>
        </div>

        <motion.div variants={fadeUp} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CustomerKpiCard icon={Users} label="总客户" value={stats?.total ?? 0} />
          <CustomerKpiCard icon={ArrowUpRight} label="复购客户" value={stats?.repeat ?? 0} />
          <CustomerKpiCard icon={Bell} label="待回访" value={stats?.dueFollowups ?? 0} />
          <CustomerKpiCard icon={Mail} label="可营销" value={stats?.marketable ?? 0} />
        </motion.div>
      </motion.div>

      <div className="glass-card mb-4 flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search ?? ""}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="搜索姓名、电话、邮箱或设备"
              className="h-9 border-border/60 bg-surface/60 pl-8"
            />
          </div>
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Filter className="size-3.5" /> 筛选
                {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-sm p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>客户筛选</SheetTitle>
              </SheetHeader>
              <CustomerFilters
                filters={filters}
                tags={tags}
                onChange={setFilters}
                onClose={() => setFilterOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "allowed", "blocked"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilters({ ...filters, marketing: value })}
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition-colors",
                (filters.marketing ?? "all") === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-surface hover:bg-accent",
              )}
            >
              {value === "all" ? "全部营销状态" : value === "allowed" ? "可营销" : "不可营销"}
            </button>
          ))}
          {(["all", "due", "overdue"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilters({ ...filters, followup: value })}
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition-colors",
                (filters.followup ?? "all") === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-surface hover:bg-accent",
              )}
            >
              {value === "all" ? "全部回访" : value === "due" ? "今天到期" : "已逾期"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="glass-card mx-auto mt-16 max-w-sm p-8 text-center">
          <Search className="mx-auto size-8 text-muted-foreground" />
          <h3 className="mt-3 font-display text-lg font-semibold">暂无符合条件的客户</h3>
          <p className="mt-1 text-sm text-muted-foreground">试试调整筛选条件，或新建客户档案。</p>
        </div>
      ) : (
        <>
          <div className="glass-card hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border/40">
                  <th className="px-4 py-2.5 text-left font-medium">客户</th>
                  <th className="px-3 py-2.5 text-left font-medium">标签</th>
                  <th className="px-3 py-2.5 text-left font-medium">设备/工单</th>
                  <th className="px-3 py-2.5 text-right font-medium">已结清营收</th>
                  <th className="px-3 py-2.5 text-right font-medium">未结清</th>
                  <th className="px-3 py-2.5 text-left font-medium">下次回访</th>
                  <th className="w-20 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <CustomerRow key={customer.id} customer={customer} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {customers.map((customer) => (
              <CustomerMobileCard key={customer.id} customer={customer} />
            ))}
          </div>
        </>
      )}

      <CustomerFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建客户"
        busy={create.isPending}
        initial={defaultCustomerForm}
        onSave={(input) => create.mutateAsync(input)}
      />
    </div>
  );
}
