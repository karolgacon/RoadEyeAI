import { PNG } from "pngjs";
import jpeg from "jpeg-js";

/**
 * Downscale + JPEG-compress satellite frames before Gemini Vision.
 * 1024² PNG data-URLs often push Hobby functions past the 60s gateway.
 */
export function prepareImageForVision(params: {
  mimeType: string;
  base64: string;
  maxEdge?: number;
  jpegQuality?: number;
}): { mimeType: string; data: string } {
  const maxEdge = params.maxEdge ?? 768;
  const jpegQuality = params.jpegQuality ?? 72;
  const raw = Buffer.from(params.base64, "base64");

  let width: number;
  let height: number;
  let rgba: Buffer;

  try {
    if (
      params.mimeType.includes("png") ||
      (raw.length >= 8 && raw[0] === 0x89 && raw[1] === 0x50)
    ) {
      const png = PNG.sync.read(raw);
      width = png.width;
      height = png.height;
      rgba = Buffer.from(png.data);
    } else {
      const decoded = jpeg.decode(raw, { useTArray: true, formatAsRGBA: true });
      width = decoded.width;
      height = decoded.height;
      rgba = Buffer.from(decoded.data);
    }
  } catch {
    // If decode fails, send original (better than blocking analysis).
    return { mimeType: params.mimeType, data: params.base64 };
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  let outRgba: Buffer;
  if (outW === width && outH === height) {
    outRgba = rgba;
  } else {
    outRgba = Buffer.alloc(outW * outH * 4);
    for (let y = 0; y < outH; y += 1) {
      const srcY = Math.min(height - 1, Math.floor((y / outH) * height));
      for (let x = 0; x < outW; x += 1) {
        const srcX = Math.min(width - 1, Math.floor((x / outW) * width));
        const si = (srcY * width + srcX) << 2;
        const di = (y * outW + x) << 2;
        outRgba[di] = rgba[si];
        outRgba[di + 1] = rgba[si + 1];
        outRgba[di + 2] = rgba[si + 2];
        outRgba[di + 3] = 255;
      }
    }
  }

  const encoded = jpeg.encode(
    { data: outRgba, width: outW, height: outH },
    jpegQuality,
  );
  return {
    mimeType: "image/jpeg",
    data: Buffer.from(encoded.data).toString("base64"),
  };
}
