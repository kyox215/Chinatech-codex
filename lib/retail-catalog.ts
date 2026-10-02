import type { Capacity, RetailCategory, RetailUnit } from "./retail";

export type CatalogOption = { value: string; label: string; detail?: string };
export type RetailCatalogField = "brand" | "model" | "cpu" | "gpu" | "keyboard" | "edition";
export type CatalogSource = { id: string; title: string; url: string; checkedAt: string };

// Curated, offline naming references, not an exhaustive market or configuration database.
// An option never supplies measured RAM, storage, battery, identity or inspection facts.
const checkedAt = "2026-10-01";
export const catalogSources: readonly CatalogSource[] = [
  { id: "intel-core", title: "Intel Core processor comparison", url: "https://www.intel.com/content/dam/support/us/en/documents/processors/APP-for-Intel-Core-Processors.pdf", checkedAt },
  { id: "intel-mobile", title: "Intel Core i5 mobile comparison", url: "https://www.intel.com/content/dam/support/us/en/documents/processors/Intel-Core-i5-Mobile-Compare-Chart.pdf", checkedAt },
  { id: "intel-ultra", title: "Intel Core Ultra desktop and mobile datasheets", url: "https://www.intel.com/content/www/us/en/support/articles/000100721/processors/intel-core-ultra-processors.html", checkedAt },
  { id: "intel-legacy", title: "Intel product specifications", url: "https://www.intel.com/content/www/us/en/ark.html", checkedAt },
  { id: "amd-processors", title: "AMD desktop, laptop and workstation processor specifications", url: "https://www.amd.com/en/products/specifications/processors.html", checkedAt },
  { id: "amd-athlon", title: "AMD Athlon desktop processors", url: "https://www.amd.com/en/products/processors/desktops/athlon.html", checkedAt },
  { id: "amd-graphics", title: "AMD processor and graphics specification directory", url: "https://www.amd.com/en/products/specifications.html", checkedAt },
  { id: "amd-graphics-support", title: "AMD desktop and mobile graphics support families", url: "https://www.amd.com/en/resources/support-articles/release-notes/RN-RAD-WIN-25-6-3.html", checkedAt },
  { id: "nvidia-desktop", title: "NVIDIA current and previous GeForce desktop cards", url: "https://www.nvidia.com/en-us/geforce/graphics-cards/compare/", checkedAt },
  { id: "nvidia-mobile", title: "NVIDIA GeForce laptop GPUs", url: "https://www.nvidia.com/en-us/geforce/laptops/compare/", checkedAt },
  { id: "intel-graphics", title: "Intel processor graphics reference", url: "https://www.intel.com/content/www/us/en/support/articles/000006778/processors.html", checkedAt },
  { id: "intel-arc", title: "Intel Arc dedicated graphics family", url: "https://www.intel.com/content/www/us/en/ark/products/series/227960/intel-arc-dedicated-graphics-family.html", checkedAt },
  { id: "apple-mac", title: "Apple MacBook Pro model and technical specification archive", url: "https://support.apple.com/en-us/108052", checkedAt },
  { id: "apple-current", title: "Apple MacBook Pro technical specifications", url: "https://www.apple.com/macbook-pro/specs/", checkedAt },
  { id: "apple-desktop", title: "Apple Mac Studio technical specifications", url: "https://www.apple.com/mac-studio/specs/", checkedAt },
  { id: "apple-desktop-archive", title: "Apple Mac Studio model and specification archive", url: "https://support.apple.com/en-us/102231", checkedAt },
  { id: "sony-history", title: "PlayStation hardware history", url: "https://www.playstation.com/playstation-history/1994-ps-one/", checkedAt },
  { id: "sony-manuals", title: "PlayStation console manuals", url: "https://www.playstation.com/en-us/support/hardware/manuals/", checkedAt },
  { id: "xbox-current", title: "Xbox Series X and Series S comparison", url: "https://www.xbox.com/en-US/consoles/compare", checkedAt },
  { id: "xbox-history", title: "Xbox original, Xbox 360 and Xbox One generations", url: "https://news.xbox.com/en-us/2017/10/23/play-three-generations-of-games-better-on-xbox-one/", checkedAt },
  { id: "nintendo-current", title: "Nintendo Switch family", url: "https://www.nintendo.com/us/gaming-systems/switch/compare/", checkedAt },
  { id: "nintendo-switch2", title: "Nintendo Switch 2 specifications", url: "https://www.nintendo.com/us/gaming-systems/switch-2/tech-specs/", checkedAt },
  { id: "nintendo-history", title: "Nintendo hardware history", url: "https://www.nintendo.com/au/about/history/", checkedAt },
  { id: "valve", title: "Valve Steam Deck models", url: "https://www.steamdeck.com/en/", checkedAt },
  { id: "asus-ally", title: "ASUS ROG Ally specifications", url: "https://rog.asus.com/gaming-handhelds/rog-ally/rog-ally-2023/spec/", checkedAt },
  { id: "asus-ally-x", title: "ASUS ROG Ally X specifications", url: "https://rog.asus.com/us/gaming-handhelds/rog-ally/rog-ally-x-2024/spec/", checkedAt },
  { id: "lenovo-go", title: "Lenovo Legion Go 8APU1 PSREF", url: "https://psref.lenovo.com/syspool/Sys/PDF/Legion/Legion_Go_8APU1/Legion_Go_8APU1_Spec.pdf", checkedAt },
] as const;

type CatalogEntry = CatalogOption & { categories: readonly RetailCategory[]; source: string; brand?: string };
const mobile: readonly RetailCategory[] = ["laptop"];
const desktop: readonly RetailCategory[] = ["desktop"];
const computer: readonly RetailCategory[] = ["laptop", "desktop"];

function hardware(prefix: string, names: readonly string[], categories: readonly RetailCategory[], detail: string, source: string): CatalogEntry[] {
  return names.map(name => {
    const value = `${prefix} ${name}`;
    const alias = name.replaceAll("-", " ");
    return { value, label: value, categories, detail: `${detail}${alias !== name ? ` · ${alias}` : ""}`, source };
  });
}

// Explicit SKU lists; do not generate a cartesian product of tiers, suffixes or generations.
const cpuEntries: CatalogEntry[] = [
  ...hardware("Intel Core", [
    "i3-3110M", "i3-4005U", "i3-4030U", "i3-5005U", "i3-6006U", "i3-6100U", "i3-7100U", "i3-8130U", "i3-8145U", "i3-1005G1", "i3-10110U", "i3-1115G4", "i3-1125G4", "i3-1215U", "i3-1315U",
    "i5-2520M", "i5-3320M", "i5-4200U", "i5-4210U", "i5-4300U", "i5-5200U", "i5-5300U", "i5-6200U", "i5-6300U", "i5-7200U", "i5-7300U", "i5-7300HQ", "i5-8250U", "i5-8265U", "i5-8300H", "i5-8365U", "i5-10210U", "i5-1035G1", "i5-1035G4", "i5-1035G7", "i5-10300H", "i5-1135G7", "i5-1145G7", "i5-11400H", "i5-1155G7", "i5-1235U", "i5-1240P", "i5-12450H", "i5-12500H", "i5-1335U", "i5-1340P", "i5-13420H", "i5-13500H",
    "i7-2620M", "i7-3520M", "i7-4500U", "i7-4600U", "i7-4700MQ", "i7-5500U", "i7-5600U", "i7-6500U", "i7-6600U", "i7-6700HQ", "i7-7500U", "i7-7600U", "i7-7700HQ", "i7-8550U", "i7-8565U", "i7-8650U", "i7-8750H", "i7-8850H", "i7-10510U", "i7-1065G7", "i7-10710U", "i7-10750H", "i7-1165G7", "i7-1185G7", "i7-11800H", "i7-1255U", "i7-1260P", "i7-12700H", "i7-12800H", "i7-1355U", "i7-1360P", "i7-13620H", "i7-13700H", "i7-14650HX", "i7-14700HX",
    "i9-8950HK", "i9-9880H", "i9-9980HK", "i9-10885H", "i9-10980HK", "i9-11900H", "i9-12900H", "i9-12900HX", "i9-13900H", "i9-13900HX", "i9-14900HX",
  ], mobile, "移动处理器 · Intel Core", "intel-core"),
  ...hardware("Intel Core", [
    "i3-2120", "i3-3220", "i3-4130", "i3-4150", "i3-4160", "i3-6100", "i3-7100", "i3-8100", "i3-9100F", "i3-10100", "i3-10100F", "i3-12100", "i3-12100F", "i3-13100", "i3-13100F", "i3-14100", "i3-14100F",
    "i5-2400", "i5-2500", "i5-3470", "i5-3570", "i5-4460", "i5-4570", "i5-4590", "i5-6500", "i5-6600", "i5-7400", "i5-7500", "i5-8400", "i5-8500", "i5-9400F", "i5-9500", "i5-10400", "i5-10400F", "i5-10500", "i5-11400", "i5-11400F", "i5-12400", "i5-12400F", "i5-12500", "i5-12600K", "i5-13400", "i5-13400F", "i5-13500", "i5-13600K", "i5-14400", "i5-14400F", "i5-14500", "i5-14600K",
    "i7-2600", "i7-3770", "i7-4770", "i7-4790", "i7-6700", "i7-7700", "i7-8700", "i7-8700K", "i7-9700", "i7-9700K", "i7-10700", "i7-10700K", "i7-11700", "i7-11700K", "i7-12700", "i7-12700K", "i7-13700", "i7-13700K", "i7-14700", "i7-14700K",
    "i9-9900K", "i9-10900K", "i9-11900K", "i9-12900K", "i9-13900K", "i9-14900K",
  ], desktop, "桌面处理器 · Intel Core", "intel-core"),
  ...hardware("Intel Core Ultra", ["5 125H", "5 125U", "5 135H", "5 135U", "5 225H", "5 225U", "5 226V", "5 228V", "7 155H", "7 155U", "7 165H", "7 165U", "7 255H", "7 255U", "7 256V", "7 258V", "7 265H", "7 268V", "9 185H", "9 285H", "9 288V"], mobile, "移动处理器 · Core Ultra", "intel-ultra"),
  ...hardware("Intel Core Ultra", ["5 245K", "5 245KF", "7 265K", "7 265KF", "9 285K"], desktop, "桌面处理器 · Core Ultra", "intel-ultra"),
  ...hardware("Intel Core", ["5 120U", "7 150U"], mobile, "移动处理器 · Core U 系列", "intel-legacy"),
  ...hardware("Intel Celeron", ["N2840", "N3050", "N3060", "N3350", "N4000", "N4020", "N4120", "N4500", "N5100", "N5105"], computer, "低功耗 · Celeron N 系列", "intel-legacy"),
  ...hardware("Intel Celeron", ["J1900", "J3355", "J3455", "J4005", "J4105", "J4125"], desktop, "桌面低功耗 · Celeron J 系列", "intel-legacy"),
  ...hardware("Intel Pentium", ["N3540", "N3710", "N4200"], mobile, "移动处理器 · Pentium", "intel-legacy"),
  ...hardware("Intel Pentium Silver", ["N5000", "N5030", "N6000"], mobile, "移动处理器 · Pentium Silver", "intel-legacy"),
  ...hardware("Intel Pentium Gold", ["4415U", "5405U", "6405U", "7505"], mobile, "移动处理器 · Pentium Gold", "intel-legacy"),
  ...hardware("Intel Pentium", ["G3258", "G4400", "G4560"], desktop, "桌面处理器 · Pentium", "intel-legacy"),
  ...hardware("Intel Pentium Gold", ["G5400", "G6400", "G7400"], desktop, "桌面处理器 · Pentium Gold", "intel-legacy"),
  ...hardware("Intel Processor", ["N95", "N97", "N100", "N150", "N200", "N250"], computer, "低功耗 · 笔记本 / 迷你电脑", "intel-legacy"),
  ...hardware("AMD Ryzen", [
    "3 2200U", "3 3200U", "3 3250U", "3 4300U", "3 5300U", "3 5400U", "3 7320U",
    "5 2500U", "5 3500U", "5 4500U", "5 4600H", "5 5500U", "5 5600U", "5 5600H", "5 5625U", "5 6600U", "5 6600H", "5 7530U", "5 7535HS", "5 7540U", "5 7640U", "5 7640HS", "5 8640U", "5 8645HS",
    "7 2700U", "7 3700U", "7 3750H", "7 4700U", "7 4800U", "7 4800H", "7 5700U", "7 5800U", "7 5800H", "7 5825U", "7 6800U", "7 6800H", "7 7730U", "7 7735U", "7 7735HS", "7 7840U", "7 7840HS", "7 8840U", "7 8845HS",
    "9 4900H", "9 4900HS", "9 5900HX", "9 6900HX", "9 7940HS", "9 7945HX", "9 8945HS",
  ], mobile, "移动处理器 · AMD Ryzen", "amd-processors"),
  ...hardware("AMD Ryzen", [
    "3 1200", "3 2200G", "3 3200G", "3 4100", "3 4300G", "3 8300G",
    "5 1600", "5 2600", "5 3600", "5 4500", "5 5500", "5 5600", "5 5600G", "5 5600X", "5 7500F", "5 7600", "5 7600X", "5 8600G", "5 9600X",
    "7 1700", "7 2700X", "7 3700X", "7 3800X", "7 5700G", "7 5700X", "7 5700X3D", "7 5800X", "7 5800X3D", "7 7700", "7 7700X", "7 7800X3D", "7 8700G", "7 9700X", "7 9800X3D",
    "9 3900X", "9 3950X", "9 5900X", "9 5950X", "9 7900", "9 7900X", "9 7900X3D", "9 7950X", "9 7950X3D", "9 9900X", "9 9950X",
  ], desktop, "桌面处理器 · AMD Ryzen", "amd-processors"),
  ...hardware("AMD Ryzen AI", ["5 340", "7 350", "9 365", "9 HX 370", "9 HX 375"], mobile, "移动处理器 · Ryzen AI", "amd-processors"),
  ...hardware("AMD Athlon", ["200GE", "3000G", "Gold 3150G", "Gold 3150GE", "Silver 3050GE"], desktop, "桌面处理器 · Athlon", "amd-athlon"),
  ...hardware("AMD Athlon", ["Silver 3050U", "Gold 3150U", "Silver 7120U", "Gold 7220U"], mobile, "移动处理器 · Athlon", "amd-processors"),
  ...hardware("Apple", ["M1", "M1 Max", "M2", "M2 Pro", "M2 Max", "M3", "M4", "M4 Pro", "M4 Max", "M5 Max"], computer, "Apple Silicon · 核数以实物为准", "apple-mac"),
  ...hardware("Apple", ["M1 Pro", "M3 Pro", "M3 Max"], mobile, "Apple Silicon · 核数以实物为准", "apple-mac"),
  ...hardware("Apple", ["M5", "M5 Pro"], mobile, "Apple Silicon · 核数以实物为准", "apple-current"),
  ...hardware("Apple", ["M1 Ultra", "M2 Ultra", "M3 Ultra"], desktop, "Apple Silicon · Mac Studio", "apple-desktop-archive"),
  ...hardware("Apple", ["M5 Ultra"], desktop, "Apple Silicon · Mac Studio", "apple-desktop"),
];

const gpuEntries: CatalogEntry[] = [
  ...hardware("NVIDIA GeForce", [
    "GT 710", "GT 730", "GT 1030", "GTX 750", "GTX 750 Ti", "GTX 950", "GTX 960", "GTX 970", "GTX 980", "GTX 980 Ti", "GTX 1050", "GTX 1050 Ti", "GTX 1060", "GTX 1070", "GTX 1070 Ti", "GTX 1080", "GTX 1080 Ti", "GTX 1630", "GTX 1650", "GTX 1650 SUPER", "GTX 1660", "GTX 1660 SUPER", "GTX 1660 Ti",
    "RTX 2060", "RTX 2060 SUPER", "RTX 2070", "RTX 2070 SUPER", "RTX 2080", "RTX 2080 SUPER", "RTX 2080 Ti", "RTX 3050", "RTX 3060", "RTX 3060 Ti", "RTX 3070", "RTX 3070 Ti", "RTX 3080", "RTX 3080 Ti", "RTX 3090", "RTX 3090 Ti", "RTX 4060", "RTX 4060 Ti", "RTX 4070", "RTX 4070 SUPER", "RTX 4070 Ti", "RTX 4070 Ti SUPER", "RTX 4080", "RTX 4080 SUPER", "RTX 4090", "RTX 5050", "RTX 5060", "RTX 5060 Ti", "RTX 5070", "RTX 5070 Ti", "RTX 5080", "RTX 5090",
  ], desktop, "桌面独立显卡 · GeForce", "nvidia-desktop"),
  ...hardware("NVIDIA GeForce", ["GTX 960M", "GTX 965M", "GTX 970M", "GTX 980M", "MX110", "MX130", "MX150", "MX230", "MX250", "MX330", "MX350", "MX450", "MX550", "MX570"], mobile, "移动独立显卡 · GeForce", "nvidia-mobile"),
  ...hardware("NVIDIA GeForce", ["GTX 1050（移动版）", "GTX 1050 Ti（移动版）", "GTX 1060（移动版）", "GTX 1070（移动版）", "GTX 1080（移动版）", "GTX 1650（移动版）", "GTX 1650 Ti（移动版）", "GTX 1660 Ti（移动版）", "RTX 2060（移动版）", "RTX 2070（移动版）", "RTX 2070 SUPER（移动版）", "RTX 2080（移动版）", "RTX 2080 SUPER（移动版）"], mobile, "移动独立显卡 · 与桌面型号分开", "nvidia-mobile"),
  ...hardware("NVIDIA GeForce", ["RTX 2050 Laptop GPU", "RTX 3050 Laptop GPU", "RTX 3050 Ti Laptop GPU", "RTX 3060 Laptop GPU", "RTX 3070 Laptop GPU", "RTX 3070 Ti Laptop GPU", "RTX 3080 Laptop GPU", "RTX 3080 Ti Laptop GPU", "RTX 4050 Laptop GPU", "RTX 4060 Laptop GPU", "RTX 4070 Laptop GPU", "RTX 4080 Laptop GPU", "RTX 4090 Laptop GPU", "RTX 5050 Laptop GPU", "RTX 5060 Laptop GPU", "RTX 5070 Laptop GPU", "RTX 5070 Ti Laptop GPU", "RTX 5080 Laptop GPU", "RTX 5090 Laptop GPU"], mobile, "移动独立显卡 · GeForce RTX", "nvidia-mobile"),
  ...hardware("AMD Radeon", ["R7 240", "R7 250", "R9 270", "R9 280", "R9 290", "R9 380", "R9 390", "RX 460", "RX 470", "RX 480", "RX 550", "RX 560", "RX 570", "RX 580", "RX 590", "RX Vega 56", "RX Vega 64", "RX 5500 XT", "RX 5600 XT", "RX 5700", "RX 5700 XT", "RX 6400", "RX 6500 XT", "RX 6600", "RX 6600 XT", "RX 6650 XT", "RX 6700 XT", "RX 6750 XT", "RX 6800", "RX 6800 XT", "RX 6900 XT", "RX 6950 XT", "RX 7600", "RX 7600 XT", "RX 7700 XT", "RX 7800 XT", "RX 7900 GRE", "RX 7900 XT", "RX 7900 XTX", "RX 9060 XT", "RX 9070", "RX 9070 XT"], desktop, "桌面独立显卡 · Radeon", "amd-graphics"),
  ...hardware("AMD Radeon", ["RX 5500M", "RX 5600M", "RX 5700M", "RX 6500M", "RX 6600M", "RX 6700M", "RX 6800M", "RX 6850M XT", "RX 7600M", "RX 7600M XT", "RX 7700S", "RX 7800M", "RX 7900M"], mobile, "移动独立显卡 · Radeon", "amd-graphics-support"),
  ...hardware("AMD Radeon", ["Graphics", "Vega 3 Graphics", "Vega 8 Graphics", "610M", "660M", "680M", "740M", "760M", "780M", "840M", "860M", "880M", "890M"], computer, "集成显卡 · Radeon", "amd-processors"),
  ...hardware("Intel HD Graphics", ["3000", "4000", "4400", "4600", "500", "505", "520", "530", "610", "615", "620", "630"], computer, "集成显卡 · Intel HD", "intel-graphics"),
  ...hardware("Intel UHD Graphics", ["600", "605", "610", "620", "630", "730", "750", "770"], computer, "集成显卡 · Intel UHD", "intel-graphics"),
  ...hardware("Intel", ["UHD Graphics", "Iris Plus Graphics 640", "Iris Plus Graphics 650", "Iris Plus Graphics 655", "Iris Plus Graphics", "Iris Xe Graphics", "Arc Graphics", "Arc 130V", "Arc 140V"], computer, "集成显卡 · 型号及核数以实物为准", "intel-graphics"),
  ...hardware("Intel Arc", ["A310", "A380", "A580", "A750", "A770", "B570", "B580"], desktop, "桌面独立显卡 · Intel Arc", "intel-arc"),
  ...hardware("Intel Arc", ["A350M", "A370M", "A530M", "A550M", "A570M", "A730M", "A770M"], mobile, "移动独立显卡 · Intel Arc", "intel-arc"),
  ...hardware("Apple", ["M1 GPU", "M1 Max GPU", "M2 GPU", "M2 Pro GPU", "M2 Max GPU", "M3 GPU", "M4 GPU", "M4 Pro GPU", "M4 Max GPU", "M5 Max GPU"], computer, "Apple 集成 GPU · 核数以实物为准", "apple-mac"),
  ...hardware("Apple", ["M1 Pro GPU", "M3 Pro GPU", "M3 Max GPU"], mobile, "Apple 集成 GPU · 核数以实物为准", "apple-mac"),
  ...hardware("Apple", ["M5 GPU", "M5 Pro GPU"], mobile, "Apple 集成 GPU · 核数以实物为准", "apple-current"),
  ...hardware("Apple", ["M1 Ultra GPU", "M2 Ultra GPU", "M3 Ultra GPU"], desktop, "Apple 集成 GPU · Mac Studio", "apple-desktop-archive"),
  ...hardware("Apple", ["M5 Ultra GPU"], desktop, "Apple 集成 GPU · Mac Studio", "apple-desktop"),
];

function models(brand: string, names: readonly string[], detail: string, source: string): CatalogEntry[] {
  return names.map(value => {
    const alias = value === "PlayStation" || value === "PS one" ? "PS1" : value.replace(/^PlayStation /, "PS");
    return { value, label: value, brand, categories: ["console"], detail: `${brand} · ${detail}${alias !== value ? ` · ${alias}` : ""}`, source };
  });
}
const modelEntries: CatalogEntry[] = [
  ...models("Sony", ["PlayStation", "PS one", "PlayStation 2", "PlayStation 2 Slim", "PlayStation 3", "PlayStation 3 Slim", "PlayStation 3 Super Slim"], "家用主机", "sony-history"),
  ...models("Sony", ["PlayStation 4", "PlayStation 4 Slim", "PlayStation 4 Pro", "PlayStation 5", "PlayStation 5 Digital Edition", "PlayStation 5 Slim", "PlayStation 5 Slim Digital Edition", "PlayStation 5 Pro"], "家用主机", "sony-manuals"),
  ...models("Sony", ["PSP-1000", "PSP-2000", "PSP-3000", "PSP Go", "PS Vita PCH-1000", "PS Vita PCH-2000"], "掌机", "sony-history"),
  ...models("Microsoft", ["Xbox", "Xbox 360", "Xbox 360 S", "Xbox 360 E", "Xbox One", "Xbox One S", "Xbox One S All-Digital Edition", "Xbox One X"], "家用主机", "xbox-history"),
  ...models("Microsoft", ["Xbox Series X", "Xbox Series X All-Digital", "Xbox Series S"], "家用主机", "xbox-current"),
  ...models("Nintendo", ["Nintendo Switch", "Nintendo Switch OLED", "Nintendo Switch Lite"], "Switch 系列", "nintendo-current"),
  ...models("Nintendo", ["Nintendo Switch 2"], "主机 / 掌机", "nintendo-switch2"),
  ...models("Nintendo", ["Nintendo 3DS", "Nintendo 3DS XL", "New Nintendo 3DS", "New Nintendo 3DS XL", "Nintendo 2DS", "New Nintendo 2DS XL", "Nintendo DS", "Nintendo DS Lite", "Nintendo DSi", "Nintendo DSi XL", "Game Boy", "Game Boy Color", "Game Boy Advance", "Game Boy Advance SP"], "旧代掌机", "nintendo-history"),
  ...models("Nintendo", ["Wii", "Wii Mini", "Wii U", "Nintendo GameCube", "Nintendo 64", "Super Nintendo Entertainment System", "Nintendo Entertainment System"], "旧代家用主机", "nintendo-history"),
  ...models("Valve", ["Steam Deck LCD", "Steam Deck OLED"], "掌上 PC", "valve"),
  ...models("ASUS", ["ROG Ally (2023)"], "掌上 PC · RC71L", "asus-ally"),
  ...models("ASUS", ["ROG Ally X (2024)"], "掌上 PC · RC72LA", "asus-ally-x"),
  ...models("Lenovo", ["Legion Go"], "掌上 PC · 8APU1", "lenovo-go"),
];

const brandPresets: Record<RetailCategory, readonly string[]> = {
  phone: ["Apple", "Samsung", "Xiaomi", "Redmi", "POCO", "Huawei", "Honor", "OPPO", "OnePlus", "realme", "vivo", "Google", "Motorola", "Nokia", "Sony", "ASUS", "Nothing", "ZTE", "TCL"],
  tablet: ["Apple", "Samsung", "Lenovo", "Xiaomi", "Huawei", "Honor", "Microsoft", "Amazon", "ASUS", "TCL", "Nokia"],
  laptop: ["Apple", "Lenovo", "HP", "Dell", "ASUS", "Acer", "MSI", "Microsoft", "Samsung", "Huawei", "LG", "Toshiba", "Dynabook", "Fujitsu", "Gigabyte", "Razer"],
  desktop: ["Apple", "Lenovo", "HP", "Dell", "ASUS", "Acer", "MSI", "Intel", "Gigabyte", "Fujitsu", "自组电脑"],
  console: ["Sony", "Microsoft", "Nintendo", "Valve", "ASUS", "Lenovo"],
  other: [],
};
const keyboardOptions: CatalogOption[] = [
  { value: "IT", label: "IT", detail: "意大利语 · QWERTY" }, { value: "US", label: "US", detail: "美国英语 · QWERTY" },
  { value: "UK", label: "UK", detail: "英国英语 · QWERTY" }, { value: "FR", label: "FR", detail: "法语 · AZERTY" },
  { value: "DE", label: "DE", detail: "德语 · QWERTZ" }, { value: "ES", label: "ES", detail: "西班牙语 · QWERTY" },
  { value: "PT", label: "PT", detail: "葡萄牙语" }, { value: "CH", label: "CH", detail: "瑞士布局 · 实物核对" },
  { value: "JP", label: "JP", detail: "日语 · JIS" }, { value: "Nordic", label: "Nordic", detail: "北欧布局" },
];
const editionPresets: Partial<Record<RetailCategory, readonly string[]>> = {
  phone: ["欧版", "国行", "美版", "港版", "日版", "单 SIM", "双 SIM", "SIM + eSIM", "仅 eSIM"],
  tablet: ["Wi-Fi", "Wi-Fi + Cellular", "Wi-Fi + 4G", "Wi-Fi + 5G"],
  console: ["光驱版", "数字版", "标准版", "OLED", "LCD", "Lite", "Slim", "Pro", "特别版"],
};

export const retailRamPresets: number[] = [2, 3, 4, 6, 8, 12, 16, 18, 24, 32, 36, 48, 64, 96, 128, 192, 256, 512];
export function retailStoragePresets(category: RetailCategory): Capacity[] {
  const gb = category === "console" ? [8, 32, 64, 128, 256, 512, 825] : category === "phone" || category === "tablet" ? [16, 32, 64, 128, 256, 512] : [];
  return gb.length ? [...gb.map(capacity => ({ capacity, unit: "GB" as const })), { capacity: 1, unit: "TB" }, { capacity: 2, unit: "TB" }] : [];
}

const normalized = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
function uniqueOptions(options: readonly CatalogOption[]): CatalogOption[] {
  const seen = new Set<string>();
  return options.filter(option => {
    const key = normalized(option.value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(option => ({ ...option }));
}
function validExistingText(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && value.length <= 5000 && !/[\u0000-\u001f\u007f]/.test(value);
}
function fieldApplies(field: RetailCatalogField, category: RetailCategory) {
  if (field === "cpu" || field === "gpu") return category === "laptop" || category === "desktop";
  if (field === "keyboard") return category === "laptop";
  if (field === "edition") return category === "phone" || category === "tablet" || category === "console";
  return true;
}

/** Suggestions only. Manual text remains valid; callers keep the current input independently. */
export function retailCatalogOptions(field: RetailCatalogField, category: RetailCategory, brand = "", units: RetailUnit[] = []): CatalogOption[] {
  if (!fieldApplies(field, category)) return [];
  const brandKey = normalized(brand);
  let options: CatalogOption[];
  if (field === "brand") options = brandPresets[category].map(value => ({ value, label: value, ...(category === "console" ? { detail: value === "Sony" ? "PlayStation / PSP / PS Vita" : value === "Microsoft" ? "Xbox" : value === "Valve" ? "Steam Deck" : value === "ASUS" ? "ROG Ally" : value === "Lenovo" ? "Legion Go" : "Switch / 3DS / Wii" } : {}) }));
  else if (field === "cpu" || field === "gpu") options = (field === "cpu" ? cpuEntries : gpuEntries).filter(entry => entry.categories.includes(category)).map(({ value, label, detail }) => ({ value, label, detail }));
  else if (field === "model") options = modelEntries.filter(entry => entry.categories.includes(category) && (!brandKey || normalized(entry.brand ?? "") === brandKey)).map(({ value, label, detail }) => ({ value, label, detail }));
  else if (field === "keyboard") options = keyboardOptions;
  else options = (editionPresets[category] ?? []).map(value => ({ value, label: value }));
  const recorded = units.filter(unit => unit.category === category && (field !== "model" || !brandKey || normalized(unit.brand) === brandKey))
    .map(unit => unit[field]).filter(validExistingText).map(value => ({ value: value.trim(), label: value.trim(), detail: "已登记值 · 实物仍须核对" }));
  return uniqueOptions([...options, ...recorded]);
}

export const retailCatalogCounts = {
  cpu: cpuEntries.length, gpu: gpuEntries.length, consoleModels: modelEntries.length,
  keyboard: keyboardOptions.length, ram: retailRamPresets.length, sources: catalogSources.length,
};
