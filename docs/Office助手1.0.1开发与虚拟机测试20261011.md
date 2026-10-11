# Office 助手 1.0.1 开发与远程测试记录

2026-10-11。用户授权在指定 Windows 测试机中继续测试，以完成 Office 软件开发。Chrome 为远程操作入口；项目证据不保存远程访问密钥、完整连接 URL、设备 ID 或完整个人文件路径。

## 本次修复

| 问题 | 1.0.1 处理 |
| --- | --- |
| 实际安装成功后被 OfficeC2RClient / msiexec 占用阻止，激活未接上 | 本次安装成功后最多等待五分钟，持续刷新实际占用；可取消，超时保留已安装状态，不再卸载。只有服务 PID、运行状态和接受停止标志同时匹配时才识别空闲 msiexec 服务，其余进程继续阻止。不会停止服务或强杀安装器。 |
| 安装器返回重启码到日志保存之间存在中断窗口 | 在真正启动安装器前保存可信开机时间；3010/1641 返回后立即持久化暂停。相同开机时间阻止新任务和继续，实际重启后重新检测再恢复。 |
| 安装器结果没有可靠保存，直接重试可能重复移除 | 保存“准备启动／已启动”事实；结果未知时停止，同一开机状态不自动重放；真实重启及当前产品复核后，只在安全阶段恢复。残留 Office 的未知移除继续要求核对。 |
| 当前窗口显示 Running，worker 已失联，无法继续 | 安全中断投影为可恢复结果；结果不明的移除保留 NeedsReview。普通用户不会改写受保护任务日志，执行前由提权 worker 再检查。 |
| 许可读取失败被当作未激活，可能继续写入激活配置 | 激活前读取失败明确停止且零写入；激活返回后或异常后的读取失败保留安装状态，明确显示读取错误，不猜许可结果。 |
| WMI、许可、验签或服务器正文等待没有期限 | 自有只读探测最长三十秒；服务器正文与响应头共用十二秒期限及容量上限。下载有整体期限。系统安装器和 OSPP 不使用短探测强杀机制。 |
| 1024×768 屏幕窗口超出工作区 | 主窗口和确认窗口按 Windows 工作区的 DIP 尺寸限制，保留纵向滚动。 |
| 原本没有 Office，却显示“已完成移除” | 界面区分无移除目标与实际移除；导出报告包含 RemovalStarted。 |
| 卸载也要求接受新的微软许可协议 | 卸载保留明确范围、文档／OneDrive 保留说明和 UAC，去掉额外条款勾选及 Remove XML 的 AcceptEULA。安装／激活仍保留明确许可确认。 |
| 导出成功显示成红色错误 | 成功反馈采用正常文字颜色。 |

中文、意大利语、英语同步。构建清单从工程读取真实版本，并可指定独立输出目录，避免修复候选覆盖原 1.0 产物。

## 实际虚拟机观察

此机为 Windows 10 Home 21H1 / 19043.928、Intel Pentium Gold 8505、4 GB、x64、意大利语、1024×768。它不属于微软当前 Office LTSC 2024／.NET 10 支持列表；以下结果属于兼容实验，不是 Windows 11 或实体 ARM 电脑验收。[Office 官方要求](https://learn.microsoft.com/zh-cn/office/ltsc/2024/overview)、[.NET 官方支持列表](https://github.com/dotnet/core/blob/main/release-notes/10.0/supported-os.md)。

重新连接时用户已自行打开 1.0.0，并启动 InstallActivate。 客机正在运行的 EXE 已通过普通权限 GUI PowerShell 只读核对 SHA256=`083430f68462fce09ea60e6a2e1de79a7d992fa600eb90c1e2416021f6a05d09`，与公开 x64 1.0.0 相同；截图已裁掉个人路径。根助手没有绕过先前浏览器警告，也没有代替用户发起这次原始安装。实际看到微软安装完成对话框；23:19 的助手重新检测确认两个 SKU、x64、16.0.17932.21000、两个产品 it-it 语言及全部八项程序。初始报告显示无旧 Office，所以任务中的 Removed 只代表无需移除，不能当作真实卸载成功。

23:01 原任务在 Activate 前因 OfficeC2RClient / msiexec 停止，Installed 保留；23:09 重新检测后操作恢复可点击。实际启动 Word，关闭非绑定隐私说明，进入无最近文档的主页；没有登录账号、打开客户文件或创建文档。23:25 打开 Word 时点击安装，助手实际检测 WINWORD，阻止安装／激活／卸载及继续任务；关闭 Word 再刷新后解除。许可读回为 ProPlus2024Volume 状态 2、剩余宽限 43198 分钟，不是已激活；当时未读到 Skype 许可。

用户随后当次明确同意适用微软条款并授权恢复同一任务进行激活测试。23:35:18，原 1.0.0 任务 `35fd6fd8-24bf-4d56-ba80-81f91be9cd96` 实际 Completed，本次恢复未重复 Remove 或 Install，实际使用服务器 `s1.kms.cx`；Fresh 检测两目标 SKU 均为 LicenseStatus=1，宽限均为 259200 分钟。原来未许可的状态与此次实际任务／许可读回分别留证；观察到的状态不证明许可权益，也不能替代尚未运行的 1.0.1 验收。

最终导出 JSON 实际读回 `LicenseError=""`、`TargetInstalled=true`、`AllComponents=true`、`TargetLicensed=true`；任务 `Server` 与 `ActivationServer` 均为 `s1.kms.cx`，`ActivationAttempts` 唯一项为该服务器、`Licensed=true`、`At=2026-10-11T21:35:14.1660597+00:00`（客机 23:35:14）。这与此前未许可基线共同证明原 1.0.0 执行了实际激活并随后读回，不能描述为已有许可直接跳过。

![客机实际 EXE SHA256](../.local/office-remote-test-1.0/guest-exe-sha256.png)

![实际八项组件检测](../.local/office-remote-test-1.0/actual-eight-components-inventory.png)

![打开 Word 时阻止操作](../.local/office-remote-test-1.0/open-word-blocks-actions.png)

![实际两项许可读回](../.local/office-remote-test-1.0/actual-both-licenses-licensed.png)

![原任务恢复完成](../.local/office-remote-test-1.0/resumed-task-completed.png)

![最终报告实际激活尝试](../.local/office-remote-test-1.0/final-report-activation-attempt.png)

截图及运行日志保留在项目私有 `.local`，不随修复 PR 发布。

## 当前构建及验证

- 72 项核心检查全部通过，Office 操作使用替身；其中包含实际受控子进程超时与 HTTP 正文流期限反例。
- 32 项 Office Node 回归通过，零跳过；包括三语内容及变量匹配。
- 候选网站下载元数据已指向 1.0.1 的两个架构及最终字节／SHA，组件三语、布局和旧准入协议未改；该文件的 7 项定向回归通过、零跳过，属于原 32 项的子集，不额外计作 39 项。候选待同提交 CI 和实际发布，当前官网仍为 1.0.0。
- WindowsChecks x64 与最新源码 ARM64 严格编译零警告、零错误，此机没有执行检查器；ARM64 新编译输出在独立 `license-read-native-artifacts`。
- x64 和 ARM64 1.0.1 严格自包含构建成功；两份清单的 18 个输入完全相同，并与当前源码 SHA 一致。实际 PE 架构、版本、大小、SHA 和无签名证书目录均核对通过。
- 独立复核恢复门禁、工作进程状态、账户范围、卸载确认和新重启检查点。没有降低原组件、媒体、权限或许可断言。

| 架构 | 字节 | 最终 SHA256 |
| --- | ---: | --- |
| x64 | 64918166 | 4a3f3d37da8b2b61b09472be567b6939176eb5e8f0b69f5662cb621620ef821f |
| ARM64 | 61071501 | 8fe0c2e6e961f43b3286e5967413f432f5448bfe2cd2457dcde1293063e66eba |

最终证据：`.local/office-dev-1.0.1/validated-verification.json`、`core-tests-license-read-gate.log`、`node-office-tests-final.log`、`windows-checks-license-read-gate-arm64.log` 及 `validated-dist` 两份清单。旧 69 项检查与第一轮二进制／交付快照保留在原日志、`final-dist` 和 `first-delivery`，不混作最终 72 项候选证据。首次受限 NuGet 构建失败以及中间构建均保留；最终重试访问官方源，没有关闭安全审计或警告检查。

交付目录：`交付/Office助手1.0.1修复候选20261011/`，包含两种架构 ZIP／EXE、清单、源码和三语说明。1.0.1 尚未在此机启动，未数字签名；`releaseReady=false`、`realWindowsAcceptance=pending`。实际 1.0 的检测及 Word 启动不能当作 1.0.1 的 GUI／安装收尾修复证明。新源码和官网版本的发布状态以随后上线记录为准。

## 后续验收边界

原 1.0.0 已有实际恢复激活及两项许可读回证据。继续验证 1.0.1 实际窗口／安装收尾、八项应用启动、卸载及文档／OneDrive 保留、取消／UAC／实际重启恢复。上述待验项不能用这次替身核心测试替代。未操作真实客户账号、生产数据库或 Windows 升级／重启。

安装收尾判断依据：[微软 Windows Installer 服务说明](https://devblogs.microsoft.com/setup/the-windows-installer-service/)、[微软 MSI 执行互斥说明](https://learn.microsoft.com/en-us/windows/win32/msi/-msiexecute-mutex)、[ODT Display 官方配置](https://learn.microsoft.com/en-us/microsoft-365-apps/deploy/office-deployment-tool-configuration-options#display-element)。仅进程存在不充分证明 Windows Installer 正在执行；当前实现以只读服务状态和 PID 做有限识别，其余未知情况继续阻止。
