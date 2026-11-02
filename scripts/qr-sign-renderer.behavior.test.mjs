import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  formatQrSignTableNumber,
  parseQrSignTableNumber,
  qrSignFilename,
} from "../src/lib/qr-sign-renderer.ts";

test("acepta solamente mesas enteras entre 1 y 999", () => {
  for (const value of ["1", "01", "9", "10", "99", "100", "999", " 7 "]) {
    assert.notEqual(parseQrSignTableNumber(value), null, value);
  }
  for (const value of ["", "0", "000", "-1", "+1", "1.5", "1e2", "1000", "abc"]) {
    assert.equal(parseQrSignTableNumber(value), null, value);
  }
});

test("presenta una cifra con cero inicial sin truncar tres cifras", () => {
  assert.equal(formatQrSignTableNumber(1), "01");
  assert.equal(formatQrSignTableNumber(9), "09");
  assert.equal(formatQrSignTableNumber(10), "10");
  assert.equal(formatQrSignTableNumber(999), "999");
});

test("crea nombres de archivo seguros para Mesa y Barra", () => {
  assert.equal(qrSignFilename("Happy Chicken", { type: "mesa", tableNumber: 1 }), "somos-happy-chicken-mesa-01.png");
  assert.equal(qrSignFilename("Queje Olga!", { type: "barra" }), "somos-queje-olga-barra.png");
});

test("el diseño de Barra no imprime el rótulo y conserva el sitio oficial", async () => {
  const source = await readFile(new URL("../src/lib/qr-sign-renderer.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /drawText\(context,\s*"BARRA"/);
  assert.match(source, /drawText\(context,\s*"www\.somos-ve\.com"/);
  assert.match(source, /canvas\.width = WIDTH/);
  assert.match(source, /canvas\.height = HEIGHT/);
});

test("el logo del comercio se dibuja dentro de una mascara circular", async () => {
  const source = await readFile(new URL("../src/lib/qr-sign-renderer.ts", import.meta.url), "utf8");
  assert.match(source, /function drawCircularLogo/);
  assert.match(source, /context\.arc\(/);
  assert.match(source, /context\.clip\(\)/);
  assert.match(source, /function drawCoverImage/);
  assert.match(source, /Math\.max\(width \/ image\.naturalWidth, height \/ image\.naturalHeight\)/);
  assert.match(source, /drawCoverImage\(context, image, box\)/);
  assert.match(source, /drawCircularLogo\(context, logo\)/);
});
