const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("MFA stays in Admin with an independent session and never changes shared panel access", () => {
  const setup = read("src/components/admin/AdminMfaSetup.tsx");
  const panelSession = read("src/lib/server/panel-session-store.ts");
  const panelAuth = read("src/lib/panel/auth.ts");
  const page = read("src/app/admin/seguridad/page.tsx");
  const adminAccess = read("src/lib/admin/access.ts");
  const mfaSessionRoute = read("src/app/api/admin/mfa-session/route.ts");
  const mfaSessionStore = read("src/lib/admin/mfa-session-store.ts");
  const preview = read("scripts/ops/buyer-staging-preview.mjs");

  assert.match(setup, /supabase\.auth\.mfa\.enroll/);
  assert.match(setup, /supabase\.auth\.mfa\.challengeAndVerify/);
  assert.match(setup, /isFounderMode/);
  assert.match(page, /AdminMfaSetup/);
  assert.match(adminAccess, /assertAdminMfa/);
  assert.match(mfaSessionStore, /create_panel_session_v2/);
  assert.match(mfaSessionRoute, /claims\?\.aal !== "aal2"/);
  assert.match(preview, /ADMIN_MFA_ENFORCEMENT: auditStaging \? 'true' : ''/);
  assert.doesNotMatch(setup, /syncPanelServerSession|createPanelServerSession|PANEL_SESSION_COOKIE/);
  assert.doesNotMatch(panelSession, /create_panel_session_v2/);
  assert.doesNotMatch(panelAuth, /aal2/);
});
