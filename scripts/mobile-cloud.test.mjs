import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveAndroidIdentity, resolveAndroidServer } from "../mobile/somos-android/server-config.ts";

test("buyer beta has a separate package and requires an HTTPS preview", () => {
  assert.deepEqual(resolveAndroidIdentity({}), { appId: "com.somosve.app", appName: "Somos" });
  const env = { SOMOS_ANDROID_BUYER_STAGING: "1", SOMOS_ANDROID_PREVIEW_URL: "https://vendeplus-clean-a1b2c3d4e-entrega2-s-projects.vercel.app" };
  assert.deepEqual(resolveAndroidIdentity(env), { appId: "com.somosve.app.staging", appName: "Somos Pruebas" });
  assert.throws(() => resolveAndroidIdentity({ SOMOS_ANDROID_BUYER_STAGING: "1" }));
  assert.throws(() => resolveAndroidIdentity({ ...env, SOMOS_ANDROID_LOCAL: "1" }));
  assert.throws(() => resolveAndroidIdentity({ ...env, SOMOS_ANDROID_PREVIEW_URL: "https://www.somos-ve.com" }));
});

test("Android defaults to official HTTPS; local testing remains explicit", () => {
  assert.deepEqual(resolveAndroidServer({}), { url: "https://www.somos-ve.com", cleartext: false, allowNavigation: ["www.somos-ve.com", "somos-ve.com"] });
  assert.deepEqual(resolveAndroidServer({ SOMOS_ANDROID_LOCAL: "1" }), { url: "http://localhost:3107", cleartext: true, allowNavigation: ["localhost"] });
});

test("cloud preview permits only the exact project deployment origin", () => {
  const host = "vendeplus-clean-a1b2c3d4e-entrega2-s-projects.vercel.app";
  for (const suffix of ["", "/"]) {
    assert.deepEqual(resolveAndroidServer({ SOMOS_ANDROID_PREVIEW_URL: `https://${host}${suffix}` }), { url: `https://${host}`, cleartext: false, allowNavigation: [host] });
  }
  for (const invalid of ["", "http://" + host, "https://other.vercel.app", "https://www.somos-ve.com", "https://" + host + ".evil.test", "https://" + host + "/panel", "https://" + host + "?token=x", "https://" + host + "#x", "https://" + host + ":443", "https://user@" + host, "https://localhost:3107", "https://*.vercel.app", " https://" + host]) {
    assert.throws(() => resolveAndroidServer({ SOMOS_ANDROID_PREVIEW_URL: invalid }), undefined, invalid);
  }
  assert.throws(() => resolveAndroidServer({ SOMOS_ANDROID_LOCAL: "1", SOMOS_ANDROID_PREVIEW_URL: `https://${host}` }));
});

test("release has an origin guard and print queue endpoints remain official", () => {
  const read = (path) => readFileSync(new URL(`../mobile/somos-android/${path}`, import.meta.url), "utf8");
  const gradle = read("android/app/build.gradle");
  assert.match(gradle, /preReleaseBuild[\s\S]*dependsOn\('verifyReleaseOrigin'\)/);
  assert.match(gradle, /config\.server\?\.url != 'https:\/\/www\.somos-ve\.com'/);
  const plugin = read("android/app/src/main/java/com/somosve/app/SomosPrinterPlugin.java");
  const printerConfig = read("android/app/src/main/java/com/somosve/app/PrinterServerConfig.java");
  assert.match(plugin, /PrinterServerConfig\.apiUrl\(context, JOBS_PATH\)/);
  assert.match(printerConfig, /OFFICIAL_ORIGIN = "https:\/\/www\.somos-ve\.com"/);
  assert.match(printerConfig, /PREVIEW_HOST = "vendeplus-clean-/);
  assert.match(printerConfig, /throw new SecurityException\("Origen de impresion no autorizado\."\)/);
  assert.doesNotMatch(plugin, /SOMOS_ANDROID_PREVIEW_URL/);
});

test("deployment excludes Android project but not web mobile components", () => {
  const ignore = readFileSync(new URL("../.vercelignore", import.meta.url), "utf8").split(/\r?\n/);
  assert.ok(ignore.includes("/mobile/"));
  assert.ok(!ignore.includes("mobile"));
});
