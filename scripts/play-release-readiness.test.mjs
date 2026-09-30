import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("release signing is external, mandatory and never reused by buyer staging", () => {
  const gradle = read("mobile/somos-android/android/app/build.gradle");
  assert.match(gradle, /SOMOS_ANDROID_KEYSTORE_PATH/);
  assert.match(gradle, /SOMOS_ANDROID_KEY_ALIAS/);
  assert.match(gradle, /SOMOS_ANDROID_STORE_PASSWORD/);
  assert.match(gradle, /SOMOS_ANDROID_KEY_PASSWORD/);
  assert.match(gradle, /verifyReleaseSigning/);
  assert.match(gradle, /preReleaseBuild[\s\S]*dependsOn\('verifyReleaseOrigin'\)[\s\S]*dependsOn\('verifyReleaseSigning'\)/);
  assert.match(gradle, /if \(buyerStaging\) throw new GradleException/);
  assert.doesNotMatch(gradle, /storePassword\s+["'][^"']+["']/);
  assert.doesNotMatch(gradle, /keyPassword\s+["'][^"']+["']/);
});

test("Play builder validates Firebase package, official identity and external keystore before Gradle", () => {
  const script = read("scripts/ops/build-play-internal-aab.ps1");
  const validationEnd = script.indexOf("$old = @{}");
  const gradleStart = script.indexOf("gradlew.bat");
  assert.ok(validationEnd > 0 && gradleStart > validationEnd);
  assert.match(script.slice(0, validationEnd), /com\.somosve\.app/);
  assert.match(script.slice(0, validationEnd), /google-services\.json/);
  assert.match(script.slice(0, validationEnd), /must live outside the repository/);
  assert.match(script, /bundleRelease testReleaseUnitTest/);
  assert.match(script, /origin = 'https:\/\/www\.somos-ve\.com'/);
});

test("release secrets and generated service configuration are ignored", () => {
  const ignore = read("mobile/somos-android/android/.gitignore");
  for (const entry of ["*.jks", "*.keystore", "keystore.properties", "google-services.json"]) {
    assert.match(ignore, new RegExp(`^${entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  }
});

test("Firebase pilot is production-package-only and keeps the official origin", () => {
  const script = read("scripts/ops/build-firebase-pilot-apk.ps1");
  assert.match(script, /Count -ne 1/);
  assert.match(script, /com\.somosve\.app/);
  assert.match(script, /Remove-Item Env:SOMOS_ANDROID_BUYER_STAGING/);
  assert.match(script, /origin = 'https:\/\/www\.somos-ve\.com'/);
  assert.match(script, /versionCode = 12/);
  assert.match(script, /assembleDebug testDebugUnitTest/);
});
