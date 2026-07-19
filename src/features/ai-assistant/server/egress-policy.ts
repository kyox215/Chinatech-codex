import type { AiAssistantRequestKind } from "./cost-policy";
import { AiServiceError } from "./errors";
import {
  AI_CHINATECH_PILOT_STORE_ID,
  assertOpenAiRequestDataApproved,
  getAiAssistantStoreAllowlist,
  type AiAssistantFeatureEnvironment,
} from "./feature-flags";

const highRiskOrderPatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\d[\s().+-]*){7,}\b/,
  /\b\d{14,16}\b/,
  /\b(?:R\d{7,12}|RD-\d{5,12})\b/i,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  /[“"'][^”"']{1,120}[”"']/,
  /(?:查找|查询|搜索|查看|find|lookup|show|cerca|trova|mostra)\s+[\p{L}][\p{L}'-]{1,60}\s*(?:的|'s\b)/iu,
  /(?:查找|查询|搜索|查看|找|查)\s*[赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦许何吕张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄江童颜郭梅林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣邓单杭洪包诸左石崔吉龚程邢裴陆荣翁荀羊於惠甄曲封芮储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾甘厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印白怀蒲台从鄂索咸籍赖卓蔺屠蒙池乔阴郁胥苍闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍却璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎连习艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶曾沙鞠关蒯相查后荆红游竺权盖益桓公][\p{Script=Han}]{1,2}\s*的(?:工单|订单|维修单)/u,
  /(?:客户|顾客|姓名|名为|叫)\s*[:：]?\s*[\p{L}\p{Script=Han}][\p{L}\p{Script=Han}' -]{1,60}/iu,
  /(?:ordini?|riparazioni?)\s+(?:di|per)\s+[\p{L}][\p{L}' -]{1,60}/iu,
  /\b(?:via|viale|piazza|corso|contrada)\s+[\p{L}0-9][\p{L}0-9' .,-]{2,80}/iu,
  /(?:地址|住址|住在|位于)\s*[:：]?\s*[^，。,.]{2,80}/u,
];

export function assertAiProviderEgressAllowed({
  requestKind,
  env,
  orderMessage,
  storeId,
}: {
  requestKind: AiAssistantRequestKind;
  env: AiAssistantFeatureEnvironment;
  orderMessage?: string;
  storeId?: string | null;
}) {
  try {
    assertOpenAiRequestDataApproved(requestKind, env);
  } catch {
    throw new AiServiceError(
      "当前数据类型尚未批准发送至外部 AI，请使用本地或手工方式",
      "AI_MISCONFIGURED",
      503,
      { retryable: false },
    );
  }
  if (requestKind === "inventory_vision") {
    const allowlist = getAiAssistantStoreAllowlist(env);
    if (
      storeId !== AI_CHINATECH_PILOT_STORE_ID ||
      allowlist.length !== 1 ||
      allowlist[0] !== AI_CHINATECH_PILOT_STORE_ID
    ) {
      throw new AiServiceError("AI 图片识别只允许 Chinatech 单店试点", "AI_MISCONFIGURED", 503, {
        retryable: false,
      });
    }
  }
  if (
    requestKind === "order_text" &&
    orderMessage &&
    highRiskOrderPatterns.some((pattern) => pattern.test(orderMessage.normalize("NFKC")))
  ) {
    throw new AiServiceError(
      "这条查询可能包含客户或设备敏感信息，请改用订单号直查或手工筛选",
      "AI_SENSITIVE_INPUT",
      400,
      { retryable: false },
    );
  }
}
