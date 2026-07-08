import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import sharp from "sharp";

export const uploadQrImeiValue = "356938035643809";

export async function makeImeiQrImageFile(value = uploadQrImeiValue) {
  const qrSvg = renderToStaticMarkup(
    React.createElement(QRCodeSVG, {
      value,
      size: 420,
      marginSize: 4,
      level: "H",
      bgColor: "#ffffff",
      fgColor: "#000000",
    }),
  );
  const qrPng = await sharp(Buffer.from(qrSvg)).png().toBuffer();
  const labelPng = await sharp({
    create: {
      width: 760,
      height: 760,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite([{ input: qrPng, left: 170, top: 120 }])
    .png()
    .toBuffer();

  return {
    name: "imei-real-qr.png",
    mimeType: "image/png",
    buffer: labelPng,
  };
}
