# 数据传输 · 手机搬家 14.7.34

2026-10-17 用户要求：上传指定APK供下载，数据传输分类删除之前其他软件，仅保留该款，并用image2制作新介绍页面。范围限此分类及其公开下载；Office、Windows、历史任务回执、业务数据和私有备份不变。

## 规划与交接

- 页面：`/toolbox/transfer`，同步工具箱分类卡片。唯一实现owner `transfer_finish`接续中断的`transfer_delivery`；根负责设计资产、独立核验和交付，不写业务源码。沿用项目原生岗位职责回退，不声称company运行时已升级。
- 复用：PublicHeader、Brand、LanguageProvider/LanguageSwitcher、DownloadLink、NavigationLink、公共button、现有工具箱panel与语义token。Figma原Card `12373:157599`于本轮读取高保真上下文与截图；复用白面板、细边框、16px圆角和紫色主按钮，不导入原项目管理业务或资产。
- 结构：标题及软件信息、唯一APK下载与测试签名提示、image2双机主视觉、三步指导、可展开的校验信息。电脑左右分栏，手机单栏；正文和按钮为真实DOM及中/意/英三语，图片仅表现概念。
- 旧Phone公开APK、README和checksums先逐文件私有归档核验，再移除公开源并返回410；MiMover/SmartSwitch已退休，保持410。保留原客户端恢复接口、回执与审计，不把隐藏入口当下载文件已删除。
- 验收：候选准确Git树、类型/lint/i18n/相关测试、正式构建CSS；1440/1024/390/375及三语、下载字节SHA、校验展开/键盘/返回导航、旧下载410。静态公开下载无业务保存、冲突、权限或未知提交状态；浏览器只确认下载发起，不声称安装/迁移完成。

## 软件事实

用户提供文件仅静态解析，未运行APK。包名com.coloros.backuprestore，版本14.7.34_third/code140734，minSDK26（Android 8），targetSDK36，ARM arm64-v8a/armeabi-v7a。32,358,088B，SHA256 `65ced175b9664ac39d616623ba60575814edf924e3b04cc29f165ebc24917e10`。apksigner核验通过，证书为Clone Phone Universal Test/Local Research，SHA256 `3ed212b6b1d66cf64c4ea44ffecca392551abb16a1e45eca8c5f7126f59ce0da`。独立测试签名，不能描述为OPPO官方更新或全品牌实测完成。

## image2 资产

使用内置image_gen生成，未走CLI/API；工具未返回可核对的模型版本字段。完整提示词见[image2-prompt.txt](clonephone-transfer-20261017/image2-prompt.txt)。原图[image2-original.png](clonephone-transfer-20261017/image2-original.png)，1536×1024，1,615,464B，SHA256 `8715599f9a75b1fef91d4659f9ea7133d631fc415a1db8ce64ab2b7362726d41`；运行资源为`public/images/clonephone-transfer-hero.webp`，原图只归档，不在public重复放置。图已实际检视：完整双机、紫色概念连接与照片/联系人/文件符号，没有文字、品牌、按钮或成功数字。不是应用截图、功能实测或整张页面。

## 当前状态

本地相关验证与正式CSS检查已通过（LOCAL_ACCEPTED），等待准确Git树冻结与发布；此时尚未上线。候选目录`.local/clonephone-transfer-release/source`，基于已上线main bcbc691498cadb0010998982ae87a52378225503；根为复合非Git工作区，不能直接发布。正式UI baseline此时保持不变。

## Figma组合与实际资产

原文件最终[可编辑组合15188:209617](https://www.figma.com/design/nhZ37YLOUVP8zpDBBGihhS?node-id=15188-209617)，1120×914，18个可编辑文本层、1个image2内容图及复用主按钮实例（主组件12001:63670）。白面板/文字/边框/主色/背景绑定既有变量；不新增控件或主题。[最终截图](clonephone-transfer-20261017/figma-desktop.png)已实看。原页面一次capture用于取得实际图像及结构参考（15185:346），最终组合建成后仅删除本轮临时capture，不修改旧设计。初次Figma文本高度重叠已修正为真实自适应；最终截图不再重叠。设计布局是项目适配，不声称与运行CSS逐像素一致。

运行图为同画面1536×1024 WebP，61,434B（PNG为原图档）；图片只在页面按需加载，APK由用户主动点击下载。用户给定APK原字节与版本保持。根独立核验旧3份私有备份与main bcbc691原Git字节/hash一致，候选公开文件已移除，报告`.company-tmp/clonephone-transfer-20261017/independent-archive.json`。

## 旧客户端联动

旧phone-assistant的公开status返回退役/不接受新任务，update不再签发已下架旧包URL；实际新任务仍在服务端P256身份与请求校验后拒绝。原匹配start回执、resume/outcome及范围/身份/过期/终态校验保留；新ClonePhone没有接入旧客户端准入协议，不能由网页下载声称已接入网站任务控制。数据库发行历史和业务数据不删除；Office与Windows原路径不变。定向测试采用真实签名和NextRequest、SQL接缝stub，不能冒充真实数据库/实体手机验收。

## 本地运行证据

Supabase-mode正式构建`y4E2NnpVCpcYxq_veQNry`，仅本任务3193预览。TypeScript、全候选lint（0错1既有warning）、4233三语词条、32项定向Node及全Node563（562通过、1项本机无PowerShell跳过）通过。初次Node20子进程造成4项环境失败，使用Node24正确PATH后原断言通过；依赖symlink越出Turbopack根与PDF依赖缺项的构建失败保留，按同一lock版本在候选实体化依赖后构建通过，未改生产构建配置或运行代码避错。

双引擎×三语×1440/1024/390/375共24个页面场景通过：工具箱入口、唯一APK链接、真实图像、Enter展开校验、校验文件真实下载、Toast消失、返回和无溢出。另4个边界场景覆盖两引擎完整32,358,088B原APK下载/SHA及真实本机附件传64KB后断TCP的原生下载失败、正文/按钮保留、无假busy。原4个失败分别为测试下载缓存/修改href后旧locator失配与本地status缺后台可信来源/凭据，保留原日志及trace；没有改产品下载逻辑或放宽原APK字节断言。页面24与修正的边界4分别留证，不冒称一次28全绿。

根独立实看中文1440/意语375截图及用户Chrome中文details/英文375首屏；375实测scrollWidth=375、唯一APK按钮305×44、图305×203.328已加载、无临时capture脚本，随后恢复中文/视口。根对两服务文件静态复核：去除本轮准确phone退役guards后与main逐字节相同。正式编译CSS门禁16条件/13份CSS/170188B字体/0外部请求通过，503个runtime输入与13CSS SHA保存在build-binding.json。上述证据在`.company-tmp/clonephone-transfer-20261017`，含`independent-{archive,retirement-scope,browser-local}.json`。冻结提交与部署绑定由发布证据另记。

本地无正式后台凭据，status/update HTTP在原可信来源/rate门之前返回503为fail-closed；路由直调测试验证退役响应，正式线上需单独确认status200/update410。没有手机安装、品牌真机迁移或旧原生客户端自动更新实操。公开静态下载无业务保存/冲突/无权限写入状态；未执行业务数据库迁移或清除记录。
