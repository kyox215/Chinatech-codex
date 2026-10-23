import { Film, Smartphone, Zap } from "lucide-react";

// The order here is the presentation order; add future entrances in this registry.
export const portalFeatures = [
  {
    category: "work", categoryLabel: "工作管理", summary: "工单、采购与设备档案", illustration: "/images/portal/repair.webp",
    id: "repair", title: "手机维修管理", href: "/repair", icon: Smartphone,
    description: "管理维修工单、采购与整机业务，查看使用教程并进入工作台。",
    action: "进入维修管理", external: false, featured: true, primaryLabel: "打开", platform: "", downloadHref: "", downloadAction: "", keywords: [],
  },
  {
    category: "entertainment", categoryLabel: "影音娱乐", summary: "开放授权短片，给日常留一点休闲时间。", illustration: "/images/portal/cinema.webp",
    id: "cinema", title: "放映室", href: "/cinema", icon: Film,
    description: "浏览并观看开放授权影片，给忙碌的日常留一点休闲时间。",
    action: "进入放映室", external: false, featured: true, primaryLabel: "打开", platform: "", downloadHref: "", downloadAction: "", keywords: [],
  },
  {
    category: "opensource", categoryLabel: "我的开源", summary: "Mac 菜单栏实时功耗与供电流向", illustration: "",
    id: "currentflow", title: "电流脉动", href: "https://github.com/kyox215/CurrentFlow", icon: Zap,
    description: "查看 Mac 实时功耗、电池电流与供电流向，获取 GitHub 源码及最新版应用。",
    action: "查看电流脉动源码（新标签页）", external: true, featured: false, primaryLabel: "GitHub", platform: "macOS 13+ · Apple Silicon",
    downloadHref: "https://github.com/kyox215/CurrentFlow/releases/latest", downloadAction: "下载电流脉动（新标签页）", keywords: ["CurrentFlow", "macOS", "Mac", "电流脉动"],
  },
] as const;
