# Mi Mover 原版限制最小修正

2026-10-09用户纠正：“我只是让你解除原版的限制”。上一轮lab2把传输和恢复换成了自主实现，超出范围。已撤下正式lab2入口及文件，两域8项页面/404检查通过；历史交付与源码只保留追溯，不作为当前方案。

当前从第一方4.5.7.5原样本重新制作：`classes2.dex` 的 `MainActivity.h2` 在1996484把本地 `sget-boolean v2,Build.l0` 改同宽 `const/16 v2,1`；正文仅1996484/1996486/1996487三字节变化。全局MIUI检测、原界面、来源选项、资料分类、权限、原MainApplication、原服务/Provider/协议/恢复实现与resources.arsc均保留。Manifest只去系统sharedUID并改versionCode45708；原包名com.miui.huanji、原versionName4.5.7.5与label不变。2932个原payload中仅classes2/Manifest改变，其余2930逐字节相等；无新增文件或classes3。

精确APK：36,846,924B，SHA256 `593998e7b3769cc0f33e300183ab78943700996fcece1d0432b4d1a9d23fee1f`，实验cert `1b71b70be3bb58e2db847aa71029ca2c071e467c60f5babef62a841eb00efc75`，min21/target35。独立签名无法覆盖官方包；测试在全新专用ctmi3-original/5600，不卸载已有官方或测试包。

非MIUI Android16/API36 ARM64实际安装、提取安装文件SHA匹配、原New/Old可点、New进入原SelectOldDeviceActivity、三来源/返回/冷重开、Old原权限类别与拒绝后重开11项通过；原页面系统截图已看。初次测试把Android Activity短名当全名、把原权限说明弹窗当已进入Guest的断言失败均保留，产品APK未改；规范化组件名并实际验收原权限/拒绝行为。没有原协议两机传输或真实资料还原验收，不复用lab2证据。

独立只读审查确认：原NetworkUtils.j0/o0非MIUI/API30+直接不支持热点，原Host还有关WiFi/隐藏AP状态/广播依赖；原联系人/日历/通话接收写权限、短信AppOps、私库BackupCompat.moveData与INSTALL_PACKAGES都不是一个首页开关。不能全局假装MIUI或注入空成功来解除。后续网络只能在原状态机/协议中适配真实公开平台调用与回调，不能换传输/恢复实现；所需手机型号/Android版本已向用户询问。

本轮网站只标“原版入口解限”，不标“完整跨品牌迁移可用”。网页三语说明明确范围、独立签名及原厂系统依赖；原App没有新增或重写文字，语言按原资源保留。验证/源码/交付见`.local/mimover-original-only`、`android/mimover-original`与`交付/MiMover原版入口解限-20261009`。正式发布证据在完成后单列；不写业务数据库。
