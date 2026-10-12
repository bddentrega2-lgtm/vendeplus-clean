import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const base = process.argv[2];
const beforeSchema = process.argv.includes('--before-schema');
const independentPayment = process.argv.includes('--independent-payment');
assert.match(base || '', /^https:\/\/(www\.somos-ve\.com|vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app)$/);
const paths = [
  ['/', 200], ['/registro', 200], ['/registro/pago', 200], ['/aliados', 200],
  ['/admin/aliados', 200], ['/transporte/panel/referidos', 200], ['/marketplace', 200],
  ['/smash/checkout', 200], ['/realza/checkout', 200], ['/shibui/carrito', 200], ['/panel/login', 200],
  ['/api/panel/orders', 401], ['/api/panel/order-notifications', 401],
  ['/api/admin/affiliates', 401], ['/api/admin/affiliates/commissions', 401],
  ['/api/affiliates/me', 401], ['/api/affiliates/payout', 401],
];
if (!beforeSchema) paths.push(['/api/affiliate-code?code=QA_RELEASE_NOT_CONFIGURED', 200]);
if (independentPayment) paths.push(['/api/admin/registration-requests?status=payment_pending', 401]);
for (const [path, expected] of paths) {
  let status, text;
  if (base.endsWith('.vercel.app')) {
    const output = execFileSync(process.execPath, [
      `${process.env.APPDATA}/npm/node_modules/vercel/dist/vc.js`, 'curl', path, '--deployment', base,
      '--', '--silent', '--show-error', '--location', '--max-time', '30', '--write-out', '\\n%{http_code}',
    ], { encoding: 'utf8', maxBuffer: 8_000_000, timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] });
    const lines = output.trimEnd().split('\n');
    status = Number(lines.pop()); text = lines.join('\n');
  } else {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(30_000) });
    status = response.status; text = await response.text();
  }
  assert.equal(status, expected, path);
  if (expected === 401) assert.ok(JSON.parse(text).error, path);
  else {
    assert.doesNotMatch(text, /Application error: a (?:client|server)-side exception/);
    if (path.startsWith('/api/affiliate-code')) assert.equal(JSON.parse(text).valid, false);
    if (path === '/') assert.match(text, /pago \u00fanico de \$20/i);
    if (path === '/registro') assert.match(text, /20\.00/);
    if (independentPayment && path === '/registro') assert.match(text, /Guardaremos tu solicitud sin pedirte el pago ahora/);
  }
  console.log(`PASS ${status} ${path}`);
}
console.log(JSON.stringify({ base, phase: beforeSchema ? 'before-schema' : 'release', readOnly: true, checks: paths.length }));
