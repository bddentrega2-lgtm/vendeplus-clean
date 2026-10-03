import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { chromium } from 'playwright';

const base = process.env.SOMOS_QA_BASE_URL || 'http://127.0.0.1:3107';
const output = new URL('../tmp/kitchen-qa/', import.meta.url);
await mkdir(output, { recursive: true });
const env = parseEnv(await readFile(new URL('../.env.local',import.meta.url),'utf8').catch(() => readFile(new URL('../../.env.local',import.meta.url),'utf8')));
const secret = env.PANEL_SESSION_COOKIE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_JWT_SECRET;
assert.ok(secret);
const payload = Buffer.from(JSON.stringify({sid:'qa-kitchen',secret:'qa',sub:'qa-kitchen-user',email:'qa@example.invalid',exp:Math.floor(Date.now()/1000)+3600,founder:false})).toString('base64url');
const cookie = `${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`;
const browser = await chromium.launch({headless:true});
const results=[];
try {
 for (const width of [320,390,800,1024,1280,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:true});
  await context.addCookies([{name:'somos_panel_session',value:cookie,url:base,httpOnly:true}]);
  await context.addInitScript(() => sessionStorage.setItem('vendeplus_panel_token',`e30.${btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600}))}.qa`));
  const stamp=new Date(Date.now()-600_000).toISOString();
  let enabled=true, dispatchMode='manual', delayAlertsEnabled=false, delayThresholds={received:10,accepted:10,preparing:20,ready:10,delivering:30}, failNext=false, mutations=0, cancellation=null;
  const tickets=Array.from({length:10},(_,n)=>({order_id:`order-${n}`,state:'queued',sent_at:stamp,started_at:null,ready_at:null,closed_at:null,dispatch_method:'manual',payment_at_dispatch:'pending',orders:{id:`order-${n}`,public_code:`SO-QA-000000000000${n}`,customer_name:n===0?'Maria Alejandra Rodriguez de los Angeles':`Cliente Cocina ${n+1}`,created_at:stamp,status:'received',delivery_type:['table','delivery','pickup','pickup'][n%4],delivery_pricing_type:n%4===3?'bar':null,table_name_snapshot:n%4===0?`Mesa ${n+1}`:null,notes:n===3?'Pedido manual. Mensaje recibido: sin salsa':n%4===3?'Pedido manual.':'Sin cubiertos',order_details:'Preparar por separado',order_items:[{id:`item-${n}`,product_name:'Hamburguesa de prueba',quantity:2,variant_name:'Especial',notes:'Sin cebolla',order_item_options:[{id:`option-${n}`,option_group_name:'Extras',option_name:'Queso adicional',quantity:2}]}]}}));
  await context.route('**/api/**',route=>route.fulfill({json:{orders:[],tables:[],notifications:[],unreadCount:0}}));
  await context.route('**/api/panel/context',route=>route.fulfill({json:{userId:'qa-kitchen-user',isFounderMode:false,stores:[{id:'store-a',slug:'qa-store',name:'Cocina QA',role:'owner',subscription_status:'active',table_orders_access_enabled:true,table_orders_enabled:true}],selectedStoreId:'store-a',achievementFeatures:{},achievements:[]}}));
  await context.route('**/api/panel/orders**',route=>{
   if(route.request().method()!=='PATCH') return route.fulfill({json:{orders:[],page:{hasMore:false},serverTime:new Date().toISOString()}});
   const data=route.request().postDataJSON(), index=tickets.findIndex(ticket=>ticket.order_id===data.id);
   assert.ok(index>=0); assert.equal(data.status,'cancelled'); assert.equal(data.expectedStatus,tickets[index].orders.status);
   cancellation={reason:data.cancellationReason,detail:data.cancellationDetail};
   const [removed]=tickets.splice(index,1); removed.orders.status='cancelled';
   return route.fulfill({json:{order:removed.orders,serverTime:new Date().toISOString()}});
  });
  await context.route('**/api/panel/kitchen**',async route=>{
   assert.equal(route.request().headers()['x-panel-store-id'],'store-a');
   const method=route.request().method();
   if(method==='POST') {
    if(failNext) { failNext=false; return route.fulfill({status:409,json:{error:'La comanda cambio. Actualiza e intenta nuevamente.'}}); }
    const data=route.request().postDataJSON(), ticket=tickets.find(t=>t.order_id===data.orderId);
    assert.ok(ticket); assert.equal(ticket.state,data.expectedState);
    ticket.state=data.action==='prepare'?'preparing':'ready';
    ticket.orders.status=ticket.state;
    ticket[data.action==='prepare'?'started_at':'ready_at']=new Date().toISOString();
    mutations++;
    return route.fulfill({json:{ticket}});
   }
   if(method==='PATCH') { const data=route.request().postDataJSON(); enabled=data.enabled; dispatchMode=data.dispatchMode; delayAlertsEnabled=data.delayAlertsEnabled; delayThresholds=data.delayThresholds; return route.fulfill({json:{saved:true}}); }
   return route.fulfill({json:{eligible:true,settings:{enabled,dispatch_mode:dispatchMode,delay_alerts_enabled:delayAlertsEnabled,delay_thresholds:delayThresholds},tickets:enabled?tickets:[],hasMore:false,serverTime:new Date().toISOString()}});
  });
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/panel/cocina`,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Comandas',exact:true}).waitFor();
  await page.getByRole('status').waitFor();
  const tutorial=page.getByRole('button',{name:'Cerrar tutorial'});
  if(await tutorial.isVisible()) await tutorial.click();
  await page.locator('article').first().waitFor();
  assert.equal(await page.locator('article').count(),10);
  const column = state => page.locator(`section[data-kitchen-stage="${state}"]`);
  assert.equal(await column('queued').locator('article').count(),10);
  assert.equal(await column('preparing').locator('article').count(),0);
  assert.equal(await column('ready').locator('article').count(),0);
  assert.ok(await page.getByText('Maria Alejandra Rodriguez de los Angeles',{exact:true}).isVisible());
  assert.ok(await page.getByText('Sin cubiertos',{exact:true}).count());
  assert.ok(await page.getByText('Nota:').count());
  assert.ok(await page.getByText('Mensaje recibido: sin salsa',{exact:true}).count());
  await page.getByRole('combobox',{name:'Modalidad',exact:true}).selectOption('Mesa');
  assert.equal(await page.locator('article').count(),3);
  await page.getByRole('textbox',{name:'Buscar pedido, cliente o mesa'}).fill('Maria Alejandra');
  assert.equal(await page.locator('article').count(),1);
  assert.ok(await page.getByText('Espera 10 min',{exact:true}).isVisible());
  assert.equal(await page.locator('summary').filter({hasText:'Tiempos'}).count(),0);
  await page.getByRole('button',{name:'Iniciar preparación',exact:true}).click();
  await page.getByRole('button',{name:'Marcar listo',exact:true}).waitFor();
  assert.equal(await column('queued').locator('article').count(),0);
  assert.equal(await column('preparing').locator('article').count(),1,'Order must move into preparing column');
  failNext=true;
  await page.getByRole('button',{name:'Marcar listo',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'La comanda cambio'}).waitFor();
  await page.waitForTimeout(350);
  assert.ok(await page.getByRole('alert').filter({hasText:'La comanda cambio'}).isVisible(),'Mutation failure remains visible after refresh');
  assert.equal(await column('preparing').locator('article').count(),1,'Failed mutation must not move the ticket');
  assert.equal(await column('ready').locator('article').count(),0);
  await page.getByRole('button',{name:'Marcar listo',exact:true}).click();
  await page.getByText('Pendiente de entrega',{exact:true}).waitFor();
  assert.equal(await column('preparing').locator('article').count(),0);
  assert.equal(await column('ready').locator('article').count(),1,'Order must move into ready column');
  assert.equal(tickets[0].payment_at_dispatch,'pending');
  assert.equal(mutations,2);
  await page.getByRole('combobox',{name:'Modalidad',exact:true}).selectOption('Todas');
  await page.getByRole('textbox',{name:'Buscar pedido, cliente o mesa'}).fill('');
  const statusFilters=page.getByRole('group',{name:'Estado de las comandas'});
  await statusFilters.getByRole('button',{name:/Listos/}).click();
  assert.equal(await page.locator('article').count(),1);
  await statusFilters.getByRole('button',{name:/Por preparar/}).click();
  assert.equal(await page.locator('article').count(),9);
  await statusFilters.getByRole('button',{name:/Todas/}).click();
  assert.equal(await page.locator('article').count(),10);
  // Simulate a status changed by another operator and received on the next snapshot.
  tickets[1].state='preparing';tickets[1].orders.status='preparing';tickets[1].started_at=new Date().toISOString();
  await page.getByRole('button',{name:'Actualizar comandas',exact:true}).click();
  await column('preparing').getByRole('heading',{name:tickets[1].orders.public_code,exact:true}).waitFor();
  assert.equal(await column('queued').locator('article').count(),8);
  assert.equal(await column('preparing').locator('article').count(),1);
  assert.equal(await column('ready').locator('article').count(),1);
  await page.getByRole('button',{name:'Configurar Cocina',exact:true}).click();
  const delaySwitch=page.getByRole('switch',{name:'Activar alertas de demora'});
  await delaySwitch.click();
  await page.getByLabel('Demora para Nuevo').fill('6');
  await page.getByRole('button',{name:'Guardar tiempos',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('[role="switch"][aria-label="Activar alertas de demora"]')?.getAttribute('aria-checked') === 'true');
  assert.equal(delayAlertsEnabled,true);
  assert.equal(delayThresholds.received,6);
  await page.getByRole('combobox',{name:'Entrada de comandas',exact:true}).selectOption('paid');
  await page.waitForFunction(()=>document.querySelector('select[aria-label="Entrada de comandas"]')?.value==='paid');
  await page.getByRole('button',{name:'Configurar Cocina',exact:true}).click();
  const geometry=await page.evaluate(()=>({body:document.body.scrollWidth,html:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(geometry.body<=geometry.viewport+1,JSON.stringify(geometry));
  assert.ok(geometry.html<=geometry.viewport+1,JSON.stringify(geometry));
  assert.deepEqual(errors,[]);
  const density=await page.locator('article').evaluateAll(cards=>({heights:cards.map(card=>Math.round(card.getBoundingClientRect().height)),columns:cards.filter(card=>Math.abs(card.getBoundingClientRect().top-cards[0].getBoundingClientRect().top)<2).length}));
  assert.ok(Math.max(...density.heights)<400,JSON.stringify(density));
  const lanes=await page.locator('section[data-kitchen-stage]').evaluateAll(sections=>sections.map(section=>({left:section.getBoundingClientRect().left,top:section.getBoundingClientRect().top})));
  if(width>=1280) {
    assert.equal(lanes.length,3);
    assert.ok(lanes[0].left<lanes[1].left && lanes[1].left<lanes[2].left,'States keep independent ordered columns');
    assert.ok(lanes.every(lane=>Math.abs(lane.top-lanes[0].top)<2),'State headers align');
  }
  if(width===800) assert.ok(density.columns>=2,JSON.stringify(density));
  const border=await page.locator('article').first().evaluate(card=>({top:getComputedStyle(card).borderTopColor,bottom:getComputedStyle(card).borderBottomColor}));
  assert.notEqual(border.top,border.bottom,'State stripe must retain its color');
  await page.screenshot({path:fileURLToPath(new URL(`kitchen-${width}.png`,output)),fullPage:true});
  if(width===1280) {
    await page.getByRole('button',{name:'Pantalla completa',exact:true}).click();
    await page.getByRole('button',{name:'Salir de pantalla completa',exact:true}).waitFor();
    const cols=await page.locator('article').evaluateAll(cards=>cards.filter(card=>Math.abs(card.getBoundingClientRect().top-cards[0].getBoundingClientRect().top)<2).length);
    assert.equal(cols,3,`Fullscreen retains three state columns: ${cols}`);
    await page.screenshot({path:fileURLToPath(new URL('kitchen-fullscreen.png',output))});
    await page.getByRole('button',{name:'Salir de pantalla completa',exact:true}).click();
  }
  const longNote='Nota importante '+ 'SinAjonjoli'.repeat(22);
  tickets[9].orders.order_items[0].notes=longNote;
  await page.getByRole('button',{name:'Actualizar comandas',exact:true}).click();
  await page.getByText(longNote,{exact:false}).waitFor();
  assert.ok(await page.getByText(longNote,{exact:false}).isVisible());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Long notes must wrap without overflow');
  const cancelCode=tickets[9].orders.public_code;
  const cancellable=page.locator('article').filter({has:page.getByRole('heading',{name:cancelCode,exact:true})});
  await cancellable.getByRole('button',{name:`Cancelar ${cancelCode}`,exact:true}).click();
  const cancelDialog=page.getByRole('dialog',{name:'Cancelar pedido',exact:true});
  await cancelDialog.waitFor();
  await cancelDialog.getByRole('combobox').selectOption('Producto agotado');
  await cancelDialog.getByRole('button',{name:'Confirmar cancelación',exact:true}).click();
  await page.getByRole('heading',{name:cancelCode,exact:true}).waitFor({state:'detached'});
  await page.waitForFunction(()=>document.querySelectorAll('article').length===9);
  assert.deepEqual(cancellation,{reason:'Producto agotado',detail:''});
  results.push({width,pass:true,geometry,density});
  await context.close();
 }
} finally { await browser.close(); await writeFile(new URL('results.json',output),JSON.stringify(results,null,2)); }
console.log(`PASS kitchen UI ${results.length}/6 viewports; 10 tickets, movement between state columns, failed and external updates, compact density, filters, timers, notes, fullscreen, no overflow (mocked HTTP).`);
