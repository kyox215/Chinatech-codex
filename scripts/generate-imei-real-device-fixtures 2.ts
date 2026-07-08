import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import sharp from "sharp";

const outputDir = "screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures";
const cameraImei = "356938035643809";
const secondaryImei = "490154203237518";
const serial = "SN-TEST-20260708";

async function main() {
  mkdirSync(outputDir, { recursive: true });

  const qrOnlySvg = renderQrOnlySvg();
  const labelSvg = renderLabelSvg(qrOnlySvg);
  const ocrOnlySvg = renderOcrOnlySvg();
  const html = renderHtml(labelSvg, ocrOnlySvg);

  writeFileSync(join(outputDir, "imei-camera-qr.svg"), qrOnlySvg);
  writeFileSync(join(outputDir, "imei-multi-candidate-label.svg"), labelSvg);
  writeFileSync(join(outputDir, "imei-ocr-text-label.svg"), ocrOnlySvg);
  writeFileSync(join(outputDir, "imei-real-device-labels.html"), html);

  await sharp(Buffer.from(labelSvg))
    .png()
    .toFile(join(outputDir, "imei-multi-candidate-label.png"));
  await sharp(Buffer.from(ocrOnlySvg)).png().toFile(join(outputDir, "imei-ocr-text-label.png"));

  console.log(`Generated IMEI real-device fixtures in ${outputDir}`);
}

function renderQrOnlySvg() {
  return renderToStaticMarkup(
    React.createElement(QRCodeSVG, {
      value: cameraImei,
      size: 420,
      marginSize: 4,
      level: "H",
      bgColor: "#ffffff",
      fgColor: "#000000",
    }),
  );
}

function renderLabelSvg(qrSvg: string) {
  const qrBody = stripSvgShell(qrSvg);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100" viewBox="0 0 900 1100">
  <rect width="900" height="1100" fill="#ffffff"/>
  <text x="60" y="90" fill="#111111" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="700">RepairDesk IMEI Test Label</text>
  <text x="60" y="145" fill="#333333" font-family="Arial, Helvetica, sans-serif" font-size="24">Use this for real camera, gallery upload, and multi-candidate checks.</text>
  <g transform="translate(285 190) scale(10)">${qrBody}</g>
  <text x="60" y="690" fill="#111111" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700">Camera QR value</text>
  <text x="60" y="745" fill="#111111" font-family="Courier New, monospace" font-size="46">${cameraImei}</text>
  <text x="60" y="835" fill="#111111" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700">OCR / gallery candidates</text>
  <text x="60" y="890" fill="#111111" font-family="Courier New, monospace" font-size="42">IMEI ${secondaryImei}</text>
  <text x="60" y="950" fill="#111111" font-family="Courier New, monospace" font-size="42">IMEI ${cameraImei}</text>
  <text x="60" y="1010" fill="#111111" font-family="Courier New, monospace" font-size="36">SERIAL ${serial}</text>
</svg>`;
}

function renderOcrOnlySvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700">
  <rect width="900" height="700" fill="#ffffff"/>
  <text x="60" y="90" fill="#111111" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700">Plain Numeric OCR Test</text>
  <text x="60" y="170" fill="#111111" font-family="Courier New, monospace" font-size="54">IMEI ${secondaryImei}</text>
  <text x="60" y="260" fill="#111111" font-family="Courier New, monospace" font-size="54">IMEI ${cameraImei}</text>
  <text x="60" y="350" fill="#111111" font-family="Courier New, monospace" font-size="44">SERIAL ${serial}</text>
  <text x="60" y="455" fill="#333333" font-family="Arial, Helvetica, sans-serif" font-size="28">Use as uploaded/captured gallery image. Browsers without native TextDetector should fall back safely.</text>
</svg>`;
}

function renderHtml(labelSvg: string, ocrOnlySvg: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RepairDesk IMEI Real Device Labels</title>
    <style>
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #f4f4f5; color: #111; }
      main { max-width: 980px; margin: 0 auto; padding: 24px; }
      section { margin-bottom: 24px; padding: 18px; background: #fff; border: 1px solid #d4d4d8; border-radius: 8px; }
      svg { width: 100%; height: auto; display: block; background: #fff; }
      code { font-family: "Courier New", monospace; font-weight: 700; }
      ul { line-height: 1.55; }
    </style>
  </head>
  <body>
    <main>
      <h1>RepairDesk IMEI Real Device Labels</h1>
      <ul>
        <li>Camera QR expected value: <code>${cameraImei}</code></li>
        <li>Gallery/OCR should show candidates: <code>${secondaryImei}</code> and <code>${cameraImei}</code></li>
        <li>Do not use production customer data while recording evidence.</li>
      </ul>
      <section>${labelSvg}</section>
      <section>${ocrOnlySvg}</section>
    </main>
  </body>
</html>`;
}

function stripSvgShell(svg: string) {
  return svg
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "")
    .trim();
}

await main();
