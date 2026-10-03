import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '../tmp/buyer-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import { currentOrderStatusMs, recordedOrderStatusTimes, formatStatusDuration } from '../src/lib/order-status-timing.ts';

test('current phase, repeated phase totals, closed and unknown legacy timings', () => {
  const now = Date.parse('2026-10-03T12:00:00Z');
  const order = {status:'preparing',status_entered_at:'2026-10-03T11:58:00Z',status_elapsed_ms:{received:60_000,preparing:180_000}};
  assert.equal(currentOrderStatusMs(order,now),120_000);
  assert.deepEqual(recordedOrderStatusTimes(order,now).map(row=>[row.value,row.ms]),[['received',60_000],['preparing',300_000]]);
  assert.equal(currentOrderStatusMs({...order,status:'completed'},now),null);
  assert.equal(currentOrderStatusMs({status:'received'},now),null);
  assert.deepEqual(recordedOrderStatusTimes({status:'ready'},now),[]);
  assert.equal(currentOrderStatusMs({...order,status_entered_at:'2026-10-03T12:10:00Z'},now),0);
  assert.equal(formatStatusDuration(0),'<1 min');
  assert.equal(formatStatusDuration(61*60_000),'1 h 1 min');
});

test('database owns phase timing, skips legacy history and ignores payment, duplicate and spoofed timing writes', async () => {
  const db=new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create table public.orders(id integer primary key, status text, payment_status text); insert into orders values(1,'preparing','pending');");
    await db.exec(readFileSync(new URL('../supabase/migrations/20261003153000_order_status_timing.sql',import.meta.url),'utf8'));
    const row = async id => (await db.query('select * from orders where id=$1',[id])).rows[0];
    assert.equal((await row(1)).status_entered_at,null);
    await db.exec("update orders set payment_status='verified' where id=1");
    assert.equal((await row(1)).status_entered_at,null);
    await db.exec("update orders set status='ready' where id=1");
    assert.deepEqual((await row(1)).status_elapsed_ms,{});
    assert.ok((await row(1)).status_entered_at);
    await db.exec("insert into orders(id,status,payment_status,status_entered_at,status_elapsed_ms) values(2,'received','pending','2000-01-01','{\"received\":999}')");
    const initial=await row(2);
    assert.deepEqual(initial.status_elapsed_ms,{});
    assert.ok(new Date(initial.status_entered_at).getFullYear()>2000);
    await new Promise(resolve=>setTimeout(resolve,25));
    await db.exec("update orders set payment_status='verified',status_entered_at='2000-01-01',status_elapsed_ms='{\"received\":999}',status='received' where id=2");
    assert.deepEqual((await row(2)).status_entered_at,initial.status_entered_at);
    assert.deepEqual((await row(2)).status_elapsed_ms,{});
    await db.exec("update orders set status='preparing' where id=2");
    const preparing=await row(2);
    assert.ok(preparing.status_elapsed_ms.received>=20);
    await new Promise(resolve=>setTimeout(resolve,25));
    await db.exec("update orders set status='preparing' where id=2");
    assert.deepEqual((await row(2)).status_entered_at,preparing.status_entered_at);
    await db.exec("update orders set status='ready' where id=2; update orders set status='preparing' where id=2");
    const first=await row(2);
    await new Promise(resolve=>setTimeout(resolve,25));
    await db.exec("update orders set status='completed' where id=2");
    const closed=await row(2);
    assert.ok(closed.status_elapsed_ms.preparing>first.status_elapsed_ms.preparing);
    await db.exec("update orders set payment_status='pending' where id=2");
    assert.deepEqual(await row(2),{...closed,payment_status:'pending'});
    await db.exec("update orders set status='ready' where id=2; update orders set status='cancelled' where id=2");
    assert.equal((await row(2)).status_elapsed_ms.completed,undefined);
    assert.equal((await row(2)).status_elapsed_ms.cancelled,undefined);
  } finally { await db.close(); }
});
