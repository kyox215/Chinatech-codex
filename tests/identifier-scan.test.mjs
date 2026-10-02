import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import zxing from "@zxing/library";

const compiled = ts.transpileModule(readFileSync(new URL("../lib/identifier-scan.ts", import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { identifierScanValue } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("SN 保留识别原值，去首尾空白并拒绝网址与不可信内容", () => {
  assert.deepEqual(identifierScanValue(" demo-SN_001.2 ", "serial"), { value: "demo-SN_001.2", error: null });
  for (const raw of ["", "https://example.invalid/sn", "www.example.invalid", "//example.invalid", "/app/retail/units/123", "javascript:alert(1)", "mailto:x@example.invalid", "user@example.invalid", "<script>", "SN\n001", "x".repeat(151)]) {
    assert.equal(identifierScanValue(raw, "serial").value, null, raw);
  }
});

test("IMEI 确认格式只接受 15 位数字，不要求虚构数据通过 Luhn", () => {
  assert.deepEqual(identifierScanValue(" 000-000000000101 ", "imei"), { value: "000000000000101", error: null });
  for (const raw of ["12345", "0000000000001012", "00000000000010A", "IMEI 000000000000101", "https://000000000000101"]) assert.equal(identifierScanValue(raw, "imei").value, null, raw);
});

test("混合设备标识接受 SN 或 IMEI，仅产生待确认字段值", () => {
  assert.deepEqual(identifierScanValue("DEMO-MBA-0927", "serial-or-imei"), { value: "DEMO-MBA-0927", error: null });
  assert.deepEqual(identifierScanValue("000 000000000101", "serial-or-imei"), { value: "000000000000101", error: null });
});

test("实际 QR 解码结果经过设备标识校验，外链不能填入字段", () => {
  const { MultiFormatWriter, BarcodeFormat, RGBLuminanceSource, HybridBinarizer, BinaryBitmap, MultiFormatReader } = zxing;
  for (const raw of ["DEMO-SN-001", "000000000000101", "https://example.invalid/device"]) {
    const encoded = new MultiFormatWriter().encode(raw, BarcodeFormat.QR_CODE, 360, 360, new Map());
    const pixels = new Uint8ClampedArray(360 * 360);
    for (let y = 0; y < 360; y++) for (let x = 0; x < 360; x++) pixels[y * 360 + x] = encoded.get(x, y) ? 0 : 255;
    const decoded = new MultiFormatReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, 360, 360))));
    assert.equal(decoded.getText(), raw);
    const result = identifierScanValue(decoded.getText(), "serial-or-imei");
    assert.equal(result.value, raw.startsWith("https:") ? null : raw);
  }
});
