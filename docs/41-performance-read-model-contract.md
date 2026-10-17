# 当前性能候选的读取合同

本合同对应本轮明确批准的性能实施，基于正式main的隔离候选。它不恢复docs/20废弃分支，也不表示已部署或全部P0–P7完成。阶段证据由本轮交付记录绑定准确Git树与实际构建。

## 已接入的读取

- 根layout只提供真实会话、当前成员及必要门店身份；页面保留授权SSR首屏。未读设置为null，不能以默认值制造政策或财务事实。
- 客户及采购分别由显式默认0的模块flag开启。查询、游标、known、锚点和响应绑定真实account/session/store/member revision/permissions/格式/完整规范查询/投影generation。每次请求仍在同一serializable事务核实时会话、成员与范围。
- 客户50摘要、采购wire2至多50摘要（实际UTF8≤100KB自适应）；完整授权计数和搜索由服务端查询，当前窗口不能用于查重或全选。主列表不传无关域canonical数组。身份拒绝在JSON解析前清当前私有资料，迟到拒绝不影响新身份，普通503保留已获授权内容。
- 单一领域Body复用原控件、行、分组、反馈与手机布局。变量高度窗口共用原横向视口；真实首组才出现组头，返回定位实际导航Link。虚拟行不拥有业务草稿或原requestId。
- 采购批量供应商12候选、清单50；选前100/本供应商全部来自完整供应商范围，所选草稿最多100，确认前按IDs再次授权核对。规格与ledgerRevision是实际事实，不能构造假events。

## 维修切片实施合同（进行中）

`BACKEND_REPAIR_LIST_READS=0`为默认兼容边界。新列表至多50摘要；active/history/all全域计数、ready组全组通知计数、完整查询结果计数与组计数分别保持原语义。分组取当前真实repairGroups，history强制单组，all附加history；created、updated和priority排序均与现有纯函数oracle对照。折叠组不能驱动footer拉取完全部隐藏行。

同事务SQL投影只保存列表需要的事实及索引。history依照真实handover事件位置及恢复stage事件位置/旧时间分支，不能仅看status或布尔值；旧ready_notified通知语义保留。配件就绪需要当前需求来源/设备指纹、版本、确认与真实采购关联，optional采购的存在性规则不能丢失。派生结果须对`currentRepairRequirements`、`repairPartsSummary`、`workflowGroup`、`repairProgress`、`pickupNotice`及`arrivalNotice`的canonical oracle验证，不从Node读取全店canonical窄JSON再过滤。

列表只呈现原前三chip预览及总数，完整需求、规格和供应商事实在原目标配件弹窗按需可达。阶段/联系/配件的canonical操作资料只在打开时读取：真实目标intake、workflow与完整同repair采购，不能把summary强转成RepairDirectoryEntry/ProcurementRecord。签名、照片原件与无关门店数组不进入此读取。

局部entity读取源使用根会话范围与实时授权，独立管理当前操作的真实资料，不configure或release根bootstrap，不替换全局页面read.plan或业务命令身份scope。局部领域providers和原Dialog复用同一操作实现；owner位于虚拟行及分组外，scope变化立即撤私有资料，同scope读取失败保留草稿。确认保存与后续重读是两个状态；后续读失败不得将已确认保存改报失败。未知结果仍通过原requestId核对。

维修扫码在提交识别内容后才读取`/api/backend/v2/repair-scan`；只传工单号/型号/序列号，50/批、准确全量计数、绑定范围/原查询/模型generation的游标与有界seek。候选window最多500，数字占位支持退回重查；匹配集缩小时旧深offset夹取真实最后窗口，不返回超出总数的假空。查询保持原`repairScanMatches`的精确ID或trim(serial)+JS uppercase语义及全部重复SN；不NFKC、不包含匹配，不读签名/照片/无关canonical JSON。索引是canonical表上store+upper(id)、store+upper(directory_trim(serial))，没有新授权或宽松RLS。`useIdentifierCandidates`复用公共只读transport、真实请求反馈、原结果模板及窗口组件，当前权限缺失不发读请求，迟到拒绝不清新身份。扫码没有写操作，原请求恢复与业务草稿不适用。

## 投影、回填与正式启用边界

投影仅由固定search_path的canonical触发器/受控owner回填维护，runtime只有SELECT，不能直接写投影或执行projector。原事实、成本、权限及历史校验不由投影取代。每次canonical写入、相关模型更新及删除都在原事务更新来源和generation。

已有门店默认unready。客户及采购operator脚本只允许明确localhost:55422连接和指定store；维修脚本另外明确允许本轮独立ICU55432/指定库及HTTP55442/指定库。每批最多200读取canonical，最终oracle也按canonical ID最多200读取及逐批验证，不累计全部原事件JSON。维修按目标逐批验证真实采购账本、数量、状态、版本与关联，仅保留当前目标的窄派生事实；完整派生语义另以原纯函数oracle验证。计数/孤立链接/来源及版本全部核对后，持原店锁标ready，再显式开启对应flag。维修重建开始先ready=false，失败不得保留ready=true。不存在的业务事实不能填零或跳过核验。

正式运维入口及明确目标连接、批准点、迁移/回填/ready/flag序列和flag0回滚手册仍属P7待交付；不能移除本地guard来暗连正式库。正式数据迁移、branch push与部署在本轮尚未执行。

## 仍须完成

新接机的全范围候选、整机/销售历史/客户设备及高历史偏斜详情的完整接入；保留店锁的目标依赖写入与最小CommandResult；域/实体授权失效提示及精确缓存；查询数、连接/锁阶段与失败耗时；10个独立真实会话/并发保存矩阵及最终整合检查。采购已测一次合成保存的v1回包约2.14MB，尚未达到10KB回执目标。

共享17.6 Supabase项目栈的真实Auth/Realtime证据与独立17.11空数据库的合成claims/纯DB证据分别记录。独立库的outbox写入不能冒称实际Realtime跨设备通过。生产P95、Linux PDF和干净CI也各以真实证据判断。

## 维修阶段验收边界

当前维修列表/操作按需读取、精确扫码及跨组版本门控已接入真实调用链。最新本地构建与源码SHA、SQL oracle/受限角色、回填、真实Auth浏览器证据在隔离候选proof中分别绑定。共享footer忙碌进入丢意图有实际组件RED及Chrome/WebKit修复证据；三组触底测试另仅在观测到上游真实追加将目标推离视口且当前请求idle时重新定位实际footer，仍核每组100、总300、静止不连抽及折叠零请求。没有把该测试修正称为线上性能改善。

维修100条同repair采购变更仍有约0.9秒/100次投影的写放大RED，后续必须在原事务对distinct repair合并再投影；关闭读取flag不会禁用canonical触发器，正式写路径回退/重建入口仍属P7交付。普通保存仍使用v1全快照，不满足最小回执预算。

本轮另有完全独立PG17.11/ICU、Auth、Realtime的本地HTTP栈与10个真实合成账号可供最终HTTP/跨设备验收；其原始schema/角色/凭据和数据均独立，不能和共享17.6或纯claims SQL证据合并冒称正式环境P95。真实会话矩阵尚须按冻结构建实际执行。

## 采购 wire2 字节边界

数据库投影format_version仍为1；HTTP响应formatVersion为2，响应token与page token包含新响应格式。主列表SQL先按ID/完整供应商分组与搜索，只在最终≤51目标投影读取显示字段；item/规格/型号/日期不会随全店中间结果搬运。普通字段完整显示，原有无上限item/supplier/expectedAt仅以100/200/160个Unicode字符和显式previews缩略，目标详情保持完整原文；原文参与搜索与分组。groupKey等于稳定groupFirst，不能拿显示预览当分组身份、查询或写入值。正反游标从实际送达边界继续，startIndex按实际送达窗口计算。缓存最多十个实际响应/500摘要，代际重读最多十个响应，不因每批变短无限循环，已看过范围只保留数字extent。

75条有效中文长字段在独立真实SQL首批33/后33/末9，四分组及旧超长同前缀供应商/emoji/尾搜/seek/anchor/原文校验和均过，最高99962B；实际React hook双引擎验证小批缓存及新代际更小批重读上限。以上是本地条件证据，最终运行构建绑定及HTTP/浏览器界面验收另记。

## 请求观测、同令牌认证读取与首次登记

固定名数值Server-Timing分别记录proxy/route实际Auth网络次数与耗时、连接池加BEGIN等待、session lock/live、SQL实际执行、业务段、commit/rollback与白名单40001/40P01。各段存在包含/并行关系，分位不能相加；不记录SQL、参数、令牌、URL、客户或权限内容。proxy覆盖客户端观测头，观测头从不参与身份或授权。失败通过finally保留耗时；SQL片段不计执行，重复await同一Query只记一次。

只读Supabase client的factory在单次请求内、确切GET/user URL+全部有效headers+credentials键复用Response各自clone，最多4个键；不同token/请求/身份不能共用。Request或带AbortSignal请求不去重，refresh及账号修改的RouteClient不缓存。原getUser/getClaims、邮箱确认/sub/session匹配、数据库实时live/member/RLS全部保留；不使用JWT解码替代验证。实际本地HS SDK两身份与正常refresh/invalid cookie已验。

首次同店十session已实证原SERIALIZABLE读内登记发生40001并耗尽原三次重试。读取改为memberForRead只核当前成员与自己的登记存在；缺行在业务读取前抛精确内部StoreSessionRequired，回滚后用同身份/门店的短READ COMMITTED登记，再新开SERIALIZABLE完整重验。内部登记仍锁项目session FOR SHARE、验live/member/RLS，ON CONFLICT不更新tombstone；只此类型允许有界一次重启，普通错误不当登记。warm读取仍单一事务且不写登记。getServerAccess的SSR选择也走此边界；命令memberInTransaction、店级写锁、隔离级别及原重试不变。独立真实Auth/受限SQL的冷10、禁用/撤权/跨店与登记前后反例过；实际HTTP/SSR及最终30轮预算另记。
