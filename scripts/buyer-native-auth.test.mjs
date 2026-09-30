import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/buyer/client.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function setup({ native = true, redirect = "com.somosve.app.staging://buyer-auth", exchangeError = null } = {}) {
  const calls = { exchange: [], open: [], oauth: [] };
  const plugin = { getRedirectUrl: async () => ({ url: redirect }), open: async value => calls.open.push(value), consume: async () => ({}) };
  const auth = { signInWithOAuth: async args => { calls.oauth.push(args); return { data: { url: "https://xpqmmdmixpyqruykkbkf.supabase.co/auth/v1/authorize?provider=google" } }; }, exchangeCodeForSession: async code => { calls.exchange.push(code); return { error: exchangeError }; } };
  const dependencies = { "@supabase/supabase-js": { createClient: () => ({ auth }) }, "@/lib/mobile/state": { isNativeApp: () => native } };
  const module = { exports: {} };
  const window = { Capacitor: { Plugins: { SomosBuyerAuth: plugin } }, location: { origin: "https://preview.example.test", assign: url => calls.open.push(url) } };
  vm.runInNewContext(js, { module, exports: module.exports, require: name => { if (!(name in dependencies)) throw new Error(name); return dependencies[name]; }, window, URL, process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://xpqmmdmixpyqruykkbkf.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock" } } });
  return { api: module.exports, calls };
}
test("native sign-in uses this installation's callback, not the other app", async () => {
  for (const redirect of ["com.somosve.app://buyer-auth", "com.somosve.app.staging://buyer-auth"]) {
    const { api, calls } = setup({ redirect });
    await api.signInBuyerWithGoogle();
    assert.equal(calls.oauth[0].options.redirectTo, redirect);
    assert.equal(calls.oauth[0].options.skipBrowserRedirect, true);
    assert.equal(calls.open.length, 1);
    await api.completeBuyerSignIn(`${redirect}?code=demo-pkce-code`);
    assert.deepEqual(calls.exchange, ["demo-pkce-code"]);
  }
});
test("cross-app, foreign, malformed, cancelled and empty callbacks never exchange codes", async () => {
  const { api, calls } = setup();
  for (const url of ["com.somosve.app://buyer-auth?code=x", "com.somosve.app.staging://buyer-auth/extra?code=x", "com.somosve.app.staging://user@buyer-auth?code=x", "com.somosve.app.staging://buyer-auth:123?code=x", "https://evil.test/auth/buyer-callback?code=x", "com.somosve.app.staging://buyer-auth?error=access_denied", "com.somosve.app.staging://buyer-auth"]) {
    await assert.rejects(api.completeBuyerSignIn(url));
  }
  assert.deepEqual(calls.exchange, []);
  await api.completeBuyerSignIn("com.somosve.app.staging://buyer-auth?code=valid-after-cancel");
  assert.equal(calls.exchange.length, 1);
});
test("web login and callback keep their own origin; native callback is rejected on web", async () => {
  const { api, calls } = setup({ native: false });
  await api.signInBuyerWithGoogle();
  assert.equal(calls.oauth[0].options.redirectTo, "https://preview.example.test/auth/buyer-callback");
  await assert.rejects(api.completeBuyerSignIn("com.somosve.app.staging://buyer-auth?code=x"));
  await api.completeBuyerSignIn("https://preview.example.test/auth/buyer-callback?code=web-code");
  assert.deepEqual(calls.exchange, ["web-code"]);
});
test("unexpected plugin callback and failed PKCE exchange are not accepted", async () => {
  const invalid = setup({ redirect: "https://evil.test" });
  await assert.rejects(invalid.api.signInBuyerWithGoogle());
  assert.equal(invalid.calls.oauth.length, 0);
  const failed = setup({ exchangeError: new Error("expired") });
  await assert.rejects(failed.api.completeBuyerSignIn("com.somosve.app.staging://buyer-auth?code=expired"), /vencio/);
});
