/** Platform feasibility and shipped coverage are deliberately separate. No device data is read here. */
export const androidBrands = ["Samsung", "Xiaomi / Redmi / POCO", "OPPO / realme / OnePlus", "vivo / iQOO", "HONOR", "HUAWEI", "Google Pixel / Motorola / Nokia / Sony", "其他安卓品牌"] as const;
export const androidVersions = [26, 28, 29, 30, 31, 33, 34, 35, 36, 37] as const;
export const androidVersionNames: Record<number, string> = { 26: "Android 8 / 8.1", 28: "Android 9", 29: "Android 10", 30: "Android 11", 31: "Android 12 / 12L", 33: "Android 13", 34: "Android 14", 35: "Android 15", 36: "Android 16", 37: "Android 17" };
export type AndroidSystem = "android" | "harmony-apk" | "harmony-next";
export type DeviceProfile = { brand: string; sdk: number | null; system: AndroidSystem; googleServices: boolean; workProfile: boolean; partialPhotos: boolean };
export type TransferKind = "media" | "files" | "contacts" | "calendar" | "apps" | "sms" | "calls" | "chats" | "notes" | "cloud" | "protected" | "identity";
export type Coverage = "alpha" | "planned" | "external" | "blocked";
export type PermissionStep = { side: "sender" | "receiver"; permission: string; mode: "picker" | "runtime" | "special" | "role"; explanation: string };
export type TransferCapability = { kind: TransferKind; title: string; coverage: Coverage; detail: string; permissions: PermissionStep[] };
export const coverageLabels: Record<Coverage, string> = { alpha: "当前测试版支持", planned: "后续开发", external: "使用官方迁移", blocked: "当前不可迁移" };
export const defaultProfile: DeviceProfile = { brand: "Samsung", sdk: 34, system: "android", googleServices: true, workProfile: false, partialPhotos: false };

export function canRunAssistant(profile: DeviceProfile): boolean {
  return profile.system !== "harmony-next" && profile.sdk !== null && Number.isInteger(profile.sdk) && profile.sdk >= 26 && profile.sdk <= 37;
}

export function planAndroidTransfer(source: DeviceProfile, target: DeviceProfile): { runnable: boolean; notices: string[]; capabilities: TransferCapability[]; connectionPermissions: PermissionStep[] } {
  const runnable = canRunAssistant(source) && canRunAssistant(target);
  const notices = ["依据手动选择规划；设备权限与迁移结果需要在助手内核验。"];
  if (!runnable) notices.push(source.system === "harmony-next" || target.system === "harmony-next" ? "HarmonyOS NEXT 需要独立鸿蒙客户端；本 APK 不适用。" : "未知系统版本或 Android 8 以下不在首版支持范围。请先核对手机系统。" );
  if (!source.googleServices || !target.googleServices) notices.push("核心传输不依赖 Google 服务；应用商店、云备份与购买许可需分别核对。");
  if (source.brand !== target.brand) notices.push("跨品牌使用标准数据格式；厂商私有内容和系统设置另行迁移。");
  if (source.workProfile || target.workProfile) notices.push("工作资料夹需要单独安装与管理员允许，不能从个人空间读取。");
  if (source.partialPhotos) notices.push("仅授权部分照片时，只能读取所选内容；不能显示为全部相册完成。");
  if (source.sdk !== null && target.sdk !== null && target.sdk < source.sdk) notices.push("迁往较旧安卓系统时，应用最低版本、处理器与数据格式必须单独核对。");
  if (source.sdk === 37 || target.sdk === 37) notices.push("Android 17 的局域网运行时权限需要单独允许。");
  const connectionPermissions: PermissionStep[] = [{ side: "receiver", permission: target.sdk !== null && target.sdk >= 33 ? "NEARBY_WIFI_DEVICES" : "ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION", mode: "runtime", explanation: "新机创建本地迁移热点时请求。旧版系统可能还要求定位开关；助手不采集位置。" }];
  if (source.sdk !== null && source.sdk >= 29) connectionPermissions.push({ side: "sender", permission: source.sdk >= 33 ? "NEARBY_WIFI_DEVICES / WifiNetworkSpecifier" : "ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION / WifiNetworkSpecifier", mode: "runtime", explanation: "旧机由助手申请加入新机热点，按系统提示确认；资料发送绑定该 Wi-Fi 网络。" });
  else connectionPermissions.push({ side: "sender", permission: "ACTION_WIFI_SETTINGS", mode: "picker", explanation: "旧版本在系统 Wi-Fi 设置手动加入热点，再返回助手。" });
  for (const [side, profile] of [["sender", source], ["receiver", target]] as const) if (profile.sdk === 37) connectionPermissions.push({ side, permission: "ACCESS_LOCAL_NETWORK", mode: "runtime", explanation: "允许访问这次局域网传输；拒绝后不能开始连接。" });
  const photoPermission = source.sdk !== null && source.sdk >= 33 ? "READ_MEDIA_IMAGES / READ_MEDIA_VIDEO / READ_MEDIA_AUDIO" : "READ_EXTERNAL_STORAGE";
  const capabilities: TransferCapability[] = [
    { kind: "media", title: "照片、视频与音频", coverage: "alpha", detail: "按授权范围扫描照片、视频和音频，分页选择并传输原文件；相册索引和系统显示日期还原仍需单独核验。", permissions: [
      { side: "sender", permission: "ACTION_OPEN_DOCUMENT", mode: "picker", explanation: "仅访问用户选择的文件，不需要全部文件权限。" },
      { side: "sender", permission: photoPermission + (source.sdk !== null && source.sdk >= 34 ? " / READ_MEDIA_VISUAL_USER_SELECTED" : ""), mode: "runtime", explanation: "扫描按系统版本请求媒体权限；部分照片授权只扫描可见子集，拒绝后仍可手动选文件。" },
    ] },
    { kind: "files", title: "文档、下载与文件夹", coverage: "alpha", detail: "扫描系统可见公共文件和用户授权的文件夹；不绕过 Android/data、保险箱或其他应用私有目录的系统访问限制。", permissions: [
      { side: "sender", permission: "ACTION_OPEN_DOCUMENT_TREE", mode: "picker", explanation: "文件夹需用户在系统选择器授权；不可读取或扫描失败的范围单独报告。" },
      { side: "receiver", permission: "ACTION_OPEN_DOCUMENT_TREE", mode: "picker", explanation: "用户选择保存目录；同名文件保留原件，不静默覆盖。" },
    ] },
    { kind: "contacts", title: "通讯录", coverage: "alpha", detail: "首版导出姓名、电话和邮箱为 VCF，交系统通讯录确认导入。分组、头像与自定义字段后续接入。", permissions: [
      { side: "sender", permission: "READ_CONTACTS", mode: "runtime", explanation: "仅在选择导出联系人时请求；拒绝后可以手动选择 VCF 文件。" },
      { side: "receiver", permission: "ACTION_VIEW / VCF", mode: "picker", explanation: "由系统通讯录确认导入，不申请写联系人权限。文件接收完成不代表系统导入完成。" },
    ] },
    { kind: "calendar", title: "日历与待办", coverage: "alpha", detail: "非重复日历导出基础 ICS；重复事件和例外保留原始字段归档，尚未实现还原。系统导入、账号同步和厂商待办另行核对。", permissions: [
      { side: "sender", permission: "READ_CALENDAR", mode: "runtime", explanation: "只读取本资料空间中可访问的日历。" },
      { side: "receiver", permission: "ACTION_VIEW / ICS", mode: "picker", explanation: "由适用日历应用确认 ICS 导入；收到文件不代表事件已写入目标日历。" },
    ] },
    { kind: "apps", title: "APP 本体与安装清单", coverage: "alpha", detail: "扫描系统可见的普通启动器 APP，选择后保存基础包、拆分包及清单；未实现自动安装，内部数据不随安装包迁移。", permissions: [
      { side: "sender", permission: "PackageManager / <queries>", mode: "special", explanation: "只列系统可见的普通启动器 APP，不申请全面应用查询权限；缺失 APP 保留官方重装指引。" },
      { side: "receiver", permission: "APK / Store", mode: "picker", explanation: "接收安装包不代表 APP 已安装或能运行；签名、拆分包、架构、最低系统和购买许可仍需核对。" },
    ] },
    { kind: "sms", title: "短信与彩信", coverage: "external", detail: "首版使用系统或官方备份迁移。后续需核验受限权限、默认短信角色及安装器授权。", permissions: [
      { side: "sender", permission: "READ_SMS", mode: "role", explanation: "运行时同意并不保证受限权限可授予；首版不申请。" },
      { side: "receiver", permission: "ROLE_SMS", mode: "role", explanation: "写入短信需适用角色或系统支持；不能靠无障碍模拟绕过。" },
    ] },
    { kind: "calls", title: "通话记录", coverage: "external", detail: "首版使用官方换机工具；后续先验证受限读写权限及厂商支持。", permissions: [
      { side: "sender", permission: "READ_CALL_LOG", mode: "role", explanation: "受限权限与分发要求单独核验，首版不申请。" },
      { side: "receiver", permission: "WRITE_CALL_LOG", mode: "role", explanation: "复制备份不代表系统拨号器已恢复记录。" },
    ] },
    { kind: "chats", title: "聊天记录与 APP 内部资料", coverage: "external", detail: "按应用官方迁移或备份逐项完成；普通助手不能读取其他 APP 的私有数据库和登录状态。", permissions: [] },
    { kind: "notes", title: "便签、录音与厂商内容", coverage: "external", detail: "公开录音可选文件传输；便签、桌面布局和私有格式使用原应用导出或厂商迁移。", permissions: [] },
    { kind: "cloud", title: "云端照片与账号同步资料", coverage: "external", detail: "本地缩略图不代表原文件。先在原服务下载原件或在新机登录同步，不收集账号密码。", permissions: [] },
    { kind: "protected", title: "保险箱、应用分身与工作空间", coverage: "external", detail: "必须由各空间所有者或管理员导出；个人空间权限不能覆盖其他资料空间。", permissions: [] },
    { kind: "identity", title: "密码、支付卡、eSIM 与生物识别", coverage: "blocked", detail: "需在官方服务重新验证或按运营商流程转移；助手不能导出安全芯片密钥、生物识别或账号令牌。", permissions: [] },
  ];
  if (!runnable) for (const capability of capabilities) if (capability.coverage === "alpha" || capability.coverage === "planned") { capability.coverage = "blocked"; capability.detail = "先解决客户端与系统兼容性，不能开始本次助手迁移。"; }
  return { runnable, notices, capabilities, connectionPermissions: runnable ? connectionPermissions : [] };
}

export type VerifiedReceipt = { objectId: string; expectedBytes: number; receivedBytes: number; expectedSha256: string; savedSha256: string; destinationCommitted: boolean; imported?: boolean };
/** Transfer receipt is valid only after the destination has been independently reopened and hashed. */
export function isVerifiedReceipt(receipt: VerifiedReceipt): boolean {
  return /^[A-Za-z0-9_-]{16,80}$/.test(receipt.objectId) && Number.isSafeInteger(receipt.expectedBytes) && receipt.expectedBytes >= 0
    && receipt.receivedBytes === receipt.expectedBytes && /^[a-f0-9]{64}$/.test(receipt.expectedSha256)
    && receipt.savedSha256 === receipt.expectedSha256 && receipt.destinationCommitted;
}
