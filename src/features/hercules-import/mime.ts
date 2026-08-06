export type BinaryInspection = {
  mimeType: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

function jpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1]!;
    const length = buffer.readUInt16BE(offset + 2);
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      ) &&
      offset + 8 < buffer.length
    ) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    if (length < 2) {
      break;
    }
    offset += 2 + length;
  }
  return null;
}

export function inspectBinary(sample: Buffer): BinaryInspection {
  if (
    sample.length >= 24 &&
    sample.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return {
      mimeType: "image/png",
      width: sample.readUInt32BE(16),
      height: sample.readUInt32BE(20),
      durationMs: null,
    };
  }
  if (
    sample.length >= 10 &&
    (sample.subarray(0, 6).toString("ascii") === "GIF87a" ||
      sample.subarray(0, 6).toString("ascii") === "GIF89a")
  ) {
    return {
      mimeType: "image/gif",
      width: sample.readUInt16LE(6),
      height: sample.readUInt16LE(8),
      durationMs: null,
    };
  }
  if (sample.length >= 4 && sample[0] === 0xff && sample[1] === 0xd8) {
    const dimensions = jpegDimensions(sample);
    return {
      mimeType: "image/jpeg",
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      durationMs: null,
    };
  }
  if (
    sample.length >= 30 &&
    sample.subarray(0, 4).toString("ascii") === "RIFF" &&
    sample.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    const kind = sample.subarray(12, 16).toString("ascii");
    let width: number | null = null;
    let height: number | null = null;
    if (kind === "VP8X") {
      width = 1 + sample.readUIntLE(24, 3);
      height = 1 + sample.readUIntLE(27, 3);
    }
    return { mimeType: "image/webp", width, height, durationMs: null };
  }
  if (
    sample.length >= 12 &&
    sample.subarray(4, 8).toString("ascii") === "ftyp"
  ) {
    const brand = sample.subarray(8, 12).toString("ascii");
    const mimeType = ["avif", "avis"].includes(brand)
      ? "image/avif"
      : "video/mp4";
    return { mimeType, width: null, height: null, durationMs: null };
  }
  if (
    sample.length >= 4 &&
    sample[0] === 0x1a &&
    sample[1] === 0x45 &&
    sample[2] === 0xdf &&
    sample[3] === 0xa3
  ) {
    return {
      mimeType: "video/webm",
      width: null,
      height: null,
      durationMs: null,
    };
  }
  if (sample.subarray(0, 5).toString("ascii") === "%PDF-") {
    return {
      mimeType: "application/pdf",
      width: null,
      height: null,
      durationMs: null,
    };
  }
  return {
    mimeType: "application/octet-stream",
    width: null,
    height: null,
    durationMs: null,
  };
}
