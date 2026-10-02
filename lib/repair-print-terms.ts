// Released wording is stable. A signature stores this version and the original language.
export const repairIntakeTermsVersion = "repair-intake-2026-10-v1" as const;
const terms = [
  {
    it: "La garanzia commerciale copre i difetti di materiale o lavorazione dei componenti sostituiti e dell'intervento effettuato, previa verifica. Il periodo indicato decorre dalla riconsegna effettiva del dispositivo riparato.",
    en: "The commercial warranty covers verified material or workmanship defects in replaced parts and the work performed. The stated period starts when the repaired device is actually returned to the customer.",
    zh: "商家保修覆盖经核实的所更换配件材料或工艺缺陷及所实施维修的缺陷。本单所列期限从维修设备实际交还日起计算。",
  },
  {
    it: "Esclusi i guasti causati da uso improprio, negligenza, cadute, urti, piegature, pressione, liquidi o corrosione. La causa va verificata; una traccia di danno non esclude automaticamente la tutela di difetti indipendenti.",
    en: "Faults caused by misuse, negligence, drops, impacts, bending, pressure, liquid ingress or corrosion are excluded. The cause must be checked; a damage mark does not automatically exclude cover for unrelated defects.",
    zh: "由使用不当、疏忽、跌落、碰撞、弯折、挤压、液体侵入或腐蚀造成的故障不属于商家保修。须核实原因，不能仅凭损坏标记排除其他独立故障的保障。",
  },
  {
    it: "Non sono coperti danni estetici preesistenti estranei all'intervento o guasti causati da successive riparazioni di terzi. Rotture accidentali successive di vetro o display non sono comprese.",
    en: "Pre-existing cosmetic damage unrelated to the work and faults caused by later third-party repairs are excluded. Subsequent accidental damage to glass or the display is not covered.",
    zh: "与本次维修无关的既有外观损坏、因后续第三方拆修造成的故障，以及之后因意外造成的玻璃或屏幕损坏不属于商家保修。",
  },
  {
    it: "La garanzia commerciale non comprende software, account, recupero dati, accessori non riparati o componenti non sostituiti. Prima dell'intervento effettuare un backup dei propri dati.",
    en: "The commercial warranty does not include software, accounts, data recovery, accessories not repaired or parts not replaced. Back up personal data before repair.",
    zh: "商家保修不包括软件、账号、数据恢复、未维修的随件或未更换的配件。维修前请备份个人数据。",
  },
  {
    it: "Per l'assistenza contattare il negozio indicato, presentando il dispositivo e questo documento. Gli interventi fuori copertura richiedono un preventivo accettato separatamente dal cliente.",
    en: "For support, contact the stated shop and present the device and this receipt. Work outside warranty requires a separate quote accepted by the customer.",
    zh: "办理售后请联系本单门店并出示设备和本单。保修范围外的维修须另行报价并获得客户确认。",
  },
] as const;
export const repairIntakeTerms = {
  it: terms.map(term => term.it), en: terms.map(term => term.en), zh: terms.map(term => term.zh),
} as const;
export const repairIntakeStatutoryRights = {
  it: "La garanzia commerciale non limita i diritti e i rimedi gratuiti previsti dalla legge, ove applicabili. Nessuna firma su questo documento comporta rinuncia a tali diritti.",
  en: "The commercial warranty does not limit statutory rights or free remedies where applicable. Signing this receipt does not waive those rights.",
  zh: "商家保修不限制适用的法定权利和免费救济。签署本单不意味着放弃这些权利。",
} as const;
export const repairIntakeAcknowledgement = {
  it: "Confermo di aver verificato i dati di accettazione, il dispositivo, gli accessori, il difetto segnalato e la garanzia commerciale indicata. La firma non attesta pagamento, diagnosi, collaudo o accettazione di un preventivo e non rinuncia ai diritti di legge.",
  en: "I confirm that I have checked the intake details, device, accessories, reported fault and stated commercial warranty. This signature does not confirm payment, diagnosis, testing or acceptance of a quote, and does not waive statutory rights.",
  zh: "我已核对接机资料、设备、随件、报告故障及本单商家保修。签名不证明付款、检测或测试完成，不表示接受报价，也不放弃法定权利。",
} as const;
