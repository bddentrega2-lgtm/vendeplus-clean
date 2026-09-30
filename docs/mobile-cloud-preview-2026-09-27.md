# Android cloud preview - 2026-09-27

## Scope and diagnosis

The user approved hosting a Vercel Preview, not changing production. The local
APK depended on localhost3107 and ADB reverse. Cloud mode now uses an exact HTTPS
preview origin; it still needs internet, but no development PC or ADB tunnel.
This is an internal debug APK, not a Play Store release.

- Preview: https://vendeplus-clean-iyyc3cg3d-entrega2-s-projects.vercel.app
- Deployment: `dpl_CQ3Rg9F7i9fBwYNHcQcryuqNEyFd`, READY, target preview.
- Production before/after: `dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi`, unchanged.
- First failed deployment: `dpl_CcPrF3HHYTcPNvFRvCnx2yRymisM`. The old
  `.vercelignore` pattern `mobile` excluded `src/components/mobile` and
  `src/lib/mobile`. Changed to `/mobile/`, excluding only the Android project.

## Files and changes

- `mobile/somos-android/server-config.ts`: default official origin, explicit
  localhost option, strict HTTPS preview deployment URL validation. Rejects
  arbitrary hosts, credentials, path/query/fragment and conflicting build modes.
- `mobile/somos-android/capacitor.config.ts`: uses that resolver.
- `mobile/somos-android/tsconfig.json`: explicit existing Node types for TS6.
- `mobile/somos-android/android/app/build.gradle`: version4/1.1.2-cloud-preview;
  preReleaseBuild guard forbids a nonofficial origin, cleartext and broad hosts.
- `.vercelignore`: root-only mobile exclusion.
- `scripts/mobile-cloud.test.mjs`: config, security and upload contracts.
- `scripts/critical-contracts.test.mjs`: follows the extracted server config.
- `scripts/mobile-city.e2e.mjs`: supports validated remote preview QA target.
- `scripts/mobile-cloud.e2e.mjs`: read-only navigation and anonymous API checks.
- This document and `SESSION_HANDOFF.md`: delivery and continuity record.

No application frontend, database, pricing, order logic or print service changes
in this step. The prior approved Stage1 and city changes are included in preview.
No migration, SQL, production promotion, commit or push.

## APK

Artifact: `tmp/mobile-cloud/somos-1.1.2-cloud-preview.apk`

- Package `com.somosve.app`, versionCode4, versionName1.1.2-cloud-preview.
- SHA256 `C6CD72061D555533156F9A1FE74CCB86261D419148AD5E6FECFC73DFEDBCBFAF`.
- Inspected the ZIP config: exact preview HTTPS origin, cleartext=false,
  allowMixedContent=false; no bypass credentials or localhost server URL.
- Permissions for foreground location unchanged. No background location added.
- Default generated Capacitor config resynced to production after copying APK.
  Install the named artifact, not a subsequently regenerated build output.
- All five native printing/push/service/storage/boot source files match the
  pre-Stage1 backup SHA256. No print-device revoke, pair, queue change or test order.
- Updating with `adb install --no-streaming -r` keeps package data and native
  printer pairing. Changing origin does not migrate web cookies/localStorage:
  login, carts, buyer drafts and city preferences at localhost stay there and may
  need to be entered again in this preview. Do not claim they migrate.

## Validations

- Local npm.cmd run build (via mobile-local runner): PASS,240pages/TypeScript.
- Vercel npm run build: PASS,240pages, READY.
- Android assembleDebug: PASS,73tasks.
- Mobile TypeScript: PASS.
- Logic/contracts:94/94 PASS. Targeted ESLint PASS. git diff --check PASS.
- Release guard: expected rejection when synced to preview; PASS after official
  origin sync. No release bundle or production-signed artifact generated.
- Remote browser QA prepared, pending preview accessibility.

## Access gate and next action

Vercel currently redirects anonymous preview requests to its SSO screen. The
project has `ssoProtection.deploymentType=all_except_custom_domains`. No global
protection setting has been changed. User was asked explicitly to authorize
making only this immutable preview domain public; answer pending at this record.
SOMOS authentication/tenant checks must remain active regardless of that gate.

Vercel's documented per-URL exception is reversible. API contract verified in
the official SDK: PATCH `/aliases/{deploymentId}/protection-bypass`, body
`{"override":{"scope":"alias-protection-override","action":"create"}}`;
use `action:"revoke"` to restore protection. Do not execute before authorization.
Do not embed an automation bypass secret or Vercel account token in an APK.

Sources:
- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/deployment-protection-exceptions
- https://raw.githubusercontent.com/vercel/sdk/main/src/models/patchurlprotectionbypassop.ts

After authorization: apply only this deployment exception; verify ordinary
HTTPS200 plus panel/admin401; run city and cloud E2E with SOMOS_QA_BASE_URL;
inspect screenshots; install APK on A34 using its current wireless port; remove
only tcp3107 reverse to prove no local dependence; open app and inspect screenshot.
Latest known33135 now refuses connection. Do not guess successive ports.

Physical QA: launch after closing/reopening, city selection/GPS, login with the
user's account, menus and cart, TIII test ticket, app closed/automatic printing
in authorized test store, Wi-Fi versus mobile data. No real orders from the agent.

## Risks and V2

- Do not circulate debug APK nationally. Release signing/key custody, Play
  Console/internal testing, privacy disclosures and update strategy are pending.
- Firebase project/google-services.json still absent. FCM is not enabled by
  deploying this preview; existing polling/foreground printing remains unchanged.
- Google OAuth/recovery redirect allowlist for this exact preview is not changed
  or verified here. Use existing email/password for initial merchant QA.
- Location is the prior proximity heuristic, not official municipal boundaries.
- Preview uses real backend data. Any manual orders/edits WOULD be real.
- Do not delete this deployment while this APK is used; its URL is fixed. Future
  pilot iterations can use a dedicated stable preview hostname after approval.
