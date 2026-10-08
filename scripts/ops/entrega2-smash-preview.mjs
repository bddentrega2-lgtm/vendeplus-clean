import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig("..");

const mode = process.argv[2];
if (!["deploy", "status", "share", "activate"].includes(mode)) throw new Error("Unsupported action");

const projectId = "prj_LPHnsOxowUvGBXYalbdNO3R01PrI";
const orgId = "team_Y83WN5EPd5KzLDL9BHzoHkme";
const productionRef = "rvmtjtuztewcrmodrodb";
const smashStoreId = "47f344a7-46f2-4871-9266-489c79361c4d";
const previewAlias = "vendeplus-entrega2-preview.vercel.app";
const artifact = "tmp/buyer-staging/smash-preview-deployment.json";
const cli = resolve(process.env.APPDATA, "npm/node_modules/vercel/dist/vc.js");
const link = JSON.parse(await readFile(".vercel/project.json", "utf8"));
if (link.projectId !== projectId || link.orgId !== orgId) throw new Error("Unexpected Vercel project");

function run(args, env = process.env, input) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", code => code === 0
      ? resolveRun(stdout)
      : reject(new Error(`Vercel action failed (${code}): ${stderr
        .replaceAll(env.ENTREGA2_WEBHOOK_SECRET || "\u0000", "[redacted]")
        .replaceAll(env.SUPABASE_SERVICE_ROLE_KEY || "\u0000", "[redacted]")
        .slice(-600)}`)));
    child.stdin.end(input);
  });
}

async function api(path) {
  const args = ["api", `${path}${path.includes("?") ? "&" : "?"}teamId=${orgId}`, "--raw"];
  return JSON.parse(await run(args));
}

const project = await api(`/v9/projects/${projectId}`);
const productionBefore = project.targets?.production?.id;
if (!productionBefore) throw new Error("Cannot verify production target");

if (mode === "deploy") {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
    SUPABASE_SERVICE_ROLE_KEY: service } = process.env;
  const secret = process.env.SOMOS_ENTREGA2_PREVIEW_WEBHOOK_SECRET || "";
  if (url !== `https://${productionRef}.supabase.co` || !anon || !service) {
    throw new Error("Production Supabase identity unavailable");
  }
  const anonClaims = JSON.parse(Buffer.from(anon.split(".")[1], "base64url").toString());
  if (anonClaims.ref !== productionRef || anonClaims.role !== "anon") {
    throw new Error("Wrong Supabase anon key");
  }
  const storeResponse = await fetch(`${url}/rest/v1/stores?id=eq.${smashStoreId}&select=id,slug`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  });
  if (!storeResponse.ok) throw new Error("Production service key validation failed");
  const stores = await storeResponse.json();
  if (stores.length !== 1 || stores[0].id !== smashStoreId || stores[0].slug !== "smash") {
    throw new Error("Smash Test identity mismatch");
  }
  if (secret.length < 32 || secret.length > 256 || /\s/.test(secret)) {
    throw new Error("Preview webhook secret unavailable");
  }
  const configured = await api(`/v9/projects/${projectId}/env`);
  for (const key of ["ENTREGA2_API_BASE_URL", "ENTREGA2_API_KEY"]) {
    if (!configured.envs?.some(row => row.key === key && row.target?.includes("preview") && !row.gitBranch)) {
      throw new Error(`Missing preview configuration: ${key}`);
    }
  }
  const env = { ...process.env, ENTREGA2_WEBHOOK_SECRET: secret };
  const vars = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY", "ENTREGA2_WEBHOOK_SECRET"];
  const args = ["deploy", "--yes", "--force", "--no-wait", "--format", "json"];
  for (const key of vars) args.push("--env", key, "--build-env", key);
  const result = JSON.parse(await run(args, env));
  const raw = result.url || result.deployment?.url;
  const deployedUrl = raw?.startsWith("https://") ? raw : `https://${raw}`;
  if (!/^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/.test(deployedUrl)) {
    throw new Error("Unexpected preview URL");
  }
  const deployed = await api(`/v13/deployments/${new URL(deployedUrl).host}`);
  const after = await api(`/v9/projects/${projectId}`);
  if (deployed.projectId !== projectId || deployed.target === "production" ||
      after.targets?.production?.id !== productionBefore) throw new Error("Production target changed");
  await writeFile(artifact, JSON.stringify({ projectId, url: deployedUrl,
    productionBefore, databaseRef: productionRef, smashStoreId }, null, 2));
  console.log(JSON.stringify({ url: deployedUrl, state: deployed.readyState,
    productionUnchanged: true, smashStoreId }));
} else {
  const saved = JSON.parse(await readFile(artifact, "utf8"));
  if (saved.projectId !== projectId || saved.productionBefore !== productionBefore ||
      saved.databaseRef !== productionRef || saved.smashStoreId !== smashStoreId ||
      !/^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/.test(saved.url)) {
    throw new Error("Unexpected preview artifact or production target");
  }
  const deployed = await api(`/v13/deployments/${new URL(saved.url).host}`);
  if (deployed.projectId !== projectId || deployed.target === "production") {
    throw new Error("Not a preview deployment");
  }
  if (mode === "share") {
    if (deployed.readyState !== "READY") throw new Error("Preview is not ready");
    await run(["api", `/aliases/${deployed.id}/protection-bypass?teamId=${orgId}`,
      "--raw", "--method", "PATCH", "--input", "-"], process.env,
    JSON.stringify({ override: { scope: "alias-protection-override", action: "create" } }));
  }
  if (mode === "activate") {
    if (deployed.readyState !== "READY") throw new Error("Preview is not ready");
    await run(["alias", "set", new URL(saved.url).host, previewAlias]);
    const aliasTarget = await api(`/v13/deployments/${previewAlias}`);
    const productionAfter = await api(`/v9/projects/${projectId}`);
    if (aliasTarget.id !== deployed.id || aliasTarget.projectId !== projectId ||
        aliasTarget.target === "production" ||
        productionAfter.targets?.production?.id !== productionBefore) {
      throw new Error("Preview alias or production target mismatch");
    }
  }
  console.log(JSON.stringify({ id: deployed.id, url: saved.url,
    state: deployed.readyState, productionUnchanged: true,
    shared: mode === "share", ...(mode === "activate" ? { webhookUrl: `https://${previewAlias}/api/integrations/entrega2/order-status` } : {}) }));
}
