import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inferMarketplaceCity } from "../src/lib/mobile/marketplace-city.ts";

test("city inference uses the nearest city, not the number of shops", () => {
  assert.equal(inferMarketplaceCity([{ slug: "a", distance: 2 }, { slug: "a", distance: 4 }, { slug: "b", distance: 6 }], 100), "a");
});
test("no city is invented for a remote location or invalid fix", () => {
  assert.equal(inferMarketplaceCity([{ slug: "a", distance: 100 }], 100), null);
  for (const accuracy of [NaN, Infinity, -1, 5001]) assert.equal(inferMarketplaceCity([{ slug: "a", distance: 1 }], accuracy), null);
});
test("adjacent cities and approximate ambiguous location need manual choice", () => {
  assert.equal(inferMarketplaceCity([{ slug: "a", distance: 2 }, { slug: "b", distance: 2.5 }], 100), null);
  assert.equal(inferMarketplaceCity([{ slug: "a", distance: 2 }, { slug: "b", distance: 4 }], 3000), null);
  assert.equal(inferMarketplaceCity([{ slug: "a", distance: 2 }, { slug: "b", distance: 12 }], 3000), "a");
});
test("missing coordinates or city metadata cannot supply a city", () => {
  assert.equal(inferMarketplaceCity([{ slug: "a", distance: null }, { slug: null, distance: 0 }, { slug: "b", distance: NaN }], 100), null);
  assert.equal(inferMarketplaceCity([], 100), null);
});
test("Android declares foreground location only and the city dialog is not hidden", () => {
  const manifest = readFileSync(new URL("../mobile/somos-android/android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
  assert.match(manifest, /android.permission.ACCESS_COARSE_LOCATION/);
  assert.match(manifest, /android.permission.ACCESS_FINE_LOCATION/);
  assert.doesNotMatch(manifest, /ACCESS_BACKGROUND_LOCATION/);
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /#inicio > div\.fixed\s*\{\s*display:\s*none/);
  assert.match(css, /#inicio > div\.fixed\[aria-hidden\]/);
});
