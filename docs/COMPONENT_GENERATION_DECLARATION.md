# RepairDesk 组件生成声明

> 本声明专门约束“新增可复用组件如何设计、生成、命名、落盘、验收”。
>
> 页面级规则见 [`UI_PAGE_GENERATION_DECLARATION.md`](./UI_PAGE_GENERATION_DECLARATION.md)。组件级可执行 class 声明见 `src/lib/component-patterns.ts`。

## 1. 组件生成目标

新组件必须满足四件事：

1. **一致**：视觉、间距、状态、动效与当前 RepairDesk 页面一致。
2. **可复用**：props 清晰，样式可扩展，不绑定单个页面的临时数据结构。
3. **可维护**：业务逻辑、数据获取、展示组件边界清楚。
4. **可验证**：有 loading / empty / error / disabled 等关键状态，能通过 lint/build。

## 2. 生成前决策

新增组件前先按顺序判断：

1. `src/components/ui/*` 已有同类原子组件吗？有则复用，不重写 Button/Input/Dialog/Table。
2. 这个 UI 是否只在一个路由使用？只用一次就先放在路由文件内部。
3. 是否会被同一业务域复用？放 `src/components/<domain>/`，例如 `src/components/orders/`。
4. 是否跨业务域复用？放 `src/components/` 根部，例如 `animated-number.tsx`、`sparkline.tsx`。
5. 是否只是 class/布局片段？优先加入 `src/lib/component-patterns.ts` 或 `src/lib/ui-patterns.ts`，不要创建空壳组件。

## 3. 文件与命名

| 类型                  | 文件位置                           | 文件名           | Export              |
| --------------------- | ---------------------------------- | ---------------- | ------------------- |
| shadcn/Radix 原子扩展 | `src/components/ui/`               | `kebab-case.tsx` | PascalCase          |
| 业务组件              | `src/components/<domain>/`         | `kebab-case.tsx` | PascalCase          |
| 跨域组件              | `src/components/`                  | `kebab-case.tsx` | PascalCase          |
| class 声明            | `src/lib/*-patterns.ts`            | `kebab-case.ts`  | camelCase objects   |
| 类型                  | 就近或 `src/lib/<domain>/types.ts` | `types.ts`       | 明确 type/interface |

命名规则：

- 组件名表达业务对象，不表达样式。例如 `OrderSummaryCard`，不要叫 `GlassPurpleCard`。
- 子组件只在同文件使用时不 export。
- 共享组件支持 `className?: string`，内部使用 `cn()` 合并。
- props 类型命名为 `<ComponentName>Props`。

## 4. 组件分层声明

### 4.1 Presentational Component

只负责展示，不请求数据，不做 mutation。

适合：

- 卡片
- 徽章
- 列表项
- 统计块
- 空态
- 时间线条目

要求：

- props 传入已整理好的数据。
- 不调用 `useQuery` / `useMutation`。
- 不直接 import `@/lib/repairdesk/api`。
- 支持 `className`。

### 4.2 Container Component

负责组合数据和展示，可调用 query/mutation。

适合：

- 页面内复杂模块
- 需要局部刷新和 mutation 的业务块
- 弹窗表单

要求：

- Query key 遵循页面声明。
- mutation 成功后 invalidate 相关 query。
- 只在必要时抽出；页面能清晰承载时不强行抽。

### 4.3 Domain Primitive

业务原语组件，跨页面复用。

现有范例：

- `StatusBadge`
- `OrderTypeBadge`
- `ApprovalBadge`
- `MoneyText`
- `PhoneText`

要求：

- 输入必须是业务枚举或明确类型。
- 状态色必须走 `toneClasses` 或现有 meta。
- 不允许页面重复实现同类状态映射。

## 5. 样式生成规则

优先 import：

```tsx
import { cn } from "@/lib/utils";
import { componentShell, componentList, componentForm } from "@/lib/component-patterns";
```

硬规则：

1. 颜色只用 `src/styles.css` 语义 token。
2. 主容器优先 `glass-card` 或 `componentShell.panel`。
3. 弹层优先 `componentOverlay.content`。
4. 状态色使用 `toneClasses` 或 `bg-status-* text-status-*-foreground`。
5. 主操作按钮使用 `<Button>` + `brandGradientStyle`，不要自造按钮。
6. 图标用 lucide-react，尺寸用 `size-3` / `size-3.5` / `size-4` / `size-5`。
7. 数字用 `font-mono tabular-nums` 或 `MoneyText`。
8. 不新增一套圆角、阴影、字体、渐变。

允许使用 `class-variance-authority` 的条件：

- 组件至少有 2 个以上 variant，或 tone/size/intent 组合会明显重复。
- variant 的输出仍必须由 token 组成。
- variant 对外类型使用 `VariantProps<typeof xxxVariants>`。

## 6. Props/API 声明

组件 props 应该遵循：

```tsx
export interface ExampleCardProps {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}
```

规则：

- 必填字段放前面，可选字段放后面。
- 回调用动词开头：`onCreate`、`onSelect`、`onDismiss`。
- boolean 用语义名：`isLoading`、`isDisabled`、`isSelected`。
- 不把整条数据库 record 传入纯 UI，除非组件就是业务详情卡。
- 不使用 `any`。
- 不把 service role、env、Supabase client 作为 props 传给 UI 组件。

## 7. 状态声明

每个可复用组件必须明确这些状态是否需要支持：

| 状态     | 要求                                         |
| -------- | -------------------------------------------- |
| Default  | 正常数据                                     |
| Loading  | 使用 `<Skeleton />` 或 `aria-busy`           |
| Empty    | `componentList.empty` 或 `surfaces.empty`    |
| Error    | `text-status-danger-foreground` + 可恢复动作 |
| Disabled | 禁止交互并保留原因或 tooltip                 |
| Selected | `bg-accent/40` 或业务选中样式                |
| Pending  | mutation 中禁用按钮，文案变为进行中          |

如果组件不负责某状态，要在组件调用方处理，不能遗漏。

## 8. 无障碍声明

必须满足：

- 图标按钮有 `aria-label`。
- `Dialog` / `Sheet` 有 `DialogTitle` / `SheetTitle`，隐藏标题用 `sr-only`。
- 表单字段有 `Label`，错误文案能被屏幕阅读器发现。
- 可点击非 button 元素必须改成 `<button>` 或 `<Link>`。
- Hover 信息不能是唯一信息来源。
- 状态不能只靠颜色表达，至少有文本、图标或圆点。
- 焦点态不能被移除。

## 9. 动效声明

- 入场动画用 `fadeUp` / `scaleIn` / `stagger`。
- 卡片 hover 用 `whileHover={{ y: -2 }}` 或 `cardHover`。
- 不在组件内部包全局路由 `AnimatePresence`。
- 列表条目 stagger 间隔 `0.025` 到 `0.06`。
- 动效不影响布局尺寸，不制造文本重排。

## 10. 数据边界声明

组件不得直接访问数据库。边界如下：

| 层                          | 可以做什么                                        |
| --------------------------- | ------------------------------------------------- |
| `src/server/*`              | Supabase service role、数据库 join、业务校验      |
| `src/lib/repairdesk/api.ts` | Next Route Handler facade、client/server 同构入口 |
| route page                  | `useQuery` / `useMutation` / invalidate           |
| container component         | 局部 query/mutation，必须清楚 query key           |
| presentational component    | 只展示 props                                      |

新增业务能力时，先扩展 `src/lib/repairdesk/types.ts` 和 API facade，再接 UI。

## 11. 组件模板

### 11.1 展示卡片

```tsx
import { cn } from "@/lib/utils";
import { componentShell } from "@/lib/component-patterns";

export interface ExampleSummaryCardProps {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export function ExampleSummaryCard({
  title,
  description,
  className,
  children,
}: ExampleSummaryCardProps) {
  return (
    <section className={cn(componentShell.panel, componentShell.panelPadding, className)}>
      <header className={componentShell.header}>
        <div className={componentShell.titleGroup}>
          <h2 className={componentShell.title}>{title}</h2>
          {description && <p className={componentShell.description}>{description}</p>}
        </div>
      </header>
      {children && <div className={componentShell.body}>{children}</div>}
    </section>
  );
}
```

### 11.2 业务列表项

```tsx
import Link from "next/link";
import { componentList } from "@/lib/component-patterns";
import { MoneyText, StatusBadge } from "@/components/orders/badges";

export interface OrderResultItemProps {
  id: string;
  publicNo: string;
  customerName: string;
  amount: number;
  status: Parameters<typeof StatusBadge>[0]["status"];
}

export function OrderResultItem({
  id,
  publicNo,
  customerName,
  amount,
  status,
}: OrderResultItemProps) {
  return (
    <Link href={`/orders/${id}`} className={componentList.itemInteractive}>
      <div className="min-w-0">
        <div className={componentList.itemTitle}>{publicNo}</div>
        <div className={componentList.itemMeta}>{customerName}</div>
      </div>
      <div className={componentList.itemTrailing}>
        <MoneyText amount={amount} />
        <StatusBadge status={status} />
      </div>
    </Link>
  );
}
```

### 11.3 弹窗表单

```tsx
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { componentOverlay } from "@/lib/component-patterns";

export interface ExampleDialogProps {
  open: boolean;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}

export function ExampleDialog({ open, isPending, onOpenChange, onSubmit }: ExampleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={componentOverlay.content}>
        <DialogHeader className={componentOverlay.header}>
          <DialogTitle className={componentOverlay.title}>操作标题</DialogTitle>
          <DialogDescription className={componentOverlay.description}>
            说明这个操作会影响什么业务对象。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className={componentOverlay.footer}>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={isPending} onClick={onSubmit}>
            {isPending ? "处理中..." : "确认"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## 12. 生成流程清单

每次生成新组件按这个顺序执行：

1. 搜索现有组件：`rg "ComponentName|相似业务词" src/components src/routes`。
2. 判断组件类型：Presentational / Container / Domain Primitive。
3. 选择落盘目录。
4. 定义 props 类型和状态支持范围。
5. 从 `component-patterns.ts`、`ui-patterns.ts`、`components/ui/*` 复用结构。
6. 接入业务组件，如 `StatusBadge`、`MoneyText`。
7. 补齐 a11y：label、title、aria、键盘路径。
8. 在调用页面中处理 query/mutation，不把数据库逻辑塞进展示组件。
9. 运行 `npm run lint`。
10. 涉及页面展示时运行 `npm run build`，必要时做浏览器截图验证。

## 13. 禁止清单

- 禁止为一个按钮新建自定义 button 组件，除非它承载明确业务语义。
- 禁止复制粘贴整段 Table/Card 样式后只改文字。
- 禁止组件内部读取 `process.env`。
- 禁止组件内部创建 Supabase service client。
- 禁止用颜色名表达业务状态。
- 禁止在可复用组件里写页面路由专属布局宽度。
- 禁止把 Dialog/Sheet 标题省略。
- 禁止新增与 `StatusBadge` / `MoneyText` 重复的业务渲染组件。

## 14. 验收标准

新组件合格标准：

- 能说明它属于哪一类组件。
- 文件路径符合分层。
- props 类型明确，无 `any`。
- class 使用 token 和声明对象。
- 支持必要状态。
- 移动端不溢出。
- 亮/暗主题都可读。
- 图标、按钮、弹窗符合 a11y。
- 未引入新的数据访问越界。
- `npm run lint` 通过；涉及构建面时 `npm run build` 通过。
