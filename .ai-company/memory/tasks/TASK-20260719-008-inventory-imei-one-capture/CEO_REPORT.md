# CEO Report — Inventory V2 单张标签本地识别 IMEI 发布

## 结论

功能已经推送并部署，数据库应用完成为安全 no-op；任务以有条件发布状态关闭。业务提交 `facb79b984de5ffdc596210cd9ba33883343053e` 已进入 `main`，Vercel 正式部署 `dpl_3HZsEL9XraLy1McLeaTxHCwsxpKs` 为 `READY`，并服务 `www.chinatech.in` 与 `chinatech.in`。Supabase migration 本地/远端 91/91 对齐，没有待应用 SQL，也没有重放历史 migration。

## 验收矩阵

| 验收项                               | 结果          | 证据                                                            |
| ------------------------------------ | ------------- | --------------------------------------------------------------- |
| 单张完整标签本地识别规格与 IMEI      | PASS          | 真实同源 Worker 合成标签 E2E；Inventory V2 Playwright 6/6       |
| 完整标签与标识符不外发               | PASS          | 网络断言无外部 OCR CDN、无 Vision 请求；完整标签不进入 BFF 路径 |
| IMEI 校验、遮罩、冲突与主标识        | PASS          | 单元测试与 390/1280 候选复核截图                                |
| 手工值不覆盖、库存不自动保存         | PASS          | merge 单元测试；E2E 与生产窗口库存写入均为零                    |
| 全仓质量                             | PASS          | lint、typecheck、313 files / 2044 tests、build 26 pages         |
| 主分支与正式部署                     | PASS          | `main@facb79b9`; exact-SHA Vercel READY                         |
| Supabase 应用                        | PASS（no-op） | 91/91 paired；dry-run 与 `db push` 均 up to date                |
| 生产 OCR 资产                        | PASS          | 五项 HTTP 200；英语模型 SHA-256 与锁定来源一致                  |
| 正式 Chinatech 登录态手机/电脑 smoke | OPEN          | 现有测试账号仅属于 `xutech`，不能冒充 Chinatech 验收            |

## 发布边界

- 仅 Chinatech；不扩大门店 allowlist、预算、模型、每日额度或 provider。
- 完整标签、原始 OCR、完整条码、IMEI、SN 与 EAN 只在浏览器临时内存处理。
- 只有员工调整、预览并明确确认的独立规格裁剪可以进入既有 Vision BFF。
- 候选只进入未保存草稿；正式库存写入继续由员工最终复核和原有保存流程完成。
- 离线、超时、取消或云端 pending 都可直接进入手工下一步，不建立上传队列。

## 生产限制与下一步

当前获授权浏览器会话只属于 `xutech`。生产页正确回退旧入库入口，证明非 Chinatech 门店无法进入 V2；但这不能替代 Chinatech 登录态功能验收。后续只需使用已授权 Chinatech 员工账号，或由 Owner 明确把测试账号加入 Chinatech，然后用一张无 PII 合成标签在 390 与桌面视口完成本地-only smoke，并在正式保存前停止。不得为了验收扩大 allowlist、修改生产数据或上传完整标签。

## 回滚

- 本地 Worker 异常：设置 `NEXT_PUBLIC_INVENTORY_LOCAL_IMEI_RECOGNITION=0` 并重新部署；保留原生 Detector、手工扫描和手工录入。
- 怀疑完整标签或标识符外发：立即关闭 Vision intake、draft apply 与 external-data 三项开关，保留账本并调查。
- Web 回滚：在最新 `main` 前向 revert 精确业务提交并重新部署；本任务没有数据库 down 操作。

## Memory / Capability 结果

- 项目记忆只固化“完整标签本地、确认裁剪云端、候选不自动保存”和数据库 no-op 的已验证边界。
- 登记单次发布能力为 C1 candidate；不提高 Permission 或 Autonomy。
- Chinatech 登录态 smoke 仍保留为明确证据缺口，不升级为已完成事实。
