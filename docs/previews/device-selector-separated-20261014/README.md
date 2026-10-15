# 独立品牌 / 型号选择器预览

2026-10-14。仅设计评审；正式网站组件、数据库和部署均未修改。

打开 [交互预览](index.html)，或本轮仍运行时访问 [本机预览](http://127.0.0.1:3183/)。

- 上方切换维修接机 / 新建商品。“预览设置”切换手机框、中/意/英和异常场景。
- 品牌、型号独立选择；系列可选。搜索A13可查看4G SM-A135、4G SM-A137和5G的差异。
- 维修可以演示故障、核对、保存、三语接机单、客户/设备回链。
- 商品先明确选择新机/翻新机，再演示创建、三项核验、设为可售、销售登记、单笔全额实收、实际交付和三语销售单。
- 目录首次加载、失败、离线、身份失效、保存冲突均为可选演示场景。

数据为项目目录的1070条抽样及虚构业务示例；无真实后台请求、保存或交易。输入不持久存储，刷新回到示例。450ms模拟提交等待仅用于显示“提交中”，不是性能测量。目录候选在这个轻量预览中直接渲染；正式组件计划复用既有窗口化，不能用这个预览证明生产性能门槛。

## 设计与验证

[完整规划和两条流程图](../../35-separated-device-selectors-plan-20261014.md)。

实际执行：Chrome、WebKit × 1440/1024/390/375 × 中/意/英 × 维修/商品，**48组布局与选择交互**通过；另各引擎的维修和商品演示流程合计4组通过。199个预览系统词条三语键一致，JavaScript语法检查通过，页面JavaScript错误0，外部请求0。

实际覆盖：候选选择、别名与键盘、品牌变化清型号/即时撤销、系列/机型码搜索、Esc、手填原文、加载/查询失败/身份失效、离线拒绝提交、冲突保留草稿、提交锁、演示单据/关联；商品明确分类、三项核验与可售门控、客户快照、收款前拒绝交付、实收/交付演示、打印不显示入库成本。

已查看电脑/手机维修、商品及移动销售单截图。曾发现手机意大利语步骤溢出，已经调整布局并保持原断言复验；一次测试点击了收起的“预览设置”按钮，已改为正常展开后点击，没有强制点击或放宽断言。

证据：项目.local/device-selector-preview-20261014/verification.json、verification.log与verify.mjs。截图在当前目录：

- [电脑维修](desktop-repair.png) / [手机维修](mobile-repair.png)
- [电脑商品](desktop-retail.png) / [手机商品](mobile-retail.png)
- [移动销售及单据示例](chromium-retail-sale.png)

尚未完成：正式React控件替换、真实Auth/API保存与刷新恢复、生产冷/暖速度测量、实体手机键盘、跨设备和物理打印。本轮没有运行正式应用CI或生产构建；这轮的修改只涉及预览和规划。

## Italiano

Anteprima di progetto, con dati di esempio e senza backend. Marca e modello si scelgono separatamente; la serie è un filtro facoltativo. In alto scegli accettazione o prodotto; nelle impostazioni puoi cambiare layout, lingua e scenario.

Salvataggi, vendite, incassi, consegne, collegamenti e ricevute sono simulazioni nella pagina. Nessuna operazione reale e nessuna memorizzazione dopo il ricaricamento. Verificati 48 casi di layout e selezione, quattro gruppi di flussi dimostrativi e 199 chiavi nelle tre lingue. Prestazioni del sito reale, tastiera su telefoni fisici e stampa reale restano da verificare nell’implementazione.

## English

Design preview using sample data, with no live backend. Brand and model are separate; series is an optional filter. Switch repair/product at the top, then change layout, language or error scenario in preview settings.

Saving, sales, payments, deliveries, linked records and receipts are page-only simulations. No real transaction or persistence after reload. Verified 48 layout/selection combinations, four demo flow groups and 199 keys across three languages. Live-site performance, physical phone keyboards and real printing remain implementation checks.
