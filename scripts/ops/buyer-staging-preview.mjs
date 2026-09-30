import { spawn } from 'node:child_process';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseEnv } from 'node:util';

const mode = process.argv[2];
if (!['inspect', 'build', 'deploy', 'status', 'share', 'start'].includes(mode)) throw new Error('Unsupported preview action');
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const keys = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const ref = 'xpqmmdmixpyqruykkbkf';
const projectId = 'prj_LPHnsOxowUvGBXYalbdNO3R01PrI';
const orgId = 'team_Y83WN5EPd5KzLDL9BHzoHkme';
if (keys.ref !== ref) throw new Error('Wrong database');
for (const [key, role] of [[keys.anon, 'anon'], [keys.service, 'service_role']]) {
  if (typeof key !== 'string') throw new Error(`Unexpected ${role} key shape: ${typeof key}; fields ${Object.keys(key || {}).join(',')}`);
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  if (claims.ref !== ref || claims.role !== role) throw new Error('Wrong staging key');
}
const link = JSON.parse(await readFile('.vercel/project.json', 'utf8'));
if (link.projectId !== projectId || link.orgId !== orgId) throw new Error('Wrong Vercel project');
const cli = resolve(process.env.APPDATA, 'npm/node_modules/vercel/dist/vc.js');
const artifact = 'tmp/buyer-staging/preview-deployment.json';
const firebasePreviewRaw = process.env.SOMOS_FIREBASE_PREVIEW === '1' ? String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '') : '';
let firebasePreview = null;
if (firebasePreviewRaw) {
  try { firebasePreview = JSON.parse(firebasePreviewRaw); } catch { throw new Error('Firebase preview credential is not valid JSON'); }
  if (firebasePreview.type !== 'service_account' || !firebasePreview.project_id || !firebasePreview.client_email || !String(firebasePreview.private_key || '').includes('BEGIN PRIVATE KEY')) {
    throw new Error('Firebase preview credential has an invalid shape');
  }
}
const redact = value => String(value)
  .replaceAll(keys.anon, '[anon-redacted]')
  .replaceAll(keys.service, '[service-redacted]')
  .replaceAll(firebasePreviewRaw, firebasePreviewRaw ? '[firebase-redacted]' : '');
function run(command, args, { env = process.env, input, stream = false } = {}) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; if (stream) process.stdout.write(redact(chunk)); });
    child.stderr.on('data', chunk => { stderr += chunk; if (stream) process.stderr.write(redact(chunk)); });
    child.on('error', fail);
    child.on('exit', code => code === 0 ? done(stdout) : fail(new Error(`Command failed (${code}): ${redact(stderr).slice(-2000)}`)));
    child.stdin.end(input);
  });
}
async function api(path, body) {
  const args = [cli, 'api', `${path}${path.includes('?') ? '&' : '?'}teamId=${orgId}`, '--raw'];
  if (body) args.push('--method', 'PATCH', '--input', '-');
  return JSON.parse(await run(process.execPath, args, { input: body ? JSON.stringify(body) : undefined }));
}
async function project() {
  const value = await api(`/v9/projects/${projectId}`);
  if (value.id !== projectId || !value.targets?.production?.id) throw new Error('Production identity unavailable');
  return value;
}
const before = await project();
if (['status', 'share'].includes(mode)) {
  const saved = JSON.parse(await readFile(artifact, 'utf8'));
  if (saved.projectId !== projectId || !/^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/.test(saved.url)) throw new Error('Wrong preview artifact');
  const deployment = await api(`/v13/deployments/${new URL(saved.url).host}`);
  if (deployment.projectId !== projectId || deployment.target === 'production') throw new Error('Not a preview');
  if (before.targets.production.id !== saved.productionBefore) throw new Error('Production changed; reconcile before sharing');
  if (mode === 'share') {
    if (deployment.readyState !== 'READY') throw new Error('Preview not ready');
    await api(`/aliases/${deployment.id}/protection-bypass`, { override: { scope: 'alias-protection-override', action: 'create' } });
  }
  console.log(JSON.stringify({ id: deployment.id, url: saved.url, state: deployment.readyState, target: deployment.target, productionUnchanged: true, shared: mode === 'share' }));
  process.exit(0);
}

// Replace every inherited application variable, including branch-specific entries.
const configured = await api(`/v9/projects/${projectId}/env?decrypt=false`);
if (!Array.isArray(configured.envs)) throw new Error('Cannot inspect inherited variables');
const names = new Set(configured.envs.map(item => item.key));
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (/\.[cm]?[jt]sx?$/.test(path)) {
      const text = await readFile(path, 'utf8');
      for (const match of text.matchAll(/process\.env\.([A-Z][A-Z_0-9]+)/g)) names.add(match[1]);
    }
  }
}
await scan('src');
for (const file of (await readdir('.')).filter(name => /^\.env(?:\.|$)/.test(name))) {
  for (const name of Object.keys(parseEnv(await readFile(file, 'utf8')))) names.add(name);
}
names.delete('NODE_ENV'); names.delete('VERCEL_ENV');
if ([...names].some(name => !/^[A-Z][A-Z_0-9]+$/.test(name) || name.startsWith('VERCEL_'))) throw new Error('Unexpected inherited environment variable');
const appEnv = Object.fromEntries([...names].map(name => [name, '']));
Object.assign(appEnv, {
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon,
  SUPABASE_SERVICE_ROLE_KEY: keys.service,
  NEXT_PUBLIC_ALLOW_DEMO_FALLBACKS: 'false',
});
if (firebasePreview) appEnv.FIREBASE_SERVICE_ACCOUNT_JSON = firebasePreviewRaw;
const env = { ...process.env, ...appEnv, VERCEL_ENV: 'preview' };
const response = await fetch(`${appEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/stores?select=id,slug&order=slug&limit=5`, { headers: { apikey: keys.service, Authorization: `Bearer ${keys.service}` } });
if (!response.ok) throw new Error(`Staging catalog HTTP ${response.status}`);
const stores = await response.json();
if (stores.length !== 2 || stores.some(store => !['cocina-demo', 'tienda-demo'].includes(store.slug))) throw new Error('Unexpected staging catalog');
const privateResponse = await fetch(`${appEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buyer_order_accounts?select=order_id&limit=1`, { headers: { apikey: keys.anon, Authorization: `Bearer ${keys.anon}` } });
if (![401, 403].includes(privateResponse.status)) throw new Error('Buyer data not private');
console.log(JSON.stringify({ stage: ref, fictionalStores: stores.map(s => s.slug), privateBuyerStatus: privateResponse.status, firebaseEnabled: Boolean(firebasePreview), disabledVariables: Object.keys(appEnv).filter(key => appEnv[key] === ''), productionBefore: before.targets.production.id }));

if (mode === 'inspect') process.exit(0);
if (mode === 'build' || mode === 'start') {
  await run('cmd.exe', ['/d', '/s', '/c', mode === 'build' ? 'npm.cmd run build' : 'npm.cmd run start -- --hostname 127.0.0.1 --port 3107'], { env, stream: true });
} else if (mode === 'deploy') {
  const args = [cli, 'deploy', '--yes', '--force', '--no-wait', '--format', 'json'];
  for (const [name, value] of Object.entries(appEnv)) {
    const flag = value === '' ? `${name}=` : name;
    args.push('--env', flag, '--build-env', flag);
  }
  const output = await run(process.execPath, args, { env });
  let deployed;
  try { deployed = JSON.parse(output); } catch { throw new Error(`Unexpected deploy output: ${redact(output).slice(-600)}`); }
  const raw = deployed.url || deployed.deployment?.url;
  const url = raw?.startsWith('https://') ? raw : `https://${raw}`;
  if (!/^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/.test(url)) throw new Error('Unexpected deployment URL; reconcile before retry');
  await writeFile(artifact, JSON.stringify({ projectId, url, productionBefore: before.targets.production.id, stage: ref, createdAt: new Date().toISOString() }, null, 2));
  const after = await project();
  if (after.targets.production.id !== before.targets.production.id) throw new Error('Production target changed');
  console.log(JSON.stringify({ url, productionUnchanged: true, stage: ref }));
}
