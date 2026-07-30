import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("order scanner component boundary", () => {
  it("keeps order management off the generic scan-search intent", () => {
    const orderList = source("src/features/orders/screens/order-list-screen.tsx");
    expect(orderList).toContain("OrderQrScannerButton");
    expect(orderList).not.toContain("ScanSearchButton");
    expect(orderList).not.toContain("consumeScanSearchIntent");
    expect(orderList).not.toContain("subscribeScanSearchIntent");
  });

  it("keeps the order QR component independent from IMEI recognition", () => {
    const orderScanner = source("src/features/orders/components/order-qr-scanner.tsx");
    expect(orderScanner).toContain('scanMode="qr-only"');
    expect(orderScanner).not.toMatch(/imei-scanner-field|imei-candidates/i);
  });
});
