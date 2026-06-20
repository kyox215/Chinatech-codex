/*
 * Paste this file into Figma MCP use_figma when the Starter plan call limit clears.
 *
 * It is intentionally incremental. Change RUN_MODE to one value, run the script,
 * inspect/screenshot, then move to the next value.
 *
 * Valid RUN_MODE values:
 * - overview-foundations
 * - components-core
 * - page-dashboard
 * - page-orders-desktop
 * - page-customers
 * - page-inventory
 * - page-buyback
 * - page-messages
 * - page-settings
 * - page-platform-admin
 */

const RUN_MODE = "page-buyback";

const PAGES = {
  overview: "00 Overview & Foundations",
  components: "01 Components",
  targets: "02 Page Targets & Protected",
};

const fonts = {
  regular: { family: "Inter", style: "Regular" },
  medium: { family: "Inter", style: "Medium" },
  semi: { family: "Inter", style: "Semi Bold" },
  mono: { family: "JetBrains Mono", style: "Regular" },
};

await Promise.all(
  [fonts.regular, fonts.medium, fonts.semi, fonts.mono].map(async (font) => {
    try {
      await figma.loadFontAsync(font);
    } catch {
      await figma.loadFontAsync(fonts.regular);
    }
  }),
);

const palette = {
  background: { r: 0.985, g: 0.987, b: 0.992 },
  card: { r: 1, g: 1, b: 1 },
  muted: { r: 0.955, g: 0.965, b: 0.98 },
  border: { r: 0.86, g: 0.89, b: 0.94 },
  text: { r: 0.12, g: 0.14, b: 0.19 },
  subtle: { r: 0.42, g: 0.47, b: 0.56 },
  primary: { r: 0.192, g: 0.361, b: 1 },
  success: { r: 0.08, g: 0.54, b: 0.35 },
  warn: { r: 0.78, g: 0.42, b: 0.06 },
  danger: { r: 0.75, g: 0.16, b: 0.14 },
};

const motionTokens = [
  {
    name: "motion/instant",
    duration: "80ms",
    easing: "ease-in-out",
    usage: "badge tone, chip selection, inline icon feedback",
  },
  {
    name: "motion/fast",
    duration: "140ms",
    easing: "ease-out",
    usage: "hover, pressed, focus ring, button loading swap",
  },
  {
    name: "motion/standard",
    duration: "220ms",
    easing: "ease-in-out",
    usage: "dialog, drawer, row expand, tab panel, context rail",
  },
  {
    name: "motion/slow",
    duration: "320ms",
    easing: "ease-out",
    usage: "first load, empty state, skeleton to content",
  },
];

const interactionStateGroups = [
  ["Default", "neutral surface / clear hierarchy"],
  ["Hover", "translateY -2 or subtle border emphasis"],
  ["Pressed", "scale 0.99 / stronger border"],
  ["Focus", "visible ring with no layout shift"],
  ["Loading", "stable skeleton or disabled pending action"],
  ["Selected", "primary tint plus text marker"],
  ["Error", "inline reason and recovery action"],
  ["Reduced motion", "opacity only, no translate or scale"],
];

const prototypeFlowSpecs = {
  "page-dashboard": [
    ["KPI drilldown", "Click KPI -> filter queue", "motion/fast"],
    ["Task card open", "Click priority card -> right context", "motion/standard"],
  ],
  "page-orders-desktop": [
    ["Row preview", "Click dense row -> desktop preview rail", "motion/standard"],
    ["Batch actions", "Select rows -> floating toolbar", "motion/fast"],
  ],
  "page-customers": [
    ["Customer preview", "Select customer -> profile workspace", "motion/standard"],
    ["Follow-up action", "Click next action -> dialog/toast", "motion/fast"],
  ],
  "page-inventory": [
    ["Scan result", "Scan/search -> SKU detail rail", "motion/standard"],
    ["Import feedback", "Preview/apply -> status notice", "motion/fast"],
  ],
  "page-buyback": [
    ["Quote step", "Select card -> quote recalculates", "motion/instant"],
    ["Inventory handoff", "Approve quote -> confirmation sheet", "motion/standard"],
  ],
  "page-messages": [
    ["Thread select", "Click thread -> conversation panel", "motion/standard"],
    ["Template insert", "Click variable/template -> inline feedback", "motion/instant"],
  ],
  "page-settings": [
    ["Workflow row", "Toggle status target -> inline pending", "motion/fast"],
    ["Save settings", "Save -> disabled pending -> toast", "motion/fast"],
  ],
  "page-platform-admin": [
    ["Request inspect", "Select request -> decision context", "motion/standard"],
    ["Approve/reject", "Submit decision -> toast + row exit", "motion/fast"],
  ],
};

const pagePlanningSpecs = {
  "page-dashboard": {
    desktop:
      "KPI strip, priority queue, recent orders, quick modules, and risk rail in one first viewport.",
    mobile: "Floating header, metric strip, priority cards, recent activity, and bottom actions.",
    states:
      "loading skeleton, partial data warning, empty recent orders, selected priority, mutation toast.",
    acceptance:
      "No hero or decorative chart; business warnings and next actions are visible immediately.",
  },
  "page-orders-desktop": {
    desktop: "Queue toolbar, dense table, batch bar, and desktop-only quick preview rail.",
    mobile:
      "Protected reference only: no replacement for mobile order list, detail, or work-order management.",
    states:
      "loading table, empty filtered queue, selected row, batch selected, preview loading, export pending.",
    acceptance:
      "Every mobile frame is clearly locked/reference-only; desktop table width stays stable.",
  },
  "page-customers": {
    desktop:
      "Customer search/list, profile workspace, activity rail, KPI addon, and list state panels.",
    mobile:
      "Floating list header, dense customer cards, detail sheet, contact actions, and status/tag chips.",
    states:
      "loading list, empty search, refresh warning, full-load error, selected customer, dialog pending.",
    acceptance: "CRM list, profile, and activity stay visible together at desktop density.",
  },
  "page-inventory": {
    desktop:
      "Stock KPIs, scan/search toolbar, dense SKU table, detail/finance rail, and import preview.",
    mobile: "Scan entry, status chips, stock cards, detail cards, and bottom stock actions.",
    states:
      "loading inventory, refresh error, empty stock, import preview, detail empty lines, mutation pending.",
    acceptance: "Supplier, margin, risk, stock, and next action are visible in one workspace.",
  },
  "page-buyback": {
    desktop: "Guided quote wizard, quote/margin panel, proof area, records, and handoff state.",
    mobile:
      "Floating quote header, stepper chips, choice cards, finance/proof detail, and bottom actions.",
    states:
      "empty records, selected choice, quote recalculating, attachment pending, handoff confirmation.",
    acceptance: "Quote creation is the first screen; finance emphasis appears before handoff.",
  },
  "page-messages": {
    desktop:
      "Thread list, conversation panel, template/variable rail, order context, and send states.",
    mobile:
      "Thread-first cards, conversation detail sheet, template rows, and compact bottom actions.",
    states:
      "template disabled, health warning, empty templates, load error, send pending, selected thread.",
    acceptance: "Template health, variable insertion, and linked order context stay visible.",
  },
  "page-settings": {
    desktop: "Store profile, members/roles, workflow transitions, templates, and audit readiness.",
    mobile:
      "Section cards, role/status rows, workflow target rows, template rows, and retry panel.",
    states:
      "settings loading, load error, pending save, disabled permission, selected target, audit warning.",
    acceptance: "Reads as an operations console with visible permissions and workflow state.",
  },
  "page-platform-admin": {
    desktop:
      "Access request queue, decision context, approve/reject actions, governance notes, and state panels.",
    mobile:
      "Request cards, decision sheet, visible approve/reject actions, risk notes, and empty/error cards.",
    states:
      "queue loading, empty queue, load error, selected request, decision pending, decision error.",
    acceptance: "Decision context is visible before approval and no sensitive data is exposed.",
  },
};

function paint(color, opacity = 1) {
  return [{ type: "SOLID", color, opacity }];
}

function stroke(color = palette.border, opacity = 1) {
  return [{ type: "SOLID", color, opacity }];
}

function applyCard(node, radius = 16) {
  node.fills = paint(palette.card);
  node.strokes = stroke();
  node.strokeWeight = 1;
  node.cornerRadius = radius;
  node.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0.16, g: 0.18, b: 0.24, a: 0.14 },
      offset: { x: 0, y: 12 },
      radius: 28,
      spread: -22,
      visible: true,
      blendMode: "NORMAL",
    },
  ];
}

function textNode(name, characters, size = 12, style = "regular", color = palette.text) {
  const node = figma.createText();
  node.name = name;
  node.fontName = fonts[style] ?? fonts.regular;
  node.fontSize = size;
  node.lineHeight = { unit: "PIXELS", value: Math.round(size * 1.35) };
  node.fills = paint(color);
  node.characters = characters;
  return node;
}

function auto(name, direction = "VERTICAL", gap = 8, padding = 12) {
  const node = figma.createAutoLayout(direction);
  node.name = name;
  node.itemSpacing = gap;
  node.paddingTop = padding;
  node.paddingRight = padding;
  node.paddingBottom = padding;
  node.paddingLeft = padding;
  node.primaryAxisSizingMode = "AUTO";
  node.counterAxisSizingMode = "FIXED";
  return node;
}

function card(name, width, height, title, subtitle) {
  const node = auto(name, "VERTICAL", 4, 10);
  node.resize(width, height);
  node.layoutSizingHorizontal = "FIXED";
  node.layoutSizingVertical = "FIXED";
  applyCard(node, 16);
  node.appendChild(textNode("Title", title, 12, "semi"));
  if (subtitle) node.appendChild(textNode("Subtitle", subtitle, 10, "regular", palette.subtle));
  return node;
}

function chip(label, active = false) {
  const node = auto(`Chip / ${label}`, "HORIZONTAL", 4, 8);
  node.resize(80, 28);
  node.layoutSizingHorizontal = "FIXED";
  node.layoutSizingVertical = "FIXED";
  node.cornerRadius = 14;
  node.fills = paint(active ? palette.primary : palette.card);
  node.strokes = stroke(active ? palette.primary : palette.border);
  node.appendChild(
    textNode("Label", label, 10, "medium", active ? { r: 1, g: 1, b: 1 } : palette.subtle),
  );
  return node;
}

function statePill(label, description, active = false) {
  const node = auto(`State / ${label}`, "VERTICAL", 2, 8);
  node.resize(170, 58);
  node.layoutSizingHorizontal = "FIXED";
  node.layoutSizingVertical = "FIXED";
  node.cornerRadius = 12;
  node.fills = paint(active ? { r: 0.925, g: 0.95, b: 1 } : palette.card);
  node.strokes = stroke(active ? palette.primary : palette.border);
  node.appendChild(textNode("State", label, 10, "semi", active ? palette.primary : palette.text));
  node.appendChild(textNode("Description", description, 8, "regular", palette.subtle));
  return node;
}

function motionSpecCard(token) {
  const node = auto(`Motion Token / ${token.name}`, "VERTICAL", 4, 10);
  node.resize(258, 132);
  node.layoutSizingHorizontal = "FIXED";
  node.layoutSizingVertical = "FIXED";
  applyCard(node, 16);
  node.appendChild(textNode("Token", token.name, 12, "semi", palette.primary));
  node.appendChild(textNode("Duration", `${token.duration} / ${token.easing}`, 11, "medium"));
  node.appendChild(textNode("Usage", token.usage, 10, "regular", palette.subtle));
  const demo = auto("Motion Preview Bar", "HORIZONTAL", 0, 0);
  demo.resize(226, 18);
  demo.layoutSizingHorizontal = "FIXED";
  demo.layoutSizingVertical = "FIXED";
  demo.cornerRadius = 9;
  demo.fills = paint(palette.muted);
  const dot = figma.createEllipse();
  dot.name = "Prototype dot - document target position in prototype";
  dot.resize(18, 18);
  dot.fills = paint(palette.primary);
  demo.appendChild(dot);
  node.appendChild(demo);
  return node;
}

function stateMatrixBoard() {
  const board = auto("Interaction States / Component Matrix", "VERTICAL", 10, 14);
  board.resize(760, 252);
  board.layoutSizingHorizontal = "FIXED";
  board.layoutSizingVertical = "FIXED";
  applyCard(board, 18);
  board.appendChild(textNode("Title", "Interaction States", 16, "semi"));
  board.appendChild(
    textNode(
      "Description",
      "Every generated component target must include these states before code refactor begins.",
      10,
      "regular",
      palette.subtle,
    ),
  );
  const grid = auto("State Grid", "HORIZONTAL", 8, 0);
  grid.resize(730, 136);
  grid.layoutSizingHorizontal = "FIXED";
  interactionStateGroups
    .slice(0, 4)
    .forEach(([label, description], index) =>
      grid.appendChild(statePill(label, description, index === 0)),
    );
  const grid2 = auto("State Grid 2", "HORIZONTAL", 8, 0);
  grid2.resize(730, 66);
  grid2.layoutSizingHorizontal = "FIXED";
  interactionStateGroups
    .slice(4)
    .forEach(([label, description]) => grid2.appendChild(statePill(label, description)));
  board.appendChild(grid);
  board.appendChild(grid2);
  return board;
}

function prototypeFlowBoard(mode) {
  const board = auto("Prototype / Interaction Flow", "HORIZONTAL", 10, 12);
  board.resize(1120, 132);
  board.layoutSizingHorizontal = "FIXED";
  board.layoutSizingVertical = "FIXED";
  board.fills = paint({ r: 0.965, g: 0.975, b: 0.995 });
  board.strokes = stroke({ r: 0.76, g: 0.82, b: 0.94 });
  board.cornerRadius = 18;
  const flows = prototypeFlowSpecs[mode] ?? [
    ["List state", "Select item -> context panel", "motion/standard"],
    ["Mutation feedback", "Submit -> loading -> toast", "motion/fast"],
  ];
  board.appendChild(textNode("Prototype Label", "Prototype flow", 12, "semi", palette.primary));
  flows.forEach(([name, trigger, motion]) => {
    const flow = auto(`Flow / ${name}`, "VERTICAL", 3, 8);
    flow.resize(325, 106);
    flow.layoutSizingHorizontal = "FIXED";
    flow.layoutSizingVertical = "FIXED";
    applyCard(flow, 14);
    flow.appendChild(textNode("Name", name, 11, "semi"));
    flow.appendChild(textNode("Trigger", trigger, 9, "regular", palette.subtle));
    flow.appendChild(textNode("Motion", motion, 9, "medium", palette.primary));
    board.appendChild(flow);
  });
  return board;
}

function pagePlanBoard(mode) {
  const spec = pagePlanningSpecs[mode];
  const board = auto("Page Design Plan / Desktop + Mobile", "HORIZONTAL", 10, 12);
  board.resize(1120, 170);
  board.layoutSizingHorizontal = "FIXED";
  board.layoutSizingVertical = "FIXED";
  board.fills = paint({ r: 0.99, g: 0.995, b: 1 });
  board.strokes = stroke({ r: 0.76, g: 0.82, b: 0.94 });
  board.cornerRadius = 18;
  board.appendChild(textNode("Page Plan Label", "Page plan", 12, "semi", palette.primary));
  [
    ["Desktop", spec?.desktop ?? "Define desktop zones before code refactor."],
    ["Mobile", spec?.mobile ?? "Define mobile zones before code refactor."],
    ["States", spec?.states ?? "Define loading, empty, error, selected, and pending states."],
    ["Acceptance", spec?.acceptance ?? "Define acceptance criteria before implementation."],
  ].forEach(([title, subtitle]) => {
    const cell = card(`Plan / ${title}`, 245, 144, title, subtitle);
    board.appendChild(cell);
  });
  return board;
}

function desktopFrame(name) {
  const frame = auto(name, "HORIZONTAL", 0, 0);
  frame.resize(1440, 1024);
  frame.layoutSizingHorizontal = "FIXED";
  frame.layoutSizingVertical = "FIXED";
  frame.fills = paint(palette.background);
  return frame;
}

function mobileFrame(name) {
  const frame = auto(name, "VERTICAL", 8, 8);
  frame.resize(390, 844);
  frame.layoutSizingHorizontal = "FIXED";
  frame.layoutSizingVertical = "FIXED";
  frame.fills = paint(palette.background);
  return frame;
}

function sidebar() {
  const node = auto("Desktop Sidebar", "VERTICAL", 8, 14);
  node.resize(252, 1024);
  node.layoutSizingHorizontal = "FIXED";
  node.layoutSizingVertical = "FIXED";
  node.fills = paint({ r: 0.99, g: 0.995, b: 1 });
  node.strokes = stroke();
  node.appendChild(textNode("Brand", "RepairDesk\nChinaTech 工作台", 12, "semi"));
  ["概览", "订单管理", "客户管理", "回收管理", "库存商品", "设置"].forEach((item) => {
    node.appendChild(card(`Nav / ${item}`, 220, 38, item, ""));
  });
  return node;
}

function desktopContent(title, sections) {
  const node = auto("Desktop Content", "VERTICAL", 12, 24);
  node.resize(1188, 1024);
  node.layoutSizingHorizontal = "FIXED";
  node.layoutSizingVertical = "FIXED";
  node.fills = paint(palette.background);
  node.appendChild(textNode("Eyebrow", "工作台 / Figma Page Target", 10, "medium", palette.subtle));
  node.appendChild(textNode("Page Title", title, 24, "semi"));

  const metrics = auto("KPI Strip", "HORIZONTAL", 10, 0);
  metrics.resize(1120, 86);
  metrics.layoutSizingHorizontal = "FIXED";
  ["今日工单", "待报价", "尾款", "可取机"].forEach((label, index) => {
    metrics.appendChild(
      card(`KPI / ${label}`, 268, 82, index === 2 ? "€ 480" : `${index + 2}`, label),
    );
  });
  node.appendChild(metrics);

  const workspace = auto("One Page Workspace", "HORIZONTAL", 12, 0);
  workspace.resize(1120, 780);
  workspace.layoutSizingHorizontal = "FIXED";
  workspace.layoutSizingVertical = "FIXED";
  sections.forEach((section) => {
    workspace.appendChild(card(section.name, section.width, 760, section.title, section.subtitle));
  });
  node.appendChild(workspace);
  return node;
}

function mobileHeader(title, subtitle) {
  const header = auto("Mobile Floating Header", "VERTICAL", 6, 8);
  header.resize(374, 120);
  header.layoutSizingHorizontal = "FIXED";
  header.layoutSizingVertical = "FIXED";
  applyCard(header, 14);
  const nav = auto("Nav Row", "HORIZONTAL", 8, 0);
  nav.resize(350, 32);
  nav.layoutSizingHorizontal = "FIXED";
  nav.appendChild(textNode("Menu", "☰", 16, "semi"));
  nav.appendChild(textNode("Title", title, 13, "semi"));
  nav.appendChild(textNode("Action", "+", 16, "semi", palette.primary));
  header.appendChild(nav);
  header.appendChild(textNode("Context", subtitle, 9, "regular", palette.subtle));
  const chips = auto("Stepper Chips", "HORIZONTAL", 6, 0);
  ["全", "收", "检", "报", "修"].forEach((label, index) =>
    chips.appendChild(chip(label, index === 0)),
  );
  header.appendChild(chips);
  return header;
}

function mobileContent(title, subtitle, cards) {
  const frame = mobileFrame(title);
  frame.appendChild(mobileHeader(title, subtitle));
  cards.forEach((item) =>
    frame.appendChild(card(item.name, 374, item.height ?? 92, item.title, item.subtitle)),
  );
  return frame;
}

async function ensurePage(name) {
  const existing = figma.root.children.find((page) => page.name === name);
  if (existing) return existing;
  const page = figma.createPage();
  page.name = name;
  return page;
}

function placeTopLevel(page, node) {
  let maxX = 0;
  for (const child of page.children) {
    maxX = Math.max(maxX, child.x + child.width);
  }
  node.x = maxX + 160;
  node.y = 0;
  page.appendChild(node);
}

function buildDesktopPair(title, sections) {
  const frame = desktopFrame(title);
  frame.appendChild(sidebar());
  frame.appendChild(desktopContent(title, sections));
  return frame;
}

function buildTarget(mode) {
  const map = {
    "page-dashboard": {
      title: "RepairDesk / Dashboard / Desktop 1440",
      mobileTitle: "概览",
      sections: [
        { name: "Priority Queue", title: "今日优先任务", subtitle: "检测、报价、取机", width: 380 },
        { name: "Recent Orders", title: "最新工单", subtitle: "高密度业务卡片", width: 360 },
        { name: "Module Actions", title: "快捷模块", subtitle: "回收、库存、消息", width: 356 },
      ],
    },
    "page-orders-desktop": {
      title: "RepairDesk / Orders Queue / Desktop 1440",
      mobileTitle: "Protected / Mobile Orders Reference Only",
      sections: [
        {
          name: "Dense Queue",
          title: "桌面工单队列",
          subtitle: "客户、设备、阶段、付款、下一步",
          width: 700,
        },
        {
          name: "Quick Preview",
          title: "桌面快速预览",
          subtitle: "不替换移动订单详情",
          width: 396,
        },
      ],
    },
    "page-customers": {
      title: "RepairDesk / Customers CRM / Desktop 1440",
      mobileTitle: "客户管理",
      sections: [
        {
          name: "Customer Search",
          title: "客户搜索与列表",
          subtitle: "姓名、电话、标签",
          width: 300,
        },
        {
          name: "Profile Workspace",
          title: "客户档案与设备",
          subtitle: "同页查看设备/偏好",
          width: 430,
        },
        {
          name: "Activity Rail",
          title: "历史工单与跟进",
          subtitle: "订单、消息、待办",
          width: 366,
        },
      ],
    },
    "page-inventory": {
      title: "RepairDesk / Inventory / Desktop 1440",
      mobileTitle: "库存商品",
      sections: [
        { name: "Stock Table", title: "SKU / 库存表", subtitle: "供应商、状态、利润", width: 650 },
        { name: "Detail Rail", title: "商品详情与财务", subtitle: "附件、风险、流水", width: 446 },
      ],
    },
    "page-buyback": {
      title: "RepairDesk / Buyback / Desktop 1440",
      mobileTitle: "回收管理",
      sections: [
        { name: "Quote Wizard", title: "回收报价工作区", subtitle: "型号、成色、附件", width: 520 },
        { name: "Margin Panel", title: "利润与库存交接", subtitle: "报价、风险、入库", width: 280 },
        { name: "Record List", title: "回收记录", subtitle: "状态、客户、设备", width: 276 },
      ],
    },
    "page-messages": {
      title: "RepairDesk / Messages / Desktop 1440",
      mobileTitle: "消息",
      sections: [
        { name: "Thread List", title: "会话列表", subtitle: "客户与工单上下文", width: 290 },
        { name: "Conversation", title: "消息线程", subtitle: "发送预览、历史", width: 470 },
        { name: "Templates", title: "模板与变量", subtitle: "健康检查、插入变量", width: 336 },
      ],
    },
    "page-settings": {
      title: "RepairDesk / Settings / Desktop 1440",
      mobileTitle: "设置",
      sections: [
        { name: "Store And Roles", title: "门店与成员", subtitle: "角色、邀请、归属", width: 360 },
        { name: "Workflow", title: "流程配置", subtitle: "状态流转与目标", width: 390 },
        { name: "Templates Audit", title: "模板与审计", subtitle: "消息、检查、日志", width: 346 },
      ],
    },
    "page-platform-admin": {
      title: "RepairDesk / Platform Admin / Desktop 1440",
      mobileTitle: "平台管理",
      sections: [
        {
          name: "Request Queue",
          title: "访问请求队列",
          subtitle: "申请人、租户、原因",
          width: 520,
        },
        { name: "Decision Context", title: "审批上下文", subtitle: "角色、策略、风险", width: 576 },
      ],
    },
  };
  return map[mode];
}

const createdNodeIds = [];

if (RUN_MODE === "overview-foundations") {
  const page = await ensurePage(PAGES.overview);
  await figma.setCurrentPageAsync(page);
  const board = auto("RepairDesk Foundations / Desktop + Mobile", "VERTICAL", 16, 24);
  board.resize(1120, 760);
  board.fills = paint(palette.background);
  board.appendChild(textNode("Title", "RepairDesk Figma Foundations", 28, "semi"));
  board.appendChild(
    textNode(
      "Scope",
      "Figma-first UI system for compact desktop and mobile business workflows. Mobile order detail remains protected and is used only as hierarchy reference.",
      13,
      "regular",
      palette.subtle,
    ),
  );
  const row = auto("Token Cards", "HORIZONTAL", 12, 0);
  [
    ["Color", "background, card, primary, status, border"],
    ["Type", "Inter, Space Grotesk, JetBrains Mono"],
    ["Density", "comfortable, compact, dense"],
    ["Visual Polish", "neutral surfaces, thin borders, status color only"],
    ["Protection", "No mobile order info/detail/work-order redesign"],
  ].forEach(([title, subtitle]) =>
    row.appendChild(card(`Foundation / ${title}`, 260, 140, title, subtitle)),
  );
  board.appendChild(row);
  const motionRow = auto("Motion Token Cards", "HORIZONTAL", 12, 0);
  motionRow.resize(1080, 142);
  motionRow.layoutSizingHorizontal = "FIXED";
  motionTokens.forEach((token) => motionRow.appendChild(motionSpecCard(token)));
  board.appendChild(motionRow);
  const polish = auto("Motion Principles / Accessibility", "HORIZONTAL", 12, 0);
  polish.resize(1080, 128);
  polish.layoutSizingHorizontal = "FIXED";
  polish.appendChild(
    card(
      "Principle / Feedback First",
      350,
      124,
      "Feedback first",
      "Motion explains loading, selection, errors, and hierarchy. It never hides business state.",
    ),
  );
  polish.appendChild(
    card(
      "Principle / Dense Stability",
      350,
      124,
      "No layout jumps",
      "Skeletons and row actions keep final dimensions stable across desktop and mobile.",
    ),
  );
  polish.appendChild(
    card(
      "Principle / Reduced Motion",
      350,
      124,
      "Reduced motion ready",
      "Disable translate and scale; keep visible text, opacity, and focus feedback.",
    ),
  );
  board.appendChild(polish);
  placeTopLevel(page, board);
  createdNodeIds.push(board.id);
} else if (RUN_MODE === "components-core") {
  const page = await ensurePage(PAGES.components);
  await figma.setCurrentPageAsync(page);
  const board = auto("RepairDesk Components / Core", "VERTICAL", 14, 24);
  board.resize(1180, 820);
  board.fills = paint(palette.background);
  board.appendChild(textNode("Title", "RepairDesk Core Component Targets", 26, "semi"));
  const grid = auto("Component Grid", "VERTICAL", 10, 0);
  grid.resize(1120, 252);
  grid.layoutSizingHorizontal = "FIXED";
  const componentRows = [
    ["Business Card", "leading / body / trailing"],
    ["Info Tile", "label / value / meta"],
    ["Section Header", "icon / title / action"],
    ["Toolbar", "search / filters / chips"],
    ["Status Badge", "neutral / warn / success / danger"],
    ["Mobile Header", "floating card reference"],
    ["Dialog / Drawer", "standard motion / stable shell"],
    ["Toast / Notice", "instant feedback / recovery action"],
    ["Skeleton", "final-size loading placeholder"],
    ["Bottom Action Bar", "mobile high-frequency actions"],
  ];
  [componentRows.slice(0, 5), componentRows.slice(5)].forEach((rowItems, rowIndex) => {
    const row = auto(`Component Row ${rowIndex + 1}`, "HORIZONTAL", 10, 0);
    row.resize(1120, 120);
    row.layoutSizingHorizontal = "FIXED";
    rowItems.forEach(([title, subtitle]) =>
      row.appendChild(card(`Component / ${title}`, 216, 120, title, subtitle)),
    );
    grid.appendChild(row);
  });
  board.appendChild(grid);
  board.appendChild(stateMatrixBoard());
  const motionRow = auto("Component Motion Tokens", "HORIZONTAL", 12, 0);
  motionRow.resize(1120, 142);
  motionRow.layoutSizingHorizontal = "FIXED";
  motionTokens.forEach((token) => motionRow.appendChild(motionSpecCard(token)));
  board.appendChild(motionRow);
  placeTopLevel(page, board);
  createdNodeIds.push(board.id);
} else {
  const target = buildTarget(RUN_MODE);
  if (!target) throw new Error(`Unknown RUN_MODE: ${RUN_MODE}`);
  const page = await ensurePage(PAGES.targets);
  await figma.setCurrentPageAsync(page);
  const desktop = buildDesktopPair(target.title, target.sections);
  const mobile = mobileContent(target.mobileTitle, "移动端高密度目标 / 保护订单移动端", [
    {
      name: "Search And Metrics",
      title: "搜索、筛选、KPI",
      subtitle: "浮动头部下方紧凑排列",
      height: 86,
    },
    {
      name: "Primary Card",
      title: "主要业务卡片",
      subtitle: "客户 / 设备 / 状态 / 下一步",
      height: 96,
    },
    {
      name: "Detail Hierarchy",
      title: "详情层级",
      subtitle: "历史、信息、金额、附件、操作",
      height: 128,
    },
    {
      name: "Motion Feedback",
      title: "状态反馈与动效",
      subtitle: "loading、error、selected、toast",
      height: 92,
    },
    {
      name: "Bottom Actions",
      title: "底部高频动作",
      subtitle: "WhatsApp / 流转 / 收款",
      height: 72,
    },
  ]);
  const pair = auto(`${target.title} + Mobile Pair`, "VERTICAL", 18, 0);
  pair.resize(1870, 1410);
  pair.layoutSizingHorizontal = "FIXED";
  pair.layoutSizingVertical = "FIXED";
  const frameRow = auto("Desktop + Mobile Frames", "HORIZONTAL", 40, 0);
  frameRow.resize(1870, 1024);
  frameRow.layoutSizingHorizontal = "FIXED";
  frameRow.layoutSizingVertical = "FIXED";
  frameRow.appendChild(desktop);
  frameRow.appendChild(mobile);
  pair.appendChild(frameRow);
  pair.appendChild(prototypeFlowBoard(RUN_MODE));
  pair.appendChild(pagePlanBoard(RUN_MODE));
  placeTopLevel(page, pair);
  createdNodeIds.push(pair.id, desktop.id, mobile.id);
}

return {
  success: true,
  runMode: RUN_MODE,
  createdNodeIds,
  pages: Object.values(PAGES),
  nextRunModes: [
    "overview-foundations",
    "components-core",
    "page-dashboard",
    "page-orders-desktop",
    "page-customers",
    "page-inventory",
    "page-buyback",
    "page-messages",
    "page-settings",
    "page-platform-admin",
  ],
};
