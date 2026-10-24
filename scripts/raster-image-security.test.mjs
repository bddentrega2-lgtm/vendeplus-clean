import assert from "node:assert/strict";
import test from "node:test";
import { detectSupportedRasterImage } from "../src/lib/server/raster-image.ts";

test("acepta las firmas raster compatibles", () => {
  assert.equal(
    detectSupportedRasterImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "png"
  );
  assert.equal(detectSupportedRasterImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "jpeg");
  assert.equal(detectSupportedRasterImage(Buffer.from("GIF89a")), "gif");
  assert.equal(
    detectSupportedRasterImage(Buffer.from("RIFF\x00\x00\x00\x00WEBP")),
    "webp"
  );
});

test("rechaza SVG aunque se presente como una imagen", () => {
  assert.equal(
    detectSupportedRasterImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),
    null
  );
});

test("rechaza contenido vacio o desconocido", () => {
  assert.equal(detectSupportedRasterImage(Buffer.alloc(0)), null);
  assert.equal(detectSupportedRasterImage(Buffer.from("not-an-image")), null);
});
