import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.SOMOS_PGLITE_MODULE;
const PGlite = modulePath ? (await import(pathToFileURL(modulePath).href)).PGlite : null;

test('receipt RPC commits the order and receipt together or rolls back both', { skip: !PGlite }, async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.orders (
      id uuid primary key, store_id uuid not null, idempotency_key text not null,
      unique (store_id, idempotency_key)
    );
    create table public.stock (store_id uuid primary key, units integer not null);
    create table public.order_payment_receipts (
      id uuid primary key, store_id uuid not null,
      order_id uuid unique references public.orders(id),
      deleted_at timestamptz, expires_at timestamptz not null,
      attached_at timestamptz
    );
    create function public.create_order_atomic(p_order jsonb, p_items jsonb)
    returns jsonb language plpgsql as $$
    declare saved public.orders; begin
      insert into public.orders(id, store_id, idempotency_key)
      values ((p_order->>'id')::uuid, (p_order->>'store_id')::uuid, p_order->>'idempotency_key')
      on conflict (store_id, idempotency_key) do nothing returning * into saved;
      if not found then
        select * into saved from public.orders
        where store_id = (p_order->>'store_id')::uuid
          and idempotency_key = p_order->>'idempotency_key';
        return jsonb_build_object('order', to_jsonb(saved), 'idempotent_replay', true);
      end if;
      update public.stock set units = units - 1 where store_id = saved.store_id;
      return jsonb_build_object('order', to_jsonb(saved), 'idempotent_replay', false);
    end $$;
    create function public.create_buyer_order_atomic(p_order jsonb, p_items jsonb, p_buyer_id uuid)
    returns jsonb language plpgsql as $$
    begin
      if p_buyer_id is null then raise exception 'Buyer required'; end if;
      return public.create_order_atomic(p_order, p_items);
    end $$;
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261020121000_create_order_with_receipt_atomic.sql', import.meta.url), 'utf8'));

  const store = '10000000-0000-4000-8000-000000000001';
  const receipt1 = '20000000-0000-4000-8000-000000000001';
  const receipt2 = '20000000-0000-4000-8000-000000000002';
  const receipt3 = '20000000-0000-4000-8000-000000000003';
  const order1 = '30000000-0000-4000-8000-000000000001';
  const order2 = '30000000-0000-4000-8000-000000000002';
  const order3 = '30000000-0000-4000-8000-000000000003';
  await db.query('insert into stock values ($1, 5)', [store]);
  for (const receipt of [receipt1, receipt2, receipt3]) {
    await db.query("insert into order_payment_receipts(id,store_id,expires_at) values($1,$2,now() + interval '1 day')", [receipt, store]);
  }
  const create = (orderId, key, receiptId, buyerId = null) => db.query(
    'select public.create_order_with_receipt_atomic($1::jsonb, $2::jsonb, $3::uuid, $4::uuid) as result',
    [JSON.stringify({ id: orderId, store_id: store, idempotency_key: key }), '[]', buyerId, receiptId]
  );
  const counts = async () => (await db.query('select count(*)::int as orders, (select units from stock where store_id=$1) as units from orders', [store])).rows[0];

  assert.equal((await create(order1, 'first', receipt1)).rows[0].result.idempotent_replay, false);
  assert.equal((await create(order1, 'first', receipt1)).rows[0].result.idempotent_replay, true);
  assert.deepEqual(await counts(), { orders: 1, units: 4 });
  assert.equal((await db.query('select order_id from order_payment_receipts where id=$1', [receipt1])).rows[0].order_id, order1);

  await assert.rejects(create(order2, 'second', receipt1), /ya fue utilizada/);
  await assert.rejects(create(order2, 'second', '20000000-0000-4000-8000-000000000099'), /ya no esta disponible/);
  assert.deepEqual(await counts(), { orders: 1, units: 4 });

  await db.exec(`
    create function public.fail_receipt_attach() returns trigger language plpgsql as $$
    begin
      if new.id = '${receipt2}'::uuid then raise exception 'Injected attach failure'; end if;
      return new;
    end $$;
    create trigger fail_receipt_attach before update on public.order_payment_receipts
    for each row execute function public.fail_receipt_attach();
  `);
  await assert.rejects(create(order2, 'second', receipt2), /Injected attach failure/);
  assert.deepEqual(await counts(), { orders: 1, units: 4 });
  assert.equal((await db.query('select order_id from order_payment_receipts where id=$1', [receipt2])).rows[0].order_id, null);

  const buyer = '40000000-0000-4000-8000-000000000001';
  assert.equal((await create(order3, 'third', receipt3, buyer)).rows[0].result.idempotent_replay, false);
  assert.deepEqual(await counts(), { orders: 2, units: 3 });
  assert.equal((await db.query('select order_id from order_payment_receipts where id=$1', [receipt3])).rows[0].order_id, order3);

  await db.exec('set role anon');
  try {
    await assert.rejects(create(order2, 'anon', receipt2), /permission denied/);
  } finally {
    await db.exec('reset role');
  }
});

test('anonymous transport reads expose only public fields and public rates', { skip: !PGlite }, async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.transport_agencies (
      id uuid primary key, name text, slug text, city text, state text,
      coverage_notes text, logo_url text, banner_image_url text,
      marketplace_primary_color text, marketplace_accent_color text,
      status text, is_active boolean, rates_visibility text,
      admin_notes text, particular_payment_details jsonb
    );
    create table public.transport_agency_rates (
      id uuid primary key, agency_id uuid references public.transport_agencies(id),
      is_active boolean, flat_fee_usd numeric
    );
    create table public.transport_agency_zones (
      id uuid primary key, agency_id uuid references public.transport_agencies(id),
      is_active boolean, fee_usd numeric
    );
    create table public.transport_agency_distance_rates (
      id uuid primary key, agency_id uuid references public.transport_agencies(id),
      is_active boolean, fee_usd numeric
    );
    alter table public.transport_agencies enable row level security;
    alter table public.transport_agency_rates enable row level security;
    alter table public.transport_agency_zones enable row level security;
    alter table public.transport_agency_distance_rates enable row level security;
    create policy "Public can read active transport agencies" on public.transport_agencies
      for select to anon, authenticated using (status='active' and is_active=true);
    grant select on public.transport_agencies, public.transport_agency_rates,
      public.transport_agency_zones, public.transport_agency_distance_rates to anon, authenticated;
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261020120000_restrict_public_transport_agency_reads.sql', import.meta.url), 'utf8'));

  const publicId = '50000000-0000-4000-8000-000000000001';
  const privateId = '50000000-0000-4000-8000-000000000002';
  const rate1 = '60000000-0000-4000-8000-000000000001';
  const rate2 = '60000000-0000-4000-8000-000000000002';
  await db.query("insert into transport_agencies(id,name,slug,status,is_active,rates_visibility,admin_notes,particular_payment_details) values($1,'Publica','publica','active',true,'public','private note','{}'),($2,'Privada','privada','active',true,'private','private note','{}')", [publicId, privateId]);
  for (const table of ['transport_agency_rates', 'transport_agency_zones', 'transport_agency_distance_rates']) {
    const amount = table === 'transport_agency_rates' ? 'flat_fee_usd' : 'fee_usd';
    await db.query(`insert into ${table}(id,agency_id,is_active,${amount}) values($1,$2,true,2),($3,$4,true,3)`, [rate1, publicId, rate2, privateId]);
  }

  await db.exec('set role anon');
  try {
    assert.equal((await db.query('select count(*)::int as n from transport_agencies')).rows[0].n, 2);
    await assert.rejects(db.query('select admin_notes from transport_agencies'), /permission denied/);
    await assert.rejects(db.query('select particular_payment_details from transport_agencies'), /permission denied/);
    for (const table of ['transport_agency_rates', 'transport_agency_zones', 'transport_agency_distance_rates']) {
      const rows = (await db.query(`select agency_id from ${table}`)).rows;
      assert.deepEqual(rows.map((row) => row.agency_id), [publicId]);
    }
  } finally {
    await db.exec('reset role');
  }
});
