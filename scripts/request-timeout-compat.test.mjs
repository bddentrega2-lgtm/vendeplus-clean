import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadTimeoutHelper(globals) {
  const source = readFileSync(new URL("../src/lib/client/request-timeout.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(output, { module: loadedModule, exports: loadedModule.exports, ...globals });
  return loadedModule.exports;
}

test("uses the native timeout signal in modern browsers", () => {
  const expected = { source: "native" };
  const helper = loadTimeoutHelper({
    AbortSignal: { timeout: (milliseconds) => {
      assert.equal(milliseconds, 12_000);
      return expected;
    } },
    AbortController: class { constructor() { throw new Error("fallback should not run"); } },
    setTimeout,
  });
  assert.equal(helper.requestTimeoutSignal(12_000), expected);
});

test("falls back to AbortController on older Android browsers", () => {
  let requestedDelay = 0;
  class LegacyAbortController {
    constructor() { this.signal = { aborted: false }; }
    abort() { this.signal.aborted = true; }
  }
  const helper = loadTimeoutHelper({
    AbortSignal: {},
    AbortController: LegacyAbortController,
    setTimeout: (callback, milliseconds) => {
      requestedDelay = milliseconds;
      callback();
      return 1;
    },
  });
  const signal = helper.requestTimeoutSignal(15_000);
  assert.equal(requestedDelay, 15_000);
  assert.equal(signal.aborted, true);
});

test("keeps requests usable when abort APIs are unavailable", () => {
  const helper = loadTimeoutHelper({ AbortSignal: undefined, AbortController: undefined, setTimeout });
  assert.equal(helper.requestTimeoutSignal(10_000), undefined);
});

test("browser entry points never call AbortSignal.timeout directly", () => {
  for (const path of [
    "../src/components/panel/PanelAuthProvider.tsx",
    "../src/lib/panel/table-snapshot-client.ts",
    "../src/components/panel/orders/PaymentReviewDialog.tsx",
    "../src/components/mobile/NativeExperience.tsx",
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /AbortSignal\.timeout/, path);
    assert.match(source, /requestTimeoutSignal/, path);
  }
});
