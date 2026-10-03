import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Called only by the staging helper after checking project and preview identities.
export async function provisionKitchenOperator(keys, base) {
  assert.equal(keys.ref, 'xpqmmdmixpyqruykkbkf');
  assert.match(base, /^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/);
  const email = String(keys.operatorEmail || '').trim().toLowerCase();
  assert.match(email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  const db = createClient(`https://${keys.ref}.supabase.co`, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
  const ok = result => { if (result.error) throw new Error(result.error.message); return result.data; };
  const store = '51000000-0000-4000-8000-000000000001';
  const commerce = ok(await db.from('stores').select('id,slug').eq('id',store).single());
  assert.equal(commerce.slug, 'cocina-demo');
  let user;
  for (let page = 1; ; page++) {
    const result = ok(await db.auth.admin.listUsers({ page, perPage: 100 }));
    user = result.users.find(entry => entry.email?.toLowerCase() === email);
    if (user || result.users.length < 100) break;
    if (page >= 100) throw new Error('Unexpected staging user count');
  }
  const created = !user;
  const password = created || keys.resetInitialPassword === true ? `Cocina-${randomBytes(12).toString('base64url')}!7` : null;
  if (created) user = ok(await db.auth.admin.createUser({ email, password, email_confirm: true })).user;
  const memberships = ok(await db.from('store_users').select('store_id,role').eq('user_id',user.id));
  assert.ok(memberships.every(row => row.store_id === store), 'Existing user has unrelated staging access; stop for review');
  if (!created && password) ok(await db.auth.admin.updateUserById(user.id,{password}));
  if (!memberships.length) ok(await db.from('store_users').insert({store_id:store,user_id:user.id,role:'owner'}));
  // Initial credential is intentionally returned to the requesting user, never written to a file.
  console.log(JSON.stringify({created,email,store:'Cocina Demo',login:`${base}/panel/login?next=/panel/cocina`,initialPreviewPassword:password,productionModified:false}));
  let verified = false;
  if (password) {
    const auth = createClient(`https://${keys.ref}.supabase.co`,keys.anon,{auth:{persistSession:false,autoRefreshToken:false}});
    const session = ok(await auth.auth.signInWithPassword({email,password})).session;
    const headers = {Authorization:`Bearer ${session.access_token}`,'X-Panel-Store-Id':store};
    for (const path of ['/api/panel/context','/api/panel/kitchen?view=board',`/api/panel/tables?storeId=${store}&view=live`,'/api/panel/orders?date=today&compact=true&limit=40']) {
      const response = await fetch(`${base}${path}`,{headers,signal:AbortSignal.timeout(30000)});
      assert.equal(response.status,200,`Preview access failed: ${path}`);
      if(path === '/api/panel/context') {
        const context = await response.json();
        assert.deepEqual(context.stores.map(row => row.id),[store]);
      }
    }
    ok(await auth.auth.signOut());
    verified = true;
  }
  console.log(JSON.stringify({verified,productionModified:false}));
}
