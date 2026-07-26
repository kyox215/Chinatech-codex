export type PhoneColorOption = {
  id: string;
  name: string;
  swatches: readonly string[];
};

export type EuPhoneModel = {
  id: string;
  brandId: string;
  name: string;
  releasedOn: string;
  aliases?: readonly string[];
  ramOptions: readonly string[];
  storageOptions: readonly string[];
  colors: readonly PhoneColorOption[];
};

export type EuPhoneBrand = {
  id: string;
  name: string;
  aliases?: readonly string[];
};

const color = (id: string, name: string, ...swatches: string[]): PhoneColorOption => ({
  id,
  name,
  swatches,
});

// These values describe physical product finishes, not application status or design-system colors.
const COLORS = {
  black: color("black", "黑色", "#1d1d1f"),
  white: color("white", "白色", "#f5f5f0"),
  silver: color("silver", "银色", "#d8d9d6"),
  graphite: color("graphite", "石墨色", "#4c4b49"),
  gold: color("gold", "金色", "#ead8c0"),
  roseGold: color("rose-gold", "玫瑰金", "#e7c4b9"),
  blue: color("blue", "蓝色", "#4776a8"),
  lightBlue: color("light-blue", "浅蓝色", "#c8d9e6"),
  green: color("green", "绿色", "#4f6657"),
  mint: color("mint", "薄荷绿", "#d7e5d3"),
  red: color("red", "红色", "#b6242a"),
  yellow: color("yellow", "黄色", "#f2e36d"),
  purple: color("purple", "紫色", "#a79ab8"),
  pink: color("pink", "粉色", "#e8c8cf"),
  orange: color("orange", "橙色", "#e16f3d"),
  naturalTitanium: color("natural-titanium", "原色钛金属", "#b8ad9e"),
  blueTitanium: color("blue-titanium", "蓝色钛金属", "#4d5c6c"),
  whiteTitanium: color("white-titanium", "白色钛金属", "#e8e6df"),
  blackTitanium: color("black-titanium", "黑色钛金属", "#3c3b3a"),
  desertTitanium: color("desert-titanium", "沙漠色钛金属", "#c9ad93"),
  cosmicOrange: color("cosmic-orange", "宇宙橙色", "#e96c36"),
  deepBlue: color("deep-blue", "深蓝色", "#233d63"),
  lavender: color("lavender", "薰衣草紫", "#c7bdd5"),
  cream: color("cream", "奶油色", "#eee6cf"),
  navy: color("navy", "海军蓝", "#26364d"),
  grey: color("grey", "灰色", "#8c8d91"),
  cyan: color("cyan", "青色", "#8bd3d5"),
  gradientBlue: color("gradient-blue", "蓝紫渐变", "#5d80d6", "#a77bd4"),
} as const;

const APPLE_CLASSIC = [COLORS.black, COLORS.white, COLORS.red, COLORS.blue] as const;
const APPLE_PRO = [COLORS.graphite, COLORS.silver, COLORS.gold, COLORS.blue] as const;
const ANDROID_CORE = [COLORS.black, COLORS.white, COLORS.blue, COLORS.green] as const;
const ANDROID_EXTENDED = [
  COLORS.black,
  COLORS.white,
  COLORS.blue,
  COLORS.green,
  COLORS.purple,
] as const;

const model = (
  brandId: string,
  name: string,
  releasedOn: string,
  ramOptions: readonly string[],
  storageOptions: readonly string[],
  colors: readonly PhoneColorOption[],
  aliases?: readonly string[],
): EuPhoneModel => ({
  id: `${brandId}-${name}`
    .toLowerCase()
    .replace(/\+/g, "-plus-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, ""),
  brandId,
  name,
  releasedOn,
  ramOptions,
  storageOptions,
  colors,
  aliases,
});

export const EU_PHONE_BRANDS: readonly EuPhoneBrand[] = [
  { id: "apple", name: "Apple", aliases: ["iPhone"] },
  { id: "samsung", name: "Samsung" },
  { id: "xiaomi", name: "Xiaomi", aliases: ["Mi"] },
  { id: "redmi", name: "Redmi", aliases: ["Xiaomi Redmi"] },
  { id: "poco", name: "POCO", aliases: ["Xiaomi POCO"] },
  { id: "google", name: "Google", aliases: ["Pixel"] },
  { id: "motorola", name: "Motorola", aliases: ["Moto"] },
  { id: "oppo", name: "OPPO" },
  { id: "oneplus", name: "OnePlus" },
  { id: "honor", name: "HONOR" },
  { id: "huawei", name: "Huawei" },
  { id: "realme", name: "realme" },
  { id: "vivo", name: "vivo" },
  { id: "hmd", name: "HMD / Nokia", aliases: ["Nokia", "HMD"] },
  { id: "sony", name: "Sony", aliases: ["Xperia"] },
  { id: "nothing", name: "Nothing / CMF", aliases: ["Nothing", "CMF"] },
  { id: "asus", name: "ASUS", aliases: ["Zenfone", "ROG Phone"] },
  { id: "fairphone", name: "Fairphone" },
  { id: "tcl", name: "TCL" },
  { id: "zte", name: "ZTE / nubia", aliases: ["ZTE", "nubia", "RedMagic"] },
] as const;

export const EU_PHONE_MODELS: readonly EuPhoneModel[] = [
  model(
    "apple",
    "iPhone 17 Pro Max",
    "2025-09-19",
    [],
    ["256 GB", "512 GB", "1 TB", "2 TB"],
    [COLORS.silver, COLORS.deepBlue, COLORS.cosmicOrange],
  ),
  model(
    "apple",
    "iPhone 17 Pro",
    "2025-09-19",
    [],
    ["256 GB", "512 GB", "1 TB"],
    [COLORS.silver, COLORS.deepBlue, COLORS.cosmicOrange],
  ),
  model(
    "apple",
    "iPhone 17 Air",
    "2025-09-19",
    [],
    ["256 GB", "512 GB", "1 TB"],
    [COLORS.black, COLORS.white, COLORS.lightBlue, COLORS.gold],
  ),
  model(
    "apple",
    "iPhone 17",
    "2025-09-19",
    [],
    ["256 GB", "512 GB"],
    [COLORS.black, COLORS.white, COLORS.blue, COLORS.green, COLORS.purple],
  ),
  model(
    "apple",
    "iPhone 16e",
    "2025-02-28",
    [],
    ["128 GB", "256 GB", "512 GB"],
    [COLORS.black, COLORS.white],
  ),
  model(
    "apple",
    "iPhone 16 Pro Max",
    "2024-09-20",
    [],
    ["256 GB", "512 GB", "1 TB"],
    [COLORS.blackTitanium, COLORS.whiteTitanium, COLORS.naturalTitanium, COLORS.desertTitanium],
  ),
  model(
    "apple",
    "iPhone 16 Pro",
    "2024-09-20",
    [],
    ["128 GB", "256 GB", "512 GB", "1 TB"],
    [COLORS.blackTitanium, COLORS.whiteTitanium, COLORS.naturalTitanium, COLORS.desertTitanium],
  ),
  model(
    "apple",
    "iPhone 16 Plus",
    "2024-09-20",
    [],
    ["128 GB", "256 GB", "512 GB"],
    [COLORS.black, COLORS.white, COLORS.pink, COLORS.cyan, COLORS.blue],
  ),
  model(
    "apple",
    "iPhone 16",
    "2024-09-20",
    [],
    ["128 GB", "256 GB", "512 GB"],
    [COLORS.black, COLORS.white, COLORS.pink, COLORS.cyan, COLORS.blue],
  ),
  model(
    "apple",
    "iPhone 15 Pro Max",
    "2023-09-22",
    [],
    ["256 GB", "512 GB", "1 TB"],
    [COLORS.blackTitanium, COLORS.whiteTitanium, COLORS.blueTitanium, COLORS.naturalTitanium],
  ),
  model(
    "apple",
    "iPhone 15 Pro",
    "2023-09-22",
    [],
    ["128 GB", "256 GB", "512 GB", "1 TB"],
    [COLORS.blackTitanium, COLORS.whiteTitanium, COLORS.blueTitanium, COLORS.naturalTitanium],
  ),
  model(
    "apple",
    "iPhone 15 Plus",
    "2023-09-22",
    [],
    ["128 GB", "256 GB", "512 GB"],
    [COLORS.black, COLORS.blue, COLORS.green, COLORS.yellow, COLORS.pink],
  ),
  model(
    "apple",
    "iPhone 15",
    "2023-09-22",
    [],
    ["128 GB", "256 GB", "512 GB"],
    [COLORS.black, COLORS.blue, COLORS.green, COLORS.yellow, COLORS.pink],
  ),
  model(
    "apple",
    "iPhone 14 Pro Max",
    "2022-09-16",
    [],
    ["128 GB", "256 GB", "512 GB", "1 TB"],
    [COLORS.graphite, COLORS.silver, COLORS.gold, COLORS.purple],
  ),
  model(
    "apple",
    "iPhone 14 Pro",
    "2022-09-16",
    [],
    ["128 GB", "256 GB", "512 GB", "1 TB"],
    [COLORS.graphite, COLORS.silver, COLORS.gold, COLORS.purple],
  ),
  model("apple", "iPhone 14 Plus", "2022-10-07", [], ["128 GB", "256 GB", "512 GB"], APPLE_CLASSIC),
  model("apple", "iPhone 14", "2022-09-16", [], ["128 GB", "256 GB", "512 GB"], APPLE_CLASSIC),
  model(
    "apple",
    "iPhone SE (3rd generation)",
    "2022-03-18",
    [],
    ["64 GB", "128 GB", "256 GB"],
    [COLORS.black, COLORS.white, COLORS.red],
    ["iPhone SE 2022", "iPhone SE 3"],
  ),
  model(
    "apple",
    "iPhone 13 Pro Max",
    "2021-09-24",
    [],
    ["128 GB", "256 GB", "512 GB", "1 TB"],
    APPLE_PRO,
  ),
  model(
    "apple",
    "iPhone 13 Pro",
    "2021-09-24",
    [],
    ["128 GB", "256 GB", "512 GB", "1 TB"],
    APPLE_PRO,
  ),
  model("apple", "iPhone 13 mini", "2021-09-24", [], ["128 GB", "256 GB", "512 GB"], APPLE_CLASSIC),
  model("apple", "iPhone 13", "2021-09-24", [], ["128 GB", "256 GB", "512 GB"], APPLE_CLASSIC),
  model("apple", "iPhone 12 Pro Max", "2020-11-13", [], ["128 GB", "256 GB", "512 GB"], APPLE_PRO),
  model("apple", "iPhone 12 Pro", "2020-10-23", [], ["128 GB", "256 GB", "512 GB"], APPLE_PRO),
  model("apple", "iPhone 12 mini", "2020-11-13", [], ["64 GB", "128 GB", "256 GB"], APPLE_CLASSIC),
  model("apple", "iPhone 12", "2020-10-23", [], ["64 GB", "128 GB", "256 GB"], APPLE_CLASSIC),
  model(
    "apple",
    "iPhone SE (2nd generation)",
    "2020-04-24",
    [],
    ["64 GB", "128 GB", "256 GB"],
    [COLORS.black, COLORS.white, COLORS.red],
    ["iPhone SE 2020", "iPhone SE 2"],
  ),
  model("apple", "iPhone 11 Pro Max", "2019-09-20", [], ["64 GB", "256 GB", "512 GB"], APPLE_PRO),
  model("apple", "iPhone 11 Pro", "2019-09-20", [], ["64 GB", "256 GB", "512 GB"], APPLE_PRO),
  model("apple", "iPhone 11", "2019-09-20", [], ["64 GB", "128 GB", "256 GB"], APPLE_CLASSIC),
  model(
    "apple",
    "iPhone XS Max",
    "2018-09-21",
    [],
    ["64 GB", "256 GB", "512 GB"],
    [COLORS.silver, COLORS.graphite, COLORS.gold],
  ),
  model(
    "apple",
    "iPhone XS",
    "2018-09-21",
    [],
    ["64 GB", "256 GB", "512 GB"],
    [COLORS.silver, COLORS.graphite, COLORS.gold],
  ),
  model("apple", "iPhone XR", "2018-10-26", [], ["64 GB", "128 GB", "256 GB"], APPLE_CLASSIC),
  model(
    "apple",
    "iPhone X",
    "2017-11-03",
    [],
    ["64 GB", "256 GB"],
    [COLORS.silver, COLORS.graphite],
  ),
  model(
    "apple",
    "iPhone 8 Plus",
    "2017-09-22",
    [],
    ["64 GB", "128 GB", "256 GB"],
    [COLORS.silver, COLORS.graphite, COLORS.gold, COLORS.red],
  ),
  model(
    "apple",
    "iPhone 8",
    "2017-09-22",
    [],
    ["64 GB", "128 GB", "256 GB"],
    [COLORS.silver, COLORS.graphite, COLORS.gold, COLORS.red],
  ),
  model(
    "apple",
    "iPhone 7 Plus",
    "2016-09-16",
    [],
    ["32 GB", "128 GB", "256 GB"],
    [COLORS.black, COLORS.silver, COLORS.gold, COLORS.roseGold, COLORS.red],
  ),
  model(
    "apple",
    "iPhone 7",
    "2016-09-16",
    [],
    ["32 GB", "128 GB", "256 GB"],
    [COLORS.black, COLORS.silver, COLORS.gold, COLORS.roseGold, COLORS.red],
  ),

  ...[
    ["Galaxy S25 Ultra", "2025-02-07", ["12 GB"], ["256 GB", "512 GB", "1 TB"]],
    ["Galaxy S25+", "2025-02-07", ["12 GB"], ["256 GB", "512 GB"]],
    ["Galaxy S25", "2025-02-07", ["12 GB"], ["128 GB", "256 GB"]],
    ["Galaxy S24 Ultra", "2024-01-31", ["12 GB"], ["256 GB", "512 GB", "1 TB"]],
    ["Galaxy S24+", "2024-01-31", ["12 GB"], ["256 GB", "512 GB"]],
    ["Galaxy S24", "2024-01-31", ["8 GB"], ["128 GB", "256 GB"]],
    ["Galaxy S23 Ultra", "2023-02-17", ["8 GB", "12 GB"], ["256 GB", "512 GB", "1 TB"]],
    ["Galaxy S23+", "2023-02-17", ["8 GB"], ["256 GB", "512 GB"]],
    ["Galaxy S23", "2023-02-17", ["8 GB"], ["128 GB", "256 GB"]],
    ["Galaxy S22 Ultra", "2022-02-25", ["8 GB", "12 GB"], ["128 GB", "256 GB", "512 GB", "1 TB"]],
    ["Galaxy S22+", "2022-02-25", ["8 GB"], ["128 GB", "256 GB"]],
    ["Galaxy S22", "2022-02-25", ["8 GB"], ["128 GB", "256 GB"]],
    ["Galaxy S21 Ultra 5G", "2021-01-29", ["12 GB", "16 GB"], ["128 GB", "256 GB", "512 GB"]],
    ["Galaxy S21+ 5G", "2021-01-29", ["8 GB"], ["128 GB", "256 GB"]],
    ["Galaxy S21 5G", "2021-01-29", ["8 GB"], ["128 GB", "256 GB"]],
    ["Galaxy S20 FE 5G", "2020-10-02", ["6 GB", "8 GB"], ["128 GB", "256 GB"]],
    ["Galaxy S20 Ultra 5G", "2020-03-13", ["12 GB", "16 GB"], ["128 GB", "512 GB"]],
    ["Galaxy S20+ 5G", "2020-03-13", ["12 GB"], ["128 GB", "512 GB"]],
    ["Galaxy S20 5G", "2020-03-13", ["12 GB"], ["128 GB"]],
    ["Galaxy Z Fold6", "2024-07-24", ["12 GB"], ["256 GB", "512 GB", "1 TB"]],
    ["Galaxy Z Flip6", "2024-07-24", ["12 GB"], ["256 GB", "512 GB"]],
    ["Galaxy Z Fold5", "2023-08-11", ["12 GB"], ["256 GB", "512 GB", "1 TB"]],
    ["Galaxy Z Flip5", "2023-08-11", ["8 GB"], ["256 GB", "512 GB"]],
    ["Galaxy A56 5G", "2025-03-19", ["8 GB", "12 GB"], ["128 GB", "256 GB"]],
    ["Galaxy A55 5G", "2024-03-15", ["8 GB", "12 GB"], ["128 GB", "256 GB"]],
    ["Galaxy A54 5G", "2023-03-24", ["8 GB"], ["128 GB", "256 GB"]],
    ["Galaxy A53 5G", "2022-03-25", ["6 GB", "8 GB"], ["128 GB", "256 GB"]],
    ["Galaxy A52s 5G", "2021-09-03", ["6 GB", "8 GB"], ["128 GB", "256 GB"]],
    ["Galaxy A36 5G", "2025-03-19", ["6 GB", "8 GB", "12 GB"], ["128 GB", "256 GB"]],
    ["Galaxy A35 5G", "2024-03-15", ["6 GB", "8 GB"], ["128 GB", "256 GB"]],
    ["Galaxy A34 5G", "2023-03-24", ["6 GB", "8 GB"], ["128 GB", "256 GB"]],
    ["Galaxy A16 5G", "2024-10-25", ["4 GB", "8 GB"], ["128 GB", "256 GB"]],
  ].map(([name, releasedOn, ram, storage]) =>
    model(
      "samsung",
      name as string,
      releasedOn as string,
      ram as string[],
      storage as string[],
      ANDROID_EXTENDED,
    ),
  ),

  ...[
    ["Pixel 9 Pro Fold", "2024-09-04", ["16 GB"], ["256 GB", "512 GB"]],
    ["Pixel 9 Pro XL", "2024-08-22", ["16 GB"], ["128 GB", "256 GB", "512 GB", "1 TB"]],
    ["Pixel 9 Pro", "2024-09-09", ["16 GB"], ["128 GB", "256 GB", "512 GB", "1 TB"]],
    ["Pixel 9", "2024-08-22", ["12 GB"], ["128 GB", "256 GB"]],
    ["Pixel 8a", "2024-05-14", ["8 GB"], ["128 GB", "256 GB"]],
    ["Pixel 8 Pro", "2023-10-12", ["12 GB"], ["128 GB", "256 GB", "512 GB"]],
    ["Pixel 8", "2023-10-12", ["8 GB"], ["128 GB", "256 GB"]],
    ["Pixel 7a", "2023-05-10", ["8 GB"], ["128 GB"]],
    ["Pixel 7 Pro", "2022-10-13", ["12 GB"], ["128 GB", "256 GB", "512 GB"]],
    ["Pixel 7", "2022-10-13", ["8 GB"], ["128 GB", "256 GB"]],
    ["Pixel 6a", "2022-07-28", ["6 GB"], ["128 GB"]],
    ["Pixel 6 Pro", "2021-10-28", ["12 GB"], ["128 GB", "256 GB"]],
    ["Pixel 6", "2021-10-28", ["8 GB"], ["128 GB", "256 GB"]],
    ["Pixel 5", "2020-10-15", ["8 GB"], ["128 GB"]],
    ["Pixel 4a", "2020-08-20", ["6 GB"], ["128 GB"]],
    ["Pixel 4 XL", "2019-10-24", ["6 GB"], ["64 GB", "128 GB"]],
    ["Pixel 4", "2019-10-24", ["6 GB"], ["64 GB", "128 GB"]],
    ["Pixel 3a XL", "2019-05-07", ["4 GB"], ["64 GB"]],
    ["Pixel 3a", "2019-05-07", ["4 GB"], ["64 GB"]],
  ].map(([name, releasedOn, ram, storage]) =>
    model(
      "google",
      name as string,
      releasedOn as string,
      ram as string[],
      storage as string[],
      ANDROID_CORE,
    ),
  ),

  ...[
    ["Xiaomi 15 Ultra", "2025-03-02", ["16 GB"], ["512 GB"]],
    ["Xiaomi 15", "2025-03-02", ["12 GB"], ["256 GB", "512 GB"]],
    ["Xiaomi 14 Ultra", "2024-03-19", ["16 GB"], ["512 GB"]],
    ["Xiaomi 14", "2024-03-19", ["12 GB"], ["256 GB", "512 GB"]],
    ["Xiaomi 13T Pro", "2023-09-26", ["12 GB", "16 GB"], ["256 GB", "512 GB", "1 TB"]],
    ["Xiaomi 13T", "2023-09-26", ["8 GB", "12 GB"], ["256 GB"]],
    ["Xiaomi 13 Pro", "2023-03-08", ["12 GB"], ["256 GB"]],
    ["Xiaomi 13", "2023-03-08", ["8 GB", "12 GB"], ["256 GB"]],
    ["Xiaomi 12T Pro", "2022-10-13", ["8 GB", "12 GB"], ["128 GB", "256 GB"]],
    ["Xiaomi 12T", "2022-10-13", ["8 GB"], ["128 GB", "256 GB"]],
    ["Xiaomi 12 Pro", "2022-03-15", ["8 GB", "12 GB"], ["256 GB"]],
    ["Xiaomi 12", "2022-03-15", ["8 GB"], ["128 GB", "256 GB"]],
    ["Mi 11 Ultra", "2021-05-03", ["12 GB"], ["256 GB"]],
    ["Mi 11", "2021-03-16", ["8 GB"], ["128 GB", "256 GB"]],
  ].map(([name, releasedOn, ram, storage]) =>
    model(
      "xiaomi",
      name as string,
      releasedOn as string,
      ram as string[],
      storage as string[],
      ANDROID_CORE,
    ),
  ),

  ...[
    ["Redmi Note 14 Pro+ 5G", "2025-01-15", ["8 GB", "12 GB"], ["256 GB", "512 GB"]],
    ["Redmi Note 14 Pro 5G", "2025-01-15", ["8 GB", "12 GB"], ["256 GB", "512 GB"]],
    ["Redmi Note 14 5G", "2025-01-15", ["6 GB", "8 GB"], ["128 GB", "256 GB"]],
    ["Redmi Note 13 Pro+ 5G", "2024-01-15", ["8 GB", "12 GB"], ["256 GB", "512 GB"]],
    ["Redmi Note 13 Pro 5G", "2024-01-15", ["8 GB", "12 GB"], ["256 GB", "512 GB"]],
    ["Redmi Note 13 5G", "2024-01-15", ["6 GB", "8 GB"], ["128 GB", "256 GB"]],
    ["Redmi Note 12 Pro+ 5G", "2023-03-23", ["8 GB"], ["256 GB"]],
    ["Redmi Note 12 Pro 5G", "2023-03-23", ["6 GB", "8 GB"], ["128 GB", "256 GB"]],
    ["Redmi Note 12 5G", "2023-03-23", ["4 GB", "6 GB", "8 GB"], ["128 GB", "256 GB"]],
    ["Redmi Note 11 Pro 5G", "2022-02-17", ["6 GB", "8 GB"], ["64 GB", "128 GB"]],
    ["Redmi Note 11", "2022-02-17", ["4 GB", "6 GB"], ["64 GB", "128 GB"]],
    ["Redmi Note 10 Pro", "2021-03-16", ["6 GB", "8 GB"], ["64 GB", "128 GB"]],
    ["Redmi Note 10 5G", "2021-05-25", ["4 GB", "6 GB"], ["64 GB", "128 GB"]],
    ["Redmi Note 9 Pro", "2020-05-05", ["6 GB"], ["64 GB", "128 GB"]],
    ["Redmi Note 9", "2020-05-12", ["3 GB", "4 GB"], ["64 GB", "128 GB"]],
  ].map(([name, releasedOn, ram, storage]) =>
    model(
      "redmi",
      name as string,
      releasedOn as string,
      ram as string[],
      storage as string[],
      ANDROID_EXTENDED,
    ),
  ),

  ...[
    ["POCO F6 Pro", "2024-05-23", ["12 GB", "16 GB"], ["256 GB", "512 GB", "1 TB"]],
    ["POCO F6", "2024-05-23", ["8 GB", "12 GB"], ["256 GB", "512 GB"]],
    ["POCO X6 Pro 5G", "2024-01-11", ["8 GB", "12 GB"], ["256 GB", "512 GB"]],
    ["POCO X6 5G", "2024-01-11", ["8 GB", "12 GB"], ["256 GB", "512 GB"]],
    ["POCO F5 Pro", "2023-05-09", ["8 GB", "12 GB"], ["256 GB", "512 GB"]],
    ["POCO F5", "2023-05-09", ["8 GB", "12 GB"], ["256 GB"]],
    ["POCO X5 Pro 5G", "2023-02-06", ["6 GB", "8 GB"], ["128 GB", "256 GB"]],
    ["POCO F4 GT", "2022-04-26", ["8 GB", "12 GB"], ["128 GB", "256 GB"]],
    ["POCO F3", "2021-03-22", ["6 GB", "8 GB"], ["128 GB", "256 GB"]],
  ].map(([name, releasedOn, ram, storage]) =>
    model(
      "poco",
      name as string,
      releasedOn as string,
      ram as string[],
      storage as string[],
      ANDROID_CORE,
    ),
  ),

  ...[
    ["Edge 50 Ultra", "2024-05-15", ["16 GB"], ["1 TB"]],
    ["Edge 50 Pro", "2024-04-16", ["12 GB"], ["512 GB"]],
    ["Edge 50 Fusion", "2024-05-15", ["8 GB", "12 GB"], ["256 GB", "512 GB"]],
    ["Razr 50 Ultra", "2024-07-04", ["12 GB"], ["512 GB"]],
    ["Razr 50", "2024-07-04", ["8 GB"], ["256 GB"]],
    ["Moto G85 5G", "2024-06-25", ["8 GB", "12 GB"], ["256 GB"]],
    ["Moto G84 5G", "2023-09-08", ["12 GB"], ["256 GB"]],
    ["Moto G54 5G", "2023-09-05", ["8 GB", "12 GB"], ["128 GB", "256 GB"]],
  ].map(([name, releasedOn, ram, storage]) =>
    model(
      "motorola",
      name as string,
      releasedOn as string,
      ram as string[],
      storage as string[],
      ANDROID_EXTENDED,
    ),
  ),

  ...[
    ["Find X8 Pro", "2024-11-21", ["16 GB"], ["512 GB"]],
    ["Reno12 Pro 5G", "2024-06-28", ["12 GB"], ["512 GB"]],
    ["Reno12 5G", "2024-06-28", ["12 GB"], ["256 GB"]],
    ["Reno11 F 5G", "2024-03-01", ["8 GB"], ["256 GB"]],
    ["Find N2 Flip", "2023-02-15", ["8 GB"], ["256 GB"]],
  ].map(([name, releasedOn, ram, storage]) =>
    model(
      "oppo",
      name as string,
      releasedOn as string,
      ram as string[],
      storage as string[],
      ANDROID_CORE,
    ),
  ),

  ...[
    ["OnePlus 13", "2025-01-07", ["12 GB", "16 GB"], ["256 GB", "512 GB"]],
    ["OnePlus 12", "2024-01-23", ["12 GB", "16 GB"], ["256 GB", "512 GB"]],
    ["OnePlus 11 5G", "2023-02-07", ["8 GB", "16 GB"], ["128 GB", "256 GB"]],
    ["OnePlus 10 Pro 5G", "2022-03-31", ["8 GB", "12 GB"], ["128 GB", "256 GB"]],
    ["OnePlus 9 Pro 5G", "2021-03-31", ["8 GB", "12 GB"], ["128 GB", "256 GB"]],
    ["Nord 4", "2024-08-08", ["12 GB", "16 GB"], ["256 GB", "512 GB"]],
    ["Nord 3 5G", "2023-07-12", ["8 GB", "16 GB"], ["128 GB", "256 GB"]],
    ["Nord 2T 5G", "2022-05-24", ["8 GB", "12 GB"], ["128 GB", "256 GB"]],
  ].map(([name, releasedOn, ram, storage]) =>
    model(
      "oneplus",
      name as string,
      releasedOn as string,
      ram as string[],
      storage as string[],
      ANDROID_CORE,
    ),
  ),

  ...[
    ["Magic7 Pro", "2025-01-15", ["12 GB"], ["512 GB"]],
    ["Magic6 Pro", "2024-02-25", ["12 GB"], ["512 GB"]],
    ["Magic5 Pro", "2023-04-19", ["12 GB"], ["512 GB"]],
    ["HONOR 200 Pro", "2024-06-12", ["12 GB"], ["512 GB"]],
    ["HONOR 200", "2024-06-12", ["12 GB"], ["512 GB"]],
    ["HONOR 90", "2023-07-06", ["12 GB"], ["512 GB"]],
    ["HONOR 70", "2022-09-02", ["8 GB"], ["128 GB", "256 GB"]],
  ].map(([name, releasedOn, ram, storage]) =>
    model(
      "honor",
      name as string,
      releasedOn as string,
      ram as string[],
      storage as string[],
      ANDROID_EXTENDED,
    ),
  ),

  ...[
    ["Pura 70 Ultra", "2024-05-02", ["16 GB"], ["512 GB"]],
    ["Pura 70 Pro", "2024-05-02", ["12 GB"], ["512 GB"]],
    ["P60 Pro", "2023-03-31", ["8 GB", "12 GB"], ["256 GB", "512 GB"]],
    ["P50 Pro", "2022-01-26", ["8 GB"], ["256 GB"]],
    ["Mate 50 Pro", "2022-09-28", ["8 GB"], ["256 GB", "512 GB"]],
    ["P40 Pro", "2020-04-07", ["8 GB"], ["256 GB"]],
    ["P30 Pro", "2019-03-26", ["8 GB"], ["128 GB", "256 GB", "512 GB"]],
  ].map(([name, releasedOn, ram, storage]) =>
    model(
      "huawei",
      name as string,
      releasedOn as string,
      ram as string[],
      storage as string[],
      ANDROID_CORE,
    ),
  ),

  ...[
    ["GT 7 Pro", "2024-11-26", ["12 GB"], ["256 GB", "512 GB"]],
    ["GT 6", "2024-06-20", ["8 GB", "12 GB", "16 GB"], ["256 GB", "512 GB"]],
    ["GT 5 Pro", "2023-05-15", ["12 GB", "16 GB"], ["256 GB", "512 GB", "1 TB"]],
    ["12 Pro+ 5G", "2024-01-29", ["8 GB", "12 GB"], ["128 GB", "256 GB"]],
    ["11 Pro 5G", "2023-06-20", ["8 GB"], ["128 GB", "256 GB"]],
  ].map(([name, releasedOn, ram, storage]) =>
    model(
      "realme",
      name as string,
      releasedOn as string,
      ram as string[],
      storage as string[],
      ANDROID_EXTENDED,
    ),
  ),

  ...[
    ["X200 Pro", "2025-01-10", ["16 GB"], ["512 GB"]],
    ["X100 Pro", "2024-02-15", ["16 GB"], ["512 GB"]],
    ["V40", "2024-09-26", ["12 GB"], ["512 GB"]],
    ["V30", "2024-02-29", ["12 GB"], ["512 GB"]],
  ].map(([name, releasedOn, ram, storage]) =>
    model(
      "vivo",
      name as string,
      releasedOn as string,
      ram as string[],
      storage as string[],
      ANDROID_CORE,
    ),
  ),

  model(
    "hmd",
    "HMD Skyline",
    "2024-07-19",
    ["8 GB", "12 GB"],
    ["128 GB", "256 GB"],
    ANDROID_EXTENDED,
  ),
  model("hmd", "Nokia XR21", "2023-05-03", ["6 GB"], ["128 GB"], ANDROID_CORE),
  model("hmd", "Nokia X30 5G", "2022-09-21", ["6 GB", "8 GB"], ["128 GB", "256 GB"], ANDROID_CORE),
  model("hmd", "Nokia G60 5G", "2022-09-01", ["4 GB", "6 GB"], ["64 GB", "128 GB"], ANDROID_CORE),

  model("sony", "Xperia 1 VI", "2024-06-06", ["12 GB"], ["256 GB"], ANDROID_CORE),
  model("sony", "Xperia 5 V", "2023-09-29", ["8 GB"], ["128 GB"], ANDROID_CORE),
  model("sony", "Xperia 10 VI", "2024-06-13", ["8 GB"], ["128 GB"], ANDROID_CORE),
  model("sony", "Xperia 1 V", "2023-06-29", ["12 GB"], ["256 GB"], ANDROID_CORE),

  model(
    "nothing",
    "Nothing Phone (3a) Pro",
    "2025-03-11",
    ["12 GB"],
    ["256 GB"],
    [COLORS.black, COLORS.grey],
  ),
  model(
    "nothing",
    "Nothing Phone (3a)",
    "2025-03-11",
    ["8 GB", "12 GB"],
    ["128 GB", "256 GB"],
    [COLORS.black, COLORS.white, COLORS.blue],
  ),
  model(
    "nothing",
    "Nothing Phone (2a)",
    "2024-03-12",
    ["8 GB", "12 GB"],
    ["128 GB", "256 GB"],
    [COLORS.black, COLORS.white],
  ),
  model(
    "nothing",
    "Nothing Phone (2)",
    "2023-07-17",
    ["8 GB", "12 GB"],
    ["128 GB", "256 GB", "512 GB"],
    [COLORS.black, COLORS.white],
  ),
  model(
    "nothing",
    "CMF Phone 1",
    "2024-07-08",
    ["8 GB"],
    ["128 GB", "256 GB"],
    [COLORS.black, COLORS.orange, COLORS.mint],
  ),

  model(
    "asus",
    "Zenfone 11 Ultra",
    "2024-04-14",
    ["12 GB", "16 GB"],
    ["256 GB", "512 GB"],
    ANDROID_CORE,
  ),
  model(
    "asus",
    "Zenfone 10",
    "2023-07-10",
    ["8 GB", "16 GB"],
    ["128 GB", "256 GB", "512 GB"],
    ANDROID_EXTENDED,
  ),
  model(
    "asus",
    "ROG Phone 9 Pro",
    "2024-11-19",
    ["16 GB", "24 GB"],
    ["512 GB", "1 TB"],
    [COLORS.black, COLORS.white],
  ),
  model(
    "asus",
    "ROG Phone 8 Pro",
    "2024-01-18",
    ["16 GB", "24 GB"],
    ["512 GB", "1 TB"],
    [COLORS.black],
  ),

  model(
    "fairphone",
    "Fairphone 5",
    "2023-08-30",
    ["8 GB"],
    ["256 GB"],
    [COLORS.black, COLORS.blue, COLORS.lightBlue],
  ),
  model(
    "fairphone",
    "Fairphone 4",
    "2021-10-25",
    ["6 GB", "8 GB"],
    ["128 GB", "256 GB"],
    [COLORS.grey, COLORS.green],
  ),

  model("tcl", "TCL 50 Pro NXTPAPER 5G", "2024-06-26", ["8 GB"], ["512 GB"], ANDROID_CORE),
  model("tcl", "TCL 50 5G", "2024-04-22", ["4 GB"], ["128 GB"], ANDROID_CORE),

  model(
    "zte",
    "nubia Z70 Ultra",
    "2024-11-26",
    ["12 GB", "16 GB", "24 GB"],
    ["256 GB", "512 GB", "1 TB"],
    [COLORS.black, COLORS.white, COLORS.gradientBlue],
  ),
  model(
    "zte",
    "nubia Flip 5G",
    "2024-04-23",
    ["8 GB"],
    ["256 GB"],
    [COLORS.black, COLORS.gold, COLORS.purple],
  ),
  model(
    "zte",
    "RedMagic 10 Pro",
    "2024-12-03",
    ["12 GB", "16 GB", "24 GB"],
    ["256 GB", "512 GB", "1 TB"],
    [COLORS.black, COLORS.white, COLORS.gradientBlue],
  ),
] as const;

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\s_-]+/g, " ");
}

export function getRollingTenYearCutoff(asOf: Date) {
  const targetYear = asOf.getUTCFullYear() - 10;
  const targetMonth = asOf.getUTCMonth();
  const targetDay = Math.min(
    asOf.getUTCDate(),
    new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate(),
  );
  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

export function isModelWithinRollingTenYears(model: EuPhoneModel, asOf = new Date()) {
  const releaseDate = new Date(`${model.releasedOn}T00:00:00.000Z`);
  const asOfEndOfDay = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate(), 23, 59, 59, 999),
  );
  return (
    Number.isFinite(releaseDate.getTime()) &&
    releaseDate >= getRollingTenYearCutoff(asOf) &&
    releaseDate <= asOfEndOfDay
  );
}

export function listCurrentEuPhoneModels(brandId: string, asOf = new Date()) {
  return EU_PHONE_MODELS.filter(
    (item) => item.brandId === brandId && isModelWithinRollingTenYears(item, asOf),
  ).sort((left, right) => right.releasedOn.localeCompare(left.releasedOn));
}

export function findEuPhoneBrand(value: string) {
  const needle = normalize(value);
  return EU_PHONE_BRANDS.find(
    (brand) =>
      normalize(brand.name) === needle ||
      brand.aliases?.some((alias) => normalize(alias) === needle),
  );
}

export function findEuPhoneModel(brandId: string, value: string, asOf = new Date()) {
  const needle = normalize(value);
  return listCurrentEuPhoneModels(brandId, asOf).find(
    (item) =>
      normalize(item.name) === needle || item.aliases?.some((alias) => normalize(alias) === needle),
  );
}

export function phoneColorBackground(colorOption: PhoneColorOption) {
  if (colorOption.swatches.length <= 1) return colorOption.swatches[0] ?? "transparent";
  return `linear-gradient(135deg, ${colorOption.swatches.join(", ")})`;
}
