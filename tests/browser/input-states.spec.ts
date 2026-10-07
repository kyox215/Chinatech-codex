import { test, expect, type Locator, type Page } from "@playwright/test";
import { retailUnits } from "../../lib/retail-fixtures";

async function preview(page: Page) {
  const response = await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  expect(response.status()).toBe(200);
}

async function feedback(input: Locator, text: string | RegExp) {
  await expect(input).toHaveAttribute("aria-invalid", "true");
  const description = await input.evaluate(element => (element.getAttribute("aria-describedby") ?? "").split(/\s+/).map(id => document.getElementById(id)?.textContent ?? "").join(" "));
  expect(description).toMatch(text);
}

async function device(page: Page) {
  await preview(page);
  await page.goto("/app/repairs/new");
  await page.getByRole("combobox", { name: /^联系电话/ }).fill("+393200001234");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.getByRole("heading", { name: "送修设备" })).toBeVisible();
  await page.getByRole("combobox", { name: /^品牌/ }).fill("Apple");
  await page.getByRole("combobox", { name: /^型号/ }).fill("iPhone 16");
}

test("登录默认、聚焦、错误、已填与清空在四个宽度保持一致", async ({ page }, info) => {
  test.setTimeout(90000);
  let posts = 0;
  page.on("request", request => { if (request.method() === "POST") posts += 1; });
  for (const width of [1440, 1024, 390, 375]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/login");
    const email = page.getByRole("textbox", { name: "电子邮件", exact: true });
    const password = page.getByLabel("密码", { exact: true });
    await expect(email).toBeEditable();
    await expect(email).toHaveValue("");
    await expect(email).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: "清空电子邮件" })).toBeHidden();
    await email.focus();
    expect(await email.evaluate(element => getComputedStyle(element.closest(".input-shell")!).borderColor)).toBe("rgb(95, 87, 255)");
    await page.getByRole("button", { name: "登录工作台" }).click();
    await feedback(email, /还未填写/);
    await feedback(password, /还未填写/);
    const errorContrast = await email.evaluate(input => {
      const message = input.closest(".input-control")!.querySelector(".control-feedback--error")!;
      const channels = getComputedStyle(message).color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 1.05 / (channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 + 0.05);
    });
    expect(errorContrast).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: `.local/input-states/${info.project.name}-login-error-${width}.png`, fullPage: true });
    await email.fill("wrong");
    await password.fill("Preview2026!");
    await email.blur();
    await feedback(email, /邮箱格式不完整/);
    await page.getByRole("button", { name: "填入演示账号" }).click();
    await expect(email).not.toHaveAttribute("aria-invalid", "true");
    await expect(password).not.toHaveAttribute("aria-invalid", "true");
    await expect(email.locator("xpath=ancestor::span[contains(@class,'input-control')][last()]")).toHaveAttribute("data-filled", "true");
    const clear = page.getByRole("button", { name: "清空电子邮件" });
    const box = await clear.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    if (width < 768) expect(await email.evaluate(element => getComputedStyle(element).fontSize)).toBe("16px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local/input-states/${info.project.name}-login-filled-${width}.png`, fullPage: true });
    if (info.project.use.hasTouch) await clear.tap();
    else {
      await email.focus();
      await email.press("Tab");
      await expect(clear).toBeFocused();
      await clear.press("Enter");
    }
    await expect(email).toHaveValue("");
    await expect(email).toBeFocused();
    await expect(password).toHaveValue("Preview2026!");
    await page.getByRole("button", { name: "显示密码", exact: true }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "隐藏密码", exact: true }).click();
    await expect(password).toHaveAttribute("type", "password");
  }
  expect(posts).toBe(0);
});

test("请求中锁定所有登录草稿，失败保留输入且可重试", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let posts = 0;
  await page.route("**/api/preview-session", async route => {
    posts += 1;
    const body = route.request().postDataJSON();
    expect(body.email).toBe("demo@chinatech.local");
    expect(body.password).toBe("Preview2026!");
    if (posts === 1) await pending;
    await route.fulfill({ status: 503, json: { message: "测试服务暂时不可用，请重试。" } });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "填入演示账号" }).click();
  await page.getByRole("button", { name: "登录工作台" }).click();
  await expect(page.locator("form")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("textbox", { name: "电子邮件", exact: true })).toBeDisabled();
  await expect(page.getByLabel("密码", { exact: true })).toBeDisabled();
  await expect(page.getByRole("checkbox")).toBeDisabled();
  await expect(page.getByRole("button", { name: "显示密码", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "填入演示账号" })).toBeDisabled();
  await page.locator("form").dispatchEvent("submit");
  expect(posts).toBe(1);
  release();
  await expect(page.locator("#login-error")).toContainText("测试服务暂时不可用");
  await expect(page.getByLabel("密码", { exact: true })).toHaveValue("Preview2026!");
  await expect(page.getByRole("textbox", { name: "电子邮件", exact: true })).toBeEnabled();
  await expect(page.locator("form")).toHaveAttribute("aria-busy", "false");
  const retrySubmit = page.getByRole("button", { name: "登录工作台" });
  await expect(retrySubmit).toBeEnabled();
  await retrySubmit.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await retrySubmit.click();
  await expect.poll(() => posts).toBe(2);
  await expect(page.locator("#login-error")).toBeVisible();
});

test("账号表单在脚本初始化前锁定，准备后保留第一次输入", async ({ page }) => {
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  await page.route(url => url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js"), async route => {
    await ready;
    await route.continue();
  });
  try {
    await page.goto("/register", { waitUntil: "commit" });
    const form = page.locator("form.auth-form");
    const password = page.getByLabel("设置密码", { exact: true });
    await expect(form).toHaveAttribute("aria-busy", "true");
    await expect(page.getByLabel("称呼", { exact: true })).toBeDisabled();
    await expect(page.getByLabel("电子邮件", { exact: true })).toBeDisabled();
    await expect(password).toBeDisabled();
    await expect(page.getByLabel("确认密码", { exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "显示密码", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "创建账号", exact: true })).toBeDisabled();
    release();
    await expect(password).toBeEditable();
    await expect(form).toHaveAttribute("aria-busy", "false");
    await password.fill("abcdefghijk");
    await password.blur();
    await expect(password).toHaveValue("abcdefghijk");
    await feedback(password, /包含字母与数字/);
  } finally { release(); }
});

test("注册密码规则与确认错误直接关联字段，修正后清除", async ({ page }) => {
  await page.goto("/register");
  const password = page.getByLabel("设置密码", { exact: true });
  const confirm = page.getByLabel("确认密码", { exact: true });
  await password.fill("abcdefghijk");
  await password.blur();
  await expect(password).toHaveValue("abcdefghijk");
  await feedback(password, /包含字母与数字/);
  await password.fill("Preview2026!");
  await confirm.fill("Preview2027!");
  await confirm.blur();
  await feedback(confirm, /两次密码不一致/);
  await confirm.fill("Preview2026!");
  await expect(confirm).not.toHaveAttribute("aria-invalid", "true");
  await expect(password).not.toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  await feedback(page.getByLabel("称呼", { exact: true }), /还未填写/);
  await expect(page.getByRole("heading", { name: "开始你的门店工作" })).toBeVisible();
});

test("组合框清空沿用客户及型号联动并返回输入焦点", async ({ page }) => {
  await preview(page);
  await page.goto("/app/repairs/new");
  const phone = page.getByRole("combobox", { name: /^联系电话/ });
  await phone.fill("1029");
  await page.getByRole("option", { name: /1029.*周先生/ }).click();
  await expect(page.getByLabel("客户称呼（选填）", { exact: true })).toHaveValue("周先生");
  await page.getByRole("button", { name: "清空联系电话", exact: true }).click();
  await expect(phone).toBeFocused();
  await expect(phone).toHaveValue("");
  await expect(page.getByLabel("客户称呼（选填）", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("电子邮件（选填）", { exact: true })).toHaveValue("");
  await phone.fill("+393200001234");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("combobox", { name: /^品牌/ }).fill("Apple");
  await page.getByRole("combobox", { name: /^型号/ }).fill("iPhone 16");
  await page.getByRole("button", { name: "清空品牌", exact: true }).click();
  await expect(page.getByRole("combobox", { name: /^品牌/ })).toBeFocused();
  await expect(page.getByRole("combobox", { name: /^型号/ })).toHaveValue("");
});

test("维修条件必填、金额错误就地提示，关闭扫码不阻挡下一步", async ({ page }) => {
  await device(page);
  await page.getByRole("button", { name: /扫描.*SN/ }).click();
  const scanner = page.getByRole("dialog", { name: /识别.*SN/ });
  const manual = scanner.getByRole("textbox");
  await manual.fill("   ");
  await manual.press("Enter");
  await feedback(manual, /还未填写|识别|标识|不能为空/);
  await scanner.getByRole("button", { name: "关闭扫码" }).click();
  await expect(page.locator("dialog input.input-control__native")).toBeDisabled();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.getByRole("heading", { name: "故障与随件" })).toBeVisible();
  const issue = page.getByLabel("故障补充 / 自定义故障", { exact: true });
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await feedback(issue, /请选择故障/);
  await page.getByRole("button", { name: "屏幕", exact: true }).click();
  const quote = page.getByLabel("屏幕报价", { exact: true });
  await quote.fill("90.001");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await feedback(quote, /最多两位小数/);
  await quote.fill("0");
  await page.getByRole("checkbox", { name: "其他", exact: true }).check();
  const other = page.getByLabel("其他随件", { exact: true });
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await feedback(other, /请填写|还未填写/);
  await other.fill("原装转接头");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.getByRole("heading", { name: "提交前核对" })).toBeVisible();
  await expect(page.locator("main")).toContainText("€0.00");
});

test("采购下拉、整数范围及金额错误保持既有业务上限", async ({ page }) => {
  await preview(page);
  await page.goto("/app/procurement/new");
  const submit = page.getByRole("button", { name: "创建采购草稿", exact: true });
  await submit.click();
  const repair = page.getByLabel("关联工单", { exact: true });
  await feedback(repair, /请选择/);
  const first = await repair.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).find(Boolean)!);
  await repair.selectOption(first);
  await page.getByLabel("配件名称", { exact: true }).fill("DEMO 屏幕");
  await page.getByLabel("供应商", { exact: true }).fill("MobileParts SRL");
  const quantity = page.getByLabel("采购数量", { exact: true });
  for (const [value, message] of [["0", /不小于 1/], ["10001", /不大于 10000/], ["1.2", /整数/]] as const) {
    await quantity.fill(value);
    await quantity.blur();
    await feedback(quantity, message);
    await expect(page).toHaveURL(/\/app\/procurement\/new$/);
  }
  await quantity.fill("10000");
  await expect(quantity).not.toHaveAttribute("aria-invalid", "true");
  const cost = page.getByLabel("采购单价", { exact: true });
  await cost.fill("12.001");
  await cost.blur();
  await feedback(cost, /最多两位小数/);
  await cost.fill("0");
  await expect(cost).not.toHaveAttribute("aria-invalid", "true");
});

test("整机建档数字、未知与零、日期及金额继续使用领域规则", async ({ page }) => {
  await preview(page);
  await page.goto("/app/retail/new");
  await page.getByRole("radio", { name: "翻新机", exact: true }).locator("..").click();
  await page.getByRole("combobox", { name: /^品牌/ }).fill("Apple");
  await page.getByRole("combobox", { name: /^型号 \/ 商品名称/ }).fill("DEMO Input States");
  await page.getByRole("heading", { name: "新建商品", exact: true }).click();
  const battery = page.getByRole("textbox", { name: "电池健康", exact: true });
  await battery.fill("101");
  await feedback(battery, /100/);
  await page.getByRole("button", { name: "创建独立档案", exact: true }).click();
  await expect(battery).toBeVisible();
  await battery.fill("0");
  await expect(battery).not.toHaveAttribute("aria-invalid", "true");
  await battery.fill("");
  await expect(battery).toHaveValue("");
  await page.getByText("成本（选填）", { exact: true }).click();
  const cost = page.getByRole("textbox", { name: "购入 / 回收成本", exact: true });
  await cost.fill("19.001");
  await feedback(cost, /两位小数/);
  await cost.fill("0");
  await expect(cost).not.toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "清空购入 / 回收成本", exact: true }).click();
  await expect(cost).toHaveValue("");
  await page.getByText("来源与存放（选填）", { exact: true }).click();
  const date = page.getByLabel("入库日期", { exact: true });
  await date.fill("");
  await expect(date).not.toHaveAttribute("required");
  await expect(date).not.toHaveAttribute("aria-invalid", "true");
  await date.fill("2026-10-04");
  await expect(date).toHaveValue("2026-10-04");
});

test("识码查找空值提示，隐藏扫码输入不阻挡候选查询", async ({ page }) => {
  await preview(page);
  await page.goto("/app/retail?source=units");
  await page.getByRole("button", { name: "识码查找", exact: true }).click();
  const input = page.getByRole("textbox", { name: "识别内容", exact: true });
  await page.getByRole("button", { name: "查找候选", exact: true }).click();
  await feedback(input, /还未填写|请填写识别内容/);
  await input.fill("DEMO-NO-MATCH");
  await page.getByRole("button", { name: "查找候选", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "未找到匹配" })).toBeVisible();
});

test("客户只读手机号保留选择能力，不提供清空或扫码修改", async ({ page }) => {
  await preview(page);
  await page.goto("/app/customers");
  await page.locator('main a[href^="/app/customers/"]').first().click();
  await page.getByRole("button", { name: "编辑客户资料", exact: true }).click();
  const phone = page.getByRole("textbox", { name: "手机号", exact: true });
  await expect(phone).toHaveAttribute("readonly");
  await expect(phone).toBeEnabled();
  await phone.focus();
  await expect(phone).toBeFocused();
  await phone.press("ControlOrMeta+A");
  expect(await phone.evaluate(input => { const node = input as HTMLInputElement; return node.selectionEnd! - node.selectionStart!; })).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "清空手机号", exact: true })).toHaveCount(0);
  const email = page.getByRole("textbox", { name: "电子邮件（选填）", exact: true });
  await email.fill("bad-email");
  await email.blur();
  await feedback(email, /邮箱格式不完整/);
  await page.getByRole("button", { name: "清空电子邮件（选填）", exact: true }).click();
  await expect(email).toHaveValue("");
  await expect(email).toBeFocused();
});

test("预留日期遵循既有下限，错误关联日期且修正可继续", async ({ page }) => {
  await preview(page);
  const unit = retailUnits.find(unit => unit.status === "available")!;
  await page.goto(`/app/retail/units/${unit.id}`);
  const actions = page.locator('[data-retail-group="actions"]');
  await expect(actions).toBeVisible();
  const toggle = actions.locator(":scope > button[aria-controls]");
  if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") === "false") {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
  await page.getByRole("button", { name: "预留商品", exact: true }).click();
  const date = page.getByLabel("预留截止日期", { exact: true });
  await date.fill("2000-01-01");
  await date.blur();
  await feedback(date, /日期早于允许范围/);
  const min = (await date.getAttribute("min"))!;
  await date.fill(min);
  await expect(date).not.toHaveAttribute("aria-invalid", "true");
  await date.fill("");
  await date.blur();
  await feedback(date, /还未填写/);
  await page.getByRole("button", { name: "关闭业务操作", exact: true }).click();
  await expect(page.getByLabel("预留截止日期", { exact: true })).toHaveCount(0);
});

test("公共输入布局在维修、采购、整机、设置的四个宽度可读可点击", async ({ page }, info) => {
  test.setTimeout(120000);
  await preview(page);
  for (const [name, url] of [["repair", "/app/repairs/new"], ["procurement", "/app/procurement/new"], ["retail", "/app/retail/new"], ["settings", "/app/settings"]]) {
    await page.goto(url);
    if (name === "retail") await page.getByRole("radio", { name: "翻新机", exact: true }).locator("..").click();
    for (const width of [1440, 1024, 390, 375]) {
      await page.setViewportSize({ width, height: 950 });
      const firstInput = page.locator("main input.input-control__native").first();
      await expect(firstInput).toBeVisible();
      if (info.project.use.hasTouch) await firstInput.tap();
      else await firstInput.click();
      await firstInput.press("Escape");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const controls = await page.locator("main input.input-control__native, main textarea, main select").evaluateAll(elements => elements.filter(element => element.getClientRects().length > 0).map(element => ({ font: parseFloat(getComputedStyle(element).fontSize), height: element.getBoundingClientRect().height })));
      for (const control of controls) {
        expect(control.height).toBeGreaterThanOrEqual(44);
        if (width < 768) expect(control.font).toBeGreaterThanOrEqual(16);
      }
      await page.screenshot({ path: `.local/input-states/${info.project.name}-${name}-${width}.png`, fullPage: true, animations: "disabled" });
    }
  }
});
