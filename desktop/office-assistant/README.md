# ChinaTech Office 助手 1.0

全新独立 Windows WPF 助手。固定 Office LTSC Professional Plus 2024 64 位，Access、Excel、OneDrive、OneNote、经典 Outlook、PowerPoint、Skype for Business、Word 全部纳入安装和核验。界面提供中文、意大利语、英语；Office 安装语言默认跟随 Windows，可单独调整。

运行测试候选包，重新检测后选择“一键安装并激活”。确认全部旧 Office、Visio、Project 的移除范围，并阅读和接受微软条款，再允许 Windows 管理员权限提示。助手先准备微软签名 ODT、固定版本 Office 媒体及需要的 OneDrive 安装器，准备失败不移除旧 Office。全程不读取或删除用户文档，也不卸载 OneDrive 或清理账户配置。

检测到 CBS、Windows Update、文件重命名待重启只显示建议。安装器实际返回需要重启时保存任务并暂停；必须重启 Windows 后再继续，关闭重开助手不等于重启。发生取消或中断后，已经完成卸载的任务只继续安装；组件缺失重新安装组件；安装完成但激活失败可以“单独激活”。未知卸载结果停止自动重放，先重新检测并核对。安装器执行中取消只记录请求，等待其结束，不强杀安装进程。

安装与激活按 [kms.cx](https://kms.cx/) 的产品选择和 Office 执行流程重新编写。ODT 从微软官网下载并验签，XML 在受保护的本机目录生成。安装固定 `ProPlus2024Volume`、`SkypeforBusiness2024Volume`、`PerpetualVL2024` 和 64 位，显式设置同一语言。Skype 单独检查 `LYNC.EXE`；已有 OneDrive 复用，缺失时采用微软签名安装器。激活前确认网站当前默认服务器及备用 `k.302.pub`，使用微软 `ospp.vbs`，重新读取两个目标许可的真实状态和宽限期。报告显示实际使用的服务器；完整密钥和私人文件路径不写报告。

本版本取消旧联网准入、会话、取包和远程脚本依赖。后台执行的是同一 EXE 的提权 worker；任务日志和媒体在 `%ProgramData%\ChinaTech.OfficeAssistant1`，仅 Administrators 和 SYSTEM 可写，普通用户可读。任务在机器上使用一个独占锁；取消管道只接受取消指令并限定用户 SID。恢复任务须为原账户，后台启动确认后可关闭界面并重新打开查看。

## 构建与验证

在项目根目录运行：

```sh
python3 desktop/office-assistant/build.py --rid win-x64
python3 desktop/office-assistant/build.py --rid win-arm64
.local/office-desktop/toolchain/dotnet/dotnet run --project desktop/office-assistant/CoreTests/CoreTests.csproj -c Release
```

依赖来自官方 NuGet 源，保持严格警告检查。构建输出位于 `.local/office-rebuild-1.0/dist`。`CoreTests` 使用模拟 Office 边界验证恢复、取消、重启和失败分支；`WindowsChecks` 只检查原生检测、ACL、日志、锁和取消管道，其日志在独立 NativeChecks 目录，不操作 Office。它们不能替代真实界面、UAC、八项安装、激活与卸载验收。

源码 ZIP 保留 `desktop/office-assistant/` 目录结构。在解压根目录使用已安装的 .NET 10 SDK 可运行 `python3 desktop/office-assistant/build.py --dotnet dotnet --rid win-x64`；ARM64 将 RID 改为 `win-arm64`。项目内 `npm run build:office-desktop` 默认构建 x64。

双架构 EXE 为未签名的测试候选版；`manifest.json` 保持 `releaseReady=false`。当前版本用于公开测试，官网发布状态以对应 Release 和发布验证记录为准。完整 Windows 验收通过前不能标为稳定版。

## Italiano

Versione di prova 1.0.0, autonoma e non firmata. Estrarre il pacchetto adatto a Windows x64 oppure ARM64 e aprire `ChinaTech.OfficeAssistant.exe`. Il piano comprende Office LTSC Professional Plus 2024 a 64 bit e tutte le otto applicazioni. La lingua di Office segue Windows ed è selezionabile separatamente dalla lingua dell'interfaccia.

L'installazione sostituisce tutto il vecchio Office, inclusi Visio e Project. Documenti e account OneDrive non fanno parte della rimozione. Leggere l'ambito e le condizioni Microsoft prima di confermare. Gli avvisi di riavvio del registro sono indicativi; se l'installer richiede un riavvio, riavviare Windows prima di riprendere. La richiesta di annullamento attende la fine dell'installer. Interfaccia, UAC, installazione, attivazione e disinstallazione reali devono ancora essere convalidati.

## English

Standalone, unsigned 1.0.0 test candidate. Extract the Windows x64 or ARM64 package and open `ChinaTech.OfficeAssistant.exe`. The plan installs 64-bit Office LTSC Professional Plus 2024 and all eight applications. Office language follows Windows and can be selected independently of the interface language.

Installation replaces all previous Office products, including Visio and Project. Documents and OneDrive accounts are outside the removal scope. Review the scope and Microsoft terms before confirming. Registry restart flags are advisory; an installer restart requirement must be resolved by restarting Windows before resuming. Cancellation waits for the installer to finish. Actual GUI, UAC, installation, activation and uninstallation acceptance is still pending.

部署配置与产品标识依据 [微软 LTSC 2024 部署说明](https://learn.microsoft.com/en-us/office/ltsc/2024/deploy)、[ODT 产品标识](https://learn.microsoft.com/en-us/microsoft-365/troubleshoot/installation/product-ids-supported-office-deployment-click-to-run)、[Office 激活工具](https://learn.microsoft.com/en-us/office/volume-license-activation/tools-to-manage-volume-activation-of-office)及[微软 OneDrive 部署说明](https://learn.microsoft.com/en-us/sharepoint/per-machine-installation)。
