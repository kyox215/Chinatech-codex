import {
  EU_PHONE_BRANDS,
  EU_PHONE_MODELS,
  type EuPhoneBrand,
  type EuPhoneModel,
  type PhoneColorOption,
} from "@/features/inventory/model/eu-phone-catalog";
import type { InventoryProductCategory } from "@/lib/repairdesk/types";

export type DeviceCatalogColor = PhoneColorOption;

export type DeviceCatalogBrand = {
  id: string;
  name: string;
  aliases?: readonly string[];
  categories: readonly InventoryProductCategory[];
};

export type DeviceCatalogModel = {
  id: string;
  category: InventoryProductCategory;
  brandId: string;
  name: string;
  series: string;
  releasedOn?: string;
  aliases?: readonly string[];
  ramOptions: readonly string[];
  storageOptions: readonly string[];
  colors: readonly DeviceCatalogColor[];
  priority: "common" | "standard";
};

const OTHER_BRANDS: readonly DeviceCatalogBrand[] = [
  brand("apple", "Apple", ["iPhone"], ["phone", "tablet", "computer", "other"]),
  brand("samsung", "Samsung", ["三星"], ["phone", "tablet", "computer", "other"]),
  brand("sony", "Sony", ["索尼", "Xperia"], ["phone", "tablet", "game_console", "other"]),
  brand("jbl", "JBL", [], ["other"]),
  brand("marshall", "Marshall", [], ["other"]),
  brand("logitech", "Logitech", ["罗技"], ["other"]),
  brand("anker", "Anker", [], ["other"]),
];

const TABLET_BRANDS: readonly DeviceCatalogBrand[] = [
  brand("apple", "Apple", ["iPad"], ["tablet"]),
  brand("samsung", "Samsung", ["Galaxy Tab", "三星"], ["tablet"]),
  brand("lenovo", "Lenovo", ["联想"], ["tablet", "computer"]),
  brand("huawei", "Huawei", ["华为", "MatePad"], ["tablet"]),
  brand("xiaomi", "Xiaomi", ["小米"], ["tablet"]),
  brand("microsoft", "Microsoft", ["Surface"], ["tablet", "computer"]),
  brand("amazon", "Amazon", ["Fire"], ["tablet"]),
  brand("google", "Google", ["Pixel"], ["tablet"]),
  brand("honor", "HONOR", ["荣耀"], ["tablet"]),
  brand("oppo", "OPPO", [], ["tablet"]),
  brand("oneplus", "OnePlus", [], ["tablet"]),
];

const COMPUTER_BRANDS: readonly DeviceCatalogBrand[] = [
  brand("apple", "Apple", ["Mac", "MacBook"], ["computer"]),
  brand("dell", "Dell", ["戴尔"], ["computer"]),
  brand("hp", "HP", ["惠普"], ["computer"]),
  brand("lenovo", "Lenovo", ["联想", "ThinkPad"], ["computer"]),
  brand("asus", "ASUS", ["华硕", "ROG"], ["computer"]),
  brand("acer", "Acer", ["宏碁"], ["computer"]),
  brand("msi", "MSI", ["微星"], ["computer"]),
  brand("microsoft", "Microsoft", ["Surface"], ["computer"]),
  brand("samsung", "Samsung", ["Galaxy Book"], ["computer"]),
];

const GAME_BRANDS: readonly DeviceCatalogBrand[] = [
  brand(
    "sony-playstation",
    "Sony / PlayStation",
    ["Sony", "PlayStation", "PS", "索尼"],
    ["game_console"],
  ),
  brand("nintendo", "Nintendo", ["任天堂", "Switch"], ["game_console"]),
  brand("microsoft-xbox", "Microsoft / Xbox", ["Microsoft", "Xbox"], ["game_console"]),
  brand("valve", "Valve", ["Steam Deck"], ["game_console"]),
  brand("asus-rog", "ASUS ROG", ["ROG Ally", "华硕"], ["game_console"]),
  brand("lenovo-legion", "Lenovo Legion", ["Legion Go", "联想"], ["game_console"]),
];

function brand(
  id: string,
  name: string,
  aliases: readonly string[],
  categories: readonly InventoryProductCategory[],
): DeviceCatalogBrand {
  return { id, name, ...(aliases.length ? { aliases } : {}), categories };
}

const COLORS = {
  black: color("black", "黑色", "#1d1d1f"),
  white: color("white", "白色", "#f5f5f0"),
  silver: color("silver", "银色", "#d8d9d6"),
  blue: color("blue", "蓝色", "#4776a8"),
  green: color("green", "绿色", "#4f6657"),
  grey: color("grey", "灰色", "#8c8d91"),
  purple: color("purple", "紫色", "#a79ab8"),
  red: color("red", "红色", "#b6242a"),
  yellow: color("yellow", "黄色", "#f2e36d"),
  neon: color("neon", "霓虹色", "#83e26b", "#8e7cff"),
} as const;

function color(id: string, name: string, ...swatches: string[]): DeviceCatalogColor {
  return { id, name, swatches };
}

function slug(value: string) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/\+/g, "-plus")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

function seedModel(
  category: InventoryProductCategory,
  brandId: string,
  name: string,
  series: string,
  options: Partial<
    Pick<
      DeviceCatalogModel,
      "releasedOn" | "aliases" | "ramOptions" | "storageOptions" | "colors" | "priority"
    >
  > = {},
): DeviceCatalogModel {
  return {
    id: `${category}-${brandId}-${slug(name)}`,
    category,
    brandId,
    name,
    series,
    ramOptions: options.ramOptions ?? [],
    storageOptions: options.storageOptions ?? [],
    colors: options.colors ?? [COLORS.black, COLORS.white],
    priority: options.priority ?? "standard",
    ...(options.releasedOn ? { releasedOn: options.releasedOn } : {}),
    ...(options.aliases?.length ? { aliases: options.aliases } : {}),
  };
}

function mapPhoneBrand(brand: EuPhoneBrand): DeviceCatalogBrand {
  return {
    id: brand.id,
    name: brand.name,
    aliases: brand.aliases,
    categories: ["phone"],
  };
}

function mapPhoneModel(model: EuPhoneModel): DeviceCatalogModel {
  const name = model.name;
  const series =
    name.match(
      /^(iPhone|Galaxy [A-Z]|Pixel|Xiaomi|Redmi|POCO|Edge|Razr|Find|Reno|OnePlus|Nord|Magic|Pura|Mate|GT|X\d+|V\d+|Xperia|Nothing|CMF|Zenfone|ROG Phone|Fairphone|TCL|nubia|RedMagic)/,
    )?.[0] ?? "其他系列";
  return {
    id: `phone-${model.id}`,
    category: "phone",
    brandId: model.brandId,
    name,
    series,
    releasedOn: model.releasedOn,
    aliases: model.aliases,
    ramOptions: model.ramOptions,
    storageOptions: model.storageOptions,
    colors: model.colors,
    priority: model.releasedOn >= "2022-01-01" ? "common" : "standard",
  };
}

const PHONE_BRANDS: readonly DeviceCatalogBrand[] = EU_PHONE_BRANDS.map(mapPhoneBrand);
const PHONE_MODELS: readonly DeviceCatalogModel[] = EU_PHONE_MODELS.map(mapPhoneModel);

const TABLET_MODELS: readonly DeviceCatalogModel[] = [
  seedModel("tablet", "apple", "iPad 10", "iPad", {
    releasedOn: "2022-10-26",
    storageOptions: ["64 GB", "256 GB"],
    priority: "common",
  }),
  seedModel("tablet", "apple", "iPad (A16)", "iPad", {
    releasedOn: "2025-03-12",
    storageOptions: ["128 GB", "256 GB", "512 GB"],
    priority: "common",
  }),
  seedModel("tablet", "apple", "iPad mini (A17 Pro)", "iPad mini", {
    releasedOn: "2024-10-23",
    storageOptions: ["128 GB", "256 GB", "512 GB"],
    priority: "common",
  }),
  seedModel("tablet", "apple", "iPad Air 5", "iPad Air", {
    releasedOn: "2022-03-18",
    storageOptions: ["64 GB", "256 GB"],
    priority: "common",
  }),
  seedModel("tablet", "apple", "iPad Air 11-inch (M2)", "iPad Air", {
    releasedOn: "2024-05-15",
    storageOptions: ["128 GB", "256 GB", "512 GB", "1 TB"],
    priority: "common",
  }),
  seedModel("tablet", "apple", "iPad Pro 11-inch (M4)", "iPad Pro", {
    releasedOn: "2024-05-15",
    storageOptions: ["256 GB", "512 GB", "1 TB", "2 TB"],
    priority: "common",
  }),
  seedModel("tablet", "apple", "iPad Pro 13-inch (M4)", "iPad Pro", {
    releasedOn: "2024-05-15",
    storageOptions: ["256 GB", "512 GB", "1 TB", "2 TB"],
    priority: "common",
  }),
  seedModel("tablet", "samsung", "Galaxy Tab S9", "Galaxy Tab S", {
    releasedOn: "2023-08-11",
    ramOptions: ["8 GB", "12 GB"],
    storageOptions: ["128 GB", "256 GB", "512 GB"],
    priority: "common",
  }),
  seedModel("tablet", "samsung", "Galaxy Tab S9 FE", "Galaxy Tab S", {
    releasedOn: "2023-10-05",
    ramOptions: ["6 GB", "8 GB"],
    storageOptions: ["128 GB", "256 GB"],
    priority: "common",
  }),
  seedModel("tablet", "samsung", "Galaxy Tab S10 Ultra", "Galaxy Tab S", {
    releasedOn: "2024-10-03",
    ramOptions: ["12 GB", "16 GB"],
    storageOptions: ["256 GB", "512 GB", "1 TB"],
    priority: "common",
  }),
  seedModel("tablet", "samsung", "Galaxy Tab A9", "Galaxy Tab A", {
    releasedOn: "2023-10-01",
    ramOptions: ["4 GB", "8 GB"],
    storageOptions: ["64 GB", "128 GB"],
    priority: "common",
  }),
  seedModel("tablet", "samsung", "Galaxy Tab A9+", "Galaxy Tab A", {
    releasedOn: "2023-10-01",
    ramOptions: ["4 GB", "8 GB"],
    storageOptions: ["64 GB", "128 GB"],
    priority: "common",
  }),
  seedModel("tablet", "samsung", "Galaxy Tab A8", "Galaxy Tab A", {
    releasedOn: "2022-01-04",
    ramOptions: ["3 GB", "4 GB"],
    storageOptions: ["32 GB", "64 GB", "128 GB"],
    priority: "standard",
  }),
  seedModel("tablet", "lenovo", "Tab M10 (3rd Gen)", "Tab M", {
    releasedOn: "2022-06-01",
    ramOptions: ["3 GB", "4 GB"],
    storageOptions: ["32 GB", "64 GB", "128 GB"],
    priority: "common",
  }),
  seedModel("tablet", "lenovo", "Tab P11 (2nd Gen)", "Tab P", {
    releasedOn: "2022-10-01",
    ramOptions: ["4 GB", "6 GB"],
    storageOptions: ["128 GB", "256 GB"],
    priority: "common",
  }),
  seedModel("tablet", "lenovo", "Tab P12", "Tab P", {
    releasedOn: "2023-08-01",
    ramOptions: ["4 GB", "8 GB"],
    storageOptions: ["128 GB", "256 GB"],
    priority: "common",
  }),
  seedModel("tablet", "huawei", "MatePad 11.5", "MatePad", {
    releasedOn: "2023-08-01",
    ramOptions: ["6 GB", "8 GB"],
    storageOptions: ["128 GB", "256 GB"],
    priority: "common",
  }),
  seedModel("tablet", "huawei", "MatePad Pro 13.2", "MatePad Pro", {
    releasedOn: "2023-12-08",
    ramOptions: ["12 GB", "16 GB"],
    storageOptions: ["256 GB", "512 GB", "1 TB"],
    priority: "standard",
  }),
  seedModel("tablet", "xiaomi", "Xiaomi Pad 6", "Xiaomi Pad", {
    releasedOn: "2023-07-01",
    ramOptions: ["6 GB", "8 GB"],
    storageOptions: ["128 GB", "256 GB"],
    priority: "common",
  }),
  seedModel("tablet", "xiaomi", "Redmi Pad SE", "Redmi Pad", {
    releasedOn: "2023-08-01",
    ramOptions: ["4 GB", "6 GB", "8 GB"],
    storageOptions: ["128 GB", "256 GB"],
    priority: "common",
  }),
  seedModel("tablet", "microsoft", "Surface Pro 9", "Surface Pro", {
    releasedOn: "2022-10-25",
    ramOptions: ["8 GB", "16 GB", "32 GB"],
    storageOptions: ["128 GB", "256 GB", "512 GB", "1 TB"],
    priority: "common",
  }),
  seedModel("tablet", "microsoft", "Surface Go 4", "Surface Go", {
    releasedOn: "2023-09-21",
    ramOptions: ["8 GB", "16 GB"],
    storageOptions: ["64 GB", "128 GB", "256 GB"],
    priority: "standard",
  }),
  seedModel("tablet", "amazon", "Fire HD 10", "Fire", {
    releasedOn: "2023-10-18",
    storageOptions: ["32 GB", "64 GB"],
    priority: "standard",
  }),
  seedModel("tablet", "amazon", "Fire Max 11", "Fire", {
    releasedOn: "2023-06-14",
    ramOptions: ["4 GB"],
    storageOptions: ["64 GB", "128 GB"],
    priority: "standard",
  }),
  seedModel("tablet", "google", "Pixel Tablet", "Pixel Tablet", {
    releasedOn: "2023-06-20",
    storageOptions: ["128 GB", "256 GB"],
    priority: "standard",
  }),
  seedModel("tablet", "honor", "HONOR Pad 9", "HONOR Pad", {
    releasedOn: "2024-02-01",
    ramOptions: ["8 GB", "12 GB"],
    storageOptions: ["128 GB", "256 GB"],
    priority: "standard",
  }),
  seedModel("tablet", "oppo", "OPPO Pad 3 Pro", "OPPO Pad", {
    releasedOn: "2024-10-24",
    ramOptions: ["8 GB", "12 GB", "16 GB"],
    storageOptions: ["256 GB", "512 GB"],
    priority: "standard",
  }),
  seedModel("tablet", "oneplus", "OnePlus Pad 2", "OnePlus Pad", {
    releasedOn: "2024-07-16",
    ramOptions: ["8 GB", "12 GB"],
    storageOptions: ["128 GB", "256 GB"],
    priority: "standard",
  }),
];

const COMPUTER_MODELS: readonly DeviceCatalogModel[] = [
  seedModel("computer", "apple", "MacBook Air", "MacBook", {
    priority: "common",
    aliases: ["MacBook Air M1", "MacBook Air M2", "MacBook Air M3", "MacBook Air M4"],
  }),
  seedModel("computer", "apple", "MacBook Pro", "MacBook", {
    priority: "common",
    aliases: ["MacBook Pro M1", "MacBook Pro M2", "MacBook Pro M3", "MacBook Pro M4"],
  }),
  seedModel("computer", "apple", "iMac", "iMac", { priority: "common" }),
  seedModel("computer", "apple", "Mac mini", "Mac", { priority: "common" }),
  seedModel("computer", "apple", "Mac Studio", "Mac", { priority: "standard" }),
  seedModel("computer", "dell", "XPS", "XPS", { priority: "common" }),
  seedModel("computer", "dell", "Inspiron", "Inspiron", { priority: "common" }),
  seedModel("computer", "dell", "Latitude", "Latitude", { priority: "common" }),
  seedModel("computer", "dell", "Precision", "Precision", { priority: "standard" }),
  seedModel("computer", "dell", "Alienware", "Alienware", { priority: "standard" }),
  seedModel("computer", "hp", "OmniBook", "OmniBook", { priority: "common" }),
  seedModel("computer", "hp", "EliteBook", "EliteBook", { priority: "common" }),
  seedModel("computer", "hp", "ProBook", "ProBook", { priority: "common" }),
  seedModel("computer", "hp", "Pavilion", "Pavilion", { priority: "common" }),
  seedModel("computer", "hp", "Envy", "Envy", { priority: "standard" }),
  seedModel("computer", "hp", "Victus", "Victus", { priority: "common" }),
  seedModel("computer", "hp", "OMEN", "OMEN", { priority: "standard" }),
  seedModel("computer", "lenovo", "ThinkPad", "ThinkPad", { priority: "common" }),
  seedModel("computer", "lenovo", "ThinkBook", "ThinkBook", { priority: "common" }),
  seedModel("computer", "lenovo", "IdeaPad", "IdeaPad", { priority: "common" }),
  seedModel("computer", "lenovo", "Yoga", "Yoga", { priority: "common" }),
  seedModel("computer", "lenovo", "Legion", "Legion", { priority: "common" }),
  seedModel("computer", "lenovo", "LOQ", "LOQ", { priority: "common" }),
  seedModel("computer", "asus", "Zenbook", "Zenbook", { priority: "common" }),
  seedModel("computer", "asus", "Vivobook", "Vivobook", { priority: "common" }),
  seedModel("computer", "asus", "ROG", "ROG", { priority: "common" }),
  seedModel("computer", "asus", "TUF Gaming", "TUF Gaming", { priority: "common" }),
  seedModel("computer", "acer", "Aspire", "Aspire", { priority: "common" }),
  seedModel("computer", "acer", "Swift", "Swift", { priority: "common" }),
  seedModel("computer", "acer", "Nitro", "Nitro", { priority: "common" }),
  seedModel("computer", "acer", "Predator", "Predator", { priority: "standard" }),
  seedModel("computer", "msi", "Modern", "Modern", { priority: "common" }),
  seedModel("computer", "msi", "Prestige", "Prestige", { priority: "standard" }),
  seedModel("computer", "msi", "Katana", "Katana", { priority: "common" }),
  seedModel("computer", "msi", "Stealth", "Stealth", { priority: "standard" }),
  seedModel("computer", "microsoft", "Surface Laptop", "Surface Laptop", { priority: "common" }),
  seedModel("computer", "microsoft", "Surface Pro", "Surface Pro", { priority: "common" }),
  seedModel("computer", "microsoft", "Surface Laptop Studio", "Surface", { priority: "standard" }),
  seedModel("computer", "samsung", "Galaxy Book", "Galaxy Book", { priority: "standard" }),
];

const GAME_MODELS: readonly DeviceCatalogModel[] = [
  seedModel("game_console", "sony-playstation", "PS5 光驱版", "PlayStation 5", {
    aliases: ["PS5 Disc", "PlayStation 5 Disc Edition"],
    storageOptions: ["825 GB", "1 TB"],
    priority: "common",
  }),
  seedModel("game_console", "sony-playstation", "PS5 数字版", "PlayStation 5", {
    aliases: ["PS5 Digital", "PlayStation 5 Digital Edition"],
    storageOptions: ["825 GB", "1 TB"],
    priority: "common",
  }),
  seedModel("game_console", "sony-playstation", "PS5 Slim 光驱版", "PlayStation 5", {
    aliases: ["PS5 Slim Disc"],
    storageOptions: ["1 TB"],
    priority: "common",
  }),
  seedModel("game_console", "sony-playstation", "PS5 Slim 数字版", "PlayStation 5", {
    aliases: ["PS5 Slim Digital"],
    storageOptions: ["1 TB"],
    priority: "common",
  }),
  seedModel("game_console", "sony-playstation", "PS5 Pro", "PlayStation 5", {
    storageOptions: ["2 TB"],
    priority: "common",
  }),
  seedModel("game_console", "sony-playstation", "PS4", "PlayStation 4", {
    aliases: ["PS4 Original"],
    storageOptions: ["500 GB", "1 TB"],
    priority: "common",
  }),
  seedModel("game_console", "sony-playstation", "PS4 Slim", "PlayStation 4", {
    storageOptions: ["500 GB", "1 TB"],
    priority: "common",
  }),
  seedModel("game_console", "sony-playstation", "PS4 Pro", "PlayStation 4", {
    storageOptions: ["1 TB", "2 TB"],
    priority: "common",
  }),
  seedModel("game_console", "sony-playstation", "PS3 Slim", "PlayStation 3", {
    storageOptions: ["120 GB", "250 GB", "320 GB"],
    priority: "standard",
  }),
  seedModel("game_console", "sony-playstation", "PS3", "PlayStation 3", {
    aliases: ["PlayStation 3", "PS3 Original"],
    storageOptions: ["20 GB", "40 GB", "60 GB", "80 GB", "160 GB", "320 GB"],
    priority: "standard",
  }),
  seedModel("game_console", "sony-playstation", "PS3 Super Slim", "PlayStation 3", {
    storageOptions: ["12 GB", "250 GB", "500 GB"],
    priority: "standard",
  }),
  seedModel("game_console", "nintendo", "Nintendo Switch", "Nintendo Switch", {
    aliases: ["Switch"],
    storageOptions: ["32 GB"],
    priority: "common",
  }),
  seedModel("game_console", "nintendo", "Nintendo Switch 续航改良版", "Nintendo Switch", {
    aliases: ["Switch V2", "Switch 2019"],
    storageOptions: ["32 GB"],
    priority: "common",
  }),
  seedModel("game_console", "nintendo", "Nintendo Switch Lite", "Nintendo Switch", {
    aliases: ["Switch Lite"],
    storageOptions: ["32 GB"],
    priority: "common",
  }),
  seedModel("game_console", "nintendo", "Nintendo Switch OLED Model", "Nintendo Switch", {
    aliases: ["Switch OLED", "Switch OLED Model"],
    storageOptions: ["64 GB"],
    priority: "common",
  }),
  seedModel("game_console", "nintendo", "Nintendo Switch 2", "Nintendo Switch 2", {
    aliases: ["Switch 2"],
    storageOptions: ["256 GB"],
    priority: "common",
  }),
  seedModel("game_console", "nintendo", "Nintendo 3DS", "Nintendo 3DS", {
    storageOptions: ["2 GB"],
    priority: "standard",
  }),
  seedModel("game_console", "nintendo", "New Nintendo 3DS XL", "Nintendo 3DS", {
    aliases: ["New 3DS XL"],
    storageOptions: ["4 GB"],
    priority: "standard",
  }),
  seedModel("game_console", "nintendo", "Nintendo 2DS", "Nintendo 2DS", { priority: "standard" }),
  seedModel("game_console", "nintendo", "New Nintendo 2DS XL", "Nintendo 2DS", {
    aliases: ["New 2DS XL"],
    priority: "standard",
  }),
  seedModel("game_console", "nintendo", "Wii", "Nintendo Wii", { priority: "standard" }),
  seedModel("game_console", "nintendo", "Wii U", "Nintendo Wii U", { priority: "standard" }),
  seedModel("game_console", "microsoft-xbox", "Xbox Series X", "Xbox Series", {
    storageOptions: ["1 TB"],
    priority: "common",
  }),
  seedModel("game_console", "microsoft-xbox", "Xbox Series S", "Xbox Series", {
    storageOptions: ["512 GB", "1 TB"],
    priority: "common",
  }),
  seedModel("game_console", "microsoft-xbox", "Xbox One", "Xbox One", {
    storageOptions: ["500 GB", "1 TB"],
    priority: "standard",
  }),
  seedModel("game_console", "microsoft-xbox", "Xbox One S", "Xbox One", {
    storageOptions: ["500 GB", "1 TB", "2 TB"],
    priority: "standard",
  }),
  seedModel("game_console", "microsoft-xbox", "Xbox One X", "Xbox One", {
    storageOptions: ["1 TB"],
    priority: "standard",
  }),
  seedModel("game_console", "microsoft-xbox", "Xbox 360", "Xbox 360", {
    storageOptions: ["4 GB", "250 GB", "500 GB"],
    priority: "standard",
  }),
  seedModel("game_console", "microsoft-xbox", "Xbox 360 S", "Xbox 360", {
    storageOptions: ["4 GB", "250 GB", "320 GB"],
    priority: "standard",
  }),
  seedModel("game_console", "microsoft-xbox", "Xbox 360 E", "Xbox 360", {
    storageOptions: ["4 GB", "250 GB", "500 GB"],
    priority: "standard",
  }),
  seedModel("game_console", "valve", "Steam Deck LCD", "Steam Deck", {
    aliases: ["Steam Deck 64GB", "Steam Deck 256GB LCD", "Steam Deck 512GB LCD"],
    storageOptions: ["64 GB", "256 GB", "512 GB"],
    priority: "common",
  }),
  seedModel("game_console", "valve", "Steam Deck OLED", "Steam Deck", {
    aliases: ["Steam Deck 512GB OLED", "Steam Deck 1TB OLED"],
    storageOptions: ["512 GB", "1 TB"],
    priority: "common",
  }),
  seedModel("game_console", "asus-rog", "ROG Ally", "ROG Ally", {
    aliases: ["ASUS ROG Ally"],
    storageOptions: ["512 GB"],
    priority: "common",
  }),
  seedModel("game_console", "asus-rog", "ROG Ally X", "ROG Ally", {
    aliases: ["ASUS ROG Ally X"],
    storageOptions: ["1 TB"],
    priority: "common",
  }),
  seedModel("game_console", "lenovo-legion", "Legion Go", "Legion Go", {
    aliases: ["Lenovo Legion Go"],
    storageOptions: ["512 GB", "1 TB"],
    priority: "common",
  }),
  seedModel("game_console", "lenovo-legion", "Legion Go S", "Legion Go", {
    storageOptions: ["512 GB", "1 TB"],
    priority: "standard",
  }),
];

const allCatalogBrands: readonly DeviceCatalogBrand[] = [
  ...PHONE_BRANDS,
  ...TABLET_BRANDS,
  ...COMPUTER_BRANDS,
  ...GAME_BRANDS,
  ...OTHER_BRANDS,
];

const catalogBrandMap = new Map<string, DeviceCatalogBrand>();
for (const item of allCatalogBrands) {
  const key = `${item.id}:${item.name}`;
  const existing = catalogBrandMap.get(key);
  if (!existing) {
    catalogBrandMap.set(key, item);
    continue;
  }
  catalogBrandMap.set(key, {
    ...existing,
    aliases: [...new Set([...(existing.aliases ?? []), ...(item.aliases ?? [])])],
    categories: [...new Set([...existing.categories, ...item.categories])],
  });
}

export const DEVICE_CATALOG_BRANDS: readonly DeviceCatalogBrand[] = [...catalogBrandMap.values()];

export const DEVICE_CATALOG_MODELS: readonly DeviceCatalogModel[] = [
  ...PHONE_MODELS,
  ...TABLET_MODELS,
  ...COMPUTER_MODELS,
  ...GAME_MODELS,
];

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\s_\-/]+/g, " ");

export function listDeviceCatalogBrands(category: InventoryProductCategory) {
  const brands = DEVICE_CATALOG_BRANDS.filter((item) => item.categories.includes(category));
  return brands.sort((left, right) =>
    left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
  );
}

export function listDeviceCatalogModels(category: InventoryProductCategory, brandValue: string) {
  const brand = findDeviceCatalogBrand(category, brandValue);
  if (!brand) return [];
  return DEVICE_CATALOG_MODELS.filter(
    (item) => item.category === category && item.brandId === brand.id,
  ).sort((left, right) => {
    if (left.priority !== right.priority) return left.priority === "common" ? -1 : 1;
    return (
      (right.releasedOn ?? "").localeCompare(left.releasedOn ?? "") ||
      left.name.localeCompare(right.name, "en")
    );
  });
}

export function findDeviceCatalogBrand(category: InventoryProductCategory, value: string) {
  const needle = normalize(value);
  if (!needle) return undefined;
  return listDeviceCatalogBrands(category).find(
    (item) =>
      normalize(item.name) === needle || item.aliases?.some((alias) => normalize(alias) === needle),
  );
}

export function findDeviceCatalogModel(
  category: InventoryProductCategory,
  brandValue: string,
  value: string,
) {
  const needle = normalize(value);
  if (!needle) return undefined;
  return listDeviceCatalogModels(category, brandValue).find(
    (item) =>
      normalize(item.name) === needle || item.aliases?.some((alias) => normalize(alias) === needle),
  );
}

export function listDeviceCatalogModelsBySeries(models: readonly DeviceCatalogModel[]) {
  const groups = new Map<string, DeviceCatalogModel[]>();
  for (const model of models) {
    const current = groups.get(model.series);
    if (current) current.push(model);
    else groups.set(model.series, [model]);
  }
  return [...groups.entries()];
}
