import assert from "node:assert/strict";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { chromium, webkit } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Menu, ScanLine, PackageCheck, Plus } from "lucide-react";

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
const customer = Object.fromEntries(["listPanel", "row", "identity", "avatar", "recordCount", "activity", "recordLink", "recordIcon", "recordInfo"]
  .map(key => [key, moduleClass("customers", key)]));
const repairTotal = moduleClass("repair-detail-workspace", "total");
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
function navigationSlot(pending) {
  return `<span class="navigation-feedback" data-pending="${pending}" data-has-icon="true" aria-hidden="true"><span class="navigation-feedback__icon"><svg width="17" height="17"><path d="M6 3l5 5-5 5" /></svg></span><svg class="spin" width="16" height="16"><circle cx="8" cy="8" r="6" /></svg></span><span class="sr-only" aria-live="polite">${pending ? "Opening page" : ""}</span>`;
}
function listSamples() {
  const labels = [
    { locale: "zh-CN", status: "已下单 · 待到货", repairs: "维修", sales: "销售记录", item: "笔记本电脑显示屏及触摸组件待核对规格", name: "离线测试客户长称呼", units: "件", records: "条" },
    { locale: "it", status: "Ordinato · In attesa di arrivo", repairs: "Riparazione", sales: "Storico vendite", item: "Schermo notebook e gruppo touch con specifiche da verificare", name: "Cliente di prova con nome lungo", units: "pezzi", records: "record" },
    { locale: "en", status: "Ordered · Awaiting arrival", repairs: "Repair", sales: "Sales records", item: "Notebook display and touch assembly with specifications to review", name: "Offline test customer with a long name", units: "items", records: "records" },
  ];
  return labels.map(label => `<section lang="${label.locale}" data-list-locale="${label.locale}">
    <div class="procurement-group"><div class="module-table-scroll">${[false, true].map(pending => `<a href="/app/procurement/OFFLINE-PO" class="procurement-row navigation-link" data-list-row="procurement" data-state="${pending}"><div class="procurement-row__item"><span class="procurement-icon">◇</span><div><strong>${label.item}</strong><small>OFFLINE-PO-20261016</small></div></div><div class="procurement-row__repair"><strong>Notebook model</strong><small>OFFLINE-CT-20261016</small></div><div class="procurement-row__progress"><span class="status-pill status-pill--progress">${label.status}</span><small>12 / 123 ${label.units}</small></div><div class="procurement-row__date"><strong>2026-10-20</strong><small>ETA</small></div>${navigationSlot(pending)}</a>`).join("")}</div></div>
    ${[false, true].map(pending => `<div class="panel ${customer.listPanel}"><div class="module-table-scroll"><a href="/app/customers/OFFLINE-CUSTOMER" class="${customer.row} navigation-link" data-list-row="customer" data-state="${pending}"><span class="${customer.identity}"><span class="${customer.avatar}">◇</span><span><strong>${label.name}</strong><small>+39 000 000 0000</small></span></span><span class="${customer.recordCount}"><small>${label.repairs}</small>123 ${label.records}</span><span class="${customer.recordCount}"><small>${label.sales}</small>456 ${label.records}</span><span class="${customer.activity}">2026-10-16 12:34</span>${navigationSlot(pending)}</a></div></div>`).join("")}
    ${[false, true].map(pending => `<a href="/app/repairs/OFFLINE-CT" class="${customer.recordLink} navigation-link" data-list-row="customer-record" data-state="${pending}"><span class="${customer.recordIcon}">◇</span><span class="${customer.recordInfo}"><strong>${label.item}</strong><small>OFFLINE-CT-20261016</small><p>${label.status}</p></span>${navigationSlot(pending)}</a>`).join("")}
  </section>`).join("");
}
function markup(css) {
  return `<!doctype html><html lang="en"><head><base href="https://ui-style.test/"><style>${css}</style></head><body>
    <main class="module-page retail-detail ${surface.page} ${detail.detail}"><div class="${detail.layout}"><div class="${detail.column}">
      ${group("identity")}${group("history", true)}${group("source", true)}
    </div></div></main>
    <div class="module-page" id="heading-samples">
      <header class="module-heading"><div class="module-title"><button class="icon-button page-menu-button" id="heading-menu">≡</button><a class="icon-button page-back-button">←</a><div class="module-title__content"><div class="module-title__line"><h2>Scheda prodotto</h2><span class="status-pill" id="heading-status">Ricambi da scegliere · Non ordinato</span></div></div></div><a class="button page-toolbar-action navigation-link" id="heading-action"><span class="navigation-feedback" data-pending="true"><span class="navigation-feedback__icon"><svg width="17" height="17"><path d="M2 2h12v12H2z" /></svg></span><svg class="spin" width="16" height="16"><circle cx="8" cy="8" r="6" /></svg></span><span id="heading-action-label">New matching model</span><span class="sr-only" id="heading-action-status">Opening page</span></a></header>
      <header class="module-heading repair-detail__toolbar"><div class="module-title"><button class="icon-button page-menu-button" id="group-menu">≡</button><div class="module-title__content"><h2>CT-2026-0929</h2></div></div><div class="module-heading__actions module-heading__actions--icons"><button class="button page-toolbar-action" id="group-action">◇<span>Print receipt</span></button><button class="button page-toolbar-action">↻<span>Rework</span></button></div></header>
    </div>
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
    <div class="app-shell"><div class="app-main module-page" id="list-samples">${listSamples()}</div></div>
    <div class="${repairTotal}" id="repair-total"><strong>Total</strong><strong>€ 123.00</strong></div>
    <dialog open class="repair-parts-dialog" id="dialog"><header><h2>Confirm action</h2></header><p>Actual saved facts remain unchanged.</p><footer><button class="button button--secondary">Cancel</button></footer></dialog>
    <dialog open class="${office.dialog}" id="office-dialog"><div class="${office.heading}" id="office-heading"><h2>Download versions</h2><button class="icon-button" aria-label="Close versions">×</button></div><p>Available architecture</p></dialog>
  </body></html>`;
}

// New repair selectors are checked against this same production payload.
// This is native stable DOM/CSS evidence; real React positioning is separate.
async function repairFeedbackStyle(page, width) {
  await page.setViewportSize({ width, height: 420 });
  const value = await page.evaluate(() => {
    const previousFocus=document.activeElement,previousScroll={x:scrollX,y:scrollY};
    const host = document.createElement("section"); host.id = "repair-feedback-css";
    host.innerHTML = `<div class="repair-unified-list"><header class="module-heading"><div class="module-title"><h2>DEMO</h2></div><div class="module-heading__actions"><button class="icon-button">Scan</button><button class="button button--compact">Batch</button><a class="button button--compact">Create</a></div></header><div class="repair-filterbar"><label class="module-search"><span class="input-control"><span class="input-control__body"><input class="input-control__native" value="DEMO" aria-label="DEMO search"></span></span><button>Clear</button><span class="repair-result-count">2</span></label><button class="button repair-filter-trigger">Filter</button><label class="module-select"><span class="select-control"><select><option>DEMO</option></select></span></label><label class="module-select"><span class="select-control"><select><option>DEMO</option></select></span></label></div><div class="repair-row-parts-cell" style="width:220px"><button class="button repair-row-parts"><span class="repair-row-parts__body"><svg width="17" height="17"></svg><span><span class="repair-row-parts__names">DEMO long display and touch requirement, DEMO battery requirement, DEMO legacy item, DEMO fourth item</span><small class="repair-row-parts__suppliers">DEMO-LIST 虚构维修配件供应商 · Laboratorio Componenti Dimostrativi per Smartphone e Batterie SRL</small></span></span></button></div></div><dialog class="repair-parts-dialog repair-part-dialog repair-items-dialog repair-procurement-dialog"><header><h2>DEMO supplier</h2><button class="icon-button">×</button></header><div class="repair-procurement-dialog__body" data-combobox-boundary><fieldset class="form-fields"><div class="field search-combobox"><label>DEMO supplier</label><span class="input-control"><span class="input-control__body"><input class="input-control__native"></span></span><div class="search-combobox__menu" style="--combobox-space:20px"><ul>${Array.from({length:12},(_,i)=>`<li><button type="button">DEMO option ${i+1}</button></li>`).join("")}</ul></div></div>${Array.from({length:14},(_,i)=>`<p>DEMO repair requirement ${i+1}</p>`).join("")}</fieldset></div><div class="repair-procurement-dialog__footer"><footer><button class="button">Cancel</button><button class="button">Save</button></footer></div></dialog>`;
    document.body.append(host);
    const box = node => {const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const heights = selector => [...host.querySelectorAll(selector)].map(node=>box(node).height);
    const toolbar = heights(".repair-filterbar > .module-search,.repair-filterbar > .repair-filter-trigger,.repair-filterbar > .module-select");
    const actions = heights(".module-heading__actions > .button,.module-heading__actions > .icon-button");
    const names=host.querySelector(".repair-row-parts__names"),namesStyle=getComputedStyle(names);
    const summary={height:box(names).height,lineHeight:Number.parseFloat(namesStyle.lineHeight),color:namesStyle.color,whiteSpace:namesStyle.whiteSpace,overflow:namesStyle.overflowX,textOverflow:namesStyle.textOverflow,clientWidth:names.clientWidth,scrollWidth:names.scrollWidth};
    const singleCell=host.querySelector(".repair-row-parts-cell").cloneNode(true);singleCell.style.width="129px";
    singleCell.querySelector(".repair-row-parts__names").textContent="DEMO complete single replacement request";
    host.querySelector(".repair-unified-list").append(singleCell);
    const singleContainer=box(singleCell.querySelector(".repair-row-parts__body > span")),singleName=box(singleCell.querySelector(".repair-row-parts__names"));
    const dialog=host.querySelector("dialog"),body=dialog.querySelector(".repair-procurement-dialog__body"),header=dialog.querySelector("header"),footer=dialog.querySelector(".repair-procurement-dialog__footer"),menu=dialog.querySelector(".search-combobox__menu");
    dialog.showModal();
    const before={header:box(header),footer:box(footer)};body.scrollTop=100;
    const after={header:box(header),footer:box(footer)};
    const menu20=box(menu).height;menu.style.setProperty("--combobox-space","0px");const menu0=box(menu).height;
    const result={toolbar,actions,summary,singleContainer,singleName,dialog:box(dialog),body:box(body),header:after.header,footer:after.footer,bodyScrollHeight:body.scrollHeight,bodyClientHeight:body.clientHeight,bodyScrollTop:body.scrollTop,outerOverflow:getComputedStyle(dialog).overflowY,bodyOverflow:getComputedStyle(body).overflowY,headerFixedDuringBodyScroll:before.header.y===after.header.y,footerFixedDuringBodyScroll:before.footer.y===after.footer.y,close:box(header.querySelector("button")),footerActions:[...footer.querySelectorAll("button")].map(box),menu20,menu0,unrelatedDialogWidth:document.getElementById("dialog").getBoundingClientRect().width,inputFont:getComputedStyle(host.querySelector(".repair-filterbar input")).fontSize};
    dialog.close();
    const supplier=host.querySelector(".repair-row-parts__suppliers"),supplierButton=supplier.closest("button");
    supplierButton.scrollIntoView({block:"nearest",inline:"nearest"});supplierButton.focus();
    const supplierStyle=getComputedStyle(supplier),supplierBox=box(supplier),supplierButtonBox=box(supplierButton),supplierHit=document.elementFromPoint(supplierButtonBox.x+supplierButtonBox.width/2,supplierButtonBox.y+supplierButtonBox.height/2);
    result.supplier={tag:supplier.tagName,text:supplier.textContent,whiteSpace:supplierStyle.whiteSpace,textOverflow:supplierStyle.textOverflow,overflowX:supplierStyle.overflowX,lineHeight:Number.parseFloat(supplierStyle.lineHeight),fontSize:supplierStyle.fontSize,clientWidth:supplier.clientWidth,scrollWidth:supplier.scrollWidth,label:supplierBox,button:supplierButtonBox,focused:document.activeElement===supplierButton,centerHitInside:supplierButton.contains(supplierHit),inViewport:supplierButtonBox.x>=0&&supplierButtonBox.right<=innerWidth&&supplierButtonBox.y>=0&&supplierButtonBox.bottom<=innerHeight};
    host.remove();if(previousFocus instanceof HTMLElement&&previousFocus.isConnected)previousFocus.focus({preventScroll:true});scrollTo(previousScroll.x,previousScroll.y);return result;
  });
  assert.ok(value.toolbar.length===4&&value.toolbar.every(height=>height===48),"Repair filter outer boxes remain48px");
  assert.ok(value.actions.length===3&&value.actions.every(height=>height===44),"Repair heading actions remain44px");
  assert.equal(value.summary.height,value.summary.lineHeight,"Repair names occupy exactly one text line");
  assert.equal(value.summary.color,"rgb(95, 87, 255)","Repair names reuse the primary text token");
  assert.ok(value.summary.whiteSpace==="nowrap"&&value.summary.overflow==="hidden"&&value.summary.textOverflow==="ellipsis"&&value.summary.scrollWidth>value.summary.clientWidth,"Long repair names really overflow into a single-line ellipsis");
  assert.ok(value.singleContainer.width>40&&Math.abs(value.singleName.width-value.singleContainer.width)<.02,"A single repair name uses the available label width");
  assert.ok(value.dialog.width<=width-24,"Supplier dialog stays inside the viewport");
  if(width>=768)assert.equal(value.dialog.width,Math.min(1040,width-48),"Only supplier dialog expands to1040/viewport-48");
  assert.ok(value.dialog.height<=388&&value.bodyScrollHeight>value.bodyClientHeight&&value.bodyScrollTop>0,`Short supplier body really scrolls within420px: ${JSON.stringify({dialog:value.dialog,body:value.body,scrollHeight:value.bodyScrollHeight,clientHeight:value.bodyClientHeight,scrollTop:value.bodyScrollTop})}`);
  assert.equal(value.outerOverflow,"hidden");assert.equal(value.bodyOverflow,"auto");
  assert.ok(value.headerFixedDuringBodyScroll&&value.footerFixedDuringBodyScroll,"Header/footer remain outside the body scroll");
  assert.ok(value.header.bottom<=value.body.y&&value.body.bottom<=value.footer.y,"Body never overlaps header/footer");
  assert.ok(value.close.width>=44&&value.close.height>=44&&value.footerActions.every(box=>box.height>=44),"Close and footer targets remain44px");
  assert.equal(value.menu20,20,"Candidate CSS consumes the actual20px boundary without a44px floor");
  assert.equal(value.menu0,0,"Zero candidate space does not create overflow padding or border");
  assert.ok(value.unrelatedDialogWidth<=500,"Unmarked dialog width remains unchanged");
  if(width<768)assert.ok(Number.parseFloat(value.inputFont)>=16,"Repair mobile input remains16px");
  assert.equal(value.supplier.tag,"SMALL","Supplier fixture uses the actual small element and its cascade");
  assert.equal(value.supplier.whiteSpace,"nowrap","Long supplier remains one line despite the older small rule");
  assert.ok(value.supplier.textOverflow==="ellipsis"&&value.supplier.overflowX==="hidden"&&value.supplier.scrollWidth>value.supplier.clientWidth,"Long supplier really overflows into an ellipsis");
  assert.ok(Math.abs(value.supplier.label.height-value.supplier.lineHeight)<.02,"Supplier occupies exactly one line without shrinking text");
  assert.ok(value.supplier.label.x>=value.supplier.button.x&&value.supplier.label.right<=value.supplier.button.right+.02&&value.supplier.label.y>=value.supplier.button.y&&value.supplier.label.bottom<=value.supplier.button.bottom+.02,"Supplier label stays inside its action button");
  assert.ok(value.supplier.button.width>=44&&value.supplier.button.height>=44&&value.supplier.focused&&value.supplier.centerHitInside&&value.supplier.inViewport,"Supplier action remains focusable, reachable and44px");
  assert.equal(value.supplier.text,"DEMO-LIST 虚构维修配件供应商 · Laboratorio Componenti Dimostrativi per Smartphone e Batterie SRL","Ellipsis preserves the complete supplier text");
  await page.setViewportSize({width,height:1000});
  return value;
}

async function repairHeaderActions(page, width) {
  if (width >= 768) return [];
  const icons = Object.fromEntries([["menu", Menu], ["scan", ScanLine], ["batch", PackageCheck], ["create", Plus]].map(([key, Icon]) => [key, renderToStaticMarkup(createElement(Icon, { size: key === "menu" ? 20 : 17, "aria-hidden": true }))]));
  const rows = [];
  await page.setViewportSize({ width, height: 600 });
  for (const [locale, title, batch, create] of [["zh-CN", "维修工单", "批量到货", "新建工单"], ["it", "Riparazioni", "Arrivi multipli", "Nuova riparazione"], ["en", "Repair orders", "Batch arrivals", "New repair"]]) {
    const value = await page.evaluate(({ locale, title, batch, create, icons }) => {
      const host = document.createElement("section"); host.lang = locale;
      host.innerHTML = `<div class="app-shell"><main class="app-main"><div class="app-content"><main class="module-page repair-page repair-parts-list repair-unified-list"><header class="module-heading"><div class="module-title"><button class="icon-button page-menu-button" type="button" aria-label="DEMO menu">${icons.menu}</button><div class="module-title__content"><div class="module-title__line"><h2>${title}</h2></div></div></div><div class="module-heading__actions"><button class="icon-button" type="button" aria-label="DEMO scanner">${icons.scan}</button><dialog></dialog><button class="button button--secondary button--compact" type="button">${icons.batch}${batch}</button><a class="button button--primary button--compact navigation-link" data-navigation-icon="true" href="#demo"><span class="navigation-feedback" data-pending="false" data-has-icon="true" aria-hidden="true"><span class="navigation-feedback__icon">${icons.create}</span><svg class="spin" width="16" height="16"></svg></span>${create}<span class="sr-only" aria-live="polite" aria-atomic="true"></span></a></div></header></main></div></main></div>`;
      document.body.append(host);
      const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
      const actions = [...host.querySelectorAll(".module-heading__actions > button,.module-heading__actions > a")].map(action => {
        const content = [], walker = document.createTreeWalker(action, NodeFilter.SHOW_TEXT); let node;
        while ((node = walker.nextNode())) {
          if (!node.textContent.trim() || node.parentElement.closest(".sr-only,.visually-hidden")) continue;
          const range = document.createRange(); range.selectNodeContents(node);
          for (const rect of range.getClientRects()) if (rect.width && rect.height) content.push({ kind: "text", text: node.textContent, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom });
        }
        for (const svg of action.querySelectorAll("svg")) { const r = box(svg), style = getComputedStyle(svg); if (r.width && r.height && style.visibility !== "hidden" && style.display !== "none") content.push({ kind: "svg", ...r }); }
        return { label: action.textContent.trim() || action.getAttribute("aria-label"), ...box(action), content };
      });
      const closedDialogDisplay = getComputedStyle(host.querySelector("dialog")).display;
      host.remove(); return { locale, actions, closedDialogDisplay };
    }, { locale, title, batch, create, icons });
    assert.equal(value.actions.length, 3, "Repair heading keeps exactly scanner, batch and create actions");
    assert.equal(value.closedDialogDisplay, "none", "Closed scanner dialog never occupies an action grid slot");
    for (const action of value.actions) {
      assert.ok(action.width >= 44 && action.height === 44, `Repair heading action keeps its44px target: ${JSON.stringify(action)}`);
      assert.ok(action.content.length && action.content.every(rect => rect.x >= action.x - .1 && rect.y >= action.y - .1 && rect.right <= action.right + .1 && rect.bottom <= action.bottom + .1), `Visible ${locale} action text and SVG stay inside its button: ${JSON.stringify(action)}`);
    }
    rows.push(value);
  }
  await page.setViewportSize({ width, height: 1000 });
  return rows;
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
            headingRows: [ ["#heading-menu", "#heading-action"], ["#group-menu", "#group-action"] ].map(([menu, action]) => {
              const a=document.querySelector(action).getBoundingClientRect(), m=document.querySelector(menu).getBoundingClientRect();
              const badge=document.querySelector("#heading-status"), content=badge.parentElement.parentElement;
              const b=badge.getBoundingClientRect(), c=content.getBoundingClientRect();
              return { centerDifference: Math.abs(a.y+a.height/2-m.y-m.height/2), width:a.width, height:a.height, badgeFits:b.right<=c.right+1 && badge.scrollWidth<=badge.clientWidth };
            }),
            headingNavigation: { slotDisplay: style("#heading-action .navigation-feedback").display, ...rect("#heading-action .navigation-feedback"), spinnerVisibility: style("#heading-action .spin").visibility, iconVisibility: style("#heading-action .navigation-feedback__icon").visibility, statusDisplay: style("#heading-action-status").display, labelDisplay: style("#heading-action-label").display },
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
            repairTotalColor: style("#repair-total strong:last-child").color, textColor: style("body").color,
          };
        });
        const listRows = await page.locator("[data-list-row]").evaluateAll(elements => elements.map(element => {
          const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
          const slot = element.querySelector(":scope > .navigation-feedback"), slotStyle = getComputedStyle(slot);
          const kind = element.dataset.listRow;
          const children = [...element.children].filter(node => !node.matches(".navigation-feedback, .sr-only"));
          return { kind, locale: element.closest("[data-list-locale]").dataset.listLocale, pending: element.dataset.state === "true", row: box(element), slot: box(slot), slotDisplay: slotStyle.display, slotPosition: slotStyle.position, slotMarginTop: slotStyle.marginTop, gridColumn: slotStyle.gridColumn, gridRow: slotStyle.gridRow, columns: getComputedStyle(element).gridTemplateColumns.split(" ").length, spinnerVisibility: getComputedStyle(slot.querySelector(":scope > svg")).visibility, iconVisibility: getComputedStyle(slot.querySelector(".navigation-feedback__icon")).visibility, overflow: element.scrollWidth > element.clientWidth + 1, children: children.map(node => ({ ...box(node), display: getComputedStyle(node).display })) };
        }));
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
        assert.equal(result.repairTotalColor, result.textColor, "Repair total uses the existing body text token");
        for (const row of listRows) {
          const context = `${row.kind}/${row.locale}/${row.pending}/${width}/${order}`;
          assert.ok(["grid", "inline-grid"].includes(row.slotDisplay), `Visible navigation slot: ${context}`);
          assert.ok(row.slot.width >= 17 && row.slot.height >= 17, `The original icon reserves its slot: ${context}`);
          assert.equal(row.slotPosition, "static", `Navigation feedback stays in flow: ${context}`);
          assert.equal(row.spinnerVisibility, row.pending ? "visible" : "hidden", context);
          assert.equal(row.iconVisibility, row.pending ? "hidden" : "visible", context);
          assert.ok(row.row.height >= 44 && !row.overflow, `Readable row and touch target: ${context}`);
          assert.ok(row.slot.right <= row.row.right + 1, `Slot stays within its row: ${context}`);
          if (row.kind === "customer-record") {
            assert.equal(row.slotMarginTop, "10px", `Record arrow keeps its existing alignment: ${context}`);
            assert.ok(row.children[1].right <= row.slot.x, `Record content leaves the slot clear: ${context}`);
          } else if (mobile) {
            assert.equal(row.columns, 3, context);
            assert.equal(row.gridColumn, "3", `Explicit third slot column: ${context}`);
            assert.equal(row.gridRow, "1 / 3", `Slot spans both content rows: ${context}`);
            if (row.kind === "customer") {
              assert.ok(row.children[0].right <= row.slot.x, `Customer identity leaves the slot clear: ${context}`);
              assert.ok(Math.abs(row.children[1].y - row.children[2].y) < 1 && row.children[1].right <= row.children[2].x, `Customer counts stay side by side: ${context}`);
              assert.ok(row.children[2].right <= row.slot.x && row.children[3].y >= row.children[1].bottom - 1, `Customer activity stays below counts: ${context}`);
            } else {
              assert.ok(row.children[0].right <= row.children[2].x && row.children[1].right <= row.children[2].x, `Procurement facts leave progress clear: ${context}`);
              assert.ok(row.children[2].right <= row.slot.x, `Procurement progress leaves the slot clear: ${context}`);
            }
          } else {
            assert.equal(row.columns, 5, `All desktop columns remain: ${context}`);
            for (const child of row.children) assert.notEqual(child.display, "none", `Desktop facts remain visible: ${context}`);
          }
          if (!row.pending) {
            const pending = listRows.find(other => other.kind === row.kind && other.locale === row.locale && other.pending);
            for (const dimension of ["x", "width", "height"]) assert.equal(pending.slot[dimension], row.slot[dimension], `Stable slot ${dimension}: ${context}`);
            assert.equal(pending.row.height, row.row.height, `Pending retains row geometry: ${context}`);
            assert.equal(pending.slot.y - pending.row.y, row.slot.y - row.row.y, `Stable slot vertical offset: ${context}`);
          }
        }
        if (!mobile) {
          assert.deepEqual(result.repairName, { size: "16px", weight: "500" });
          assert.deepEqual(result.catalogName, { size: "16px", weight: "500" });
        }
        if (mobile) {
          assert.ok(Number.parseFloat(result.inputSize) >= 16);
          for (const heading of result.headingRows) {
            assert.ok(heading.centerDifference < 1, "Mobile heading actions share the menu row");
            assert.ok(heading.width >= 44 && heading.height >= 44);
            assert.ok(heading.badgeFits, "Long mobile status stays within title content");
          }
          assert.ok(["grid", "inline-grid"].includes(result.headingNavigation.slotDisplay), "Navigation slot keeps its grid after flex item blockification");
          assert.ok(result.headingNavigation.width > 0 && result.headingNavigation.height > 0, "Mobile navigation feedback slot stays visible");
          assert.equal(result.headingNavigation.spinnerVisibility, "visible");
          assert.equal(result.headingNavigation.iconVisibility, "hidden");
          assert.notEqual(result.headingNavigation.statusDisplay, "none");
          assert.equal(result.headingNavigation.labelDisplay, "none");
          for (const target of [result.tiny, result.icon]) assert.ok(target.width >= 44 && target.height >= 44);
        }
        const repairFeedback = await repairFeedbackStyle(page, width);
        const repairHeader = await repairHeaderActions(page, width);
        rows.push({ engine: engine.name(), order, width, ...result, listRows, repairFeedback, repairHeader });
      }
      assert.ok(fontRequests > 0);
      assert.deepEqual(unexpectedRequests, []);
      await page.close();
    }
  } finally { await browser.close(); }
}
assert.match(all, new RegExp(`\\.${repairTotal}\\s*>\\s*strong:last-child\\s*\\{[^}]*color:\\s*var\\(--text\\)`), "Compiled repair total uses the defined --text token");
const result = {
  at: new Date().toISOString(), buildId,
  classification: "Actual production CSS, synthetic stable component DOM; both stylesheet orders and two real browser engines. React interactions are verified separately.",
  passed: rows.length, assets: assets.map(({ name, sha256 }) => ({ name, sha256 })), fontBytes: font.length, fontSha256: fontHash,
  externalNetworkRequests: 0, productionBusinessWrites: 0, rows,
};
await writeFile(path.join(proof, "verification.json"), JSON.stringify(result, null, 2));
const repairProof=path.resolve(".local/ui-proof/repair-feedback/production-css");await mkdir(repairProof,{recursive:true});await writeFile(path.join(repairProof,"verification.json"),JSON.stringify({buildId,assets:result.assets,passed:rows.length,classification:"Same production CSS, synthetic native repair DOM; real React boundary/flows verified separately",rows:rows.map(({engine,order,width,repairFeedback,repairHeader})=>({engine,order,width,...repairFeedback,headerActions:repairHeader}))},null,2));
console.log(`Production design contracts passed: ${rows.length} conditions, ${assets.length} compiled CSS assets, font${font.length}B, zero external requests.`);
