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
  assert.match(script, /lintRelease testReleaseUnitTest bundleRelease/);
  assert.match(script, /somos-release-metadata\.json/);
  assert.doesNotMatch(script, /versionCode = \d+/);
  assert.match(script, /\$releaseMetadata\.origin -ne 'https:\/\/www\.somos-ve\.com'/);
  assert.match(script, /origin = \$releaseMetadata\.origin/);
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
  assert.match(script, /versionCode = 15/);
  assert.match(script, /versionName = '1\.5\.1'/);
  assert.match(script, /lintDebug assembleDebug testDebugUnitTest/);
});

test("Play candidate is one-shot, private by default and compatible with the supported Android range", () => {
  const manifest = read("mobile/somos-android/android/app/src/main/AndroidManifest.xml");
  const service = read("mobile/somos-android/android/app/src/main/java/com/somosve/app/PrintForegroundService.java");
  const firebase = read("mobile/somos-android/android/app/src/main/java/com/somosve/app/SomosFirebaseMessagingService.java");
  const gradle = read("mobile/somos-android/android/app/build.gradle");
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
  assert.match(manifest, /android:fullBackupContent="@xml\/backup_rules"/);
  assert.doesNotMatch(manifest, /RECEIVE_BOOT_COMPLETED|PrintBootReceiver/);
  assert.match(manifest, /FOREGROUND_SERVICE_CONNECTED_DEVICE/);
  assert.match(service, /ContextCompat\.startForegroundService/);
  assert.match(service, /Build\.VERSION\.SDK_INT < Build\.VERSION_CODES\.O/);
  assert.match(service, /START_NOT_STICKY/);
  assert.doesNotMatch(service, /scheduleWithFixedDelay|START_STICKY/);
  assert.match(firebase, /if \(!"print_jobs"\.equals/);
  assert.match(gradle, /productionVersionCode = 15/);
  assert.match(gradle, /productionVersionName = "1\.5\.1"/);
  assert.match(gradle, /finalizedBy\('writeReleaseMetadata'\)/);
});

test("every account can reach a deletion path without deleting business records", () => {
  const route = read("src/app/api/buyer/account/route.ts");
  const screen = read("src/components/buyer/DeleteBuyerAccount.tsx");
  const panel = read("src/components/panel/PanelShell.tsx");
  const migration = read("supabase/migrations/20261001153000_account_deletion_requests.sql");
  assert.match(route, /type !== "buyer"/);
  assert.match(route, /account_deletion_requests/);
  assert.match(route, /deleteUser\(identity\.id, false\)/);
  assert.match(route, /error && error\.code !== "23505"/);
  assert.match(screen, /Ingresar como comercio/);
  assert.match(screen, /Solicitar eliminacion/);
  assert.match(panel, /href="\/eliminar-cuenta"/);
  assert.match(migration, /unique index[\s\S]*where status = 'pending'/);
  assert.match(migration, /revoke all[\s\S]*anon, authenticated/);
});

test("release preserves optional hardware and native 16 KB compatibility checks", () => {
  const manifest = read("mobile/somos-android/android/app/src/main/AndroidManifest.xml");
  const gradle = read("mobile/somos-android/android/app/build.gradle");
  const verifier = read("scripts/ops/verify-android-apk.ps1");
  for (const feature of ["bluetooth", "bluetooth_le", "location", "location.gps", "location.network"]) {
    assert.match(manifest, new RegExp(`android:name="android\\.hardware\\.${feature.replaceAll(".", "\\.")}"\\s+android:required="false"`));
  }
  assert.match(gradle, /androidx\.datastore:datastore-preferences:1\.2\.1/);
  assert.match(verifier, /zipalign\.exe[\s\S]*-c -P 16 4/);
  assert.match(verifier, /\$alignment -lt 16384/);
  assert.match(verifier, /0x6474e552/);
  assert.match(verifier, /\(\(\$virtualAddress \+ \$memorySize\) % 16384\)/);
});
