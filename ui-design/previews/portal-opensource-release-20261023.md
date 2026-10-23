# 聚合首页与电流脉动开源入口（实施与发布中）

用户授权新增 GitHub 开源软件入口、加入电流脉动，并将已确认的聚合首页正式上线。一级三个入口：维修、放映室、电流脉动；维修工具箱仍仅由维修模块进入。新增“我的开源”分类，GitHub 源码/最新版发布链接均指向用户公开 MIT 项目 kyox215/CurrentFlow，不镜像安装包或硬件服务。

沿现有 PortalPage、PublicHeader、Brand、InputControl、NavigationLink、账号/语言/B反馈；原 Figma 15448:210924、双端210925/210962、组件集210996补六变体并目视。高保真上下文已读取；素材采用原创SVG笔记本，仅装饰，无整页图片。正式上线前移除参考站CC BY-NC原图和许可文件，保留布局来源署名；原预览在历史提交保留。

计划验收三语/1440、1024、390、375/双引擎、开源筛选与搜索、两个外链的点击/键盘/新标签、维修/影院/工具箱/旧书签/媒体/匿名权限以及正式构建。实际结果、精确提交、候选和上线回执完成后在本文件追加；当前不代表已上线。

## 候选冻结时验证

单元610项：609通过、1项既有PowerShell不可用跳过；全量lint0错/1条既有backend/client导航警告，三语4429/strict types/本地与正式模式构建通过。Cr/WK×中意英×1440/1024/390/375覆盖根/维修/影院，初始76项含实际三片/教程字幕/离页释放/旧书签/权限/工具箱通过且0页面错误；额外的客户端元说明翻译会与流式元数据重复，已撤回该附加调整并保留失败证据；未以首个标签掩盖重复。8项长账号合成状态、4项原导航/搜索/焦点/对比度、4项真实GitHub新标签跳转通过。正式编译16项样式条件、12 CSS、170188B字体通过。

卡片下载经真实键盘Enter打开GitHub最新版页，当时为v0.7.4；整卡点击打开源码，原网页保留。平台限制清楚显示，链接不固定版本，不镜像安装包、不承诺在网页中读取Mac硬件。发布素材为原创hub-laptop.svg，旧参考站CC BY-NC图未纳入发布Git历史；布局署名保留。

[电脑截图](portal-opensource-release-20261023/desktop.png) · [手机截图](portal-opensource-release-20261023/mobile.png) · [意语](portal-opensource-release-20261023/mobile-it.png) · [英语](portal-opensource-release-20261023/mobile-en.png) · [Figma组合](portal-opensource-release-20261023/figma-composition.png)。

原Figma文件nhZ37YLOUVP8zpDBBGihhS：组合15448:210924、电脑210925、手机210962、FeatureEntrance组件集210996、CurrentFlow变体211057/211088；六个repair/cinema/currentflow双端变体，原变量/导航/字体复用，0整页栅格图，新增原创笔记本为可编辑SVG。卡片图标/手机分类/SVG文字缩放已校正并目视；真实DOM允许三语长度导致手机分类换行，44px操作不缩小。标题沿原LanguageProvider翻译；服务器元说明仍按既有默认中文输出，首页说明已包含开源应用。

授权发布范围为本候选；根8项并行运行差异不带入。正式main d9ab6b9a与B86X为发布前回滚版本。上游正式main完整CI39861723965已有失败，不能冒称全站CI通过；不修改CI/分支保护或以本定向验收替代全部Windows/实体手机验证。真实生产业务写入、创建/申请、金额/签名/数据库迁移不在本次发布中。

本文件是候选冻结时记录；实际main SHA、部署ID、双域与运行日志回执以项目根PROJECT_MEMORY及.company-tmp/portal-opensource-release-20261023/production-binding.json为准，冻结时内容不代表已完成切换。

最终复验的WebKit快速旧书签循环完成全部行为断言，但出现认证读取被下一次硬导航取消的pageerror；原始失败保留。原生error/unhandledrejection/fetch同步异常探针均未观察到应用抛错；同一探针等待页面网络结束后为零记录。仅在旧书签测试的页面间加入真实网络完成条件，保留原零pageerror门禁，不过滤异常，不改认证代码。最终复验另存。
