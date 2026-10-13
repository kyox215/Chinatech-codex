# Office Windows 代码签名与发布输入

这是签名接入工具，不会购买证书、导入根证书、关闭 Windows 防护、登录 Azure、上传 Release 或改变网站最低版本。服务端 OFFICE_COMMAND_SIGNING_KEY / OFFICE_DESKTOP_SIGNING_KEY 是授权协议密钥，不能拿来签 Windows EXE。

只处理已经完成正式构建验收的双架构输入。根目录的 build.py 和当前 0.2.2 迭代属于独立任务，本轮没有改动；不要为签名把未验收的候选直接上线。签名通过也不等于 Office 操作、真实许可或 SmartScreen 无提示验收通过。

## 1. 冻结未签名输入

两份现有 build.py 生成的 manifest.json 必须分别证明正式地址、development=false、版本、RID、runner SHA、EXE SHA 和大小一致。它是构建声明绑定，不能替代二进制无开发类及 CI 验证。

```sh
python3 desktop/office-assistant/release/prepare.py \
  --arm64 <ARM64正式EXE> --arm64-sha256 <冻结SHA256> \
  --arm64-build-manifest <ARM64构建manifest.json> \
  --x64 <x64正式EXE> --x64-sha256 <冻结SHA256> \
  --x64-build-manifest <x64构建manifest.json> \
  --version <新版本> --published-version <当前正式版本> \
  --source-commit <二进制构建源码40位SHA> --runner-sha256 <固定runnerSHA256> \
  --output <项目内全新目录>
```

原文件保持原样。双包全部核对后才产生 input-manifest.json，任何失败没有可用成功标记。新版本必须大于当前已发布版本。`--inspection-only` 可以核查旧正式包，但签名脚本必须拒绝这个目录；不能重签并覆盖现有 0.2.1 发布资产。

## 2. 配置真实发布者

传统证书用 store.example.json：填写证书真实完整 Subject、指纹、证书库位置和微软 SDK 的 signtool.exe。私钥留在证书库或受支持的硬件 token/HSM，不把 PFX 密码放进命令行。文件签名算法是 SHA256；/sha1 只是选择证书指纹。TSA 采用证书供应商支持的 RFC3161 地址，返回内容由可信时间戳验证保护。

微软服务用 artifact.example.json：需要已完成实名验证的 PublicTrust 账户及证书 profile，填写同一目标的 endpoint/account/profile/EKU/tenant/subscription/Dlib。意大利合法组织属于当前 EU 支持范围；个人开发者目前只支持美国/加拿大。必须具有 Certificate Profile Signer；Azure Owner/Contributor 不自动获得签名权限。脚本仅使用明确核对过 tenant/subscription 的 Azure CLI 身份，其他 DefaultAzureCredential 来源被排除，不自动复用其他项目登录。

示例中的空字段会拒绝执行，不能把示例发布者冒充实名身份。配置不包含私钥、访问令牌或密码；真实配置保持项目私有，勿把令牌加进去。

## 3. Windows 签名与验证

```powershell
& .\desktop\office-assistant\release\Sign-OfficeRelease.ps1 `
  -InputManifest <冻结目录\input-manifest.json> `
  -Configuration <本地真实配置.json> -OutputDirectory <新的签名目录>
```

签名仅修改新目录副本，固定 /fd SHA256、RFC3161 /tr 和 /td SHA256。验证必须是嵌入签名、预期发布者、代码签名 EKU、可信时间戳，并通过微软 SignTool `/pa /all /v /tw`，退出码严格为 0；警告也拒绝。本流程保守接受单份主签名，不接受 catalog、nested 或多主签名。传统证书另查 AuthRoot 公信来源；它是保守门禁，尚未证明所有公共 CA/设备覆盖。Artifact 使用 Windows 平台信任及 PublicTrust/profile EKU，不因短期叶证书后来过期而错误拒绝有效时间戳签名。

签前冻结原始文件的全部程序内容，签后再次锁定副本核对；只允许 PE checksum、Security Directory 共12字节和严格对齐的末尾证书区变化，包括 .NET 单文件 bundle 内容在内的任何其他变化都会报 PAYLOAD_CHANGED。这是程序内容保留检查，不代替 Authenticode 信任验证。

两个架构全部通过才生成 signature-verified.json，并计算签后最终全文 SHA256。其 releaseReady=false、requiresAcceptance=true，不能充当生产发布许可。后续交付/上传/官网下载/版本放行都要使用签后 SHA，不再使用未签名输入 SHA，也不得再改 EXE。

## 4. 正式发布前

在保持默认浏览器防护、Defender 与防火墙开启的 Windows 环境，重新下载最终签名包，核对最终 SHA、网络标记、显示的发布者和实际启动/联网。按影响完成业务、UAC/失败恢复及对应源码 CI；通过后再发布新版本并设置最低版本。签名减少未知发布者风险，但不能保证新文件立即没有信誉警告。真实第三方杀毒告警按厂商渠道提交已核对的文件，未完成提交不能说已经消除误报。

专用 VM 的执行策略为 Restricted，本轮保持原策略。Windows 验证采用 SHA 固定的 AST 源码命令，实际正常 .ps1 文件链及可信证书签名尚未验收。部署此签名工具时必须使用组织允许脚本执行的受控签名机/CI；不能把本轮源码测试当作终端用户运行脚本的证明。

本轮测试和实际缺项见 [接入验证记录](../../../docs/Office代码签名接入-20261011.md)。

参考：[SignTool](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool)、[Artifact Signing 准备条件](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart)、[集成参数](https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations)、[证书生命周期](https://learn.microsoft.com/en-us/azure/artifact-signing/concept-certificate-management)、[SmartScreen 信誉](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)。
