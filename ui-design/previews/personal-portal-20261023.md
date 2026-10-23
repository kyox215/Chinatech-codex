# 2026-10-23 个人工作与生活聚合首页（本地完成）

公开个人空间 / 维修与放映室两个入口已按用户确认实施。一级 `/` 是“我的数字空间”，原维修首页迁至 `/repair`，开放影片迁至 `/cinema`；工具箱保留原地址，仅在维修模块和工具箱内显示。注册、登录与工作台门店授权沿原协议，公共导航活动路径纳入两条新路由，不改变业务会话权限或会员事实。

## 设计、组件与接口

原 Figma 可编辑组合 [15412:210329](https://www.figma.com/design/nhZ37YLOUVP8zpDBBGihhS?node-id=15412-210329)，电脑15415:210370、手机15415:210444；FeatureEntrance组件集15415:210369，维修/放映室两个配置内容变体。沿原NavigationControl / Source Sans 3 / semantic变量，复用精确Lucide手机与影片SVG。最终图层结构FRAME35、INSTANCE22、GROUP6、VECTOR32、TEXT30；无整图页面填充，双端高保真上下文与最终组合图已目视。初次实例内图标替换不受支持并回滚，改为两个配置变体；自动布局高度与账号按钮宽度修正后再检查最终图。Figma使用英文以避免原中文字体缺字，运行中/意/英分别验证。真实Brand/账号状态/可变文案与按钮自适应采用现有组件，不声称逐像素一致。

PortalPage / FeatureEntrance读取lib/portal-features.ts；PublicHeader page增加portal/repair/cinema，个人公共页不显示工具箱；Brand增加purpose=personal，默认repair保持。PublicAuthPage复用getPublicAuthBootstrap和AuthStatusProvider；PublicBreadcrumb提供首页返回；PersonalFooter复用Brand。原TutorialLibrary及开放片源/署名保持，维修教程仍用原默认变体。只有公共页组合CSS扩展，无新主题、依赖或数据库。

旧 `/#features`、`/#tutorials`、`/#workflow`、`/#questions` 客户端replace至维修页对应片段；`/#cinema` 到放映室，保留query。未知hash和skip链接保持首页。局部章节重复点击/Enter复用确定定位函数；品牌和认证返回首页均指向聚合页。新公共页分别有title/description，新增可见词条三语4397门禁通过。

## 实际验收

Node24.22严格类型、相关lint、i18n和44个书签/认证/i18n/媒体单元通过；Next16.3.7正式构建通过。Chromium/WebKit各中意英×1440/1024/390/375×3页面共72布局，另各2导航/媒体/明确合成登录态流程，共76场景通过，0pageerror。触控≥44、原布局/token、无文档横溢、标题与语言、两卡顺序/手机堆叠、二级面包屑/工具箱/账号入口均查。三片在两个引擎开始并推进，切片保持闲置、离页移除src并停止；原中文教程开始/推进且字幕cues加载。导航前进后退、旧书签/未知hash、重复锚点与Enter、登录注册/品牌返回、匿名工作台重定向实际执行。

定向既有回归14场景：13初次通过，手机账号菜单外部点击误选被浮层覆盖的标题超时；改为页头实际可点的空白处，原失败保留，唯一失败在WebKit单独复验通过。含三语维修页、长账号、菜单/退出入口、同URL刷新、旧导航迟到不覆盖新页面、教程503后重试实际播放。首轮新QA账号设置定位同时命中菜单/正文/页脚，收窄至菜单区域后76通过；未放宽断言或改变产品迁就测试。

正式编译浏览器送达的3个CSS资产已逐SHA绑定，截图已看（中文电脑/手机首页、意语手机首页、双端影片及维修手机）；构建与源码见 `.company-tmp/personal-portal-20261023/build-binding.json`。候选由正式d9及本地放映室a647延续，隔离分支codex/personal-portal-20261023。根仅在25路径原件一致后窄同步，其他候选保持。正式部署baseline不变。

实体手机、完整看片、生产真实登录/门店写入没有重验；登录态只使用明确API显示夹具，不代表正式授权验证。无生产写、推送或上线，本地预览3284保留。业务数据/保存/签名/打印未变化，关联业务不机械全量重测。

根复合项目同步后严格类型通过；根check:i18n仍有25个既有、范围外的后台loading/retail-history未翻译发现（根共4406词条），与前次影院记录相同。隔离候选4397词条门禁通过；未覆盖这些其他候选或声称根全绿。
