# ChinaTech Office 助手 1.3

独立 Windows WPF 助手，安装 Office LTSC Professional Plus 2024 64 位。八项默认全选，可分别选择 Access、Excel、OneDrive、OneNote、经典 Outlook、PowerPoint、Skype for Business、Word。界面与安装语言分别选择中文、意大利语、英语。

兼容已有应用使用增量配置，保留原版本、全部语言和未选应用；版本、位数或产品不兼容时先明确选择卸载。组件配置与文件冲突时停止单项修改，可选择整套产品移除。套件及 Skype 按所选 SKU 核验授权。

卸载先重新检测，再选择应用或全部 Office。全部 Office 包括检测到的 Visio、Project，保留 OneDrive；MSI 产品按已核验 GUID 整项移除。OneDrive 仅支持原 UI 账户卸载，停止同步但不删除本地或云端文件；先下载仅在线文件并关闭 OneDrive；卸载期间保持助手窗口打开。机器级 OneDrive 明确不支持，由 Windows 设置处理。个人文档不列入移除范围。

界面使用内置 WPF Fluent Light 主题与紫色主操作，主界面不使用滚动容器。应用卡片显示选择及安装状态，应用管理直接打开独立检测选择窗口，更多菜单只保留激活和导出。刷新位于电脑状态卡，图标按钮44×44且带三语可访问名称；按钮固定高度，进度卡贴窗口底部。检测与任务记录在弹窗查看。任务持久化保存原选择与移除范围，恢复不能扩大选择；旧 Schema1 任务仍遵守旧全量范围并明确提示。真实下载字节、文件核验数量显示百分比，无法可靠测量的阶段显示活动条和用时。安装器收尾最多五分钟，未知结果不会重复执行破坏性步骤。

## 构建与验证

`python3 desktop/office-assistant/build.py --rid win-x64`，ARM 使用 `--rid win-arm64`。SDK 10.0.401。CoreTests 使用合成 Office 边界；UiChecks 在 Windows 测量真实 WPF 控件、使用合成库存，不运行安装器或激活。WindowsChecks 包含真实只读检测和隔离任务存储探针，仅编译不能证明运行通过。

这是未签名测试版。完整 Windows GUI、UAC、Office 安装/激活/卸载、OneDrive 原账户卸载及真实文档保留尚待验收。部署与许可需适用的微软条款和有效授权。

## Italiano

Assistente Windows per Office LTSC Professional Plus 2024 a 64 bit. Le otto applicazioni sono preselezionate e possono essere scelte singolarmente. Le installazioni compatibili mantengono applicazioni, versione e tutte le lingue. Una configurazione incoerente impedisce modifiche per applicazione.

Rimuovi gli elementi rilevati selezionati oppure tutto Office, inclusi Visio e Project; la rimozione completa mantiene OneDrive. I prodotti MSI si rimuovono per intero. OneDrive si rimuove solo per l’account originale, interrompendo la sincronizzazione senza eliminare file locali o nel cloud. Scarica prima i file solo online, chiudi OneDrive e mantieni aperta la finestra dell’assistente durante la rimozione. Per tutti gli account usa le impostazioni Windows.

Tema WPF Fluent Light con azioni viola, schede delle app e gestione separata. La pagina principale non scorre, i pulsanti restano alti 44 e l’avanzamento è fissato in basso; menu e dettagli sono separati. La ripresa conserva la selezione originale; i task precedenti indicano il vecchio ambito. Solo misure reali mostrano percentuali. Versione di prova non firmata; flusso Windows reale, UAC, licenze e conservazione dei documenti restano da validare.

## English

Windows assistant for 64-bit Office LTSC Professional Plus 2024. All eight applications are selected by default and individually selectable. Compatible installations retain existing apps, version and all languages. Inconsistent configuration blocks per-app changes.

Remove selected detected items or all Office, including Visio and Project; full Office removal retains OneDrive. MSI products require whole-product removal. OneDrive removal supports only the original account, stops sync and does not delete local or cloud files. Download online-only files first, close OneDrive and keep the assistant window open during removal. Use Windows Settings for all-account installations.

Built-in WPF Fluent Light styling uses purple actions, selectable app cards and separate app management. The main page has no scrolling container; buttons remain 44 high and progress stays at the bottom. Actions and details use separate menus and windows. Resume retains the original selection; legacy tasks show their original scope. Only real measurements show percentages. This unsigned test release still requires real Windows flow, UAC, licensing and document-preservation acceptance.

依据：[ODT 配置](https://learn.microsoft.com/en-us/deployoffice/office-deployment-tool-configuration-options)、[LTSC 部署](https://learn.microsoft.com/en-us/office/ltsc/2024/deploy)、[Office 授权](https://learn.microsoft.com/en-us/office/volume-license-activation/tools-to-manage-volume-activation-of-office)。
