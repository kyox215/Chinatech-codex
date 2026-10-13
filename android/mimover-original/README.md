# Mi Mover 原版入口最小补丁

用户已明确只解除原版品牌限制，禁止替换为自有分类、协议或恢复实现。本目录仅包含原APK的最小二进制补丁脚本；不是新的Android应用或传输引擎。

固定输入：4.5.7.5原包SHA256 `2e2b845f44fc99249de19c7801d7ce6aa67e31f3372ba54dc4f6d20782e25752`。

修改只有 `MainActivity.h2` 的本地首页分支（三个DEX正文数据字节，校验重算），以及Manifest删除系统sharedUID并将versionCode45705改45708。保留versionName4.5.7.5、包名、原MainApplication、权限/组件、全部原资源/语言、原数据分类、传输与恢复代码；无新增文件或DEX。全局MIUI身份保持真实。

`python3 android/mimover-original/scripts/build.py` 需要在当前项目提供固定原输入、Android build-tools16/JDK21与本地实验签名目录；这些不在源码ZIP内。构建不打印密码或私钥。重新签名不能覆盖官方签名包，不得为测试卸载官方版或客户资料。

正式范围与验证见[原版解限记录](../../docs/mimover-original-restriction.md)。入口开放不保证原版热点、系统安装、短信或私库还原具备其他厂商权限。不得把前一错误lab2的自有引擎测试当作原版验收。
