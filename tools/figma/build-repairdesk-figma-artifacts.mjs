import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../..");
const blueprintPath = join(__dirname, "repairdesk-ui-system-blueprint.json");
const runnerPath = join(__dirname, "use-figma-create-repairdesk-ui-system.mjs");
const outputDir = join(__dirname, "generated");
const payloadDir = join(outputDir, "use-figma-payloads");

const blueprint = JSON.parse(readFileSync(blueprintPath, "utf8"));
const runnerTemplate = readFileSync(runnerPath, "utf8");

const runModes = [
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
];

mkdirSync(payloadDir, { recursive: true });

for (const runMode of runModes) {
  const code = runnerTemplate.replace(/const RUN_MODE = ".*?";/, `const RUN_MODE = "${runMode}";`);
  const payload = {
    fileKey: blueprint.figmaFileKey,
    skillNames: "figma-use,figma-generate-design",
    description: `RepairDesk Figma UI system generation: ${runMode}`,
    code,
  };
  writeFileSync(join(payloadDir, `${runMode}.js`), code);
  writeFileSync(join(payloadDir, `${runMode}.json`), `${JSON.stringify(payload, null, 2)}\n`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const stateByComponent = new Map(
  (blueprint.interactionStates?.componentMatrix ?? []).map((entry) => [
    entry.component,
    entry.states,
  ]),
);

const componentCards = blueprint.componentTargets
  .map((component) => {
    const states =
      stateByComponent.get(component.name) ?? blueprint.interactionStates?.requiredStates ?? [];
    return `
      <article class="card component-card">
        <div class="label">Component</div>
        <h3>${escapeHtml(component.name)}</h3>
        <p>${escapeHtml(component.variants.join(" / "))}</p>
        <div class="state-pills">${states
          .slice(0, 5)
          .map((state) => `<span>${escapeHtml(state)}</span>`)
          .join("")}</div>
        <small>${escapeHtml(component.codeSources.join(", "))}</small>
      </article>
    `;
  })
  .join("");

const motionCards = (blueprint.motionSystem?.tokens ?? [])
  .map(
    (token) => `
      <article class="card motion-card">
        <div class="label">Motion</div>
        <h3>${escapeHtml(token.name)}</h3>
        <p>${escapeHtml(token.durationMs)}ms / ${escapeHtml(token.easing)}</p>
        <div class="motion-track"><span style="animation-duration:${Math.max(token.durationMs * 6, 600)}ms"></span></div>
        <small>${escapeHtml(token.usage.join(", "))}</small>
      </article>
    `,
  )
  .join("");

const stateMatrix = (blueprint.interactionStates?.componentMatrix ?? [])
  .map(
    (entry) => `
      <tr>
        <th>${escapeHtml(entry.component)}</th>
        <td>${entry.states.map((state) => `<span>${escapeHtml(state)}</span>`).join("")}</td>
      </tr>
    `,
  )
  .join("");

const prototypeFlows = (blueprint.prototypeFlows ?? [])
  .map(
    (flow) => `
      <article class="card prototype-card">
        <div class="label">Prototype</div>
        <h3>${escapeHtml(flow.name)}</h3>
        <p><strong>Trigger:</strong> ${escapeHtml(flow.trigger)}</p>
        <p><strong>Motion:</strong> ${escapeHtml(flow.transition)}</p>
        <small>${escapeHtml(flow.result)}</small>
      </article>
    `,
  )
  .join("");

const pagePlanByDomain = new Map(
  (blueprint.pageDesignPlans ?? []).map((plan) => [plan.domain, plan]),
);

function renderPlanList(title, items, limit = 4) {
  return `
    <div class="plan-column">
      <h4>${escapeHtml(title)}</h4>
      <ul>${(items ?? [])
        .slice(0, limit)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("")}</ul>
    </div>
  `;
}

function renderPagePlan(target) {
  const plan = pagePlanByDomain.get(target.domain);
  if (!plan) {
    return `
      <article class="plan-card">
        <h3>${escapeHtml(target.domain)}</h3>
        <p>No detailed page plan has been defined yet.</p>
      </article>
    `;
  }

  return `
    <article class="plan-card">
      <header>
        <div>
          <span>Page Planning</span>
          <strong>${escapeHtml(target.domain)}</strong>
        </div>
        <p>${escapeHtml(plan.densityTargets?.desktop ?? "")}</p>
      </header>
      <div class="plan-grid">
        ${renderPlanList("Desktop Zones", plan.desktopZones)}
        ${renderPlanList("Mobile Zones", plan.mobileZones)}
        ${renderPlanList("Primary Actions", plan.primaryActions)}
        ${renderPlanList("States", plan.states)}
        ${renderPlanList("Motion", plan.motionFlows, 3)}
        ${renderPlanList("Acceptance", plan.acceptance, 3)}
      </div>
      <small>${escapeHtml(plan.densityTargets?.mobile ?? "")}</small>
    </article>
  `;
}

const pagePairs = blueprint.pageTargets
  .map(
    (target) => `
      <section class="page-pair">
        <div class="desktop-frame">
          <header>
            <span>Desktop 1440</span>
            <strong>${escapeHtml(target.desktopFrame)}</strong>
          </header>
          <div class="metric-strip">
            <div><b>12</b><span>今日</span></div>
            <div><b>5</b><span>待处理</span></div>
            <div><b>€480</b><span>尾款</span></div>
            <div><b>3</b><span>可取</span></div>
          </div>
          <div class="desktop-workspace">
            <div class="panel wide">
              <h4>${escapeHtml(target.desktopGoal)}</h4>
              <p>Dense table / split workspace / one page decision surface.</p>
            </div>
            <div class="panel">
              <h4>Context</h4>
              <p>History, finance, status, next action, and risk.</p>
            </div>
          </div>
        </div>
        <div class="mobile-frame ${target.mobileFrame.startsWith("Protected") ? "protected" : ""}">
          <header class="mobile-header">
            <button>☰</button>
            <div>
              <strong>${escapeHtml(target.mobileFrame)}</strong>
              <span>${escapeHtml(target.mobileGoal)}</span>
            </div>
            <button>+</button>
          </header>
          <div class="chips"><span>全</span><span>收</span><span>检</span><span>报</span><span>修</span></div>
          <article class="mobile-card">
            <b>历史 / 状态 / 下一步</b>
            <p>Borrow hierarchy from the protected mobile order detail standard.</p>
          </article>
          <article class="mobile-card">
            <b>状态反馈 / 动效</b>
            <p>Loading, selected, error, toast, and reduced-motion states are specified before code refactor.</p>
          </article>
          <article class="mobile-card">
            <b>客户 / 设备 / 金额</b>
            <p>Compact information cards, neutral surfaces, focused status color.</p>
          </article>
          <footer><span>WhatsApp</span><span>流转</span><span>收款</span></footer>
        </div>
        ${renderPagePlan(target)}
      </section>
    `,
  )
  .join("");

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RepairDesk Figma UI System Storyboard</title>
    <style>
      :root {
        --bg: #f6f8fb;
        --card: #fff;
        --text: #1f2633;
        --muted: #687384;
        --border: #d8dee8;
        --primary: #315cff;
        --success: #148a59;
        --warn: #b76507;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
      }
      main {
        display: grid;
        gap: 24px;
        padding: 32px;
      }
      .hero, .card, .desktop-frame, .mobile-frame {
        background: var(--card);
        border: 1px solid var(--border);
        box-shadow: 0 14px 34px -28px rgba(32, 38, 52, 0.45);
      }
      .hero {
        border-radius: 20px;
        padding: 22px;
      }
      h1, h2, h3, h4, p { margin: 0; }
      h1 { font-size: 24px; }
      .hero p { margin-top: 8px; color: var(--muted); max-width: 900px; }
      .component-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 10px;
      }
      .card {
        min-height: 132px;
        border-radius: 16px;
        padding: 12px;
      }
      .label {
        color: var(--primary);
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .card h3 { margin-top: 8px; font-size: 14px; }
      .card p, .card small { display: block; margin-top: 8px; color: var(--muted); font-size: 11px; }
      .state-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 8px;
      }
      .state-pills span,
      .state-table span {
        display: inline-flex;
        align-items: center;
        min-height: 20px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: #f8fafc;
        padding: 0 7px;
        color: var(--muted);
        font-size: 10px;
        font-weight: 650;
      }
      .motion-grid,
      .prototype-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }
      .prototype-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }
      .motion-track {
        position: relative;
        height: 18px;
        margin-top: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: #edf3ff;
      }
      .motion-track span {
        position: absolute;
        top: 3px;
        left: 4px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--primary);
        animation: motion-preview 1200ms ease-in-out infinite alternate;
      }
      @keyframes motion-preview {
        from { transform: translateX(0); opacity: 0.72; }
        to { transform: translateX(210px); opacity: 1; }
      }
      .state-table {
        width: 100%;
        border-collapse: collapse;
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: white;
      }
      .state-table th,
      .state-table td {
        border-bottom: 1px solid var(--border);
        padding: 10px;
        text-align: left;
        vertical-align: top;
        font-size: 12px;
      }
      .state-table th {
        width: 260px;
        color: var(--text);
      }
      .state-table td {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .prototype-card p {
        line-height: 1.35;
      }
      .page-pair {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 390px;
        gap: 18px;
        align-items: start;
      }
      .plan-card {
        grid-column: 1 / -1;
        border: 1px solid var(--border);
        border-radius: 18px;
        background: white;
        padding: 14px;
      }
      .plan-card header {
        display: grid;
        grid-template-columns: minmax(0, 280px) minmax(0, 1fr);
        gap: 12px;
        align-items: start;
        margin-bottom: 12px;
      }
      .plan-card header span,
      .plan-card small {
        display: block;
        color: var(--muted);
        font-size: 11px;
      }
      .plan-card header strong {
        display: block;
        margin-top: 3px;
        font-size: 15px;
      }
      .plan-card header p {
        color: var(--muted);
        font-size: 12px;
        line-height: 1.4;
      }
      .plan-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .plan-column {
        min-height: 130px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: #fbfcfe;
        padding: 10px;
      }
      .plan-column h4 {
        font-size: 12px;
        margin: 0 0 7px;
      }
      .plan-column ul {
        display: grid;
        gap: 5px;
        margin: 0;
        padding-left: 16px;
      }
      .plan-column li {
        color: var(--muted);
        font-size: 11px;
        line-height: 1.35;
      }
      .plan-card small {
        margin-top: 10px;
      }
      .desktop-frame {
        min-height: 480px;
        border-radius: 22px;
        padding: 18px;
      }
      .desktop-frame header {
        display: grid;
        gap: 4px;
        margin-bottom: 14px;
      }
      .desktop-frame header span, .mobile-header span {
        color: var(--muted);
        font-size: 11px;
      }
      .metric-strip {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 14px;
      }
      .metric-strip div, .panel, .mobile-card {
        border: 1px solid var(--border);
        border-radius: 16px;
        background: #fbfcfe;
      }
      .metric-strip div {
        display: grid;
        gap: 4px;
        padding: 10px;
      }
      .metric-strip b { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 18px; }
      .metric-strip span { color: var(--muted); font-size: 10px; }
      .desktop-workspace {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(260px, 0.8fr);
        gap: 12px;
      }
      .panel {
        min-height: 320px;
        padding: 14px;
      }
      .panel h4 { font-size: 15px; line-height: 1.35; }
      .panel p { margin-top: 10px; color: var(--muted); font-size: 12px; }
      .mobile-frame {
        width: 390px;
        min-height: 620px;
        border-radius: 24px;
        padding: 8px;
      }
      .mobile-frame.protected {
        outline: 2px dashed var(--warn);
        outline-offset: 4px;
      }
      .mobile-header {
        display: grid;
        grid-template-columns: 32px minmax(0, 1fr) 32px;
        gap: 8px;
        align-items: center;
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 8px;
      }
      .mobile-header button {
        width: 28px;
        height: 28px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: white;
      }
      .mobile-header div {
        min-width: 0;
        text-align: center;
      }
      .mobile-header strong, .mobile-header span {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .mobile-header strong { font-size: 11px; }
      .chips {
        display: flex;
        gap: 6px;
        padding: 8px 2px;
        overflow: hidden;
      }
      .chips span {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--primary);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
      }
      .chips span:not(:first-child) {
        background: #eef2f8;
        color: var(--muted);
      }
      .mobile-card {
        margin-top: 8px;
        padding: 10px;
      }
      .mobile-card b {
        font-size: 12px;
      }
      .mobile-card p {
        margin-top: 6px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.35;
      }
      footer {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-top: 14px;
      }
      footer span {
        display: grid;
        place-items: center;
        height: 36px;
        border-radius: 12px;
        background: var(--primary);
        color: #fff;
        font-size: 12px;
        font-weight: 700;
      }
      @media (max-width: 1100px) {
        .component-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .motion-grid, .prototype-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .page-pair { grid-template-columns: 1fr; }
        .plan-grid { grid-template-columns: 1fr; }
        .plan-card header { grid-template-columns: 1fr; }
      }
      @media (prefers-reduced-motion: reduce) {
        .motion-track span { animation: none; transform: translateX(180px); }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <h1>RepairDesk Figma UI System Storyboard</h1>
        <p>
          Figma MCP is currently blocked. This local storyboard previews the component and page targets that should be generated in Figma once access resumes. Protected mobile order information/detail/work-order pages are reference-only.
        </p>
      </section>
      <section>
        <h2>Core Components</h2>
        <div class="component-grid">${componentCards}</div>
      </section>
      <section>
        <h2>Motion Tokens</h2>
        <div class="motion-grid">${motionCards}</div>
      </section>
      <section>
        <h2>Interaction States</h2>
        <table class="state-table">
          <tbody>${stateMatrix}</tbody>
        </table>
      </section>
      <section>
        <h2>Desktop + Mobile Page Targets</h2>
        ${pagePairs}
      </section>
      <section>
        <h2>Prototype Flows</h2>
        <div class="prototype-grid">${prototypeFlows}</div>
      </section>
    </main>
  </body>
</html>
`;

writeFileSync(
  join(outputDir, "repairdesk-ui-system-storyboard.html"),
  html.replace(/[ \t]+$/gm, ""),
);

const manifest = {
  generatedAt: new Date().toISOString(),
  fileKey: blueprint.figmaFileKey,
  runModes,
  payloadDir: "tools/figma/generated/use-figma-payloads",
  storyboard: "tools/figma/generated/repairdesk-ui-system-storyboard.html",
  protectedMobileOrderSurfaces: blueprint.protectedMobileOrderSurfaces,
  pageDesignPlans: blueprint.pageDesignPlans?.map((plan) => plan.domain) ?? [],
  motionTokens: blueprint.motionSystem?.tokens?.map((token) => token.name) ?? [],
  prototypeFlows: blueprint.prototypeFlows?.map((flow) => flow.name) ?? [],
  interactionStates: blueprint.interactionStates?.requiredStates ?? [],
};

writeFileSync(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      ok: true,
      payloads: runModes.length,
      outputDir: outputDir.replace(`${repoRoot}/`, ""),
      storyboard: manifest.storyboard,
    },
    null,
    2,
  ),
);
