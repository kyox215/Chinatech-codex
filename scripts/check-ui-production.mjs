import assert from "node:assert/strict";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { chromium, webkit } from "@playwright/test";

// This checks real compiled CSS against stable component semantics. It does not
// replace the React interaction, authorization or business-flow browser tests.
const dist = path.resolve(process.argv[2] || ".next-backend");
const proof = path.resolve(process.env.UI_DESIGN_PROOF_DIR || ".local/ui-proof/production-design");
await mkdir(proof, { recursive: true });
const buildId = (await readFile(path.join(dist, "BUILD_ID"), "utf8")).trim();
const names = (await readdir(path.join(dist, "static"), { recursive: true }))
  .filter(name => name.endsWith(".css")).sort();
assert.ok(names.length, "The production build must emit CSS");
const assets = await Promise.all(names.map(async name => {
  const css = await readFile(path.join(dist, "static", name), "utf8");
  return { name, css, sha256: createHash("sha256").update(css).digest("hex") };
}));
const all = assets.map(asset => asset.css).join("\n");
assert.ok(!all.includes("</style>"));
function moduleClass(module, local) {
  const match = all.match(new RegExp(`\\.([A-Za-z0-9_-]*${module}[A-Za-z0-9_-]*__${local})\\b`));
  assert.ok(match, `Compiled ${module}/${local} must exist`);
  return match[1];
}
const detail = Object.fromEntries(["detail", "layout", "column", "group", "groupToggle", "groupDesktopHead", "groupBody", "embeddedGroup"]
  .map(key => [key, moduleClass("retail-detail", key)]));
const surface = { page: moduleClass("retail-surface", "page"), head: moduleClass("retail-surface", "sectionHead") };
const office = { dialog: moduleClass("office-tools", "downloadDialog"), heading: moduleClass("office-tools", "dialogHeading") };
const catalog = { table: moduleClass("device-catalog", "table"), name: moduleClass("device-catalog", "name") };
const font = await readFile("public/fonts/source-sans-3/source-sans-3-roman.woff2");
assert.equal(font.subarray(0, 4).toString(), "wOF2");
const fontHash = createHash("sha256").update(font).digest("hex");
const provenance = JSON.parse(await readFile("public/fonts/source-sans-3/provenance.json", "utf8"));
assert.equal(provenance.files.find(file => file.file.endsWith(".woff2")).sha256, fontHash);

function group(id, embedded = false) {
  return `<section class="panel ${detail.group} ${embedded ? detail.embeddedGroup : ""}" data-retail-group="${id}" data-open="false">
    <button class="detail-section__head ${surface.head} ${detail.groupToggle}" aria-expanded="false"><div><span>◇</span><h3>${id}</h3></div></button>
    <div class="detail-section__head ${surface.head} ${detail.groupDesktopHead}"><div><span>◇</span><h3>${id}</h3></div></div>
    <div class="${detail.groupBody}" id="${id}-body">Saved business facts</div></section>`;
}
function markup(css) {
  return `<!doctype html><html lang="en"><head><base href="https://ui-style.test/"><style>${css}</style></head><body>
    <main class="module-page retail-detail ${surface.page} ${detail.detail}"><div class="${detail.layout}"><div class="${detail.column}">
      ${group("identity")}${group("history", true)}${group("source", true)}
    </div></div></main>
    <div class="panel" id="panel">Figma card</div>
    <button class="button button--primary" id="primary">Primary action</button>
    <button class="button button--secondary" id="secondary">Secondary action</button>
    <button class="button button--tiny" id="tiny">View all</button>
    <button class="icon-button" id="icon" aria-label="Close">×</button>
    <a class="navigation-link" id="navigation" href="#">Navigation<span class="navigation-feedback" data-pending="true" aria-hidden="true"><svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></span></a>
    <label class="field"><span id="field-label">Input</span><span class="input-control" data-filled="false" data-invalid="false"><span class="input-control__body"><input id="input" class="input-control__native" aria-label="Input"></span></span></label>
    <div class="repair-module-table__head" id="table-header">Model</div>
    <div class="repair-unified-list"><div class="repair-module-row"><div class="repair-module-row__device"><div><strong id="repair-name">Repair model</strong></div></div></div></div>
    <table class="${catalog.table}"><tbody><tr><td class="${catalog.name}"><strong id="catalog-name">Catalog model</strong></td></tr></tbody></table>
    <dialog open class="repair-parts-dialog" id="dialog"><header><h2>Confirm action</h2></header><p>Actual saved facts remain unchanged.</p><footer><button class="button button--secondary">Cancel</button></footer></dialog>
    <dialog open class="${office.dialog}" id="office-dialog"><div class="${office.heading}" id="office-heading"><h2>Download versions</h2><button class="icon-button" aria-label="Close versions">×</button></div><p>Available architecture</p></dialog>
  </body></html>`;
}

const rows = [];
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    for (const order of ["forward", "reverse"]) {
      const page = await browser.newPage();
      let fontRequests = 0;
      const unexpectedRequests = [];
      await page.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.origin === "https://ui-style.test" && url.pathname === "/fonts/source-sans-3/source-sans-3-roman.woff2") {
          fontRequests += 1;
          await route.fulfill({ status: 200, contentType: "font/woff2", body: font });
        } else {
          unexpectedRequests.push(url.origin + url.pathname);
          await route.abort();
        }
      });
      const css = (order === "forward" ? assets : [...assets].reverse()).map(asset => asset.css).join("\n");
      await page.setContent(markup(css), { waitUntil: "domcontentloaded" });
      const loaded = await page.evaluate(async () => (await document.fonts.load('16px "Source Sans 3"')).map(face => face.status));
      assert.ok(loaded.length && loaded.every(status => status === "loaded"), "The actual bundled font must load");
      for (const width of [1440, 1024, 390, 375]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.locator("#primary").focus();
        const result = await page.evaluate(() => {
          const style = selector => getComputedStyle(document.querySelector(selector));
          const rect = selector => {
            const box = document.querySelector(selector).getBoundingClientRect();
            return { width: box.width, height: box.height };
          };
          const visible = id => {
            const element = document.querySelector(`[data-retail-group="${id}"]`);
            return [...element.querySelectorAll(":scope > button, :scope > .detail-section__head:not(button)")]
              .filter(node => getComputedStyle(node).display !== "none").map(node => node.tagName);
          };
          return {
            identity: visible("identity"), history: visible("history"), source: visible("source"),
            closedBody: style("#identity-body").display,
            button: { size: style("#primary").fontSize, weight: style("#primary").fontWeight, radius: style("#primary").borderRadius, background: style("#primary").backgroundColor },
            panelRadius: style("#panel").borderRadius,
            pendingOutline: style("#navigation").outlineStyle,
            pendingSlot: { position: style("#navigation .navigation-feedback").position, ...rect("#navigation .navigation-feedback") },
            dialog: { radius: style("#dialog").borderRadius, padding: style("#dialog").paddingTop },
            table: { size: style("#table-header").fontSize, weight: style("#table-header").fontWeight, background: style("#table-header").backgroundColor },
            repairName: { size: style("#repair-name").fontSize, weight: style("#repair-name").fontWeight },
            catalogName: { size: style("#catalog-name").fontSize, weight: style("#catalog-name").fontWeight },
            office: { margin: style("#office-heading").marginBottom, padding: style("#office-heading").paddingBottom, border: style("#office-heading").borderBottomWidth, titleSize: style("#office-heading h2").fontSize, titleWeight: style("#office-heading h2").fontWeight, titleLine: style("#office-heading h2").lineHeight, radius: style("#office-dialog").borderTopLeftRadius },
            inputSize: style("#input").fontSize, label: { size: style("#field-label").fontSize, weight: style("#field-label").fontWeight }, tiny: rect("#tiny"), icon: rect("#icon"),
          };
        });
        const mobile = width < 768;
        assert.deepEqual(result.identity, [mobile ? "BUTTON" : "DIV"], `One visible heading at${width}/${order}`);
        assert.deepEqual(result.history, ["BUTTON"]);
        assert.deepEqual(result.source, ["BUTTON"]);
        assert.equal(result.closedBody === "none", mobile);
        await page.locator('[data-retail-group="identity"]').evaluate(element => element.setAttribute("data-open", "true"));
        assert.notEqual(await page.locator("#identity-body").evaluate(element => getComputedStyle(element).display), "none");
        await page.locator('[data-retail-group="identity"]').evaluate(element => element.setAttribute("data-open", "false"));
        assert.deepEqual(result.button, { size: "14px", weight: "500", radius: "8px", background: "rgb(95, 87, 255)" });
        assert.equal(result.panelRadius, "16px");
        assert.equal(result.pendingOutline, "none", "Pending does not add a frame");
        assert.deepEqual(result.pendingSlot, { position: "static", width: 16, height: 16 }, "Pending occupies its inline slot");
        await page.locator("#navigation").focus(); await page.keyboard.press("Shift");
        assert.equal(await page.locator("#navigation").evaluate(e => document.activeElement === e), true);
        assert.deepEqual(await page.locator("#navigation").evaluate(e => ({style:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth})), {style:"solid",width:"3px"}, "Keyboard focus remains visible independently");
        assert.deepEqual(result.dialog, { radius: "16px", padding: "16px" });
        assert.deepEqual(result.table, { size: "14px", weight: "400", background: "rgb(246, 247, 249)" });
        assert.equal(result.inputSize, "16px");
        assert.deepEqual(result.label, { size: "14px", weight: "500" });
        assert.equal(result.office.margin, "10px");
        assert.equal(result.office.padding, "12px");
        assert.equal(result.office.border, "1px");
        assert.equal(result.office.titleSize, mobile ? "20px" : "18px");
        assert.equal(result.office.titleWeight, "500");
        assert.equal(result.office.titleLine, "24px");
        assert.equal(result.office.radius, mobile ? "24px" : "16px");
        if (!mobile) {
          assert.deepEqual(result.repairName, { size: "16px", weight: "500" });
          assert.deepEqual(result.catalogName, { size: "16px", weight: "500" });
        }
        if (mobile) {
          assert.ok(Number.parseFloat(result.inputSize) >= 16);
          for (const target of [result.tiny, result.icon]) assert.ok(target.width >= 44 && target.height >= 44);
        }
        rows.push({ engine: engine.name(), order, width, ...result });
      }
      assert.ok(fontRequests > 0);
      assert.deepEqual(unexpectedRequests, []);
      await page.close();
    }
  } finally { await browser.close(); }
}
const result = {
  at: new Date().toISOString(), buildId,
  classification: "Actual production CSS, synthetic stable component DOM; both stylesheet orders and two real browser engines. React interactions are verified separately.",
  passed: rows.length, assets: assets.map(({ name, sha256 }) => ({ name, sha256 })), fontBytes: font.length, fontSha256: fontHash,
  externalNetworkRequests: 0, productionBusinessWrites: 0, rows,
};
await writeFile(path.join(proof, "verification.json"), JSON.stringify(result, null, 2));
console.log(`Production design contracts passed: ${rows.length} conditions, ${assets.length} compiled CSS assets, font${font.length}B, zero external requests.`);
