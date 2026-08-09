import { describe, expect, it } from "vitest";

import {
  DEVICE_CATALOG_MODELS,
  findDeviceCatalogBrand,
  findDeviceCatalogModel,
  listDeviceCatalogBrands,
  listDeviceCatalogModels,
  listDeviceCatalogModelsBySeries,
} from "./device-catalog";

describe("inventory device catalog", () => {
  it("reuses the existing European phone catalog and keeps canonical ids unique", () => {
    expect(
      DEVICE_CATALOG_MODELS.filter((item) => item.category === "phone").length,
    ).toBeGreaterThan(150);
    expect(new Set(DEVICE_CATALOG_MODELS.map((item) => item.id)).size).toBe(
      DEVICE_CATALOG_MODELS.length,
    );
    expect(findDeviceCatalogModel("phone", "Apple", "iPhone SE 2022")?.name).toBe(
      "iPhone SE (3rd generation)",
    );
  });

  it("covers the common game-console brands, aliases and model variants", () => {
    expect(findDeviceCatalogBrand("game_console", "PS")?.id).toBe("sony-playstation");
    expect(findDeviceCatalogBrand("game_console", "Switch")?.id).toBe("nintendo");
    expect(findDeviceCatalogBrand("game_console", "Xbox")?.id).toBe("microsoft-xbox");
    const consoleBrands = listDeviceCatalogBrands("game_console");
    expect(
      consoleBrands
        .filter((item) => item.name === "Sony" || item.aliases?.includes("Sony"))
        .map((item) => item.name),
    ).toEqual(["Sony / PlayStation"]);
    expect(
      consoleBrands.every((item) => listDeviceCatalogModels("game_console", item.name).length > 0),
    ).toBe(true);

    const playstation = listDeviceCatalogModels("game_console", "PlayStation");
    expect(playstation.map((item) => item.name)).toEqual(
      expect.arrayContaining([
        "PS3",
        "PS3 Slim",
        "PS3 Super Slim",
        "PS4 Slim",
        "PS4 Pro",
        "PS5 光驱版",
        "PS5 数字版",
        "PS5 Pro",
      ]),
    );
    expect(findDeviceCatalogModel("game_console", "PlayStation", "PS3")?.name).toBe("PS3");
    expect(findDeviceCatalogModel("game_console", "PlayStation", "PlayStation 3")?.name).toBe(
      "PS3",
    );
    expect(findDeviceCatalogModel("game_console", "PlayStation", "PS3 Slim")?.name).toBe(
      "PS3 Slim",
    );
    expect(findDeviceCatalogModel("game_console", "Nintendo", "Switch OLED")?.name).toBe(
      "Nintendo Switch OLED Model",
    );
    expect(
      findDeviceCatalogModel("game_console", "Valve", "Steam Deck OLED")?.storageOptions,
    ).toEqual(["512 GB", "1 TB"]);
  });

  it("filters brands by category and groups models by series", () => {
    expect(listDeviceCatalogBrands("tablet").map((item) => item.name)).toEqual(
      expect.arrayContaining(["Apple", "Samsung", "Lenovo"]),
    );
    expect(listDeviceCatalogBrands("computer").map((item) => item.name)).toEqual(
      expect.arrayContaining(["Apple", "Dell", "Lenovo"]),
    );
    expect(
      listDeviceCatalogModelsBySeries(listDeviceCatalogModels("game_console", "Nintendo")).map(
        ([series]) => series,
      ),
    ).toEqual(expect.arrayContaining(["Nintendo Switch", "Nintendo 3DS", "Nintendo Wii"]));
  });
});
