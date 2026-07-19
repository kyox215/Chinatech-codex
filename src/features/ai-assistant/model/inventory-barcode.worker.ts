import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";

type BarcodeWorkerRequest = {
  id: string;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

type BarcodeWorkerResponse = {
  id: string;
  values: string[];
};

type BarcodeWorkerScope = {
  onmessage: ((event: MessageEvent<BarcodeWorkerRequest>) => void) | null;
  postMessage: (message: BarcodeWorkerResponse) => void;
};

const workerScope = self as unknown as BarcodeWorkerScope;
const formats = [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
];

workerScope.onmessage = ({ data }) => {
  const values = decodeBarcodeRegions(data.pixels, data.width, data.height);
  workerScope.postMessage({ id: data.id, values });
};

function decodeBarcodeRegions(pixels: Uint8ClampedArray, width: number, height: number) {
  const source = new RGBLuminanceSource(pixels, width, height);
  const reader = new MultiFormatReader();
  const hints = new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, formats],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  const values: string[] = [];

  for (const region of buildRegions(width, height)) {
    try {
      const regionSource = source.crop(region.x, region.y, region.width, region.height);
      const bitmap = new BinaryBitmap(new HybridBinarizer(regionSource));
      const value = reader.decode(bitmap, hints).getText().trim();
      if (value && !values.includes(value)) values.push(value.slice(0, 256));
    } catch {
      // Each region is best-effort. The worker returns every successfully decoded value.
    } finally {
      reader.reset();
    }
    if (values.length >= 8) break;
  }

  return values;
}

function buildRegions(width: number, height: number) {
  const regions = [{ x: 0, y: 0, width, height }];
  const halfHeight = Math.max(1, Math.round(height * 0.58));
  regions.push(
    { x: 0, y: 0, width, height: halfHeight },
    { x: 0, y: Math.max(0, height - halfHeight), width, height: halfHeight },
  );
  const stripHeight = Math.max(1, Math.round(height * 0.36));
  for (const ratio of [0.18, 0.42, 0.66]) {
    regions.push({
      x: 0,
      y: Math.max(0, Math.min(height - stripHeight, Math.round(height * ratio))),
      width,
      height: stripHeight,
    });
  }
  return regions;
}
