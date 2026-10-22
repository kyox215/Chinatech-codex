# 供应商／配件两行名称摘要

## 决策与实现

用户选定名称摘要：上行按当前项目顺序显示“屏幕、电池、尾插”，下行显示供应商。电脑／手机一致、各行单行省略，不把整个工单行锁死高度。规格、原装／组装、无需采购及旧采购说明保留于原title、aria-describedby和配件弹窗；自定义名称原文及同名独立记录保留。

仅修改RepairList的展示与所属语义CSS，复用原按钮、PackageSearch／ChevronRight、primary色、弹窗及打开／关闭／保存／焦点恢复。没有新增公共API、类型协议、依赖、数据库或权限改动。新增显示名来自结构化title／旧记录item，不对完整label按分隔符截取。无新异步过程或加载状态；离线／权限／冲突／未知结果继续沿原领域和B反馈边界。

## Figma与代码映射

原Figma [15322:210250](https://www.figma.com/design/nhZ37YLOUVP8zpDBBGihhS?node-id=15322-210250)原位更新；具体摘要15322:210252，名称210253，供应商210254。复用Primary/50、Primary/600及原文本变量。已读取具体节点高保真上下文并目视截图，[设计预览](parts-name-summary-20261022/figma-summary.png)。Figma只表达摘要文本区，运行继续复用原按钮图标和箭头，不另造整页／控件或截图页面。

代码：`components/repairs/repair-list.tsx`与`app/globals.css`；原摘要浏览器回归及正式CSS检查同步更新。

## 源码与实际验证

隔离候选：项目根`.local/repair-parts-summary-20261022/source`，基于本机origin/main36215a0d。根是复合工作区，后续只取本任务补丁，不能整根发布。此次远程Git查询因DNS失败，未宣称重新确认实时远程main。

Node24.19：类型检查、定向lint无错误／警告、三语静态4354词条、58项相关领域测试通过。Chromium／WebKit最终14项相关浏览器检查通过：三语×四宽1440／1024／390／375、0／1／2／3／7项、长供应商／多供应商、原始自定义及重复旧项目，键盘焦点圈、手机tap与44px命中、减少动画、打开／取消／保存、刷新恢复和旧规格读取。摘要几何120组在各自宽度的不同项目数量下同高；桌面50px／手机44px。整行仍由原布局和其他真实字段决定高度。

默认Turbopack生产构建通过，BUILD_ID `3_4oDxzAH3IJOExC2Oplf`；实际11份编译CSS、双引擎／四宽／正反样式顺序16项检查通过，字体170188B，外部请求0。该证据为正式CSS＋合成稳定DOM，不冒完整生产JS业务或正式账号验收。原Figma图与实际三语／双端截图已分别目视。[电脑实际预览](parts-name-summary-20261022/chromium-desktop-zh-CN-1440.png)、[手机实际预览](parts-name-summary-20261022/webkit-touch-zh-CN-375.png)，均为DEMO。

证据（项目根）：`.company-tmp/repair-parts-summary-20261022/`内browser-final.log／browser-results.json、production-css/verification.json、compiled-production、build-inputs与最终绑定记录；运行截图在候选`.local/ui-proof/parts-name-summary/`。

## 保留的边界与首次失败

触控首次复验误用键盘focus-visible断言已留red日志；触控改查真实焦点与命中，键盘焦点圈原断言保留，最终通过。生产模式按既有安全规则禁用演示登录，尝试返回404后停止该验收，不修改认证保护；业务交互使用隔离演示会话，不是正式登录／真机证据。测试数据均为DEMO，无生产业务写入。

手机意大利语原阶段／跟进控件的长文换行属于既有布局，本轮仅确认摘要不溢出，不据此声称整页三语重验完毕。正式baseline、其他候选及部署不变；本次未推送或上线。临时构建路径适配和自动生成的next-env最终撤出交付源码。
