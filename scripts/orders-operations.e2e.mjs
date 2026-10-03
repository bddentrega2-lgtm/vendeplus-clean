import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHmac } from 'node:crypto';

const base='http://127.0.0.1:3107', output='tmp/orders-operations-qa';
await mkdir(output,{recursive:true});
const env={};
for(const path of ['../../.env.local','../.env.local','./.env.local']) {
 try {Object.assign(env,parseEnv(await readFile(new URL(path,import.meta.url),'utf8')));} catch(error) {if(error?.code!=='ENOENT')throw error;}
}
const secret=env.PANEL_SESSION_COOKIE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_JWT_SECRET;
const payload=Buffer.from(JSON.stringify({sid:'qa-operations',secret:'qa',sub:'qa-operations',email:'qa@example.invalid',exp:Math.floor(Date.now()/1000)+3600,founder:false})).toString('base64url');
const cookie=`${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`;
const browser=await chromium.launch({headless:true});
try {
 for(const native of [false,true]) {
  const context=await browser.newContext({viewport:{width:1280,height:900},isMobile:native,hasTouch:native});
  await context.addCookies([{name:'somos_panel_session',value:cookie,url:base,httpOnly:true}]);
  await context.addInitScript(native=>{
   sessionStorage.setItem('vendeplus_panel_token',`e30.${btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600}))}.qa`);
   if(native) window.Capacitor={isNativePlatform:()=>true,Plugins:{}};
  },native);
  const store={id:'qa-store',slug:'qa-store',name:'Cocina QA',role:'owner',subscription_status:'active',table_orders_access_enabled:true,table_orders_enabled:true};
  const stamp=new Date(Date.now()-600_000).toISOString();
  const order={id:'qa-order',store_id:store.id,public_code:'SO-1003-00000000001',customer_name:'Maria Alejandra Rodriguez Rodriguez de los Angeles',customer_phone:'04120000000',status:'received',created_at:stamp,status_entered_at:stamp,status_elapsed_ms:{},delivery_type:'table',store_table_id:'qa-table',table_name_snapshot:'Mesa 1',table_fulfillment_snapshot:'table_service',delivery_notes:'Zona centro. Tarifa de traslado confirmada para la direccion suministrada.',payment_status:'pending',payment_method:'Efectivo',payment_reference:'12345678',total_usd:12,subtotal_usd:12,delivery_usd:0,stores:store,order_items:[]};
  const counterOrder={...order,id:'qa-counter-order',public_code:'SO-1003-BARRA',customer_name:'Cliente barra',store_table_id:null,table_name_snapshot:'Barra',table_fulfillment_snapshot:'counter_pickup'};
  let ticket=null, failNext=false, orderReads=0, kitchenReads=0;
  const orderQueries=[];
  let kitchenSettings={enabled:true,dispatch_mode:'manual',delay_alerts_enabled:true,delay_thresholds:{received:5,accepted:5,preparing:20,ready:10,delivering:30}};
  await context.route('**/api/**',route=>route.fulfill({json:{orders:[],notifications:[],unreadCount:0}}));
  await context.route('**/api/panel/context',route=>route.fulfill({json:{userId:'qa-operations',isFounderMode:false,stores:[store],selectedStoreId:store.id,achievementFeatures:{},achievements:[]}}));
  await context.route('**/api/panel/tables**',route=>route.fulfill({json:{enabled:true,tables:[{id:'qa-table',name:'Mesa 1',zone:'Interior',is_enabled:true}],tableOrders:[order],counterOrders:[counterOrder],activeOrders:[order,counterOrder],waiterCalls:[],waiterCallsEnabled:false,waiterCallLabel:'Pedir asistencia',paymentMethods:['Efectivo'],selectedPaymentMethods:['Efectivo'],fulfillmentMode:'table_service',qrToken:''}}));
  await context.route('**/api/panel/kitchen**',async route=>{
   kitchenReads++;
   if(route.request().method()==='PATCH') {
    const body=route.request().postDataJSON(); kitchenSettings={...kitchenSettings,enabled:body.enabled,dispatch_mode:body.dispatchMode,delay_alerts_enabled:body.delayAlertsEnabled,delay_thresholds:body.delayThresholds};
    return route.fulfill({json:{saved:true,settings:kitchenSettings}});
   }
   if(route.request().method()==='POST') {
    const body=route.request().postDataJSON(); assert.equal(body.action,'send');
    ticket={order_id:order.id,state:'queued',sent_at:new Date().toISOString(),started_at:null,ready_at:null};
   }
   await route.fulfill({json:{eligible:true,settings:kitchenSettings,tickets:ticket?[ticket]:[],serverTime:new Date().toISOString()}});
  });
  await context.route('**/api/panel/orders**',async route=>{
   const method=route.request().method();
   if(method==='PATCH') {
    if(failNext) {failNext=false; return route.fulfill({status:409,json:{error:'El pedido cambio. Actualiza e intenta de nuevo.'}});}
    const body=route.request().postDataJSON();
    if(body.paymentStatus) { order.payment_status=body.paymentStatus; if(body.paymentStatus==='verified' && order.status==='received') order.status='accepted'; }
    else {
     assert.equal(body.expectedStatus,order.status);
     order.status_elapsed_ms[order.status]=(order.status_elapsed_ms[order.status]||0)+Math.max(0,Date.now()-Date.parse(order.status_entered_at));
     order.status=body.status; order.status_entered_at=new Date().toISOString();
     if(ticket) ticket.state=body.status==='accepted'?'queued':body.status;
    }
    return route.fulfill({json:{order,serverTime:new Date().toISOString()}});
   }
   orderReads++;
   orderQueries.push(route.request().url());
   return route.fulfill({json:{orders:[order],order,page:{hasMore:false},serverTime:new Date().toISOString(),auth:{storeIds:[]}}});
  });
  const page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message)); page.on('dialog',dialog=>dialog.accept());
  await page.goto(`${base}/panel/pedidos`);
  await page.getByRole('heading',{name:order.public_code,exact:true}).waitFor();
  const tutorial=page.getByRole('button',{name:'Cerrar tutorial'});
  if(await tutorial.isVisible()) await tutorial.click();
  const card=page.locator('.native-order-card');
  assert.ok(orderQueries.some(url=>new URL(url).searchParams.get('status')==='active'));
  await page.getByPlaceholder(/Buscar por/).fill('Maria');
  await page.getByText('Actualizando resultados...',{exact:true}).waitFor();
  await page.getByRole('heading',{name:order.public_code,exact:true}).waitFor();
  await page.getByRole('button',{name:'Filtros',exact:true}).click();
  assert.equal(await page.getByRole('switch',{name:'Activar alertas de demora'}).count(),0,'Delay settings belong to Kitchen configuration, not order filters');
  for(const width of [320,390,800,1024,1280,1440]) {
   await page.setViewportSize({width,height:900}); await page.evaluate(()=>document.fonts.ready);
   assert.equal(await card.getByRole('combobox').count(),1);
   const clipping=await card.locator('h3,p').evaluateAll(els=>els.filter(el=>{
    const r=el.getBoundingClientRect(), range=document.createRange(); range.selectNodeContents(el);
    return getComputedStyle(el).textOverflow==='ellipsis' || [...range.getClientRects()].some(t=>t.right>r.right+1 || t.bottom>r.bottom+1);
   }).map(el=>el.textContent));
   assert.deepEqual(clipping,[],`clipped ${native}/${width}`);
   const select=card.getByRole('combobox');
   assert.ok(await select.evaluate(el=>{
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=getComputedStyle(el).font;
    return Math.max(...[...el.options].map(o=>ctx.measureText(o.text).width))+35<=el.clientWidth;
   }),`status text ${native}/${width}`);
   const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,offenders:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(el=>({tag:el.tagName,class:el.className,text:(el.textContent||'').slice(0,50),right:Math.round(el.getBoundingClientRect().right)}))}));
   assert.ok(overflow.page<=overflow.viewport+1,`overflow ${native}/${width}: ${JSON.stringify(overflow)}`);
   await card.screenshot({path:`${output}/orders-${native?'app':'web'}-${width}.png`});
  }
  await page.setViewportSize({width:1280,height:900});
  assert.ok(await card.getByText('Demorado · 10 min en este estado',{exact:true}).isVisible());
  assert.equal(await card.locator('[data-order-status-time][data-delayed="true"]').count(),1);
  await card.getByRole('button',{name:'Enviar a cocina',exact:true}).click();
  await card.locator('[aria-label="En cocina: Por preparar"]').waitFor();
  assert.equal(order.payment_status,'pending');
  assert.equal(await card.getByRole('button',{name:'Enviar a cocina',exact:true}).count(),0);
  await card.getByRole('combobox').selectOption('preparing');
  await card.locator('[aria-label="En cocina: En preparaci\u00f3n"]').waitFor();
  await card.getByText('<1 min en este estado',{exact:true}).waitFor();
  const phase=order.status_entered_at;
  await card.getByRole('button',{name:`Confirmar pago de ${order.public_code}`,exact:true}).click();
  await card.getByText('Pagado',{exact:true}).waitFor();
  assert.equal(order.status_entered_at,phase);
  failNext=true;
  await card.getByRole('combobox').selectOption('ready');
  await page.getByText('El pedido cambio. Actualiza e intenta de nuevo.',{exact:true}).waitFor();
  assert.equal(await card.getByRole('combobox').inputValue(),'preparing');
  await page.reload(); await page.getByRole('heading',{name:order.public_code,exact:true}).waitFor();
  assert.equal(await card.getByRole('combobox').inputValue(),'preparing');
  assert.equal(order.status_entered_at,phase);
  await card.locator('summary').click();
  assert.ok(await card.getByRole('definition').count()>=2);
  console.log(`PASS orders ${native?'app':'web'}: 6 widths, text, single state, icon, payment, timers, failed update, reload; reads ${orderReads}/${kitchenReads}`);

  await page.goto(`${base}/panel/mesas`);
  await page.getByRole('button',{name:'Pantalla completa',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Pedidos en barra',exact:true}).waitFor();
  await page.getByText(counterOrder.public_code,{exact:true}).waitFor();
  if(await tutorial.isVisible()) await tutorial.click();
  await page.getByRole('button',{name:'Pantalla completa',exact:true}).click();
  await page.getByRole('button',{name:'Salir de pantalla completa',exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.fullscreenElement?.hasAttribute('data-tables-board')));
  await page.getByRole('button',{name:`Revisar pago de ${order.public_code}`,exact:true}).click();
  await page.locator('dialog[open]').waitFor();
  assert.ok(await page.locator('dialog[open]').isVisible());
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:`Comanda y pago de ${order.public_code}`,exact:true}).click();
  await page.getByRole('button',{name:'Cerrar detalle',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();
  await page.getByRole('button',{name:'Salir de pantalla completa',exact:true}).click();
  await page.getByRole('button',{name:'Pantalla completa',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.fullscreenElement),null);
  // Unsupported fullscreen must still expand the board, with an explicit exit.
  await page.evaluate(()=>{Element.prototype.requestFullscreen=undefined;});
  await page.getByRole('button',{name:'Pantalla completa',exact:true}).click();
  await page.getByRole('button',{name:'Salir de pantalla completa',exact:true}).waitFor();
  assert.equal(await page.locator('[data-tables-board]').evaluate(el=>getComputedStyle(el).position),'fixed');
  await page.getByRole('button',{name:'Salir de pantalla completa',exact:true}).click();
  for(const width of [320,390,800,1280]) {
   await page.setViewportSize({width,height:900});
   await page.getByRole('button',{name:'Pantalla completa',exact:true}).click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`${output}/tables-${native?'app':'web'}-${width}.png`});
   await page.getByRole('button',{name:'Salir de pantalla completa',exact:true}).click();
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS tables ${native?'app':'web'}: fullscreen, payment, command, exit, fallback, 4 widths`);
  await context.close();
 }
} finally {await browser.close();}
