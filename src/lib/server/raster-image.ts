export type SupportedRasterImage = "gif" | "jpeg" | "png" | "webp";

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectSupportedRasterImage(
  bytes: Uint8Array
): SupportedRasterImage | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "jpeg";
  }

  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }

  const gifHeader = String.fromCharCode(...bytes.subarray(0, 6));
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return "gif";
  }

  return null;
}
