# Office 原生开发 / Sviluppo nativo Office / Native Office development

Office 助手的原生客户端、测试、签名工具和构建流程位于私有仓库 `kyox215/ChinaTech-OfficeAssistant`。本公开网站仓库只维护下载元数据、网站准入接口和使用说明；原生构建请在私有仓库执行，不使用本仓库已移除的 `build:office-desktop` 命令。原有公开发行文件与 Git 历史保留，后续不在这里发布原生源码 ZIP、调试符号或内部构建日志。

发布新版原生客户端前，两边 CI 必须通过。私有构建和合成测试不能替代真实 Windows Office 验收。

Il client nativo, i test, gli strumenti di firma e la compilazione dell’Assistente Office sono nel repository privato `kyox215/ChinaTech-OfficeAssistant`. Questo repository pubblico mantiene solo metadati dei download, API di ammissione e istruzioni. Compila il client nel repository privato; il comando `build:office-desktop` è stato rimosso qui. File già pubblicati e cronologia Git restano disponibili; nuovi ZIP dei sorgenti nativi, simboli e log interni non vengono pubblicati qui.

Prima di distribuire una nuova versione nativa devono passare entrambe le CI. Compilazione privata e test sintetici non sostituiscono la verifica reale di Office su Windows.

The Office Assistant native client, tests, signing tools and build workflow are maintained in the authorized private `kyox215/ChinaTech-OfficeAssistant` repository. Build the native client there; the obsolete `build:office-desktop` command has been removed from this public repository. This website repository retains download metadata, website admission APIs and usage instructions. Existing public release artifacts and Git history are retained. Future native source archives, symbols and internal build logs are not published here.

Public and private CI must both pass before a new native version is released. A private build or synthetic test does not establish real Windows Office acceptance.
