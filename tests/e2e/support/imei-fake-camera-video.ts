import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import sharp from "sharp";

export const fakeCameraImeiValue = "490154203237518";
export const fakeCameraVideoPath = join(tmpdir(), "repairdesk-imei-qr-camera-v3.y4m");

const videoWidth = 640;
const videoHeight = 480;
const frameCount = 120;

export async function ensureImeiFakeCameraVideo() {
  if (existsSync(fakeCameraVideoPath)) return fakeCameraVideoPath;

  mkdirSync(tmpdir(), { recursive: true });
  const qrSvg = renderToStaticMarkup(
    React.createElement(QRCodeSVG, {
      value: fakeCameraImeiValue,
      size: 240,
      marginSize: 4,
      level: "H",
      bgColor: "#ffffff",
      fgColor: "#000000",
    }),
  );
  const qrPng = await sharp(Buffer.from(qrSvg)).png().toBuffer();
  const rgbFrame = await sharp({
    create: {
      width: videoWidth,
      height: videoHeight,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite([{ input: qrPng, left: 200, top: 120 }])
    .removeAlpha()
    .raw()
    .toBuffer();

  const yuvFrame = rgbToI420(rgbFrame, videoWidth, videoHeight);
  const header = Buffer.from(`YUV4MPEG2 W${videoWidth} H${videoHeight} F30:1 Ip A1:1 C420jpeg\n`);
  const frames = Array.from({ length: frameCount }, () =>
    Buffer.concat([Buffer.from("FRAME\n"), yuvFrame]),
  );

  writeFileSync(fakeCameraVideoPath, Buffer.concat([header, ...frames]));
  return fakeCameraVideoPath;
}

function rgbToI420(rgb: Buffer, width: number, height: number) {
  const yPlane = Buffer.alloc(width * height);
  const uPlane = Buffer.alloc((width / 2) * (height / 2));
  const vPlane = Buffer.alloc((width / 2) * (height / 2));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 3;
      const r = rgb[index] ?? 255;
      const g = rgb[index + 1] ?? 255;
      const b = rgb[index + 2] ?? 255;
      yPlane[y * width + x] = clampYuv(0.257 * r + 0.504 * g + 0.098 * b + 16);
    }
  }

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      let uSum = 0;
      let vSum = 0;
      for (let dy = 0; dy < 2; dy += 1) {
        for (let dx = 0; dx < 2; dx += 1) {
          const index = ((y + dy) * width + (x + dx)) * 3;
          const r = rgb[index] ?? 255;
          const g = rgb[index + 1] ?? 255;
          const b = rgb[index + 2] ?? 255;
          uSum += -0.148 * r - 0.291 * g + 0.439 * b + 128;
          vSum += 0.439 * r - 0.368 * g - 0.071 * b + 128;
        }
      }
      const uvIndex = (y / 2) * (width / 2) + x / 2;
      uPlane[uvIndex] = clampYuv(uSum / 4);
      vPlane[uvIndex] = clampYuv(vSum / 4);
    }
  }

  return Buffer.concat([yPlane, uPlane, vPlane]);
}

function clampYuv(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
