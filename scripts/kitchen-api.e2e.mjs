import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

export async function testKitchenApi(keys, base) {
 assert.equal(keys.ref,'xpqmmdmixpyqruykkbkf');
 assert.match(base,/^https:\/\/vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$/);
 const db=createClient(`https://${keys.ref}.supabase.co`,keys.service,{auth:{persistSession:false,autoRefreshToken:false}});
 const ok=result=>{if(result.error)throw new Error(result.error.message);return result.data;};
 const store='51000000-0000-4000-8000-000000000001', other='51000000-0000-4000-8000-000000000002';
 const original=ok(await db.from('store_kitchen_settings').select('*').eq('store_id',store).single());
 let userId,orderId,cancelOrderId,access,manualOrderId,qaProductId,realtimeClient,realtimeChannel,browser,browserContext;
 const realtimeEvents=[];
 const timings=[];
 const call=async(path,method='GET',body,storeId=store,expected=200)=>{
  const start=performance.now();
  const response=await fetch(`${base}${path}`,{method,headers:{Authorization:`Bearer ${access}`,'X-Panel-Store-Id':storeId,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  const data=await response.json();
  assert.equal(response.status,expected,`${method} ${path}: ${response.status} ${data.error || ''}`);
  timings.push({path,method,ms:Math.round(performance.now()-start)});
  return data;
 };
 try {
  const email=`kitchen-qa-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url');
  const user=ok(await db.auth.admin.createUser({email,password,email_confirm:true}));userId=user.user.id;
  ok(await db.from('store_users').insert({store_id:store,user_id:userId,role:'owner'}));
  const auth=createClient(`https://${keys.ref}.supabase.co`,keys.anon,{auth:{persistSession:false,autoRefreshToken:false}});
  access=ok(await auth.auth.signInWithPassword({email,password})).session.access_token;
  realtimeClient=auth;
  await auth.realtime.setAuth(access);
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(new Error('Private Cocina realtime did not subscribe.')),10000);
   realtimeChannel=auth.channel(`store:${store}:orders`,{config:{private:true}})
    .on('broadcast',{event:'kitchen_changed'},()=>realtimeEvents.push('kitchen_changed'))
    .on('broadcast',{event:'order_changed'},()=>realtimeEvents.push('order_changed'))
    .subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve();}else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){clearTimeout(timeout);reject(new Error(`Private Cocina realtime ${status}.`));}});
  });
  const anonymous=await fetch(`${base}/api/panel/kitchen`,{headers:{'X-Panel-Store-Id':store}});
  assert.equal(anonymous.status,401);
  await call('/api/panel/kitchen?view=board','GET',undefined,other,403);
  await call('/api/panel/kitchen','PATCH',{enabled:true,dispatchMode:'manual',delayAlertsEnabled:false});
  browser=await chromium.launch({headless:true});
  browserContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const panelSession=await fetch(`${base}/api/auth/panel-session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:access})});
  assert.equal(panelSession.status,200,'Browser panel session must be created.');
  const panelCookies=panelSession.headers.getSetCookie().map(value=>value.split(';',1)[0]).map(value=>{
   const separator=value.indexOf('=');
   return {name:value.slice(0,separator),value:value.slice(separator+1),url:base,httpOnly:true,secure:true,sameSite:'Lax'};
  });
  assert.ok(panelCookies.length);
  await browserContext.addCookies(panelCookies);
  await browserContext.addInitScript(token=>sessionStorage.setItem('vendeplus_panel_token',token),access);
  const page=await browserContext.newPage();
  await page.goto(`${base}/panel/cocina`,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Comandas',exact:true}).waitFor({timeout:30_000});
  await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent?.includes('En vivo'),undefined,{timeout:15_000});
  assert.match((await page.getByRole('status').textContent()) || '',/En vivo/);
  console.log('PASS authenticated browser shares one Realtime channel and shows En vivo.');
  const board=await call('/api/panel/kitchen?view=board');
  assert.ok(board.tickets.some(t=>t.orders?.order_items?.length),'Embedded item/option query works');
  assert.ok(board.tickets.some(t=>t.orders?.customer_name),'Kitchen board includes customer names');
  const tables=await call('/api/panel/kitchen?view=tables');
  assert.ok(tables.tables.length);
  const product=ok(await db.from('products').select('id,name,price_usd').eq('store_id',store).limit(1).single());
  orderId=randomUUID();
  ok(await db.rpc('create_order_atomic',{p_order:{id:orderId,store_id:store,public_code:`QA-${randomUUID().slice(0,8)}`,idempotency_key:randomUUID(),customer_name:'API QA',customer_phone:'',delivery_type:'pickup',payment_method:'Efectivo',payment_status:'pending',subtotal_usd:product.price_usd,total_usd:product.price_usd,platform_service_fee_usd:0},p_items:[{product_id:product.id,product_name:product.name,quantity:1,unit_price_usd:product.price_usd,total_usd:product.price_usd,options:[]}]}));
  for(let n=0;n<2;n++) await call('/api/panel/kitchen','POST',{orderId,action:'send'});
  for(let n=0;n<20 && !realtimeEvents.includes('kitchen_changed');n++) await new Promise(resolve=>setTimeout(resolve,100));
  assert.ok(realtimeEvents.includes('kitchen_changed'),'Kitchen mutation must arrive through private realtime.');
  assert.equal(ok(await db.from('orders').select('status').eq('id',orderId).single()).status,'accepted');
  await call('/api/panel/kitchen','POST',{orderId,action:'prepare',expectedState:'queued'});
  await call('/api/panel/kitchen','POST',{orderId,action:'ready',expectedState:'preparing'});
  const order=ok(await db.from('orders').select('status,payment_status,total_usd').eq('id',orderId).single());
  assert.equal(order.status,'ready'); assert.equal(order.payment_status,'pending'); assert.equal(Number(order.total_usd),Number(product.price_usd));
  await call('/api/panel/kitchen','POST',{orderId,action:'prepare',expectedState:'queued'},store,400);
  cancelOrderId=randomUUID();
  ok(await db.rpc('create_order_atomic',{p_order:{id:cancelOrderId,store_id:store,public_code:`QA-CANCEL-${randomUUID().slice(0,8)}`,idempotency_key:randomUUID(),customer_name:'Cancel QA',customer_phone:'',delivery_type:'pickup',payment_method:'Efectivo',payment_status:'pending',subtotal_usd:product.price_usd,total_usd:product.price_usd,platform_service_fee_usd:0},p_items:[{product_id:product.id,product_name:product.name,quantity:1,unit_price_usd:product.price_usd,total_usd:product.price_usd,options:[]}]}));
  await call('/api/panel/orders','PATCH',{id:cancelOrderId,status:'cancelled'},store,400);
  await call('/api/panel/orders','PATCH',{id:cancelOrderId,status:'cancelled',cancellationReason:'Cliente desistió',cancellationDetail:''});
  const cancelledPickup=ok(await db.from('orders').select('status,table_cancellation_reason').eq('id',cancelOrderId).single());
  assert.equal(cancelledPickup.status,'cancelled');assert.equal(cancelledPickup.table_cancellation_reason,'Cliente desistió');
  await call('/api/panel/kitchen','PATCH',{enabled:false,dispatchMode:'manual',delayAlertsEnabled:false});
  for(const status of ['accepted','preparing','ready','completed']) await call('/api/panel/orders','PATCH',{id:orderId,status});
  qaProductId=randomUUID();
  ok(await db.from('products').insert({id:qaProductId,store_id:store,name:'Temporary kitchen QA',price_usd:1,is_available:true}));
  await call('/api/panel/kitchen','PATCH',{enabled:true,dispatchMode:'paid',delayAlertsEnabled:false});
  const manual=await call('/api/panel/orders','POST',{storeId:store,idempotencyKey:randomUUID(),deliveryType:'table',tableId:tables.tables[0].id,deliveryReference:'untrusted table label',paymentMethod:'Efectivo',items:[{productId:qaProductId,quantity:1,selectedOptions:[]}]});
  manualOrderId=manual.order.id;
  const stored=ok(await db.from('orders').select('delivery_type,store_table_id,table_name_snapshot').eq('id',manualOrderId).single());
  assert.equal(stored.delivery_type,'table');assert.equal(stored.store_table_id,tables.tables[0].id);assert.equal(stored.table_name_snapshot,tables.tables[0].name);
  assert.equal(ok(await db.from('order_kitchen_tickets').select('order_id').eq('order_id',manualOrderId)).length,0);
  const tablePage=await browserContext.newPage();
  await tablePage.goto(`${base}/panel/mesas`,{waitUntil:'domcontentloaded'});
  await tablePage.getByText(manual.order.public_code,{exact:true}).waitFor({timeout:30_000});
  await call(`/api/panel/orders/${manualOrderId}/payment`,'PATCH',{paymentStatus:'verified'});
  assert.equal(ok(await db.from('orders').select('status').eq('id',manualOrderId).single()).status,'accepted');
  assert.equal(ok(await db.from('order_kitchen_tickets').select('dispatch_method').eq('order_id',manualOrderId).single()).dispatch_method,'paid');
  await call('/api/panel/kitchen','POST',{orderId:manualOrderId,action:'prepare',expectedState:'queued'});
  await call('/api/panel/kitchen','POST',{orderId:manualOrderId,action:'ready',expectedState:'preparing'});
  const tableCard=tablePage.getByText(manual.order.public_code,{exact:true}).locator('..').locator('..');
  await tableCard.getByText('Listo para entregar',{exact:false}).waitFor({timeout:15_000});
  await call('/api/panel/orders','PATCH',{id:manualOrderId,status:'cancelled',expectedStatus:'ready',cancellationReason:'Producto agotado',cancellationDetail:''});
  const cancelled=ok(await db.from('orders').select('status,table_cancellation_reason').eq('id',manualOrderId).single());
  assert.equal(cancelled.status,'cancelled'); assert.equal(cancelled.table_cancellation_reason,'Producto agotado');
  assert.equal(ok(await db.from('order_kitchen_tickets').select('state').eq('order_id',manualOrderId).single()).state,'cancelled');
  console.log('PASS Kitchen cancellation closes the real order and ticket with its reason.');
  console.log('PASS Mesa receives Cocina ready through Realtime without reloading.');
  console.log('PASS physical table manual order and automatic dispatch through payment API.');
  console.log(JSON.stringify({pass:true,realPreviewApi:true,checks:['auth401','tenant403','embedded items','table selector','unpaid manual dispatch','deduplication','prepare','ready','stale state rejected','pickup cancellation reason required and saved','Pedidos with kitchen disabled'],timings}));
 } finally {
  const errors=[];
  if(browserContext) await browserContext.close().catch(()=>{});
  if(browser) await browser.close().catch(()=>{});
  if(realtimeClient && realtimeChannel) await realtimeClient.removeChannel(realtimeChannel);
  const clean=async(label,promise)=>{const result=await promise;if(result.error)errors.push(`${label}: ${result.error.message}`);};
  if(orderId) await clean('test order',db.from('orders').delete().eq('id',orderId).eq('store_id',store));
  if(cancelOrderId) await clean('test cancelled pickup',db.from('orders').delete().eq('id',cancelOrderId).eq('store_id',store));
  if(manualOrderId) await clean('test table order',db.from('orders').delete().eq('id',manualOrderId).eq('store_id',store));
  if(qaProductId) await clean('test product',db.from('products').delete().eq('id',qaProductId).eq('store_id',store));
  await clean('settings restore',db.from('store_kitchen_settings').upsert(original));
  if(userId) {
   await clean('membership',db.from('store_users').delete().eq('user_id',userId).eq('store_id',store));
   await clean('test auth user',db.auth.admin.deleteUser(userId));
  }
  assert.deepEqual(errors,[],'QA cleanup must complete');
  console.log('Temporary staging order and user removed; original settings restored.');
 }
}
