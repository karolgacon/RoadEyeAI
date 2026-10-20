import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import type { BBox } from "@/types/satellite";

export type RgbaFrame = {
  width: number;
  height: number;
  /** RGBA interleaved 0–255 */
  data: Buffer | Uint8Array;
};

/** Decode PNG or JPEG bytes to RGBA. */
export function decodeRaster(buffer: Buffer): RgbaFrame {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50) {
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: png.data };
  }
  // JPEG
  const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
  return {
    width: decoded.width,
    height: decoded.height,
    data: Buffer.from(decoded.data),
  };
}

function lumaAt(frame: RgbaFrame, x: number, y: number): number {
  const i = (y * frame.width + x) << 2;
  const d = frame.data;
  return (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
}

/**
 * Mean absolute Laplacian response — measures edge/high-frequency detail.
 * Soft upsampled Sentinel frames score very low; Esri HD scores high.
 */
export function laplacianSharpness(frame: RgbaFrame): number {
  const { width, height } = frame;
  if (width < 4 || height < 4) {
    return 0;
  }
  let sum = 0;
  let n = 0;
  // Stride 2 for speed on 1024²
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const c = lumaAt(frame, x, y);
      const lap =
        Math.abs(
          4 * c -
            lumaAt(frame, x - 1, y) -
            lumaAt(frame, x + 1, y) -
            lumaAt(frame, x, y - 1) -
            lumaAt(frame, x, y + 1),
        );
      sum += lap;
      n += 1;
    }
  }
  return n > 0 ? sum / n : 0;
}

/**
 * How much the Process API upsamples native Sentinel-2 (~10 m) into the frame.
 * >~2.5× usually looks soft / unusable for pavement Vision.
 */
export function upsampleFactor(
  bbox: BBox,
  imageWidth: number,
  nativeMetersPerPixel = 10,
): number {
  const [west, south, east, north] = bbox;
  const midLat = (south + north) / 2;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  const widthM = (east - west) * mPerDegLng;
  const heightM = (north - south) * mPerDegLat;
  const spanM = Math.max(widthM, heightM);
  const nativePixels = Math.max(1, spanM / nativeMetersPerPixel);
  return imageWidth / nativePixels;
}

export function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) {
    return null;
  }
  try {
    return Buffer.from(m[2], "base64");
  } catch {
    return null;
  }
}
