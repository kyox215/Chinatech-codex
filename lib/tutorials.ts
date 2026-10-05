export type TutorialStep = { title: string; body: string; at: number };
export type Tutorial = { id: string; number: string; title: string; description: string; duration: string; src: string; poster: string; captions: string; href: string; actionLabel: string; steps: readonly TutorialStep[] };
export type TutorialLocale = "zh-CN" | "it" | "en";

// Generated from the three storyboards and measured, frame-aligned narration.
const catalog: Record<TutorialLocale, readonly Tutorial[]> = {
  "zh-CN": [
    {
      "id": "start",
      "number": "01",
      "title": "注册、登录与进入门店",
      "description": "从打开网站到进入工作台，先把账号准备好。",
      "href": "/login",
      "actionLabel": "前往登录",
      "duration": "1:04",
      "src": "/tutorials/start.mp4",
      "poster": "/tutorials/start.webp",
      "captions": "/tutorials/start.vtt",
      "steps": [
        {
          "title": "打开网站，无需下载",
          "body": "在手机或电脑浏览器打开 ChinaTech 网站。首页左上角有登录和注册入口，不需要下载安装软件。",
          "at": 0
        },
        {
          "title": "填写资料，创建账号",
          "body": "第一次使用，点击注册。填写称呼、邮箱和两次密码。密码至少十位，并包含字母和数字。",
          "at": 9.875
        },
        {
          "title": "验证邮箱，等待门店授权",
          "body": "提交后，在发起注册的同一浏览器打开验证邮件。完成验证，还需要门店老板授权，才能查看门店业务。",
          "at": 20.208
        },
        {
          "title": "使用已获授权的账号登录",
          "body": "已有账号，回到登录页，输入邮箱和密码。也可以使用页面提供的 Google 登录，门店权限仍需单独授权。",
          "at": 30.708
        },
        {
          "title": "从侧栏找到日常工作",
          "body": "进入工作台后，从侧栏打开维修工单、整机商品或客户记录。这里展示的是虚构资料，实际内容以你的门店为准。",
          "at": 41.5
        },
        {
          "title": "手机菜单也在标题旁",
          "body": "手机上点击页面标题旁的菜单按钮，就能切换模块。账号和退出在侧栏底部，用完共享设备记得退出。",
          "at": 52.792
        }
      ]
    },
    {
      "id": "intake",
      "number": "02",
      "title": "接机登记与新建工单",
      "description": "记清客户、设备与故障，核对后保存接机资料。",
      "href": "/app/repairs/new",
      "actionLabel": "开始接机登记",
      "duration": "1:07",
      "src": "/tutorials/intake.mp4",
      "poster": "/tutorials/intake.webp",
      "captions": "/tutorials/intake.vtt",
      "steps": [
        {
          "title": "维修工单 → 新建工单",
          "body": "收到客户送修设备，进入维修工单，点击右上角的新建工单。接下来按步骤登记，不需要一次填完所有信息。",
          "at": 0
        },
        {
          "title": "先填写客户联系电话",
          "body": "先填写联系电话，再核对称呼。已有客户可以从候选中选择，避免重复录入；本次使用的是虚构演示资料。",
          "at": 10.5
        },
        {
          "title": "核对这一台实物设备",
          "body": "下一步选择设备类型、品牌和型号。序列号或 IMEI 按实物填写，使用扫码时也要先核对，不能凭型号猜测配置。",
          "at": 21.333
        },
        {
          "title": "记录故障、维修项目与报价",
          "body": "选择客户报告的故障，按需要填写维修项目和报价。这里记录的是客户需求，不能代替实际检测和客户的维修同意。",
          "at": 33.333
        },
        {
          "title": "核对资料，签名可以跳过",
          "body": "到确认步骤，核对客户、设备、故障、随件和报价。接机签名可以跳过，签名也不代表已收款或已交还。",
          "at": 44.417
        },
        {
          "title": "保存后查看详情与接机单",
          "body": "勾选已与客户核对，点击保存并预览。保存成功后可以查看工单和打印接机单，后续进度继续在这张工单跟进。",
          "at": 55.292
        }
      ]
    },
    {
      "id": "follow-up",
      "number": "03",
      "title": "查找工单与联系跟进",
      "description": "查单、改阶段、记沟通，每一步都有可追溯记录。",
      "href": "/app/repairs",
      "actionLabel": "打开维修工单",
      "duration": "1:05",
      "src": "/tutorials/follow-up.mp4",
      "poster": "/tutorials/follow-up.webp",
      "captions": "/tutorials/follow-up.vtt",
      "steps": [
        {
          "title": "四个日常分组，快速查单",
          "body": "维修列表按返修、处理中、等配件、等取机分组。用客户、设备或工单信息搜索，先核对目标设备。",
          "at": 0
        },
        {
          "title": "点击阶段，按实际进展选择",
          "body": "点击这一行的阶段标签，打开维修阶段窗口。按实际进展选择待检测、维修中，或修好，等取机。",
          "at": 10.75
        },
        {
          "title": "确认保存，阶段才会更新",
          "body": "核对新的阶段，必要时填写变更原因，然后保存。改变维修阶段，不会自动代表配件到齐、收到款项或交还设备。",
          "at": 20.792
        },
        {
          "title": "用跟进记录联系结果",
          "body": "点击跟进，打开联系窗口。与客户沟通报价后，根据实际结果选择已沟通报价、未接通或报价待客户回复。",
          "at": 32.5
        },
        {
          "title": "先实际联系，再记录结果",
          "body": "补充联系说明，再点击对应的结果按钮。这里保存的是沟通记录，不会替你发送消息，也不表示客户已经同意维修。",
          "at": 43.667
        },
        {
          "title": "详情中继续追溯",
          "body": "打开工单详情，可以继续查看设备、配件和跟进历史。返回列表后，接着处理下一张工单。",
          "at": 54.958
        }
      ]
    },
    {
      "id": "procurement",
      "number": "04",
      "title": "配件采购与分次到货",
      "description": "选供应商、核对实际下单，再逐次记录收到的配件。",
      "href": "/app/procurement",
      "actionLabel": "打开采购与到货",
      "duration": "1:06",
      "src": "/tutorials/procurement.mp4",
      "poster": "/tutorials/procurement.webp",
      "captions": "/tutorials/procurement.vtt",
      "steps": [
        {
          "title": "从工单打开配件",
          "body": "先在工单列表点击配件按钮。窗口会列出接机时选好的维修项目，逐项填写就可以，不需要重复新建项目。",
          "at": 0
        },
        {
          "title": "逐项选择供应商与报价",
          "body": "给需要采购的项目选择供应商，报价可以选填。有财务权限时才能记录进价；只填报价不选供应商，不会生成采购。",
          "at": 10.833
        },
        {
          "title": "保存加车，不等于已下单",
          "body": "核对后保存，已选供应商的项目进入采购车。加车只代表准备采购，系统不会自动向供应商下单。",
          "at": 22.542
        },
        {
          "title": "实际下单后，核对清单再记录",
          "body": "实际向供应商下单后，打开采购车，选供应商和对应项目。点击核对所选清单，再确认保存实际事实。",
          "at": 32.5
        },
        {
          "title": "到多少，记录多少",
          "body": "收到配件时打开批量到货。选择供应商和项目，填写本次实际数量，核对后保存；分几次到，就分几次记录。",
          "at": 43.125
        },
        {
          "title": "到货与维修阶段分别核对",
          "body": "采购页可以查看到货数量和关联工单。配件到齐后，仍要按实际情况跟进维修与客户联系，这里不作为配件库存。",
          "at": 54.375
        }
      ]
    },
    {
      "id": "retail",
      "number": "05",
      "title": "整机商品，一机一档",
      "description": "给门店自有实物建档，记录规格并继续检测。",
      "href": "/app/retail/new",
      "actionLabel": "新建整机档案",
      "duration": "1:10",
      "src": "/tutorials/retail.mp4",
      "poster": "/tutorials/retail.webp",
      "captions": "/tutorials/retail.vtt",
      "steps": [
        {
          "title": "新建独立单机，先选分类",
          "body": "整机商品用于门店自有的待售实物。新建独立单机时，先选新机或翻新机，不要把客户送修设备登记在这里。",
          "at": 0
        },
        {
          "title": "相同型号，也要分别建档",
          "body": "填写商品类型、品牌和型号，再按实物记录识别码。相同型号的两台设备，也有各自独立的档案。",
          "at": 11.417
        },
        {
          "title": "规格按实测，未知就留空",
          "body": "内存、机身存储和磁盘分别记录。检测到什么就填什么，未知不要填零，也不要从商品名称推断这台设备的配置。",
          "at": 21.417
        },
        {
          "title": "记录外观、电池与随件",
          "body": "下一步记录外观、电池和随附物品。已知问题要对应这台实物，照片在建档后上传；没有检测过的项目不要填写通过。",
          "at": 32.917
        },
        {
          "title": "核对金额、来源与所有权",
          "body": "填写标价和存放位置，成本只向获授权成员开放。确认是门店自有实物，再创建独立档案。新档案保持待检测，不会自动可售。",
          "at": 44.667
        },
        {
          "title": "建档后继续真实检测",
          "body": "在单机详情记录实际检测，再按流程确认可售。以后销售、收款、交付和售后分别记录，始终跟随这一台设备。",
          "at": 58.292
        }
      ]
    }
  ],
  "it": [
    {
      "id": "start",
      "number": "01",
      "title": "Registrazione e accesso al negozio",
      "description": "Prepara il tuo account e accedi allo spazio di lavoro del negozio.",
      "href": "/login",
      "actionLabel": "Vai all'accesso",
      "duration": "1:03",
      "src": "/tutorials/it/start.mp4",
      "poster": "/tutorials/it/start.webp",
      "captions": "/tutorials/it/start.vtt",
      "steps": [
        {
          "title": "Apri il sito",
          "body": "Apri ChinaTech nel browser del telefono o del computer. In alto a sinistra trovi accesso e registrazione. Non serve scaricare un'applicazione.",
          "at": 0
        },
        {
          "title": "Crea il tuo account",
          "body": "Scegli Registrati e inserisci nome, email e due volte la password. La password deve avere almeno dieci caratteri, con lettere e numeri.",
          "at": 10.208
        },
        {
          "title": "Verifica l'email e attendi l'accesso",
          "body": "Apri l'email di verifica nello stesso browser usato per registrarti. Dopo la verifica, il titolare deve ancora autorizzarti ad accedere ai dati del negozio.",
          "at": 19.5
        },
        {
          "title": "Accedi con un account autorizzato",
          "body": "Nella pagina di accesso inserisci email e password, oppure usa il pulsante Google. L'accesso con Google non assegna automaticamente i permessi del negozio.",
          "at": 29.833
        },
        {
          "title": "Trova il lavoro quotidiano",
          "body": "Dal menu a sinistra apri le riparazioni, i dispositivi in vendita o i clienti. I dati di questa dimostrazione sono fittizi: nel tuo negozio troverai i suoi dati reali.",
          "at": 40.083
        },
        {
          "title": "Usa il menu dal telefono",
          "body": "Sul telefono tocca il menu accanto al titolo della pagina. Account e uscita sono in fondo al menu laterale. Ricordati di uscire quando usi un dispositivo condiviso.",
          "at": 51.458
        }
      ]
    },
    {
      "id": "intake",
      "number": "02",
      "title": "Accettazione e nuova riparazione",
      "description": "Registra cliente, dispositivo e problema, poi controlla e salva.",
      "href": "/app/repairs/new",
      "actionLabel": "Inizia l'accettazione",
      "duration": "1:10",
      "src": "/tutorials/it/intake.mp4",
      "poster": "/tutorials/it/intake.webp",
      "captions": "/tutorials/it/intake.vtt",
      "steps": [
        {
          "title": "Crea una nuova riparazione",
          "body": "Nell'elenco delle riparazioni, premi il pulsante viola in alto a destra per creare una nuova scheda. Il modulo ti guida un passaggio alla volta.",
          "at": 0
        },
        {
          "title": "Inizia dal numero di telefono",
          "body": "Inserisci il numero del cliente nel primo campo e verifica il nome. Se il cliente esiste già, selezionalo dai suggerimenti. Qui usiamo soltanto dati dimostrativi fittizi.",
          "at": 9.417
        },
        {
          "title": "Identifica questo dispositivo",
          "body": "Scegli categoria, marca e modello. Copia il numero di serie o l'IMEI dal dispositivo. Verifica sempre il testo scansionato: il modello non conferma le caratteristiche di quell'esemplare.",
          "at": 21.625
        },
        {
          "title": "Registra problema e preventivo",
          "body": "Seleziona il problema segnalato e compila gli interventi e l'eventuale preventivo. Sono richieste del cliente: non sostituiscono la diagnosi né il consenso alla riparazione.",
          "at": 34.875
        },
        {
          "title": "Controlla i dati; la firma è facoltativa",
          "body": "Controlla cliente, dispositivo, problema, accessori e preventivo. Puoi saltare la firma. Una firma non significa che il pagamento sia stato ricevuto o il dispositivo riconsegnato.",
          "at": 45.708
        },
        {
          "title": "Salva e apri la scheda",
          "body": "Spunta la conferma e premi il pulsante di salvataggio e anteprima in basso. Dopo il salvataggio puoi aprire la scheda o stampare la ricevuta di accettazione.",
          "at": 59
        }
      ]
    },
    {
      "id": "follow-up",
      "number": "03",
      "title": "Ricerca e aggiornamento delle riparazioni",
      "description": "Trova la scheda, aggiorna la fase e registra i contatti effettivi.",
      "href": "/app/repairs",
      "actionLabel": "Apri le riparazioni",
      "duration": "1:14",
      "src": "/tutorials/it/follow-up.mp4",
      "poster": "/tutorials/it/follow-up.webp",
      "captions": "/tutorials/it/follow-up.vtt",
      "steps": [
        {
          "title": "Cerca nei quattro gruppi quotidiani",
          "body": "Le riparazioni sono divise in rientri in riparazione, in lavorazione, attesa ricambi e attesa ritiro. Cerca cliente, dispositivo o numero della scheda, poi verifica il dispositivo corretto.",
          "at": 0
        },
        {
          "title": "Scegli la fase reale",
          "body": "Premi l'etichetta della fase nella riga. Nella finestra scegli la situazione reale, per esempio da diagnosticare, in riparazione, oppure riparato e in attesa di ritiro.",
          "at": 13.167
        },
        {
          "title": "Controlla e salva la fase",
          "body": "Verifica la nuova fase e scrivi il motivo, se richiesto. Poi salva dal pulsante in basso. La fase non conferma arrivo dei ricambi, pagamento o riconsegna del dispositivo.",
          "at": 24.167
        },
        {
          "title": "Apri contatti e aggiornamenti",
          "body": "Premi il pulsante di contatto nella riga. Dopo aver contattato il cliente per il preventivo, registra l'esito reale: preventivo comunicato, nessuna risposta o attesa di risposta sul preventivo.",
          "at": 36.208
        },
        {
          "title": "Registra ciò che è successo",
          "body": "Scrivi una nota nel campo, poi premi sotto il pulsante dell'esito corretto. Il sito salva una registrazione: non invia messaggi e non dimostra il consenso del cliente alla riparazione.",
          "at": 48.708
        },
        {
          "title": "Consulta la cronologia della scheda",
          "body": "Apri i dettagli per vedere dispositivo, ricambi e cronologia dei contatti. Custodia e riconsegna sono fatti separati. Torna all'elenco per continuare con la scheda successiva.",
          "at": 61
        }
      ]
    },
    {
      "id": "procurement",
      "number": "04",
      "title": "Acquisto ricambi e arrivi parziali",
      "description": "Scegli il fornitore e registra ordini reali e singole consegne.",
      "href": "/app/procurement",
      "actionLabel": "Apri acquisti e arrivi",
      "duration": "1:12",
      "src": "/tutorials/it/procurement.mp4",
      "poster": "/tutorials/it/procurement.webp",
      "captions": "/tutorials/it/procurement.vtt",
      "steps": [
        {
          "title": "Apri i ricambi dalla riparazione",
          "body": "Premi il pulsante dei ricambi nell'elenco delle riparazioni. La finestra contiene già gli interventi scelti all'accettazione. Compila ogni voce senza crearla di nuovo.",
          "at": 0
        },
        {
          "title": "Scegli fornitore e preventivo",
          "body": "Seleziona il fornitore per i ricambi da acquistare. Il preventivo è facoltativo; il costo richiede permessi finanziari. Il solo preventivo, senza fornitore, non crea un acquisto.",
          "at": 11.208
        },
        {
          "title": "Salva nel carrello",
          "body": "Controlla e salva. Le voci con un fornitore entrano nel carrello acquisti. Il carrello è solo una preparazione: il sito non invia ordini al fornitore.",
          "at": 23.792
        },
        {
          "title": "Registra l'ordine già effettuato",
          "body": "Dopo aver ordinato realmente al fornitore, apri il carrello e seleziona fornitore e voci. Premi il controllo della lista in basso, verifica e conferma i fatti registrati.",
          "at": 35.042
        },
        {
          "title": "Registra quanto è arrivato",
          "body": "Apri gli arrivi multipli, scegli fornitore e voci e inserisci le quantità ricevute in questa consegna. Controlla e salva. Ogni consegna va registrata separatamente.",
          "at": 46.375
        },
        {
          "title": "Separa arrivi e fase di riparazione",
          "body": "La pagina acquisti mostra quantità arrivate e riparazioni collegate. Dopo l'arrivo, continua a seguire la riparazione e il cliente secondo i fatti reali. Questi dati non sono un magazzino ricambi.",
          "at": 58.083
        }
      ]
    },
    {
      "id": "retail",
      "number": "05",
      "title": "Una scheda per ogni dispositivo in vendita",
      "description": "Registra l'esemplare di proprietà del negozio e poi esegui i controlli.",
      "href": "/app/retail/new",
      "actionLabel": "Crea una scheda dispositivo",
      "duration": "1:16",
      "src": "/tutorials/it/retail.mp4",
      "poster": "/tutorials/it/retail.webp",
      "captions": "/tutorials/it/retail.vtt",
      "steps": [
        {
          "title": "Scegli nuovo o ricondizionato",
          "body": "I dispositivi in vendita sono esemplari di proprietà del negozio. In alto scegli nuovo o ricondizionato. Non inserire qui i dispositivi consegnati dai clienti per riparazione.",
          "at": 0
        },
        {
          "title": "Una scheda per ogni esemplare",
          "body": "Inserisci categoria, marca e modello, poi copia i codici dall'esemplare reale. Due dispositivi dello stesso modello devono avere schede distinte.",
          "at": 12.042
        },
        {
          "title": "Compila solo le specifiche verificate",
          "body": "Registra separatamente memoria, spazio interno e singoli dischi, quando previsti. Lascia vuoti i valori sconosciuti, senza scrivere zero. Non dedurre la configurazione dal nome del prodotto.",
          "at": 22.042
        },
        {
          "title": "Registra condizioni e accessori",
          "body": "Prosegui con aspetto, batteria e accessori inclusi. I problemi noti devono riferirsi a questo esemplare. Carica le foto dopo aver creato la scheda e non segnare come superati controlli mai eseguiti.",
          "at": 35.583
        },
        {
          "title": "Verifica prezzo, provenienza e proprietà",
          "body": "Inserisci prezzo e posizione. I costi richiedono l'autorizzazione. Spunta la proprietà del negozio e crea la scheda. Il nuovo esemplare resta da controllare, non diventa subito vendibile.",
          "at": 48.958
        },
        {
          "title": "Controlla prima di mettere in vendita",
          "body": "Nei dettagli registra i controlli effettivi, poi segui la conferma per rendere il dispositivo vendibile. Vendita, pagamenti, consegna e assistenza restano registrazioni separate dello stesso esemplare.",
          "at": 62.542
        }
      ]
    }
  ],
  "en": [
    {
      "id": "start",
      "number": "01",
      "title": "Register, sign in and access your shop",
      "description": "Set up your account, then enter your shop workspace.",
      "href": "/login",
      "actionLabel": "Go to sign in",
      "duration": "1:04",
      "src": "/tutorials/en/start.mp4",
      "poster": "/tutorials/en/start.webp",
      "captions": "/tutorials/en/start.vtt",
      "steps": [
        {
          "title": "Open the website",
          "body": "Open ChinaTech in your phone or computer browser. The sign in and register links are at the top left. There is no app to download.",
          "at": 0
        },
        {
          "title": "Create your account",
          "body": "Choose Register and enter your name, email and password twice. Your password needs at least ten characters, including letters and numbers.",
          "at": 10.333
        },
        {
          "title": "Verify your email and await access",
          "body": "Open the verification email in the same browser used to register. After verification, the shop owner still needs to grant access to shop records.",
          "at": 20.458
        },
        {
          "title": "Sign in with an approved account",
          "body": "On the sign in page, enter your email and password, or use the Google button. Signing in with Google does not automatically grant shop permissions.",
          "at": 30.917
        },
        {
          "title": "Find your daily work in the sidebar",
          "body": "Use the left sidebar to open repair orders, retail devices or customers. The records shown in this demonstration are fictional; your shop has its own records.",
          "at": 41.125
        },
        {
          "title": "Use the menu on your phone",
          "body": "On a phone, tap the menu beside the page title. Your account and sign out option are at the bottom of the sidebar. Sign out when using a shared device.",
          "at": 52.417
        }
      ]
    },
    {
      "id": "intake",
      "number": "02",
      "title": "Receive a device and create a repair",
      "description": "Record the customer, device and reported problem, then review and save.",
      "href": "/app/repairs/new",
      "actionLabel": "Start device intake",
      "duration": "1:14",
      "src": "/tutorials/en/intake.mp4",
      "poster": "/tutorials/en/intake.webp",
      "captions": "/tutorials/en/intake.vtt",
      "steps": [
        {
          "title": "Open a new repair order",
          "body": "In the repair list, click the purple button at the top right to create an order. The form guides you through the details one step at a time.",
          "at": 0
        },
        {
          "title": "Start with the phone number",
          "body": "Enter the customer's phone number in the first field, then check their name. Select an existing customer from the suggestions when appropriate. These are fictional demo details.",
          "at": 9.25
        },
        {
          "title": "Identify this physical device",
          "body": "Choose the device category, brand and model. Enter the serial number or I M E I from the device. Always check scanned text; a model name does not confirm its specifications.",
          "at": 21.667
        },
        {
          "title": "Record the problem and quote",
          "body": "Select the reported problem and enter any repair items and quote. These fields record the customer's request. They do not replace inspection or the customer's approval to repair.",
          "at": 35.167
        },
        {
          "title": "Review; the signature is optional",
          "body": "Review the customer, device, problem, accessories and quote. You may skip the signature button. A signature does not mean payment was received or the device was returned.",
          "at": 47.958
        },
        {
          "title": "Save, then view the order",
          "body": "Tick the confirmation box and use the save and preview button below. After saving, open the order or print the intake receipt. Continue tracking this repair in the same order.",
          "at": 60.833
        }
      ]
    },
    {
      "id": "follow-up",
      "number": "03",
      "title": "Find repairs and record follow-ups",
      "description": "Find the right order, update its stage and record actual contact.",
      "href": "/app/repairs",
      "actionLabel": "Open repair orders",
      "duration": "1:11",
      "src": "/tutorials/en/follow-up.mp4",
      "poster": "/tutorials/en/follow-up.webp",
      "captions": "/tutorials/en/follow-up.vtt",
      "steps": [
        {
          "title": "Find a repair in the four groups",
          "body": "Daily repairs are grouped as return repairs, in progress, waiting for parts and waiting for collection. Use the search field to find a customer, device or order, then check the device.",
          "at": 0
        },
        {
          "title": "Choose the actual repair stage",
          "body": "Click the stage badge in the order row. In the window, choose the actual progress, such as awaiting diagnosis, being repaired, or repaired and waiting for collection.",
          "at": 12.667
        },
        {
          "title": "Review and save the stage",
          "body": "Check the stage, add a reason when required, then click the save button below. A stage change does not confirm parts arrival, payment or the return of the device.",
          "at": 24.042
        },
        {
          "title": "Open contact and follow-up",
          "body": "Click the follow-up button in the order row. After contacting the customer about the quote, choose the actual result: quote discussed, no answer, or awaiting a reply about the quote.",
          "at": 35.292
        },
        {
          "title": "Record what actually happened",
          "body": "Enter a contact note in the field, then click the matching result button below. This saves a record; it does not send a message or prove the customer approved the repair.",
          "at": 47.25
        },
        {
          "title": "Review the history in the order",
          "body": "Open the order details to see the device, parts and follow-up history. Device custody and return are separate facts. Go back to the list to continue with the next order.",
          "at": 58.25
        }
      ]
    },
    {
      "id": "procurement",
      "number": "04",
      "title": "Purchase parts and record arrivals",
      "description": "Choose suppliers, confirm actual orders and record each delivery.",
      "href": "/app/procurement",
      "actionLabel": "Open purchases and arrivals",
      "duration": "1:16",
      "src": "/tutorials/en/procurement.mp4",
      "poster": "/tutorials/en/procurement.webp",
      "captions": "/tutorials/en/procurement.vtt",
      "steps": [
        {
          "title": "Open parts from the repair row",
          "body": "Click the parts button in the repair list. The window already contains the repair items chosen at intake. Fill in each item without creating the same item again.",
          "at": 0
        },
        {
          "title": "Choose a supplier and quote",
          "body": "Use the supplier field for items you need to buy. A quote is optional. Purchase cost is editable only with financial permission. A quote without a supplier does not create a purchase.",
          "at": 11.792
        },
        {
          "title": "Save to the cart",
          "body": "Check the entries and save. Items with a supplier enter the purchase cart. The cart is only preparation; the website does not place an order with the supplier.",
          "at": 26.042
        },
        {
          "title": "Record the order after placing it",
          "body": "After actually ordering from the supplier, open the cart and select that supplier and the items. Use the review button below, check the list, then confirm the recorded facts.",
          "at": 37.875
        },
        {
          "title": "Record only what arrived",
          "body": "Open batch arrivals, choose the supplier and items, then enter the quantities received in this delivery. Review and save. Record separate deliveries separately.",
          "at": 49.917
        },
        {
          "title": "Keep arrivals and repair stages separate",
          "body": "The purchase page shows received quantities and linked repairs. When parts arrive, still update the repair and contact the customer as appropriate. These records are not parts inventory.",
          "at": 61.958
        }
      ]
    },
    {
      "id": "retail",
      "number": "05",
      "title": "One record for each retail device",
      "description": "Create a record for a shop-owned device, then inspect it.",
      "href": "/app/retail/new",
      "actionLabel": "Create a device record",
      "duration": "1:20",
      "src": "/tutorials/en/retail.mp4",
      "poster": "/tutorials/en/retail.webp",
      "captions": "/tutorials/en/retail.vtt",
      "steps": [
        {
          "title": "Choose new or refurbished",
          "body": "Retail devices are physical items owned by your shop. Start by choosing new or refurbished at the top. Never create a retail record for a customer's repair device.",
          "at": 0
        },
        {
          "title": "Give every device its own record",
          "body": "Enter the category, brand and model, then copy identifiers from the physical device. Two devices of the same model still need separate records.",
          "at": 12.083
        },
        {
          "title": "Enter measured specifications",
          "body": "Record memory, built-in storage and individual drives separately where applicable. Leave unknown values empty, not zero. Do not infer this device's configuration from its product name.",
          "at": 22.625
        },
        {
          "title": "Record condition and accessories",
          "body": "Next, record appearance, battery condition and supplied accessories. Known issues must belong to this device. Upload photos after creating the record, and never mark an untested check as passed.",
          "at": 36.292
        },
        {
          "title": "Check price, source and ownership",
          "body": "Enter the asking price and storage location. Cost fields require permission. Confirm shop ownership using the checkbox, then create the record. A new device remains awaiting inspection, not ready for sale.",
          "at": 50.958
        },
        {
          "title": "Inspect before making it available",
          "body": "Record the actual inspection in the device details, then follow the approval process to make it available. Sale, payments, handover and after-sales are recorded separately for this same device.",
          "at": 66.958
        }
      ]
    }
  ]
};

export const tutorials: readonly Tutorial[] = catalog["zh-CN"];
export function getTutorials(locale: TutorialLocale): readonly Tutorial[] { return catalog[locale]; }
