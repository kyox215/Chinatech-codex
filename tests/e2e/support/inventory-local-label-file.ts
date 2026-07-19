import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import sharp from "sharp";

export const inventoryLocalImeiValue = "490154203237518";

export async function makeInventoryLocalLabelFile() {
  const qrSvg = renderToStaticMarkup(
    React.createElement(QRCodeSVG, {
      value: inventoryLocalImeiValue,
      size: 320,
      marginSize: 4,
      level: "H",
      bgColor: "#ffffff",
      fgColor: "#000000",
    }),
  );
  const qrPng = await sharp(Buffer.from(qrSvg)).png().toBuffer();
  const labelSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="820">
      <rect width="1200" height="820" fill="#ffffff"/>
      <g fill="#111111" font-family="Arial, Helvetica, sans-serif">
        <text x="70" y="110" font-size="72" font-weight="700">REDMI</text>
        <text x="70" y="215" font-size="58" font-weight="700">MODEL: A7 Pro</text>
        <text x="70" y="310" font-size="54">COLOR: Black</text>
        <text x="70" y="405" font-size="54">RAM: 4GB</text>
        <text x="70" y="500" font-size="54">STORAGE: 64GB</text>
        <text x="70" y="625" font-family="Courier New, monospace" font-size="48">IMEI1: ${inventoryLocalImeiValue}</text>
      </g>
    </svg>`;
  const labelPng = await sharp(Buffer.from(labelSvg))
    .composite([{ input: qrPng, left: 820, top: 420 }])
    .png()
    .toBuffer();

  return {
    name: "synthetic-inventory-local-label.png",
    mimeType: "image/png",
    buffer: labelPng,
  };
}
