"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Printer,
  Settings2,
  Store,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import {
  createStore,
  getStoreMembers,
  getStoreContext,
  getStoreSettings,
  inviteStoreMember,
  switchStore,
  updateStoreSettings,
  type StoreInviteInput,
  type StoreSettings,
} from "@/lib/repairdesk/api";
import { cn } from "@/lib/utils";
import { brandGradientStyle, formLayout, pageHeader, pageShell, surfaces } from "@/lib/ui-patterns";

type SettingsDraft = Pick<
  StoreSettings,
  | "store_name"
  | "store_address"
  | "store_phone"
  | "store_whatsapp"
  | "store_email"
  | "default_order_warranty_text"
  | "default_inventory_warranty_months"
  | "print_footer"
  | "message_signature"
>;

export function SettingsScreen() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: messageSettingsKeys.store,
    queryFn: getStoreSettings,
  });
  const storeContextQuery = useQuery({
    queryKey: storesKeys.context,
    queryFn: getStoreContext,
  });
  const storeMembersQuery = useQuery({
    queryKey: storesKeys.members,
    queryFn: getStoreMembers,
  });
  const settingsData = settingsQuery.data;
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [newStoreName, setNewStoreName] = useState("");
  const [inviteDraft, setInviteDraft] = useState<StoreInviteInput>({
    email: "",
    role: "technician",
  });

  useEffect(() => {
    if (!settingsData) return;
    setDraft(toDraft(settingsData));
  }, [settingsData]);

  const hasChanges = useMemo(() => {
    if (!draft || !settingsData) return false;
    const current = toDraft(settingsData);
    return JSON.stringify(current) !== JSON.stringify(draft);
  }, [draft, settingsData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("设置未加载");
      return updateStoreSettings(draft);
    },
    onSuccess: (settings) => {
      toast.success("设置已保存");
      setDraft(toDraft(settings));
      queryClient.invalidateQueries({ queryKey: messageSettingsKeys.store });
      queryClient.invalidateQueries({ queryKey: messageSettingsKeys.templates });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存失败"),
  });
  const switchStoreMutation = useMutation({
    mutationFn: switchStore,
    onSuccess: async (context) => {
      toast.success(`已切换到 ${context.activeStore?.name ?? "店铺"}`);
      await queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "切换店铺失败"),
  });
  const createStoreMutation = useMutation({
    mutationFn: createStore,
    onSuccess: async (context) => {
      toast.success(`已创建 ${context.activeStore?.name ?? "新店铺"}`);
      setNewStoreName("");
      await queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "创建店铺失败"),
  });
  const inviteMemberMutation = useMutation({
    mutationFn: inviteStoreMember,
    onSuccess: async () => {
      toast.success("邀请已保存");
      setInviteDraft({ email: "", role: "technician" });
      await queryClient.invalidateQueries({ queryKey: storesKeys.members });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "邀请失败"),
  });

  if (settingsQuery.isLoading || !draft) {
    return <SettingsLoading />;
  }

  if (settingsQuery.isError) {
    return (
      <main className={pageShell.form}>
        <section className={surfaces.empty}>
          <Settings2 className="mb-3 size-8 text-status-danger-foreground" />
          <p className="text-sm text-status-danger-foreground">读取系统设置失败</p>
          <Button variant="outline" className="mt-3" onClick={() => settingsQuery.refetch()}>
            重新加载
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className={pageShell.form}>
      <header className={pageHeader.root}>
        <div>
          <p className={pageHeader.eyebrow}>RepairDesk / Settings</p>
          <h1 className={pageHeader.compactTitle}>
            <span className="gradient-text">系统设置</span>
          </h1>
          <p className={pageHeader.subtitle}>店铺资料、默认规则和输出签名。</p>
        </div>
        <div className={pageHeader.actions}>
          <Button
            style={brandGradientStyle}
            disabled={!hasChanges || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Check className="mr-1.5 size-3.5" /> 保存设置
          </Button>
        </div>
      </header>

      <form
        className={cn(formLayout.stack, "mt-5")}
        onSubmit={(event) => {
          event.preventDefault();
          if (hasChanges && !saveMutation.isPending) saveMutation.mutate();
        }}
      >
        <StoreManagementSection
          activeStoreId={storeContextQuery.data?.activeStore?.id}
          stores={storeContextQuery.data?.stores ?? []}
          isLoading={storeContextQuery.isLoading}
          isSwitching={switchStoreMutation.isPending}
          isCreating={createStoreMutation.isPending}
          newStoreName={newStoreName}
          onNewStoreNameChange={setNewStoreName}
          onSwitchStore={(storeId) => {
            if (!storeId || storeId === storeContextQuery.data?.activeStore?.id) return;
            switchStoreMutation.mutate(storeId);
          }}
          onCreateStore={() => {
            const name = newStoreName.trim();
            if (!name) return;
            createStoreMutation.mutate({ name });
          }}
        />
        <StoreMembersSection
          members={storeMembersQuery.data?.members ?? []}
          invitations={storeMembersQuery.data?.invitations ?? []}
          isLoading={storeMembersQuery.isLoading}
          inviteDraft={inviteDraft}
          isInviting={inviteMemberMutation.isPending}
          onInviteDraftChange={setInviteDraft}
          onInvite={() => {
            const email = inviteDraft.email.trim();
            if (!email) return;
            inviteMemberMutation.mutate({ ...inviteDraft, email });
          }}
        />

        <section className={formLayout.section}>
          <SectionTitle icon={Store} title="店铺资料" />
          <div className={formLayout.grid}>
            <Field label="店铺名" htmlFor="store-name">
              <Input
                id="store-name"
                value={draft.store_name}
                onChange={(event) => setDraftField(setDraft, "store_name", event.target.value)}
              />
            </Field>
            <Field label="邮箱" htmlFor="store-email" icon={Mail}>
              <Input
                id="store-email"
                type="email"
                value={draft.store_email}
                onChange={(event) => setDraftField(setDraft, "store_email", event.target.value)}
              />
            </Field>
            <Field label="电话" htmlFor="store-phone" icon={Phone}>
              <Input
                id="store-phone"
                value={draft.store_phone}
                onChange={(event) => setDraftField(setDraft, "store_phone", event.target.value)}
              />
            </Field>
            <Field label="WhatsApp" htmlFor="store-whatsapp" icon={MessageSquare}>
              <Input
                id="store-whatsapp"
                value={draft.store_whatsapp}
                onChange={(event) => setDraftField(setDraft, "store_whatsapp", event.target.value)}
              />
            </Field>
          </div>
          <Field label="地址" htmlFor="store-address" className="mt-3">
            <Textarea
              id="store-address"
              rows={3}
              value={draft.store_address}
              onChange={(event) => setDraftField(setDraft, "store_address", event.target.value)}
            />
          </Field>
        </section>

        <section className={formLayout.section}>
          <SectionTitle icon={Settings2} title="默认规则" />
          <div className={formLayout.grid}>
            <Field label="维修默认保修文本" htmlFor="order-warranty">
              <Input
                id="order-warranty"
                value={draft.default_order_warranty_text}
                onChange={(event) =>
                  setDraftField(setDraft, "default_order_warranty_text", event.target.value)
                }
              />
            </Field>
            <Field label="二手库存默认保修月数" htmlFor="inventory-warranty">
              <Input
                id="inventory-warranty"
                type="number"
                min={0}
                value={draft.default_inventory_warranty_months}
                onChange={(event) =>
                  setDraftField(
                    setDraft,
                    "default_inventory_warranty_months",
                    Math.max(0, Number(event.target.value || 0)),
                  )
                }
              />
            </Field>
          </div>
        </section>

        <section className={formLayout.section}>
          <SectionTitle icon={Printer} title="输出配置" />
          <div className="space-y-3">
            <Field label="打印页脚" htmlFor="print-footer">
              <Textarea
                id="print-footer"
                rows={3}
                value={draft.print_footer}
                onChange={(event) => setDraftField(setDraft, "print_footer", event.target.value)}
              />
            </Field>
            <Field label="客户消息签名" htmlFor="message-signature">
              <Textarea
                id="message-signature"
                rows={3}
                value={draft.message_signature}
                onChange={(event) =>
                  setDraftField(setDraft, "message_signature", event.target.value)
                }
              />
            </Field>
          </div>
        </section>

        <div className={formLayout.section}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">模板预览和客户通知会使用当前店铺资料。</p>
            <Button
              type="submit"
              style={brandGradientStyle}
              disabled={!hasChanges || saveMutation.isPending}
            >
              <Check className="mr-1.5 size-3.5" /> 保存设置
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}

const roleLabels: Record<string, string> = {
  owner: "店主",
  manager: "经理",
  technician: "技师",
  sales: "销售",
  viewer: "只读",
};

function StoreMembersSection({
  members,
  invitations,
  isLoading,
  inviteDraft,
  isInviting,
  onInviteDraftChange,
  onInvite,
}: {
  members: {
    id: string;
    email: string;
    display_name?: string;
    role: string;
    status: string;
  }[];
  invitations: { id: string; email: string; role: string; expires_at: string }[];
  isLoading: boolean;
  inviteDraft: StoreInviteInput;
  isInviting: boolean;
  onInviteDraftChange: React.Dispatch<React.SetStateAction<StoreInviteInput>>;
  onInvite: () => void;
}) {
  return (
    <section className={formLayout.section}>
      <SectionTitle icon={Users} title="成员权限" />
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto]">
            <Field label="员工邮箱" htmlFor="invite-email">
              <Input
                id="invite-email"
                type="email"
                value={inviteDraft.email}
                onChange={(event) =>
                  onInviteDraftChange((current) => ({ ...current, email: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onInvite();
                  }
                }}
              />
            </Field>
            <Field label="角色" htmlFor="invite-role">
              <Select
                value={inviteDraft.role}
                onValueChange={(role) =>
                  onInviteDraftChange((current) => ({
                    ...current,
                    role: role as StoreInviteInput["role"],
                  }))
                }
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["manager", "technician", "sales", "viewer"] as const).map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabels[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                disabled={isInviting || inviteDraft.email.trim().length < 3}
                onClick={onInvite}
              >
                <UserPlus className="mr-1.5 size-3.5" /> 邀请
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex min-h-12 flex-col justify-center gap-1 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {member.display_name || member.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                <Badge variant={member.role === "owner" ? "default" : "outline"}>
                  {roleLabels[member.role] ?? member.role}
                </Badge>
              </div>
            ))}
          </div>

          {invitations.length ? (
            <div className="grid gap-2">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex min-h-11 flex-col justify-center gap-1 rounded-md border border-dashed border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="truncate text-sm">{invitation.email}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {roleLabels[invitation.role] ?? invitation.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(invitation.expires_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function StoreManagementSection({
  activeStoreId,
  stores,
  isLoading,
  isSwitching,
  isCreating,
  newStoreName,
  onNewStoreNameChange,
  onSwitchStore,
  onCreateStore,
}: {
  activeStoreId?: string;
  stores: { id: string; name: string; slug: string; role: string }[];
  isLoading: boolean;
  isSwitching: boolean;
  isCreating: boolean;
  newStoreName: string;
  onNewStoreNameChange: (value: string) => void;
  onSwitchStore: (storeId: string) => void;
  onCreateStore: () => void;
}) {
  return (
    <section className={formLayout.section}>
      <SectionTitle icon={Store} title="店铺管理" />
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Field label="当前店铺" htmlFor="active-store">
            <Select
              value={activeStoreId}
              onValueChange={onSwitchStore}
              disabled={isSwitching || stores.length === 0}
            >
              <SelectTrigger id="active-store">
                <SelectValue placeholder="选择店铺" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="新增店铺" htmlFor="new-store">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="new-store"
                value={newStoreName}
                onChange={(event) => onNewStoreNameChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onCreateStore();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={isCreating || newStoreName.trim().length < 2}
                onClick={onCreateStore}
              >
                <Plus className="mr-1.5 size-3.5" /> 新建
              </Button>
            </div>
          </Field>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            {stores.map((store) => (
              <Badge
                key={store.id}
                variant={store.id === activeStoreId ? "default" : "outline"}
                className="max-w-full gap-1"
              >
                <span className="truncate">{store.name}</span>
                <span className="text-[10px] uppercase opacity-70">{store.role}</span>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Store; title: string }) {
  return (
    <div className={formLayout.sectionHeader}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h2 className={formLayout.sectionTitle}>{title}</h2>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  icon: Icon,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  icon?: typeof Store;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(formLayout.field, className)}>
      <Label htmlFor={htmlFor} className={formLayout.label}>
        <span className="inline-flex items-center gap-1.5">
          {Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null}
          {label}
        </span>
      </Label>
      {children}
    </div>
  );
}

function SettingsLoading() {
  return (
    <main className={pageShell.form}>
      <div className={pageHeader.root}>
        <div>
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-3 h-8 w-44" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
      </div>
      <div className="mt-5 space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    </main>
  );
}

function toDraft(settings: StoreSettings): SettingsDraft {
  return {
    store_name: settings.store_name,
    store_address: settings.store_address,
    store_phone: settings.store_phone,
    store_whatsapp: settings.store_whatsapp,
    store_email: settings.store_email,
    default_order_warranty_text: settings.default_order_warranty_text,
    default_inventory_warranty_months: settings.default_inventory_warranty_months,
    print_footer: settings.print_footer,
    message_signature: settings.message_signature,
  };
}

function setDraftField<K extends keyof SettingsDraft>(
  setDraft: React.Dispatch<React.SetStateAction<SettingsDraft | null>>,
  key: K,
  value: SettingsDraft[K],
) {
  setDraft((current) => (current ? { ...current, [key]: value } : current));
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(date);
}
