# Figma 操作反馈与原提交闭环（2026-10-14）

状态：实施与验证进行中，尚未发布。用户已授权全部缺失状态组件、相关逻辑闭环修复及 main／正式域名上线。

## 实现与设计边界

正式基线 main `5826131154f7ed5d15e72198dde0f03938f9ea41`；独立工作树 `.local/ui-feedback-release/source`，分支 `codex/ui-feedback-20261014`。保护根目录并行 Office 1.4、目录、安卓及媒体工作，不将未上线候选整批覆盖正式源码。

Figma `nhZ37YLOUVP8zpDBBGihhS`：按钮 `12001:63564`／默认主按钮 `12001:63670`／聚焦 `12001:63910`，错误输入 `5103:538`，侧栏 `12327:112060`，进度 `7071:2100`。实际读取设计上下文与截图；沿用现有紫色 token、边框／圆角、语义 CSS、Lucide、InputControl／SelectControl，不引入新主题／依赖。缺失的等待、错误恢复、分页、下载请求提示、原提交恢复是项目组件扩展，不声称原 Figma 提供了加载变体或已修改 Figma 文件。

导航使用 Next 16.3.7 的真实 useLinkStatus，默认不预取，减少后台全快照及列表链接的无关预取；普通 hash、本地选择与折叠保持即时状态，不制造等待或百分比。公开工具页保留完整 SSR／无 JavaScript 下载；添加公共 route loading 曾导致流式隐藏内容与重复 DOM，已移除，公开等待由原入口反馈和局部读取承担。后台加载复用 PageLoading／PageTitle，首启动可回首页；错误只重读、不重放业务提交。

公开 bootstrap 只根据 cookie 是否存在显示匿名／核对中，绝不据 cookie 授权；真实状态由原 API 校验，保护页仍原服务端身份／成员／范围／事务检查。BackendProvider 按 user／session／store key 重建。客户列表与客户设备在完整授权集合过滤后每页50条，不截断总数、搜索、关联或历史。

## 原请求和草稿

useOperationReceipt 精确匹配本次 requestId；Provider dispatch 可选 UI options、store 可选末尾 options 只传 backendCommand 第三参数，不入业务 payload，不改变 API wire／schema。未知期间保留草稿与锁；匹配成功回执才清本次事实或收起确认。明确拒绝／取消且恢复记录清理完成后才发布内部 resolution；临时 pending=null 不解锁。recoverOperation 可选 expectedRequestId 拒绝旧控件操作其他原请求。

原生窗口的恢复控件在 disabled fieldset 之外；IDB 暂不可读时提供只读重载。全局和局部恢复控件通过当前 Provider 展示登记去重。设备草稿恢复／删除／选择也须受提交／未知锁约束。销售／签署快照、原自由文本、金额／数量、权限及事务规则不变。

## 当前证据与剩余

- 发布树 Node：最终475项，474通过／1本地PowerShell环境跳过；backend恢复专项27/27。
- 原业务组件预览8/8；慢提交／409 10/10；原回执与原生modal 12/12；prepared离线原ID恢复2/2。证据 `.local/ui-feedback-release/business-harness/receipt-closure-verification.json`，14源SHA；后续共享展示及更多表单有新修改，需增量验证。
- 首次完整360浏览器：323通过、37失败，原日志在 source/.local/feedback/browser-full.log。产品流式／无JS缺陷和旧宽泛DOM选择器已定位修正；相关96/96定向回归通过，日志 regression-fix.log。不得将首轮说成全通过。
- 新导航6/6、客户／原业务定向19/20首轮；WebKit外部模拟附件无下载事件，改同源原生下载入口同一反馈组件复验通过，外部EXE保持HTTP与Chrome单独边界。
- 三语检查已通过3953键；当前类型检查通过；lint零错误、保留原backend/client的location.assign建议警告。

采购显式父子归属：20/20私有原回执反例、6/6实际预览与54领域检查通过，证据 procurement-proof/verification.json；随后两处设备草稿Notice增加disabled，须最终代表回归。签名／返修／草稿：Chrome与WebKit共8/8通过（晚签名回执只清本编辑器草稿，其他草稿保留；返修成功导航／取消保留原因；恢复入口去重；禁用恢复删除）。证据 final-state-proof/verification.json。返修原因Textarea增加明确aria-label，修正填写后标签名称不稳定，原失败与诊断日志保留。正式模式build已通过。

设置专项：8/8实际预览、10/10私有原回执反例通过（五类表单×Chrome1440/WebKit375）；503未知、IDB只读重载、取消保留、新nonce、旧receipt拒绝与exactreceipt清/close。没有生产写入。证据 settings-proof/recovery-results.json，产品4文件SHA冻结。

剩余：源码冻结后的本地必要检查、远程完整CI、独立delta审查、production候选READY／来源核对、主域与www发布及只读线上验收。实际业务数据库事务、本轮生产业务写入、实体手机／相机／签字硬件／物理打印分别记录，不能以合成API或截图替代。

## 最终增量冻结前复验

初次冻结0f04c385后的代表30项：28通过、2返修全链失败。原因是稳定子表单在本次成功添加维修项目后仍保留空旧表，需多做人工核对。现用精确requestId／新增requirement／原现版本确认信号：只对本次已确认添加且没有未保存输入的表单更新；dirty与外部变化保留人工核对。直接保存先释放本次父owner再收窗，未知锁保留。新12/12双浏览器原返修／采购归属检查与59领域通过；原失败日志保留，本地首轮trace被后续默认输出清理，不声称仍保留。

额外库存发现分组编辑的原回执归属缺失，已补本次nonce、未知编辑／关闭／上层分类锁、精确回执完成及安全取消保留。4/4 Chrome／WebKit合成原回执反例、分组与设置30/30实际预览通过；登录设备只读查询15秒超时可恢复。settings明确拒绝另6/6，仍不改变金额、角色或权限规则。

0f04c385旧production候选 `dpl_CScGvuDdgWqv8GCJQLsL6dhh5JVu` READY，但因上述增量已过期，不晋升。使用既有Vercel身份只读HTTP200；来源gitCommitSha0f04c385／项目prj_FZoMRZoHsRNALz4ahEVGaXAxHOFS已核验；没有改变保护规则。正式www仍以独立fresh检查为准。新源码须重新完整CI和新production候选。

## 异步设备草稿收尾

独立审查对74047a3复现2/2：签名committed后草稿清理延迟2秒，取消已解锁，可重新编辑后被旧回调关闭。最终修复将 useOperationReceipt.confirmed 声明为可返回Promise，Promise结束前同步ref与waiting持续锁；成功后requestId清空，不错误展示只读恢复按钮。回调获得原tracked token的isCurrent，卸载／新scope后旧异步完成无权关闭新表单；重复watch同ID不重入，不同ID不能抢占旧owner。

各异步清草稿回调返回Promise并在await后核对isCurrent；设置／员工原alive与attempt保护保持。稳定采购Items／legacyPart通过retainUntilReleased明确保留父锁至本子编辑器清理完成，条件消失的项目／准备操作保持父回执恢复。normal Part成功也先release父owner再收窗。签名修复2/2、early receipt／重复watch／卸载新scope生命周期2/2私有证据在final-state-proof；相关source业务／采购／设置／返修／销售34/34真实预览通过，TS与full lint零错误／1原警告。74047a3候选同样过期，不晋升；只最终新SHA完整CI与候选可作为发布门禁。

## 远程失败证据与测试顺序

0f04c385远程完整374项：353通过／21失败。20项为采购编辑保存未释放父锁／本次新增空旧表（后续源码修复已通过原返修及代表闭环）；另1个WebKit财务测试未等待第一次本地保存失败实际收尾便恢复替身并再次点击，首请求busy时第二次被正确拦截。补强测试：明确断言本地保存失败及主按钮重新可操作后才恢复／重试，保留原清空、金额、条数及作废断言；两浏览器8/8通过。原失败日志与远程artifact已保存source/.local/feedback/ci-0f04c38-*。这次只修改测试与文档，已CODE_GO的8623b98产品组件字节不变。

财务等待补强首复验6/8，因同区域两个实际alert使新定位器严格模式失败；已按完整本地保存失败文字定位，最终8/8。原首次log/trace保留；不减少失败反馈或放松原数据断言。最终产品源码仍与8623b98 CODE_GO字节一致。
