# UI Spec — AI 助手折叠辅助区域

## Information hierarchy

1. Header: title and read-only scope.
2. Optional compact usage disclosure.
3. Scrollable conversation/results.
4. Compact processing disclosure.
5. Text input and send controls.

## Usage disclosure

- Component: controlled `Collapsible`, default `open=false`.
- Trigger: full-width button, minimum height 44px, left title, middle/right compact values, final chevron.
- Collapsed ready copy: `今日大模型 · 14/20 · 7,919 Token · $0.000774`，允许在窄屏截断费用前的次要分隔信息，但请求数必须可见。
- Expanded content: reuse three metric tiles and reservation note; no duplicated heading row.
- Chevron rotates 180° via `data-[state=open]`.
- Required attributes: accessible name “展开/收起今日大模型用量”, native button semantics, Radix-managed `aria-expanded`/content relationship.
- Error state remains one compact row with visible retry; error does not block conversation.

## Processing disclosure

- Component: controlled `Collapsible`, default `open=false`.
- Trigger: full-width button, minimum height 44px.
- Left: `处理方式`; center: selected icon + `本地处理` or `大模型理解`; secondary copy: `不调用模型` or `发送至 OpenAI · 计入用量`; right: chevron.
- Expanded content: existing two-column ToggleGroup, followed by corresponding privacy/help paragraph and optional voice disclosure.
- On mode selection, keep disclosure expanded so the user can verify the changed privacy copy. On valid submit, collapse it to return space to results without changing the selected mode.
- While request loading, trigger and ToggleGroup are disabled; collapse state is not changed automatically.

## Responsive behavior

- 390–430px: both disclosures default collapsed; no horizontal scroll; one-line summaries use `min-w-0`, tabular numbers and safe truncation.
- Desktop: same collapsed default for predictable behavior; user can independently expand either section.
- Conversation is the only flexible/scrolling region; header, disclosures and composer remain shrink-safe.

## Accessibility and interaction

- Tab reaches usage trigger, processing trigger, input, voice and send in visual order.
- Enter/Space toggles disclosures; focus stays on trigger after toggle.
- Selected processing mode remains exposed through trigger text and ToggleGroup radio state; model mode always exposes the external-send/cost implication even while collapsed.
- No color-only distinction; icons are decorative unless their label carries meaning.
- Touch targets at least 44px; focus ring uses existing Button behavior/tokens.

## Visual verification matrix

| Viewport | State                                           | Evidence                             |
| -------- | ----------------------------------------------- | ------------------------------------ |
| 390×844  | both collapsed, model selected, Apple 15 result | primary owner screenshot             |
| 390×844  | both expanded                                   | disclosure completeness and overflow |
| 1280×800 | collapsed then expanded                         | responsive and keyboard sanity       |

## Non-goals

- No new color tokens, animations library or reusable component declaration.
- No permanent persistence across browsers/devices.
- No hiding usage for authorized users or removing privacy text.
