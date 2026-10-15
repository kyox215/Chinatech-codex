(() => {
  'use strict';
  const copy = {
    zh: {
      classificationRequired:'请明确选择新机或翻新机。',
      previewTitle:'独立品牌 / 型号',previewSubtitle:'交互设计预览 · 示例数据 · 未连接正式后台',previewModule:'预览模块',repair:'维修接机',retail:'新建商品',settings:'预览设置',layout:'布局',auto:'随窗口变化',desktop:'电脑',mobile:'手机 390px',language:'语言',scenario:'场景',normal:'正常',loadingScenario:'首次加载',errorScenario:'目录查询失败',offlineScenario:'离线',deniedScenario:'身份失效',conflictScenario:'保存冲突',reset:'重置示例',mainMenu:'主菜单',closeMenu:'关闭菜单',openMenu:'打开菜单',brandSubtitle:'维修 · 采购 · 整机',searchOrder:'搜索工单',dashboard:'工作台',orders:'维修工单',products:'整机商品',customers:'客户管理',customerDevices:'客户设备',demoAccount:'预览账号',backStep:'返回上一步',entrySteps:'录入步骤',newRepair:'新建维修工单',newRetail:'新建商品',customer:'客户',device:'设备',faults:'故障',review:'核对',step:'步骤',contactInfo:'客户联系资料',deviceInfo:'送修设备',faultInfo:'故障与随件',reviewInfo:'提交前核对',draft:'演示草稿',phone:'联系电话',customerName:'客户称呼（选填）',email:'电子邮件（选填）',demoCustomer:'演示客户',category:'设备类别',brand:'品牌',model:'型号',productName:'型号 / 商品名称',searchBrand:'搜索或填写品牌',searchModel:'搜索型号、机型码',chooseBrand:'选择品牌',chooseModel:'选择型号',clearBrand:'清空品牌',clearModel:'清空型号',mobilePhone:'手机',computer:'电脑',laptop:'笔记本',desktopCategory:'台式机',tablet:'平板',console:'游戏机',other:'其他',color:'颜色',unknown:'未记录',black:'黑色',white:'白色',blue:'蓝色',identifier:'SN / IMEI',identifierPlaceholder:'输入识别码，未知可留空',identifierButton:'识别码录入',moreDevice:'更多设备信息 · 颜色、SN / IMEI',allSeries:'全部',history:'门店原文',catalog:'目录型号',sampleCount:'条示例',custom:'手动填写',useText:'使用原文',historyLabel:'门店原文 · 实物仍须核对',searchHint:'输入名称或机型码查找',noResults:'没有匹配，可保留手填原文。',chooseBrandFirst:'先选择品牌可查询目录；型号仍可手填。',changedBrand:'已切换品牌，请重新选择型号。',changedCategory:'已切换类别，请重新选择品牌和型号。',undo:'撤销',previous:'上一步',next:'下一步',saveReview:'保存并预览',saving:'正在保存…',requiredBrand:'请选择或填写设备品牌。',requiredModel:'请选择或填写实物型号。',requiredPhone:'请填写联系电话。',requiredReview:'请先核对接机信息。',loadingTitle:'正在读取目录…',loadingText:'可以先填写其他资料，也可以手填。',loadedAction:'演示加载完成',errorTitle:'目录暂不可用',errorText:'已保留输入，可手填或重试查询。',retry:'重新查询',offlineTitle:'当前离线',offlineText:'可以继续填写草稿；恢复联网后再提交。',restoreOnline:'演示恢复联网',deniedTitle:'账号身份已失效',deniedText:'候选已清空，请重新核对账号后继续。',restoreAccount:'演示恢复账号',conflictText:'资料已被更新，草稿已保留。重新核对后再提交。',recheck:'重新核对',screen:'屏幕',battery:'电池',charging:'充电',otherFault:'其他问题',issue:'补充说明（选填）',accessories:'随件',charger:'充电器',cable:'充电线',none:'无',issuePlaceholder:'记录客户原话',confirm:'已与客户核对接机信息',confirmHint:'设备、随件与维修需求',signature:'客户签名',signatureHint:'选填，可在工单详情补签。',skipSignature:'本次跳过签名',repairSaved:'接机信息已保存（演示）',demoSaved:'仅在本预览内演示，未保存至门店。',printPreview:'打印预览',viewOrder:'查看工单',viewCustomer:'客户记录',viewDevice:'客户设备',createAnother:'再建一张',closePreview:'关闭预览',repairReceipt:'接机单 · 示例',salesReceipt:'销售单 · 示例',receiptLanguage:'打印语言',associatedOrder:'工单详情 · 示例',associatedCustomer:'客户关联记录 · 示例',associatedDevice:'客户设备 · 示例',source:'来源',orderSource:'接机工单 PREVIEW-001',identifierFact:'未知，未推断或合并设备',classification:'商品分类',newDevice:'新机',refurbished:'翻新机',productIdentity:'商品身份',createArchive:'创建商品档案',createHint:'创建后仍需检测并明确设为可售。',price:'售价（€）',cost:'入库成本（€）',unknownPlaceholder:'未知可留空',productArchive:'商品档案',pending:'待检测',available:'在售',sold:'已售',physical:'实物核验',functional:'功能检测',ownership:'所有权及账号锁核验',dataCheck:'数据处理核验',makeAvailable:'设为可售',checksRequired:'请完成三项实物核验并填写售价。',sell:'登记售出',buyer:'客户称呼',salePrice:'成交价（€）',recordSale:'确认销售登记',saleRecorded:'销售已登记（演示）',recordPayment:'记录实际收款',paymentMethod:'收款方式',choosePayment:'请选择',cash:'现金',card:'银行卡',amount:'实收金额（€）',confirmPayment:'确认本次实收',paymentRequired:'请选择收款方式并核对实收金额。',received:'已记录实收（演示）',confirmDelivery:'确认实际交付',deliveryRequired:'收款未结清，暂不能确认交付。',delivered:'已确认交付（演示）',notDelivered:'尚未交付',notReceived:'实收未记录',actualPayment:'实际收款',delivery:'交付',saleSnapshot:'销售冻结快照 · 示例',manualNote:'原文录入 · 保存前核对实物',relatedOnly:'此入口仅展示已选择设备的关联预览。',edit:'返回修改',priceRequired:'请填写有效售价。',network:'网络版本',salePending:'销售登记、收款与交付分别记录。',rawHistory:'店内原型号记录',readBoundary:'预览中没有真实账号验证或交易请求。',typeBrand:'填写品牌',typeModel:'填写型号',fieldSelection:'字段候选',repairPriority:'普通',serviceHint:'仅记录客户报告，不代替实物检测。',productCode:'商品编号',verifyUnknown:'未记录实测规格',menuSummary:'候选来自项目目录的抽样数据。'
    },
    it: {
      classificationRequired:'Scegli esplicitamente nuovo o ricondizionato.',
      previewTitle:'Marca e modello separati',previewSubtitle:'Anteprima interattiva · Dati di esempio · Senza backend',previewModule:'Modulo di anteprima',repair:'Accettazione',retail:'Nuovo prodotto',settings:'Impostazioni',layout:'Layout',auto:'Automatico',desktop:'Computer',mobile:'Telefono 390px',language:'Lingua',scenario:'Scenario',normal:'Normale',loadingScenario:'Primo caricamento',errorScenario:'Errore catalogo',offlineScenario:'Offline',deniedScenario:'Sessione scaduta',conflictScenario:'Conflitto al salvataggio',reset:'Ripristina esempio',mainMenu:'Menu principale',closeMenu:'Chiudi menu',openMenu:'Apri menu',brandSubtitle:'Riparazioni · Acquisti · Dispositivi',searchOrder:'Cerca riparazione',dashboard:'Dashboard',orders:'Riparazioni',products:'Dispositivi in vendita',customers:'Clienti',customerDevices:'Dispositivi clienti',demoAccount:'Account di anteprima',backStep:'Torna al passo precedente',entrySteps:'Passi di inserimento',newRepair:'Nuova riparazione',newRetail:'Nuovo prodotto',customer:'Cliente',device:'Dispositivo',faults:'Guasti',review:'Verifica',step:'Passo',contactInfo:'Dati del cliente',deviceInfo:'Dispositivo ricevuto',faultInfo:'Guasti e accessori',reviewInfo:'Verifica prima di inviare',draft:'Bozza dimostrativa',phone:'Telefono',customerName:'Nome del cliente (facoltativo)',email:'Email (facoltativa)',demoCustomer:'Cliente dimostrativo',category:'Tipo di dispositivo',brand:'Marca',model:'Modello',productName:'Modello / Nome prodotto',searchBrand:'Cerca o scrivi la marca',searchModel:'Cerca modello o codice',chooseBrand:'Scegli la marca',chooseModel:'Scegli il modello',clearBrand:'Cancella marca',clearModel:'Cancella modello',mobilePhone:'Telefono',computer:'Computer',laptop:'Portatile',desktopCategory:'Desktop',tablet:'Tablet',console:'Console',other:'Altro',color:'Colore',unknown:'Non registrato',black:'Nero',white:'Bianco',blue:'Blu',identifier:'SN / IMEI',identifierPlaceholder:'Inserisci il codice, oppure lascia vuoto',identifierButton:'Inserisci identificativo',moreDevice:'Altri dati · Colore, SN / IMEI',allSeries:'Tutte',history:'Testo del negozio',catalog:'Modelli del catalogo',sampleCount:'esempi',custom:'Inserimento manuale',useText:'Usa testo originale',historyLabel:'Testo del negozio · Verifica il dispositivo',searchHint:'Cerca per nome o codice',noResults:'Nessun risultato. Puoi usare il testo manuale.',chooseBrandFirst:'Scegli la marca per cercare; puoi scrivere il modello.',changedBrand:'Marca cambiata. Scegli di nuovo il modello.',changedCategory:'Tipo cambiato. Scegli di nuovo marca e modello.',undo:'Annulla cambio',previous:'Indietro',next:'Avanti',saveReview:'Salva e visualizza',saving:'Salvataggio…',requiredBrand:'Scegli o scrivi la marca.',requiredModel:'Scegli o scrivi il modello.',requiredPhone:'Inserisci un numero di telefono.',requiredReview:'Verifica i dati di accettazione.',loadingTitle:'Caricamento catalogo…',loadingText:'Puoi compilare altri dati o inserire testo manuale.',loadedAction:'Simula caricamento completato',errorTitle:'Catalogo non disponibile',errorText:'Testo mantenuto. Inserisci manualmente o riprova.',retry:'Riprova',offlineTitle:'Sei offline',offlineText:'Continua la bozza; invia quando torni online.',restoreOnline:'Simula connessione ripristinata',deniedTitle:'Sessione scaduta',deniedText:'Suggerimenti rimossi. Verifica l’account per continuare.',restoreAccount:'Simula account ripristinato',conflictText:'I dati sono cambiati. Bozza mantenuta. Verifica prima di inviare.',recheck:'Verifica di nuovo',screen:'Schermo',battery:'Batteria',charging:'Ricarica',otherFault:'Altro problema',issue:'Note (facoltative)',accessories:'Accessori',charger:'Caricatore',cable:'Cavo',none:'Nessuno',issuePlaceholder:'Riporta le parole del cliente',confirm:'Dati verificati con il cliente',confirmHint:'Dispositivo, accessori e richieste',signature:'Firma del cliente',signatureHint:'Facoltativa. Puoi aggiungerla nella riparazione.',skipSignature:'Salta la firma questa volta',repairSaved:'Accettazione salvata (demo)',demoSaved:'Solo in questa anteprima. Nessun salvataggio al negozio.',printPreview:'Anteprima di stampa',viewOrder:'Apri riparazione',viewCustomer:'Storico cliente',viewDevice:'Dispositivo cliente',createAnother:'Nuova accettazione',closePreview:'Chiudi anteprima',repairReceipt:'Accettazione · Esempio',salesReceipt:'Ricevuta di vendita · Esempio',receiptLanguage:'Lingua di stampa',associatedOrder:'Dettagli riparazione · Esempio',associatedCustomer:'Storico cliente · Esempio',associatedDevice:'Dispositivo cliente · Esempio',source:'Origine',orderSource:'Riparazione PREVIEW-001',identifierFact:'Sconosciuto. Nessun dispositivo unito automaticamente.',classification:'Categoria prodotto',newDevice:'Nuovo',refurbished:'Ricondizionato',productIdentity:'Identità del prodotto',createArchive:'Crea scheda prodotto',createHint:'Dopo la creazione, verifica il dispositivo e abilita la vendita.',price:'Prezzo (€)',cost:'Costo di acquisto (€)',unknownPlaceholder:'Lascia vuoto se sconosciuto',productArchive:'Scheda prodotto',pending:'Da verificare',available:'In vendita',sold:'Venduto',physical:'Verifica del dispositivo',functional:'Test funzionale',ownership:'Proprietà e blocchi account',dataCheck:'Verifica trattamento dati',makeAvailable:'Abilita vendita',checksRequired:'Completa le tre verifiche e inserisci il prezzo.',sell:'Registra vendita',buyer:'Nome cliente',salePrice:'Prezzo di vendita (€)',recordSale:'Conferma vendita',saleRecorded:'Vendita registrata (demo)',recordPayment:'Registra incasso effettivo',paymentMethod:'Metodo di pagamento',choosePayment:'Seleziona',cash:'Contanti',card:'Carta',amount:'Importo incassato (€)',confirmPayment:'Conferma incasso',paymentRequired:'Scegli il metodo e verifica l’importo.',received:'Incasso registrato (demo)',confirmDelivery:'Conferma consegna effettiva',deliveryRequired:'Pagamento incompleto. Consegna non confermabile.',delivered:'Consegna confermata (demo)',notDelivered:'Non consegnato',notReceived:'Incasso non registrato',actualPayment:'Incasso effettivo',delivery:'Consegna',saleSnapshot:'Dati congelati della vendita · Esempio',manualNote:'Testo originale · Verifica prima di salvare',relatedOnly:'Questo collegamento mostra solo l’anteprima del dispositivo scelto.',edit:'Torna a modificare',priceRequired:'Inserisci un prezzo valido.',network:'Versione di rete',salePending:'Vendita, incasso e consegna sono registrati separatamente.',rawHistory:'Modello originale del negozio',readBoundary:'Nessuna verifica reale dell’account o transazione in questa anteprima.',typeBrand:'Scrivi la marca',typeModel:'Scrivi il modello',fieldSelection:'Suggerimenti del campo',repairPriority:'Normale',serviceHint:'Richiesta del cliente, non risultato di un test.',productCode:'Codice prodotto',verifyUnknown:'Specifiche misurate non registrate',menuSummary:'Suggerimenti da un campione del catalogo del progetto.'
    },
    en: {
      classificationRequired:'Explicitly choose new or refurbished.',
      previewTitle:'Separate brand / model',previewSubtitle:'Interactive preview · Sample data · No live backend',previewModule:'Preview module',repair:'Repair intake',retail:'New product',settings:'Preview settings',layout:'Layout',auto:'Automatic',desktop:'Desktop',mobile:'Phone 390px',language:'Language',scenario:'Scenario',normal:'Normal',loadingScenario:'First load',errorScenario:'Catalog error',offlineScenario:'Offline',deniedScenario:'Session expired',conflictScenario:'Save conflict',reset:'Reset example',mainMenu:'Main menu',closeMenu:'Close menu',openMenu:'Open menu',brandSubtitle:'Repairs · Purchasing · Devices',searchOrder:'Search repair',dashboard:'Dashboard',orders:'Repair orders',products:'Devices for sale',customers:'Customers',customerDevices:'Customer devices',demoAccount:'Preview account',backStep:'Previous step',entrySteps:'Entry steps',newRepair:'New repair order',newRetail:'New product',customer:'Customer',device:'Device',faults:'Issues',review:'Review',step:'Step',contactInfo:'Customer contact details',deviceInfo:'Received device',faultInfo:'Issues and accessories',reviewInfo:'Review before submitting',draft:'Demo draft',phone:'Phone number',customerName:'Customer name (optional)',email:'Email (optional)',demoCustomer:'Demo customer',category:'Device category',brand:'Brand',model:'Model',productName:'Model / Product name',searchBrand:'Search or enter a brand',searchModel:'Search model or model code',chooseBrand:'Choose a brand',chooseModel:'Choose a model',clearBrand:'Clear brand',clearModel:'Clear model',mobilePhone:'Phone',computer:'Computer',laptop:'Laptop',desktopCategory:'Desktop',tablet:'Tablet',console:'Console',other:'Other',color:'Color',unknown:'Not recorded',black:'Black',white:'White',blue:'Blue',identifier:'SN / IMEI',identifierPlaceholder:'Enter identifier, or leave blank if unknown',identifierButton:'Enter identifier',moreDevice:'More details · Color, SN / IMEI',allSeries:'All',history:'Store text',catalog:'Catalog models',sampleCount:'samples',custom:'Manual entry',useText:'Use original text',historyLabel:'Store text · Check the physical device',searchHint:'Search by name or model code',noResults:'No match. You can keep manual text.',chooseBrandFirst:'Choose a brand to search; manual models are allowed.',changedBrand:'Brand changed. Choose the model again.',changedCategory:'Category changed. Choose brand and model again.',undo:'Undo change',previous:'Back',next:'Next',saveReview:'Save and preview',saving:'Saving…',requiredBrand:'Choose or enter the device brand.',requiredModel:'Choose or enter the model.',requiredPhone:'Enter a phone number.',requiredReview:'Please review the intake details.',loadingTitle:'Loading catalog…',loadingText:'You can enter other details or use manual text.',loadedAction:'Simulate load completed',errorTitle:'Catalog unavailable',errorText:'Your input is kept. Enter manually or retry.',retry:'Retry catalog',offlineTitle:'You are offline',offlineText:'Continue the draft; submit when back online.',restoreOnline:'Simulate connection restored',deniedTitle:'Account session expired',deniedText:'Suggestions cleared. Verify the account to continue.',restoreAccount:'Simulate account restored',conflictText:'The record changed. Your draft is kept. Review before submitting.',recheck:'Review again',screen:'Screen',battery:'Battery',charging:'Charging',otherFault:'Other issue',issue:'Notes (optional)',accessories:'Accessories',charger:'Charger',cable:'Cable',none:'None',issuePlaceholder:'Record the customer’s own words',confirm:'Intake details checked with the customer',confirmHint:'Device, accessories and repair requests',signature:'Customer signature',signatureHint:'Optional. Add it later in the order details.',skipSignature:'Skip signature this time',repairSaved:'Intake saved (demo)',demoSaved:'Only in this preview. Nothing saved to the store.',printPreview:'Print preview',viewOrder:'View repair order',viewCustomer:'Customer history',viewDevice:'Customer device',createAnother:'Create another',closePreview:'Close preview',repairReceipt:'Repair intake · Sample',salesReceipt:'Sales receipt · Sample',receiptLanguage:'Print language',associatedOrder:'Order details · Sample',associatedCustomer:'Linked customer history · Sample',associatedDevice:'Customer device · Sample',source:'Source',orderSource:'Repair intake PREVIEW-001',identifierFact:'Unknown. No device inferred or automatically merged.',classification:'Product classification',newDevice:'New',refurbished:'Refurbished',productIdentity:'Product identity',createArchive:'Create product record',createHint:'After creation, inspect the device and explicitly enable sale.',price:'Price (€)',cost:'Purchase cost (€)',unknownPlaceholder:'Leave blank if unknown',productArchive:'Product record',pending:'Awaiting inspection',available:'For sale',sold:'Sold',physical:'Physical checks',functional:'Functional test',ownership:'Ownership and account lock check',dataCheck:'Data handling check',makeAvailable:'Enable sale',checksRequired:'Complete all three physical checks and enter a price.',sell:'Register sale',buyer:'Customer name',salePrice:'Sale price (€)',recordSale:'Confirm sale registration',saleRecorded:'Sale registered (demo)',recordPayment:'Record actual payment',paymentMethod:'Payment method',choosePayment:'Choose',cash:'Cash',card:'Card',amount:'Amount received (€)',confirmPayment:'Confirm this payment',paymentRequired:'Choose a payment method and check the amount.',received:'Payment recorded (demo)',confirmDelivery:'Confirm actual delivery',deliveryRequired:'Payment incomplete. Delivery cannot be confirmed yet.',delivered:'Delivery confirmed (demo)',notDelivered:'Not delivered',notReceived:'Payment not recorded',actualPayment:'Actual payment',delivery:'Delivery',saleSnapshot:'Frozen sale snapshot · Sample',manualNote:'Original text · Check the device before saving',relatedOnly:'This link only shows the selected device’s linked preview.',edit:'Back to editing',priceRequired:'Enter a valid price.',network:'Network variant',salePending:'Sale, payment and delivery are recorded separately.',rawHistory:'Original store model text',readBoundary:'No real account validation or transaction requests in this preview.',typeBrand:'Enter a brand',typeModel:'Enter a model',fieldSelection:'Field suggestions',repairPriority:'Normal',serviceHint:'Customer report, not a physical test result.',productCode:'Product code',verifyUnknown:'Measured specifications not recorded',menuSummary:'Suggestions use a sample of the project catalog.'
    }
  };
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/[\s\-_.]+/g,'');
  const aliases = {Apple:['苹果'],Samsung:['三星'],Xiaomi:['小米'],Redmi:['红米'],OPPO:['欧珀'],Honor:['荣耀'],ASUS:['华硕'],Lenovo:['联想'],HP:['惠普'],Dell:['戴尔'],Google:['谷歌'],Sony:['索尼'],Huawei:['华为']};
  const canonical = value => Object.keys(aliases).find(brand => [brand,...aliases[brand]].some(alias => normalize(alias) === normalize(value))) || String(value).trim();
  const data = window.CATALOG_PREVIEW.rows;
  let locale = new URLSearchParams(location.search).get('lang') || 'zh';
  if (!copy[locale]) locale = 'zh';
  const t = key => copy[locale][key] || key;
  const initial = flow => ({flow,step:flow === 'repair' ? 1 : 0,category:'phone',brand:'Samsung',model:'',color:'',serial:'',phone:'+39 320 000 0000',customerName:'',email:'',faults:[],issue:'',accessories:[],consent:false,classification:'',price:'80.00',cost:'20.00',checks:[false,false,false],productState:'draft',sale:null,record:null,panel:'',printLanguage:'it',error:'',note:'',previousIdentity:null,manual:false,busy:false});
  let state = initial('repair');
  let scenario = 'normal';
  let picker = null;
  let generation = 0;
  let saleOpen = false;
  let paymentOpen = false;
  const notice = text => { $('#live-status').textContent = text; };
  const categoryLabels = {phone:'mobilePhone',computer:'computer',laptop:'laptop',desktop:'desktopCategory',tablet:'tablet',console:'console',other:'other'};
  const categoryRows = () => data.filter(row => state.category === 'computer' ? ['laptop','desktop'].includes(row.category) : row.category === state.category);
  const btn = (key,action,primary=false,disabled=false) => '<button type="button" class="button '+(primary?'button--primary':'button--secondary')+'" data-action="'+action+'"'+(disabled?' disabled':'')+'>'+html(t(key))+'</button>';
  const textField = (key,field,value,wide=false,type='text',placeholder='') => '<div class="field'+(wide?' field--wide':'')+'"><label for="'+field+'">'+html(t(key))+'</label><input class="plain-input" id="'+field+'" data-bind="'+field+'" type="'+type+'" value="'+html(value)+'"'+(type==='number'?' step="0.01" min="0" inputmode="decimal"':'')+' placeholder="'+html(placeholder)+'"'+(state.busy?' disabled':'')+'></div>';
  const fact = (key,value) => '<div class="fact-row"><span>'+html(t(key))+'</span><strong>'+html(value)+'</strong></div>';
  function shellCopy(){
    document.documentElement.lang = {zh:'zh-CN',it:'it',en:'en'}[locale];
    document.title = 'ChinaTech · '+t('previewTitle');
    $$('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
    $$('[data-i18n-aria]').forEach(node => { node.setAttribute('aria-label',t(node.dataset.i18nAria)); });
    $('#language').value = locale;
    $$('[data-flow]').forEach(node => node.setAttribute('aria-pressed',String(node.dataset.flow === state.flow)));
    $$('[data-nav-flow]').forEach(node => { if (node.dataset.navFlow === state.flow) node.setAttribute('aria-current','page'); else node.removeAttribute('aria-current'); });
    $('#page-title').textContent = state.flow === 'repair' ? t('newRepair') : t(state.productState === 'draft' ? 'newRetail' : 'productArchive');
  }
  function scenarioNotice(){
    const notices = {
      loading:['loadingTitle','loadingText','loadedAction','restore'],
      error:['errorTitle','errorText','retry','restore'],
      offline:['offlineTitle','offlineText','restoreOnline','restore'],
      denied:['deniedTitle','deniedText','restoreAccount','restore']
    };
    const item = notices[scenario];
    if (!item) return '';
    return '<div class="scenario-notice '+(scenario === 'denied'?'error':'warning')+'" role="status"><p><strong>'+html(t(item[0]))+'</strong><br>'+html(t(item[1]))+'</p>'+btn(item[2],item[3])+'</div>';
  }
  function formHead(key,index){
    return '<div class="form-head"><div>'+(index===undefined?'':'<small>'+html(t('step'))+' '+(index+1)+' / 4</small>')+'<h2>'+html(t(key))+'</h2></div><span class="saved-draft"><span class="dot" aria-hidden="true"></span>'+html(t('draft'))+'</span></div>';
  }
  function formFoot(nextKey,nextAction,back=true){
    return '<footer class="form-actions">'+(back?btn('previous','previous',false,state.busy):'<span class="muted">'+html(t('createHint'))+'</span>')+'<div>'+btn(state.busy?'saving':nextKey,nextAction,true,state.busy||scenario==='denied')+'</div></footer>';
  }
  const errorBlock = () => state.error ? '<p class="inline-error" role="alert">'+html(t(state.error))+(state.error==='conflictText'?' '+btn('recheck','restore'):'')+'</p>' : '';
  function identityFields(){
    const categories = state.flow==='repair'?['phone','computer','tablet','console','other']:['phone','laptop','desktop','tablet','console','other'];
    const modelLabel = state.flow==='repair'?'model':'productName';
    const denied = scenario==='denied'||state.busy;
    const mobile = innerWidth < 768 || $('#preview-frame').classList.contains('is-mobile');
    const extraFields='<div class="field"><label for="color">'+html(t('color'))+'</label><select id="color" data-bind="color"'+(denied?' disabled':'')+'>'+['','black','white','blue'].map(value=>'<option value="'+value+'"'+(state.color===value?' selected':'')+'>'+html(t(value||'unknown'))+'</option>').join('')+'</select></div><div class="field identifier field--wide"><label for="serial">'+html(t('identifier'))+'</label><div class="identifier-box"><input class="plain-input" id="serial" data-bind="serial" value="'+html(state.serial)+'" placeholder="'+html(t('identifierPlaceholder'))+'"'+(denied?' disabled':'')+'><button type="button" class="icon-button" data-action="identifier" aria-label="'+html(t('identifierButton'))+'"'+(denied?' disabled':'')+'>⌗</button></div></div>';
    const extras=mobile?'<details class="device-extras"'+(state.color||state.serial?' open':'')+'><summary>'+html(t('moreDevice'))+'</summary><div class="extras-grid">'+extraFields+'</div></details>':extraFields;
    return '<div class="field-grid"><div class="field"><label for="category">'+html(t('category'))+' *</label><select id="category"'+(denied?' disabled':'')+'>'+categories.map(value=>'<option value="'+value+'"'+(state.category===value?' selected':'')+'>'+html(t(categoryLabels[value]))+'</option>').join('')+'</select></div>'+
      control('brand','brand',state.brand,state.flow==='repair',denied)+control('model',modelLabel,state.model,true,denied)+
      extras+'<div id="identity-note" class="field-note"'+(!state.note?' hidden':'')+'><span>'+html(t(state.note))+'</span>'+(state.previousIdentity?'<button type="button" class="text-button" data-action="undo">'+html(t('undo'))+'</button>':'')+'</div></div>';
  }
  function control(field,key,value,required,disabled){
    return '<div class="field catalog-field" data-field="'+field+'"><label for="'+field+'-input">'+html(t(key))+(required?' *':'')+'</label><div class="search-input"><span class="search-icon" aria-hidden="true">⌕</span><input id="'+field+'-input" role="combobox" aria-autocomplete="list" aria-expanded="false" autocomplete="off" maxlength="'+(field==='brand'?100:160)+'" value="'+html(value)+'" placeholder="'+html(t(field==='brand'?'searchBrand':'searchModel'))+'"'+(disabled?' disabled':'')+'><button type="button" data-clear="'+field+'" aria-label="'+html(t(field==='brand'?'clearBrand':'clearModel'))+'"'+(!value?' hidden':'')+(disabled?' disabled':'')+'>×</button><button type="button" data-open="'+field+'" aria-label="'+html(t(field==='brand'?'chooseBrand':'chooseModel'))+'"'+(disabled?' disabled':'')+'>⌄</button></div></div>';
  }
  function renderSteps(){
    const stepKeys=['customer','device','faults','review'];
    $('#steps').hidden = state.flow!=='repair'||Boolean(state.record);
    $('#workflow-grid').style.gridTemplateColumns = state.flow==='repair'&&!state.record?'':'minmax(0,1fr)';
    $('#steps').innerHTML = stepKeys.map((key,index)=>'<button type="button" class="step" data-step="'+index+'"'+(index===state.step?' aria-current="step"':'')+' data-complete="'+String(index<state.step)+'"'+(index>state.step||state.busy?' disabled':'')+'><span class="step-number" aria-hidden="true">'+(index<state.step?'✓':index+1)+'</span><span><small>'+html(t('step'))+' '+(index+1)+'</small><strong>'+html(t(key))+'</strong></span></button>').join('');
  }
  function repairBody(){
    if (state.record) return repairSuccess();
    const headers=['contactInfo','deviceInfo','faultInfo','reviewInfo'];
    let body='';
    if(state.step===0) body='<div class="field-grid">'+textField('phone','phone',state.phone,false,'tel')+textField('customerName','customerName',state.customerName,false,'text',t('demoCustomer'))+textField('email','email',state.email,true,'email')+'</div>';
    if(state.step===1) body=identityFields();
    if(state.step===2) body='<div class="field-grid"><div class="field field--wide"><span>'+html(t('faults'))+'</span><div class="choice-grid">'+['screen','battery','charging','otherFault'].map(key=>'<label class="choice"><input type="checkbox" data-choice="faults" value="'+key+'"'+(state.faults.includes(key)?' checked':'')+'><span>'+html(t(key))+'</span></label>').join('')+'</div><small class="hint">'+html(t('serviceHint'))+'</small></div><div class="field field--wide"><label for="issue">'+html(t('issue'))+'</label><textarea id="issue" data-bind="issue" placeholder="'+html(t('issuePlaceholder'))+'">'+html(state.issue)+'</textarea></div><div class="field field--wide"><span>'+html(t('accessories'))+'</span><div class="choice-grid">'+['charger','cable'].map(key=>'<label class="choice"><input type="checkbox" data-choice="accessories" value="'+key+'"'+(state.accessories.includes(key)?' checked':'')+'><span>'+html(t(key))+'</span></label>').join('')+'</div></div></div>';
    if(state.step===3) body='<div class="review-facts">'+fact('customer',(state.customerName||t('demoCustomer'))+' · '+state.phone)+fact('device',state.brand+' '+state.model)+fact('category',t(categoryLabels[state.category]))+fact('identifier',state.serial||t('unknown'))+fact('faults',state.faults.map(t).join(' · ')||state.issue||t('unknown'))+fact('accessories',state.accessories.map(t).join(' · ')||t('none'))+'</div><div class="field-note" style="margin-top:18px"><span>'+html(t('signature'))+' · '+html(t('signatureHint'))+'</span><strong>'+html(t('skipSignature'))+'</strong></div><label class="review-confirm"><input type="checkbox" data-bind="consent"'+(state.consent?' checked':'')+'><span><strong>'+html(t('confirm'))+'</strong><small>'+html(t('confirmHint'))+'</small></span></label>';
    return formHead(headers[state.step],state.step)+'<div class="form-body">'+scenarioNotice()+body+errorBlock()+'</div>'+formFoot(state.step===3?'saveReview':'next',state.step===3?'saveRepair':'next');
  }
  function repairSuccess(){
    const record=state.record;
    return '<div class="form-body"><div class="success-head"><span class="success-icon" aria-hidden="true">✓</span><div><h2>'+html(t('repairSaved'))+'</h2><p>PREVIEW-001 · '+html(t('demoSaved'))+'</p></div></div><div class="review-facts">'+fact('customer',record.customerName||t('demoCustomer'))+fact('device',record.brand+' '+record.model)+fact('phone',record.phone)+'</div><div class="success-actions">'+btn('printPreview','print',true)+btn('viewOrder','order')+btn('createAnother','reset')+'</div><div class="record-links">'+btn('viewCustomer','customer')+btn('viewDevice','device')+'</div>'+relatedPanel()+'</div>';
  }
  function retailBody(){
    if(state.productState!=='draft') return productBody();
    return formHead('newRetail')+'<div class="form-body">'+scenarioNotice()+'<div class="classification" role="group" aria-label="'+html(t('classification'))+'">'+['new','refurbished'].map(value=>'<button type="button" data-classification="'+value+'" aria-pressed="'+String(state.classification===value)+'">'+html(t(value==='new'?'newDevice':'refurbished'))+'</button>').join('')+'</div>'+identityFields()+'<div class="field-grid" style="margin-top:20px">'+textField('price','price',state.price,false,'number',t('unknownPlaceholder'))+textField('cost','cost',state.cost,false,'number',t('unknownPlaceholder'))+'</div>'+errorBlock()+'</div>'+formFoot('createArchive','createProduct',false);
  }
  function productBody(){
    const sold=Boolean(state.sale);
    const requiredChecks = state.checks.every(Boolean);
    const validPrice = state.price.trim()!=='' && Number.isFinite(Number(state.price)) && Number(state.price)>=0;
    const productStateKey = sold?'sold':state.productState==='available'?'available':'pending';
    const detail='<div class="review-facts">'+fact('productCode','PREVIEW-ST-001')+fact('brand',state.brand||t('unknown'))+fact('model',state.model)+fact('identifier',state.serial||t('unknown'))+fact('category',t(categoryLabels[state.category]))+'</div>';
    let actions='';
    if(!sold){
      actions=state.productState==='available'?btn('sell','openSale',true):btn('makeAvailable','available',true,!requiredChecks||!validPrice);
      actions+=btn('edit','editProduct');
    }
    const salePanel=sold?recordedSale():(saleOpen?saleForm():'');
    return '<div class="form-body">'+scenarioNotice()+'<div class="product-heading"><div><h2>'+html(state.brand+' '+state.model)+'</h2><small class="muted">'+html(t('demoSaved'))+'</small></div><span class="status-tag '+(state.productState==='available'?'available':'')+'">'+html(t(productStateKey))+'</span></div><div class="product-columns"><section class="product-section"><h3>'+html(t('productIdentity'))+'</h3>'+detail+'</section><section class="product-section"><h3>'+html(t('physical'))+'</h3><div class="checks">'+['functional','ownership','dataCheck'].map((key,index)=>'<label class="choice"><input type="checkbox" data-check="'+index+'"'+(state.checks[index]?' checked':'')+(state.productState!=='pending'?' disabled':'')+'><span>'+html(t(key))+'</span></label>').join('')+'</div><small class="muted">'+html(t('verifyUnknown'))+'</small><div class="price-line">€'+html(validPrice?Number(state.price).toFixed(2):'—')+'</div><div class="success-actions">'+actions+'</div></section></div>'+errorBlock()+salePanel+relatedPanel()+'</div>';
  }
  function saleForm(){
    return '<section class="sale-box"><h3>'+html(t('sell'))+'</h3><div class="field-grid">'+textField('phone','salePhone',state.phone,false,'tel')+textField('buyer','saleName',state.customerName,false,'text',t('demoCustomer'))+textField('salePrice','salePrice',state.price,false,'number')+'</div><div class="success-actions">'+btn('recordSale','registerSale',true)+btn('closePreview','closeSale')+'</div><p class="muted" style="margin-top:12px">'+html(t('salePending'))+'</p></section>';
  }
  function recordedSale(){
    const sale=state.sale;
    return '<section class="sale-box"><h3>'+html(t('saleRecorded'))+'</h3><div class="review-facts">'+fact('customer',sale.customerName||t('demoCustomer'))+fact('phone',sale.phone)+fact('salePrice','€'+Number(sale.price).toFixed(2))+fact('actualPayment',sale.paid===null?t('notReceived'):'€'+Number(sale.paid).toFixed(2))+fact('delivery',t(sale.delivered?'delivered':'notDelivered'))+'</div><div class="success-actions">'+(sale.paid===null?btn('recordPayment','openPayment',true):'')+(!sale.delivered?btn('confirmDelivery','deliver',sale.paid!==null,sale.paid===null):'')+btn('printPreview','print')+'</div>'+(paymentOpen?'<div class="field-grid" style="margin-top:20px"><div class="field"><label for="paymentMethod">'+html(t('paymentMethod'))+'</label><select id="paymentMethod"><option value="">'+html(t('choosePayment'))+'</option><option value="cash">'+html(t('cash'))+'</option><option value="card">'+html(t('card'))+'</option></select></div>'+textField('amount','paymentAmount',sale.price,false,'number')+'<div class="field--wide">'+btn('confirmPayment','pay',true)+'</div></div>':'')+'<div class="record-links">'+btn('viewCustomer','customer')+btn('viewDevice','device')+'</div></section>';
  }
  function relatedPanel(){
    if(!state.panel) return '';
    const record=state.sale||state.record||state;
    if(state.panel==='print'){
      const printLocale=state.printLanguage;
      const p=key=>copy[printLocale][key];
      const f=(key,value)=>'<div class="fact-row"><span>'+html(p(key))+'</span><strong>'+html(value)+'</strong></div>';
      return '<section class="associated-preview"><div class="receipt-language"><label for="receiptLanguage">'+html(t('receiptLanguage'))+'</label><select id="receiptLanguage"><option value="it"'+(printLocale==='it'?' selected':'')+'>Italiano</option><option value="en"'+(printLocale==='en'?' selected':'')+'>English</option><option value="zh"'+(printLocale==='zh'?' selected':'')+'>中文</option></select>'+btn('closePreview','closePanel')+'</div><article class="sample-receipt"><div class="receipt-head"><strong>ChinaTech</strong><span>'+html(p(state.sale?'salesReceipt':'repairReceipt'))+'</span></div><p class="muted">'+html(p('demoSaved'))+'</p>'+f('customer',record.customerName||p('demoCustomer'))+f('phone',record.phone||state.phone)+f('device',record.brand+' '+record.model)+f('identifier',record.serial||p('unknown'))+(state.sale?f('salePrice','€'+Number(record.price).toFixed(2))+f('actualPayment',record.paid===null?p('notReceived'):'€'+Number(record.paid).toFixed(2))+f('delivery',p(record.delivered?'delivered':'notDelivered')):f('faults',record.faults.map(p).join(' · ')||record.issue||p('unknown'))+f('accessories',record.accessories.map(p).join(' · ')||p('none')))+'</article></section>';
    }
    const titles={order:'associatedOrder',customer:'associatedCustomer',device:'associatedDevice'};
    return '<section class="associated-preview"><h3>'+html(t(titles[state.panel]))+'</h3><div class="review-facts">'+fact('device',record.brand+' '+record.model)+fact('source',state.sale?'PREVIEW-SALE-001':t('orderSource'))+fact('identifier',record.serial||t('identifierFact'))+'</div><div class="success-actions">'+btn('closePreview','closePanel')+'</div></section>';
  }
  function render(){
    closePicker(false);
    shellCopy();
    renderSteps();
    $('#workspace').innerHTML = state.flow==='repair'?repairBody():retailBody();
    bindForm();
  }
  function updateNote(){
    const node=$('#identity-note');
    if(!node) return;
    node.hidden=!state.note;
    node.innerHTML='<span>'+html(t(state.note))+'</span>'+(state.previousIdentity?'<button type="button" class="text-button" data-action="undo">'+html(t('undo'))+'</button>':'');
  }
  function commitIdentity(field,value,manual=false){
    const cleaned=String(value).trim();
    if(field==='brand'){
      if(canonical(cleaned)!==canonical(state.brand)){
        state.previousIdentity={brand:state.brand,model:state.model};
        state.model='';
        state.note='changedBrand';
        state.checks=[false,false,false];
      }
      state.brand=cleaned;
    }else{
      if(cleaned!==state.model) state.checks=[false,false,false];
      state.model=cleaned;
      state.manual=manual;
      state.previousIdentity=null;state.note='';
    }
    state.consent=false;
    state.error='';
    ['brand','model'].forEach(key=>{
      const input=$('#'+key+'-input');
      if(input) input.value=state[key];
      const clear=$('[data-clear="'+key+'"]');
      if(clear) clear.hidden=!state[key];
    });
    updateNote();
    notice(field==='brand'&&state.note?t(state.note):cleaned);
  }
  function openPicker(field,keepQuery=false){
    if(state.busy||scenario==='denied') return;
    if(picker && picker.field!==field) closePicker(true);
    const input=$('#'+field+'-input');
    if(!input) return;
    if(!keepQuery||!picker) picker={field,query:'',dirty:false,active:-1,history:false};
    const root=$('[data-field="'+field+'"]');
    let menu=$('.catalog-menu',root);
    if(!menu){
      menu=document.createElement('div');menu.className='catalog-menu';menu.setAttribute('data-preview-menu',field);root.appendChild(menu);
    }
    input.setAttribute('aria-expanded','true');
    input.setAttribute('aria-controls',field+'-list');
    input.select();
    renderMenu();
  }
  function closePicker(commitDirty=false){
    if(!picker) return;
    const current=picker;
    picker=null;
    if(commitDirty&&current.dirty) commitIdentity(current.field,current.query,true);
    const input=$('#'+current.field+'-input');
    if(input){input.setAttribute('aria-expanded','false');input.removeAttribute('aria-controls');input.removeAttribute('aria-activedescendant');input.value=state[current.field];}
    $$('.catalog-menu').forEach(node=>node.remove());
  }
  function options(){
    if(!picker) return [];
    const query=picker.query.trim();
    const terms=query.split(/\s+/).filter(Boolean).map(normalize);
    if(picker.field==='brand'){
      const brands=[...new Set(categoryRows().map(row=>row.brand))].sort((a,b)=>a.localeCompare(b,'en'));
      return brands.filter(brand=>terms.every(term=>normalize(brand+' '+(aliases[brand]||[]).join(' ')).includes(term))).map(brand=>({id:'brand-'+brand,value:brand,label:brand,detail:(aliases[brand]||[]).join(' · ')}));
    }
    if(picker.history){
      const raw=canonical(state.brand)==='Apple'?'iPhone 13 店内原记录':t('rawHistory')+' · '+state.brand;
      return [{id:'history-demo',value:raw,label:raw,detail:t('historyLabel'),manual:true}];
    }
    const canonicalBrand=canonical(state.brand);
    const rows=categoryRows().filter(row=>canonical(row.brand)===canonicalBrand&&(!picker.family||row.family===picker.family));
    return rows.filter(row=>terms.every(term=>normalize([row.name,...row.modelCodes,...row.aliases,row.network].join(' ')).includes(term))).sort((a,b)=>(b.releasedAt||'').localeCompare(a.releasedAt||'')||(b.year||0)-(a.year||0)||b.name.localeCompare(a.name,'en',{numeric:true})).map(row=>({id:row.id,value:row.name,label:row.name,detail:[row.network==='unknown'?'':row.network,row.year||'',row.modelCodes[0]||''].filter(Boolean).join(' · '),network:row.network==='unknown'?'':row.network}));
  }
  function renderMenu(){
    if(!picker) return;
    const field=picker.field;
    const root=$('[data-field="'+field+'"]');
    const menu=$('.catalog-menu',root);
    if(!menu) return;
    const unavailable=['loading','error','offline','denied'].includes(scenario);
    const rows=unavailable?[]:options();
    picker.rows=rows;
    if(picker.active>=rows.length) picker.active=-1;
    let inner='';
    if(field==='model'&&!unavailable&&state.brand){
      const families=[...new Set(categoryRows().filter(row=>canonical(row.brand)===canonical(state.brand)).map(row=>row.family))].sort((a,b)=>{
        const priorities={'Galaxy S':0,'Galaxy A':1,'Galaxy Z':2};
        return (priorities[a]??10)-(priorities[b]??10)||a.localeCompare(b,'en');
      });
      inner+='<div class="menu-context"><strong>'+html(state.brand)+'</strong><span>'+rows.length+' '+html(t('sampleCount'))+'</span></div>';
      if(families.length>1&&!picker.query.trim()) inner+='<div class="series-filter" role="group" aria-label="'+html(t('allSeries'))+'"><button type="button" data-family="" aria-pressed="'+String(!picker.family&&!picker.history)+'">'+html(t('allSeries'))+'</button>'+families.map(family=>'<button type="button" data-family="'+html(family)+'" aria-pressed="'+String(picker.family===family&&!picker.history)+'">'+html(family||t('unknown'))+'</button>').join('')+'</div>';
    }
    if(unavailable){
      const title=scenario==='loading'?'loadingTitle':scenario==='error'?'errorTitle':scenario==='offline'?'offlineTitle':'deniedTitle';
      const detail=scenario==='loading'?'loadingText':scenario==='error'?'errorText':scenario==='offline'?'offlineText':'deniedText';
      inner+='<div class="menu-status"><strong>'+html(t(title))+'</strong>'+html(t(detail))+'</div>';
      if(scenario==='loading') inner+='<div class="catalog-skeleton"></div><div class="catalog-skeleton"></div>';
    }else if(field==='model'&&!state.brand){
      inner+='<div class="menu-status">'+html(t('chooseBrandFirst'))+'</div>';
    }
    inner+='<ul class="candidate-list" id="'+field+'-list" role="listbox" aria-label="'+html(t(field==='brand'?'brand':'model'))+'">';
    inner+=rows.map((row,index)=>'<li role="presentation"><button type="button" class="candidate" role="option" id="'+field+'-option-'+index+'" data-option="'+index+'" aria-selected="'+String(state[field]===row.value)+'" data-active="'+String(picker.active===index)+'"><span><strong>'+html(row.label)+'</strong>'+(row.detail?'<small>'+html(row.detail)+'</small>':'')+'</span>'+(row.network?'<span class="network-badge">'+html(row.network)+'</span>':'')+(state[field]===row.value?'<span class="selected-check" aria-hidden="true">✓</span>':'')+'</button></li>').join('')+'</ul>';
    if(!unavailable&&!rows.length&&state.brand) inner+='<div class="menu-status">'+html(t('noResults'))+'</div>';
    inner+='<div class="menu-footer">'+(picker.dirty&&picker.query.trim()?'<button type="button" class="text-button" data-manual="true">'+html(t('useText'))+' “'+html(picker.query.trim())+'”</button>':'<span>'+html(t('searchHint'))+'</span>')+(field==='model'&&!unavailable&&state.brand?'<button type="button" class="text-button" data-history="true">'+html(t(picker.history?'catalog':'history'))+'</button>':scenario==='error'?'<button type="button" class="text-button" data-action="restore">'+html(t('retry'))+'</button>':'')+'</div>';
    menu.innerHTML=inner;
    $$('button',menu).forEach(button=>button.addEventListener('pointerdown',event=>event.preventDefault()));
    const input=$('#'+field+'-input');
    if(picker.active>=0) input.setAttribute('aria-activedescendant',field+'-option-'+picker.active); else input.removeAttribute('aria-activedescendant');
    positionMenu();
  }
  function positionMenu(){
    if(!picker) return;
    const root=$('[data-field="'+picker.field+'"]');
    const menu=$('.catalog-menu',root);
    if(!menu) return;
    menu.classList.remove('menu-above');
    const visual=window.visualViewport;
    const viewportTop=visual?visual.offsetTop:0;
    const bottom=viewportTop+(visual?visual.height:window.innerHeight);
    const box=root.getBoundingClientRect();
    const below=Math.max(0,bottom-box.bottom-12);
    const above=Math.max(0,box.top-viewportTop-12);
    const cap=window.innerWidth<768||$('#preview-frame').classList.contains('is-mobile')?310:360;
    let available=below;
    if(below<Math.min(cap,260)&&above>below){menu.classList.add('menu-above');available=above;}
    menu.style.maxHeight=Math.max(120,Math.min(cap,available))+'px';
  }
  function bindForm(){
    $$('[data-bind]',$('#workspace')).forEach(input=>input.addEventListener(input.tagName==='SELECT'||input.type==='checkbox'?'change':'input',()=>{
      const field=input.dataset.bind;
      const value=input.type==='checkbox'?input.checked:input.value;
      if(['salePhone','saleName','salePrice','paymentAmount'].includes(field)) return;
      state[field]=value;
      if(field!=='consent'){state.consent=false;state.previousIdentity=null;state.note='';updateNote();}
    }));
    const category=$('#category');
    if(category) category.addEventListener('change',()=>{
      closePicker(false);
      state.previousIdentity={brand:state.brand,model:state.model,category:state.category};
      state.category=category.value;state.brand='';state.model='';state.note='changedCategory';state.checks=[false,false,false];state.consent=false;
      render();notice(t('changedCategory'));
    });
    ['brand','model'].forEach(field=>{
      const input=$('#'+field+'-input');
      if(!input) return;
      input.addEventListener('focus',()=>openPicker(field));
      input.addEventListener('click',()=>{if(!picker||picker.field!==field)openPicker(field);});
      input.addEventListener('input',()=>{
        if(!picker||picker.field!==field) openPicker(field);
        picker.query=input.value;picker.dirty=true;picker.active=-1;picker.history=false;picker.family='';
        renderMenu();
      });
      input.addEventListener('keydown',event=>{
        if(event.isComposing||event.keyCode===229) return;
        if(event.key==='Escape'){event.preventDefault();closePicker(false);return;}
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){
          event.preventDefault();
          if(!picker) openPicker(field);
          const rows=picker.rows||[];
          picker.active=rows.length?(event.key==='ArrowDown'?(picker.active+1)%rows.length:picker.active<=0?rows.length-1:picker.active-1):-1;
          renderMenu();
          const active=$('#'+field+'-option-'+picker.active);
          if(active)active.scrollIntoView({block:'nearest'});
        }
        if(event.key==='Enter'){
          event.preventDefault();
          if(picker&&picker.active>=0&&picker.rows[picker.active]){
            const option=picker.rows[picker.active];commitIdentity(field,option.value,Boolean(option.manual));closePicker(false);
          }else closePicker(true);
        }
        if(event.key==='Tab') closePicker(true);
      });
    });
    $$('[data-choice]',$('#workspace')).forEach(input=>input.addEventListener('change',()=>{
      const key=input.dataset.choice;
      state[key]=input.checked?[...state[key],input.value]:state[key].filter(value=>value!==input.value);
      state.consent=false;
    }));
    $$('[data-check]',$('#workspace')).forEach(input=>input.addEventListener('change',()=>{
      state.checks[Number(input.dataset.check)]=input.checked;
      render();
    }));
    const receiptLanguage=$('#receiptLanguage');
    if(receiptLanguage)receiptLanguage.addEventListener('change',()=>{state.printLanguage=receiptLanguage.value;render();});
  }
  function validateIdentity(){
    if(state.flow==='repair'&&!state.brand.trim()){state.error='requiredBrand';return false;}
    if(!state.model.trim()){state.error='requiredModel';return false;}
    return true;
  }
  function save(action){
    closePicker(true);
    if(scenario==='offline'){state.error='offlineText';render();return;}
    if(scenario==='denied'){state.error='deniedText';render();return;}
    if(scenario==='conflict'){state.error='conflictText';render();return;}
    if(action==='createProduct'&&!state.classification){state.error='classificationRequired';render();return;}
    if(!validateIdentity()){render();return;}
    if(action==='saveRepair'&&!state.consent){state.error='requiredReview';render();return;}
    state.busy=true;state.error='';
    const ticket=++generation;
    render();
    // This deliberate, labelled simulation is not a network or performance measurement.
    setTimeout(()=>{
      if(ticket!==generation) return;
      state.busy=false;
      if(action==='saveRepair'){
        state.record=structuredClone({brand:state.brand,model:state.model,serial:state.serial,phone:state.phone,customerName:state.customerName,email:state.email,faults:state.faults,accessories:state.accessories,issue:state.issue});
      }else state.productState='pending';
      render();notice(t('demoSaved'));
    },450);
  }
  function action(name){
    if(state.busy) return;
    closePicker(true);
    if(name==='next'){
      if(state.step===0&&!state.phone.trim())state.error='requiredPhone';
      else if(state.step!==1||validateIdentity()){state.error='';state.step=Math.min(3,state.step+1);}
      render();
    }else if(name==='previous'){state.step=Math.max(0,state.step-1);state.error='';render();}
    else if(name==='saveRepair'||name==='createProduct')save(name);
    else if(name==='reset'){generation++;state=initial(state.flow);saleOpen=false;paymentOpen=false;render();}
    else if(name==='restore'){scenario='normal';$('#scenario').value='normal';state.error='';render();}
    else if(name==='undo'&&state.previousIdentity){const previous=state.previousIdentity;state.brand=previous.brand;state.model=previous.model;if(previous.category)state.category=previous.category;state.previousIdentity=null;state.note='';state.consent=false;render();}
    else if(name==='identifier'){const extras=$('.device-extras');if(extras)extras.open=true;$('#serial').focus();}
    else if(['print','order','customer','device'].includes(name)){state.panel=name;render();}
    else if(name==='closePanel'){state.panel='';render();}
    else if(name==='available'){
      if(!state.checks.every(Boolean)||state.price.trim()===''||!Number.isFinite(Number(state.price))||Number(state.price)<0)state.error='checksRequired';
      else{state.productState='available';state.error='';}
      render();
    }else if(name==='editProduct'){state.productState='draft';state.checks=[false,false,false];state.note='';render();}
    else if(name==='openSale'){saleOpen=true;render();}
    else if(name==='closeSale'){saleOpen=false;render();}
    else if(name==='registerSale'){
      const phone=$('#salePhone').value.trim(),price=$('#salePrice').value.trim(),customerName=$('#saleName').value.trim();
      if(!phone){state.error='requiredPhone';}
      else if(price===''||!Number.isFinite(Number(price))||Number(price)<0){state.error='priceRequired';}
      else{state.sale={brand:state.brand,model:state.model,serial:state.serial,phone,customerName,price,paid:null,delivered:false};state.productState='sold';state.error='';saleOpen=false;}
      render();
    }else if(name==='openPayment'){paymentOpen=true;render();}
    else if(name==='pay'){
      const method=$('#paymentMethod').value,amount=$('#paymentAmount').value.trim();
      if(!method||amount===''||Number(amount)!==Number(state.sale.price)){state.error='paymentRequired';}
      else{state.sale.paid=amount;state.sale.method=method;state.error='';paymentOpen=false;}
      render();
    }else if(name==='deliver'){
      if(state.sale.paid===null){state.error='deliveryRequired';}
      else{state.sale.delivered=true;state.error='';}
      render();
    }
  }
  function setFlow(flow){
    generation++;state=initial(flow);saleOpen=false;paymentOpen=false;render();
    $('#sidebar').classList.remove('is-open');$('#drawer-shade').hidden=true;
  }
  document.addEventListener('pointerdown',event=>{
    if(picker&&!event.target.closest('[data-field="'+picker.field+'"]'))closePicker(true);
  });
  document.addEventListener('focusin',event=>{
    if(picker&&!event.target.closest('[data-field="'+picker.field+'"]'))closePicker(true);
  });
  document.addEventListener('click',event=>{
    const option=event.target.closest('[data-option]');
    if(option&&picker){const row=picker.rows[Number(option.dataset.option)];if(row){commitIdentity(picker.field,row.value,Boolean(row.manual));closePicker(false);}return;}
    const family=event.target.closest('[data-family]');
    if(family&&picker){picker.family=family.dataset.family;picker.history=false;picker.active=-1;renderMenu();return;}
    if(event.target.closest('[data-history]')&&picker){picker.history=!picker.history;picker.active=-1;renderMenu();return;}
    if(event.target.closest('[data-manual]')&&picker){commitIdentity(picker.field,picker.query,true);closePicker(false);return;}
    const clear=event.target.closest('[data-clear]');
    if(clear){const field=clear.dataset.clear;closePicker(false);commitIdentity(field,'');$('#'+field+'-input').focus();return;}
    const open=event.target.closest('[data-open]');
    if(open){const field=open.dataset.open;const isOpen=picker&&picker.field===field;if(isOpen)closePicker(false);else{$('#'+field+'-input').focus();openPicker(field);}return;}
    const step=event.target.closest('[data-step]');
    if(step&&!step.disabled){state.step=Number(step.dataset.step);state.consent=false;render();return;}
    const classification=event.target.closest('[data-classification]');
    if(classification){state.classification=classification.dataset.classification;render();return;}
    const flow=event.target.closest('[data-flow], [data-nav-flow]');
    if(flow){setFlow(flow.dataset.flow||flow.dataset.navFlow);return;}
    const target=event.target.closest('[data-action]');
    if(target&&!target.disabled) action(target.dataset.action);
  });
  $('#back').addEventListener('click',()=>{if(state.record){state.record=null;state.step=3;state.consent=false;render();}else if(state.productState!=='draft'&&!state.sale){state.productState='draft';render();}else action('previous');});
  $('.mobile-menu').addEventListener('click',()=>{$('#sidebar').classList.add('is-open');$('#drawer-shade').hidden=false;});
  const closeDrawer=()=>{$('#sidebar').classList.remove('is-open');$('#drawer-shade').hidden=true;$('.mobile-menu').focus();};
  $('.sidebar-close').addEventListener('click',closeDrawer);
  $('#drawer-shade').addEventListener('click',closeDrawer);
  $$('.nav-static').forEach(button=>{button.disabled=true;});
  $('#layout').addEventListener('change',event=>{$('#preview-frame').classList.toggle('is-mobile',event.target.value==='mobile');render();});
  $('#language').addEventListener('change',event=>{locale=event.target.value;render();});
  $('#scenario').addEventListener('change',event=>{
    generation++;state.busy=false;scenario=event.target.value;state.error='';
    if(scenario==='denied'){state=initial(state.flow);state.brand='';state.model='';state.record=null;state.sale=null;state.panel='';saleOpen=false;paymentOpen=false;}
    render();
  });
  $('#reset').addEventListener('click',()=>action('reset'));
  window.addEventListener('resize',positionMenu);
  if(window.visualViewport){window.visualViewport.addEventListener('resize',positionMenu);window.visualViewport.addEventListener('scroll',positionMenu);}
  window.addEventListener('scroll',positionMenu,{passive:true});
  const params=new URLSearchParams(location.search);
  if(params.get('present')==='1')$('.review-bar').hidden=true;
  if(params.get('flow')==='retail')state=initial('retail');
  if(params.get('layout')==='mobile'){$('#layout').value='mobile';$('#preview-frame').classList.add('is-mobile');}
  render();
  if(params.get('open')==='model'){$('#model-input').focus();openPicker('model');}
})();
