import type { Tutorial, TutorialLocale } from "./tutorials";

// Generated from explicitly localized public storyboards and measured narration.
const catalog: Record<TutorialLocale, readonly Tutorial[]> = {
  "zh-CN": [
    {
      "id": "install",
      "number": "01",
      "title": "Office 安装：从网页复制到管理员终端",
      "description": "选择安装命令，保存文档，核对终端并了解执行后的检查。",
      "duration": "1:19",
      "src": "/tutorials/office/zh-CN/install.mp4",
      "poster": "/tutorials/office/zh-CN/install.webp",
      "captions": "/tutorials/office/zh-CN/install.vtt",
      "href": "#command-install",
      "actionLabel": "查看对应命令",
      "steps": [
        {
          "title": "打开工具箱，选择仅安装",
          "body": "在浏览器打开 ChinaTech 工具箱，进入 Office 页面，选择仅安装。这里提供命令参考，点击网页按钮不会自动安装软件。",
          "at": 0
        },
        {
          "title": "先保存正在编辑的文档",
          "body": "先保存 Word、Excel 等正在编辑的文档。安装过程可能关闭 Office 应用，也请核对页面说明中的版本和所选组件。",
          "at": 11.541667
        },
        {
          "title": "选择你实际使用的终端",
          "body": "这里默认选择 PowerShell。如果准备使用 CMD，请先切换到 CMD；两种命令格式不同，不要把一种格式粘贴到另一种终端。",
          "at": 22.541667
        },
        {
          "title": "完整复制，失败时下载文本",
          "body": "点击复制完整命令。若浏览器不允许复制，可以下载命令文本再打开复制。请使用网页上的完整内容，不要照着视频手抄长命令。",
          "at": 34.583333
        },
        {
          "title": "管理员终端操作示意",
          "body": "在 Windows 打开管理员 PowerShell，核对终端名称，再粘贴整条命令。本画面是操作示意，视频不会执行安装。确认保存好文档后，再自行决定是否按回车。",
          "at": 47.541667
        },
        {
          "title": "以实际安装输出为准",
          "body": "运行后按安装程序的实际输出核对结果。下载返回403、网络错误或校验失败时先停止，不要绕过校验。安装完成与获得有效授权是两件事。",
          "at": 63.166667
        }
      ]
    },
    {
      "id": "activate",
      "number": "02",
      "title": "Office 激活：先核对授权，再选命令",
      "description": "了解批量授权前提、命令格式与实际授权结果的核对。",
      "duration": "1:15",
      "src": "/tutorials/office/zh-CN/activate.mp4",
      "poster": "/tutorials/office/zh-CN/activate.webp",
      "captions": "/tutorials/office/zh-CN/activate.vtt",
      "href": "#command-activate",
      "actionLabel": "查看对应命令",
      "steps": [
        {
          "title": "选择仅激活",
          "body": "进入 Office 页面，选择仅激活。这个命令针对页面所说明的 Office 批量许可版本，不是所有 Office 版本都适用。",
          "at": 0
        },
        {
          "title": "确认已有有效批量授权",
          "body": "先确认你已有有效的 Office 批量许可证。通用密钥不等于购买授权，也不能用于激活个人零售版；本步骤会连接页面说明的第三方服务。",
          "at": 10.875
        },
        {
          "title": "核对终端格式",
          "body": "选择 PowerShell 或 CMD，与你准备打开的管理员终端一致。这里只选择命令格式，不会替你执行激活。",
          "at": 23.708333
        },
        {
          "title": "复制完整命令",
          "body": "点击复制完整命令，并检查网页上的复制反馈。复制失败时下载命令文本；保留完整内容，不要删改密钥、校验或错误检查部分。",
          "at": 33.791667
        },
        {
          "title": "管理员终端操作示意",
          "body": "在对应的管理员终端粘贴命令，先阅读并核对内容，再决定是否运行。画面只是操作示意，不展示或承诺激活成功。",
          "at": 46.75
        },
        {
          "title": "核对目标版本和许可状态",
          "body": "以目标版本的实际许可状态为准，不能把其他版本已授权当成这次成功。出现错误、未授权或服务无法连接时先停止核对，不要反复执行或把输入命令当成成功。",
          "at": 58.541667
        }
      ]
    },
    {
      "id": "uninstall",
      "number": "03",
      "title": "Office 卸载：先备份，再确认移除范围",
      "description": "明确卸载范围、保存与备份要求，以及失败时的处理。",
      "duration": "1:09",
      "src": "/tutorials/office/zh-CN/uninstall.mp4",
      "poster": "/tutorials/office/zh-CN/uninstall.webp",
      "captions": "/tutorials/office/zh-CN/uninstall.vtt",
      "href": "#command-uninstall",
      "actionLabel": "查看对应命令",
      "steps": [
        {
          "title": "选择仅卸载",
          "body": "打开 Office 工具页面，选择仅卸载。卸载与安装是独立操作，请先确认自己需要移除现有 Office。",
          "at": 0
        },
        {
          "title": "保存文档并备份设置",
          "body": "先保存所有文档，备份需要保留的配置。页面说明的卸载会移除现有 Office，并清理相关配置、许可、服务和缓存。",
          "at": 10.041667
        },
        {
          "title": "选择管理员终端类型",
          "body": "选择 PowerShell 或 CMD，保持与实际终端一致。请仔细阅读卸载提示，再进入复制步骤。",
          "at": 21.833333
        },
        {
          "title": "完整复制卸载命令",
          "body": "点击复制完整命令，或下载命令文本。不要在不确定用途的电脑上粘贴运行，也不要把卸载命令误当作安装命令。",
          "at": 31
        },
        {
          "title": "管理员终端操作示意",
          "body": "在对应管理员终端粘贴后，再确认移除范围。本画面仅作示意，没有执行卸载；按回车前再次确认文档已保存、设置已备份。",
          "at": 42.083333
        },
        {
          "title": "失败时停止继续清理",
          "body": "如果卸载报错，先保存错误信息并停止；脚本不会在卸载失败后继续深度清理。不要因为看到命令运行就认定卸载完成，请按实际输出核对。",
          "at": 54.416667
        }
      ]
    },
    {
      "id": "reinstall",
      "number": "04",
      "title": "Office 完整重装：了解先卸载再安装",
      "description": "核对重装的影响，了解配置预检与执行结果的检查。",
      "duration": "1:08",
      "src": "/tutorials/office/zh-CN/reinstall.mp4",
      "poster": "/tutorials/office/zh-CN/reinstall.webp",
      "captions": "/tutorials/office/zh-CN/reinstall.vtt",
      "href": "#command-reinstall",
      "actionLabel": "查看对应命令",
      "steps": [
        {
          "title": "选择完整重装",
          "body": "进入 Office 页面，选择完整重装。它与仅安装不同，会先移除现有 Office，再按安装配置重新部署。",
          "at": 0
        },
        {
          "title": "保存与备份后再考虑重装",
          "body": "先保存文档、备份需要保留的设置，并阅读重装提示。完整重装不是修复按钮，请确认你接受移除现有 Office 的影响。",
          "at": 10.125
        },
        {
          "title": "选择相同的终端格式",
          "body": "选择 PowerShell 或 CMD，与实际管理员终端保持一致。网页只提供命令，不会因为选了完整重装就开始卸载。",
          "at": 21.583333
        },
        {
          "title": "复制或下载完整命令",
          "body": "点击复制完整命令，或下载文本再复制。保留全部内容，因为其中包含安装配置下载和校验的预检。",
          "at": 32.333333
        },
        {
          "title": "管理员终端操作示意",
          "body": "在管理员终端粘贴并核对，再自行决定是否执行。此处是操作示意，没有卸载或安装软件，也没有展示虚构的成功结果。",
          "at": 42.291667
        },
        {
          "title": "配置预检失败就停止",
          "body": "配置无法下载、返回403或校验失败时，脚本会在卸载前停止。不要跳过预检；重装结果和许可状态都需分别按实际输出核对。",
          "at": 54.208333
        }
      ]
    }
  ],
  "it": [
    {
      "id": "install",
      "number": "01",
      "title": "Installare Office: dal sito al terminale amministratore",
      "description": "Scegli il comando, salva i documenti e verifica il terminale e il risultato reale.",
      "duration": "1:17",
      "src": "/tutorials/office/it/install.mp4",
      "poster": "/tutorials/office/it/install.webp",
      "captions": "/tutorials/office/it/install.vtt",
      "href": "#command-install",
      "actionLabel": "Vedi il comando",
      "steps": [
        {
          "title": "Apri gli strumenti e scegli l’installazione",
          "body": "Apri gli strumenti ChinaTech nel browser, entra nella pagina Office e scegli Solo installazione. Il sito fornisce un comando: premere un pulsante sul sito non installa il programma.",
          "at": 0
        },
        {
          "title": "Salva prima i documenti aperti",
          "body": "Salva i documenti Word, Excel e le altre modifiche. L’installazione potrebbe chiudere le applicazioni Office. Controlla anche la versione e i componenti indicati nella pagina.",
          "at": 11.791667
        },
        {
          "title": "Scegli il terminale corretto",
          "body": "PowerShell è selezionato inizialmente. Se userai CMD, scegli CMD prima di copiare. I due formati sono diversi: usa quello del terminale che aprirai.",
          "at": 23.541667
        },
        {
          "title": "Copia tutto o scarica il testo",
          "body": "Premi Copia comando completo. Se il browser non permette la copia, scarica il testo e copialo dal file. Usa tutto il contenuto del sito, senza trascrivere il lungo comando dal video.",
          "at": 34.833333
        },
        {
          "title": "Esempio del terminale amministratore",
          "body": "In Windows apri PowerShell come amministratore, controlla il nome del terminale e incolla tutto il comando. Questa è un’illustrazione: il video non esegue l’installazione. Decidi se premere Invio solo dopo aver salvato i documenti.",
          "at": 47.125
        },
        {
          "title": "Verifica l’output effettivo",
          "body": "Controlla il risultato nell’output reale del programma. Con errore 403, problemi di rete o verifica fallita, fermati senza aggirare i controlli. Installazione e licenza valida sono due verifiche separate.",
          "at": 62.208333
        }
      ]
    },
    {
      "id": "activate",
      "number": "02",
      "title": "Attivare Office: verifica prima la licenza",
      "description": "Comprendi i requisiti della licenza volume e verifica il risultato effettivo.",
      "duration": "1:14",
      "src": "/tutorials/office/it/activate.mp4",
      "poster": "/tutorials/office/it/activate.webp",
      "captions": "/tutorials/office/it/activate.vtt",
      "href": "#command-activate",
      "actionLabel": "Vedi il comando",
      "steps": [
        {
          "title": "Scegli Solo attivazione",
          "body": "Apri la pagina Office e scegli Solo attivazione. Il comando riguarda la versione con licenza volume indicata: non è adatto a tutte le versioni di Office.",
          "at": 0
        },
        {
          "title": "Verifica la licenza volume valida",
          "body": "Assicurati di avere una licenza Office volume valida. Una chiave generica non equivale a una licenza acquistata e non attiva una copia personale retail. Il comando contatta il servizio di terze parti indicato nella pagina.",
          "at": 9.791667
        },
        {
          "title": "Controlla il formato del terminale",
          "body": "Scegli PowerShell o CMD in base al terminale amministratore che aprirai. Stai scegliendo il formato: il sito non esegue l’attivazione.",
          "at": 24.416667
        },
        {
          "title": "Copia il comando completo",
          "body": "Premi Copia comando completo e controlla il messaggio sul sito. Se fallisce, scarica il testo. Mantieni tutto il contenuto, comprese chiave e verifiche degli errori.",
          "at": 34.208333
        },
        {
          "title": "Esempio del terminale amministratore",
          "body": "Incolla nel terminale amministratore corretto, leggi e controlla il comando prima di decidere se eseguirlo. È soltanto un’illustrazione, senza mostrare o promettere un’attivazione riuscita.",
          "at": 45.833333
        },
        {
          "title": "Verifica versione e stato della licenza",
          "body": "Controlla lo stato effettivo della versione richiesta. Un’altra versione già autorizzata non dimostra il successo. Con errori, stato non autorizzato o servizio irraggiungibile, fermati e verifica, senza ripetere alla cieca.",
          "at": 58.208333
        }
      ]
    },
    {
      "id": "uninstall",
      "number": "03",
      "title": "Disinstallare Office: salva e verifica cosa rimuovi",
      "description": "Comprendi la rimozione, il backup e la gestione degli errori.",
      "duration": "1:10",
      "src": "/tutorials/office/it/uninstall.mp4",
      "poster": "/tutorials/office/it/uninstall.webp",
      "captions": "/tutorials/office/it/uninstall.vtt",
      "href": "#command-uninstall",
      "actionLabel": "Vedi il comando",
      "steps": [
        {
          "title": "Scegli Solo disinstallazione",
          "body": "Apri la pagina degli strumenti Office e scegli Solo disinstallazione. È un’operazione distinta dall’installazione: verifica di voler rimuovere Office esistente.",
          "at": 0
        },
        {
          "title": "Salva documenti e impostazioni",
          "body": "Salva tutti i documenti e fai una copia delle impostazioni da conservare. La rimozione descritta elimina Office e pulisce configurazioni, licenze, servizi e cache correlati.",
          "at": 10.291667
        },
        {
          "title": "Scegli il tipo di terminale",
          "body": "Scegli PowerShell o CMD, in accordo con il terminale amministratore. Leggi attentamente l’avviso di disinstallazione prima di copiare.",
          "at": 22.416667
        },
        {
          "title": "Copia tutto il comando di rimozione",
          "body": "Premi Copia comando completo oppure scarica il testo. Non eseguirlo su un computer di cui non conosci l’utilizzo e non confonderlo con il comando di installazione.",
          "at": 31.541667
        },
        {
          "title": "Esempio del terminale amministratore",
          "body": "Dopo aver incollato, verifica ancora cosa verrà rimosso. È un’illustrazione: non viene eseguita alcuna disinstallazione. Prima di Invio, assicurati di aver salvato e fatto il backup.",
          "at": 42.166667
        },
        {
          "title": "Fermati se la rimozione fallisce",
          "body": "Con un errore, conserva il messaggio e fermati. Lo script non continua la pulizia approfondita se la disinstallazione fallisce. Un comando avviato non equivale a un’operazione completata: controlla l’output reale.",
          "at": 54.875
        }
      ]
    },
    {
      "id": "reinstall",
      "number": "04",
      "title": "Reinstallare Office: rimuovere prima di installare",
      "description": "Comprendi l’impatto della reinstallazione e il controllo della configurazione.",
      "duration": "1:11",
      "src": "/tutorials/office/it/reinstall.mp4",
      "poster": "/tutorials/office/it/reinstall.webp",
      "captions": "/tutorials/office/it/reinstall.vtt",
      "href": "#command-reinstall",
      "actionLabel": "Vedi il comando",
      "steps": [
        {
          "title": "Scegli Reinstallazione completa",
          "body": "Apri la pagina Office e scegli Reinstallazione completa. È diversa dalla sola installazione: rimuove prima Office esistente e poi lo reinstalla secondo la configurazione.",
          "at": 0
        },
        {
          "title": "Salva e fai il backup prima",
          "body": "Salva i documenti, fai una copia delle impostazioni da conservare e leggi l’avviso. Non è un semplice pulsante di riparazione: devi accettare la rimozione di Office esistente.",
          "at": 11.166667
        },
        {
          "title": "Scegli il formato corretto",
          "body": "Scegli PowerShell o CMD in accordo con il terminale amministratore. Il sito fornisce solo il comando: selezionare la reinstallazione non avvia la rimozione.",
          "at": 22.75
        },
        {
          "title": "Copia o scarica tutto il comando",
          "body": "Premi Copia comando completo oppure scarica e copia il testo. Mantieni l’intero contenuto: comprende i controlli preliminari sul download e sulla configurazione.",
          "at": 33.333333
        },
        {
          "title": "Esempio del terminale amministratore",
          "body": "Incolla e controlla il comando, poi decidi se eseguirlo. La scena è un’illustrazione: non rimuove né installa programmi e non mostra un risultato riuscito inventato.",
          "at": 44.375
        },
        {
          "title": "Fermati se il controllo fallisce",
          "body": "Se la configurazione non si scarica, ritorna 403 o non supera la verifica, lo script si ferma prima della rimozione. Non saltare i controlli. Verifica separatamente reinstallazione e licenza nell’output reale.",
          "at": 55.333333
        }
      ]
    }
  ],
  "en": [
    {
      "id": "install",
      "number": "01",
      "title": "Install Office: from the website to an administrator terminal",
      "description": "Choose the command, save your documents and check the terminal and actual result.",
      "duration": "1:24",
      "src": "/tutorials/office/en/install.mp4",
      "poster": "/tutorials/office/en/install.webp",
      "captions": "/tutorials/office/en/install.vtt",
      "href": "#command-install",
      "actionLabel": "View the command",
      "steps": [
        {
          "title": "Open the toolbox and choose installation",
          "body": "Open the ChinaTech toolbox in your browser, go to Office and choose Install only. The website provides a command reference. Clicking a website button does not install software.",
          "at": 0
        },
        {
          "title": "Save your open documents first",
          "body": "Save your Word, Excel and other unfinished documents. Installation may close Office applications. Check the version and selected components described on the page.",
          "at": 12.666667
        },
        {
          "title": "Choose the terminal you will use",
          "body": "PowerShell is selected by default. If you will use CMD, select CMD before copying. The formats differ, so use the one matching the administrator terminal you open.",
          "at": 25.333333
        },
        {
          "title": "Copy everything or download the text",
          "body": "Click Copy full command. If your browser blocks copying, download the command text and copy it from the file. Use the full website content rather than typing the long command from this video.",
          "at": 38.416667
        },
        {
          "title": "Administrator terminal illustration",
          "body": "In Windows, open PowerShell as administrator, check the terminal name and paste the entire command. This is an illustration: the video does not run the installation. Decide whether to press Enter only after saving your documents.",
          "at": 52
        },
        {
          "title": "Check the actual installation output",
          "body": "Check the result in the installer's actual output. Stop on a 403 response, network error or failed verification. Do not bypass the checks. Installation and a valid license are separate matters.",
          "at": 67.708333
        }
      ]
    },
    {
      "id": "activate",
      "number": "02",
      "title": "Activate Office: check your license first",
      "description": "Understand volume licensing requirements and check the actual licensing result.",
      "duration": "1:23",
      "src": "/tutorials/office/en/activate.mp4",
      "poster": "/tutorials/office/en/activate.webp",
      "captions": "/tutorials/office/en/activate.vtt",
      "href": "#command-activate",
      "actionLabel": "View the command",
      "steps": [
        {
          "title": "Choose Activate only",
          "body": "Open the Office page and choose Activate only. This command targets the volume licensed edition described on the page. It does not apply to every Office edition.",
          "at": 0
        },
        {
          "title": "Confirm a valid volume license",
          "body": "Make sure you already have a valid Office volume license. A generic key is not a purchased license and cannot activate a personal retail copy. This step contacts the third-party service identified on the page.",
          "at": 12.041667
        },
        {
          "title": "Check the terminal format",
          "body": "Choose PowerShell or CMD to match the administrator terminal you will open. You are selecting a command format. The website does not perform activation.",
          "at": 26.75
        },
        {
          "title": "Copy the entire command",
          "body": "Click Copy full command and check the website feedback. If copying fails, download the text. Keep the complete command, including its key, verification and error checks.",
          "at": 38.5
        },
        {
          "title": "Administrator terminal illustration",
          "body": "Paste into the matching administrator terminal. Read and check the content before deciding whether to run it. This is only an illustration and neither shows nor promises successful activation.",
          "at": 52
        },
        {
          "title": "Check the target edition and license status",
          "body": "Check the actual license status of the target edition. Another licensed edition does not prove success. Stop and investigate errors, an unlicensed status or an unreachable service. Starting a command is not proof of activation.",
          "at": 65.083333
        }
      ]
    },
    {
      "id": "uninstall",
      "number": "03",
      "title": "Uninstall Office: back up and check the removal scope",
      "description": "Understand what is removed, what to save and what to do on failure.",
      "duration": "1:15",
      "src": "/tutorials/office/en/uninstall.mp4",
      "poster": "/tutorials/office/en/uninstall.webp",
      "captions": "/tutorials/office/en/uninstall.vtt",
      "href": "#command-uninstall",
      "actionLabel": "View the command",
      "steps": [
        {
          "title": "Choose Uninstall only",
          "body": "Open the Office toolbox page and choose Uninstall only. This is separate from installation. First confirm that you intend to remove the existing Office installation.",
          "at": 0
        },
        {
          "title": "Save documents and back up settings",
          "body": "Save every open document and back up settings you need to keep. The removal described on the page removes Office and clears its related configuration, licensing, services and caches.",
          "at": 11.916667
        },
        {
          "title": "Choose your administrator terminal",
          "body": "Choose PowerShell or CMD to match the actual administrator terminal. Read the removal notice carefully before moving on to copying.",
          "at": 24.458333
        },
        {
          "title": "Copy the entire removal command",
          "body": "Click Copy full command or download its text. Do not run it on a computer whose purpose you are unsure of, and do not confuse this command with the installation command.",
          "at": 34.041667
        },
        {
          "title": "Administrator terminal illustration",
          "body": "After pasting, check the removal scope again. This is only an illustration: no uninstall is run. Before pressing Enter, confirm that your documents are saved and your settings backed up.",
          "at": 45.041667
        },
        {
          "title": "Stop if removal fails",
          "body": "If uninstalling reports an error, keep the message and stop. The script does not continue deep cleanup after an uninstall failure. A started command is not a completed uninstall. Check the actual output.",
          "at": 58.666667
        }
      ]
    },
    {
      "id": "reinstall",
      "number": "04",
      "title": "Reinstall Office: understand removal before installation",
      "description": "Understand the impact, configuration preflight and actual result checks.",
      "duration": "1:17",
      "src": "/tutorials/office/en/reinstall.mp4",
      "poster": "/tutorials/office/en/reinstall.webp",
      "captions": "/tutorials/office/en/reinstall.vtt",
      "href": "#command-reinstall",
      "actionLabel": "View the command",
      "steps": [
        {
          "title": "Choose Full reinstall",
          "body": "Open the Office page and choose Full reinstall. Unlike installation alone, it first removes existing Office and then deploys it again using the installation configuration.",
          "at": 0
        },
        {
          "title": "Save and back up before reinstalling",
          "body": "Save your documents, back up settings you need to keep and read the notice. Full reinstall is not a simple repair button. Confirm that you accept removing the existing Office installation.",
          "at": 11.416667
        },
        {
          "title": "Match the terminal format",
          "body": "Choose PowerShell or CMD to match your administrator terminal. The website only provides a command. Selecting Full reinstall does not start uninstalling.",
          "at": 24.416667
        },
        {
          "title": "Copy or download the whole command",
          "body": "Click Copy full command or download and copy the text. Keep every part, because it includes configuration download and verification checks before removal.",
          "at": 36.166667
        },
        {
          "title": "Administrator terminal illustration",
          "body": "Paste and review the command, then decide whether to execute it. This scene is an illustration. It does not uninstall or install software and does not invent a successful result.",
          "at": 47.083333
        },
        {
          "title": "Stop if configuration checks fail",
          "body": "If configuration cannot download, returns 403 or fails verification, the script stops before uninstalling. Do not skip preflight checks. Check reinstall results and licensing separately using the actual output.",
          "at": 59.875
        }
      ]
    }
  ]
};

export function getOfficeTutorials(locale: TutorialLocale): readonly Tutorial[] { return catalog[locale]; }
