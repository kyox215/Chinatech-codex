# PRD — 准确的设备工单搜索与紧凑 AI 对话

## Problem statement

用户在大模型模式输入“有没有苹果15系列的单子”时，模型可能生成没有设备约束的合法 tool call。后端只验证 JSON 结构，随后返回整店活跃工单，因此出现 Samsung 等不相关结果。与此同时，用量卡、处理方式卡和说明在 390px 屏幕占据过多垂直空间。

## Users and jobs

- 店主/获授权员工：用自然中文询问具体设备型号，快速得到可信工单。
- 店主：在需要时查看当日模型用量，但不让指标挡住查询结果。
- 所有 AI 助手用户：随时知道当前是本地还是大模型处理，并能在发送前切换。

## Product rules

1. 明确品牌+型号来自用户原句时，它是不可被模型放宽或替换的可信条件。
2. 只有品牌、只有数字、客户名/订单号中的偶然数字不自动视为设备条件。
3. “系列”“单子”等自然口语外壳不应进入设备匹配键。
4. 大模型模式仍真实调用模型；准确性修正发生在 provider 计划之后，不伪装成本地模式。
5. 任何设备相关性不一致都 fail closed，绝不回退到无筛选整店列表。
6. 用量仅向已有聚合财务权限用户显示；折叠不改变权限或请求范围。
7. 当前处理方式在收起状态始终可见；切换必须在发送前由用户主动操作。
8. 隐私说明可收起但不能删除；展开操作需键盘和读屏可用。

## State model

### Usage disclosure

- unauthorized: entirely hidden, unchanged.
- loading: compact one-line loading trigger; optional expanded skeleton.
- ready collapsed: title + requests/limit + tokens + cost summary.
- ready expanded: three existing metrics and reservation note.
- error collapsed: compact failure label + retry action remains available.

### Processing disclosure

- collapsed local: “处理方式 · 本地处理 · 不调用模型”.
- collapsed model: “处理方式 · 大模型理解 · 发送至 OpenAI · 计入用量”.
- expanded: two selectable cards plus mode-specific privacy text and voice disclosure.
- loading query: disclosure trigger and mode controls disabled; submitted bubble retains last mode.

## Acceptance examples

| Input                  | Model plan can be wrong | Effective repository constraint | Forbidden result         |
| ---------------------- | ----------------------- | ------------------------------- | ------------------------ |
| 有没有苹果15系列的单子 | empty filters           | `deviceSearch=iPhone 15`        | Samsung A12/A52          |
| 查找苹果 15 Pro 工单   | `search=15`             | `deviceSearch=iPhone 15 pro`    | iPhone 14 / Samsung      |
| trova Samsung A12      | conflicting device      | `deviceSearch=Samsung a12`      | iPhone 15                |
| 15                     | none                    | no guessed device constraint    | silent iPhone assumption |

## Success indicators

- Regression suite proves conflicting/empty model plans cannot broaden recognized device queries.
- 390px initial sheet displays materially more result/composer area than the current screenshot.
- Mode, usage, privacy, keyboard and screen-reader behavior remain observable and testable.
