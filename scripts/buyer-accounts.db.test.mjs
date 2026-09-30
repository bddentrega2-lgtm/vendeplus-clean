import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "../tmp/buyer-db-test/node_modules/@electric-sql/pglite/dist/index.js";

const a = "10000000-0000-4000-8000-000000000001", b = "10000000-0000-4000-8000-000000000002";
const store = "20000000-0000-4000-8000-000000000001";
const order = "30000000-0000-4000-8000-000000000001", guest = "30000000-0000-4000-8000-000000000002";
test("buyer migration: ownership, transaction replay, reviews, RLS and aggregate privacy", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create table public.stores(id uuid primary key);
    create table public.store_users(store_id uuid not null, user_id uuid not null, role text);
    create table public.orders(id uuid primary key, store_id uuid, status text);
    insert into auth.users values ('${a}', 'a@example.test'), ('${b}', 'b@example.test');
    insert into public.stores values ('${store}');
    create function public.create_order_atomic(p_order jsonb, p_items jsonb) returns jsonb language plpgsql as $$
    declare saved public.orders; begin
      select * into saved from public.orders where id = (p_order->>'id')::uuid;
      if found then return jsonb_build_object('order', to_jsonb(saved), 'idempotent_replay', true); end if;
      insert into public.orders values ((p_order->>'id')::uuid,(p_order->>'store_id')::uuid,coalesce(p_order->>'status','received')) returning * into saved;
      return jsonb_build_object('order',to_jsonb(saved),'idempotent_replay',false);
    end; $$;
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/20260929193000_buyer_accounts_and_reviews.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/20260930030000_buyer_review_observation.sql", import.meta.url), "utf8"));
  const create = (id, buyer) => db.query("select public.create_buyer_order_atomic($1::jsonb, '[]'::jsonb, $2::uuid) as result", [JSON.stringify({ id, store_id: store }), buyer]);
  await t.test("new authenticated order is bound atomically and replay keeps its owner", async () => {
    assert.equal((await create(order, a)).rows[0].result.idempotent_replay, false);
    assert.equal((await create(order, a)).rows[0].result.idempotent_replay, true);
    assert.equal((await db.query("select buyer_user_id from buyer_order_accounts")).rows[0].buyer_user_id, a);
    await assert.rejects(create(order, b), /ownership mismatch/);
    assert.equal((await db.query("select count(*)::int as n from buyer_order_accounts")).rows[0].n, 1);
  });
  await t.test("guest orders cannot be claimed by replay or matching personal data", async () => {
    await db.query("select create_order_atomic($1::jsonb, '[]'::jsonb)", [JSON.stringify({ id: guest, store_id: store })]);
    await assert.rejects(create(guest, a), /ownership mismatch/);
    assert.equal((await db.query("select count(*)::int as n from buyer_order_accounts where order_id=$1", [guest])).rows[0].n, 0);
  });
  await t.test("invalid buyer cannot create a partial order", async () => {
    await assert.rejects(create("30000000-0000-4000-8000-000000000009", null), /Invalid buyer/);
    assert.equal((await db.query("select count(*)::int as n from orders")).rows[0].n, 2);
  });
  const rate = (buyer, value, id = order) => db.query("select save_buyer_store_review($1,$2,$3)", [id, buyer, value]);
  const observe = (buyer, value, note, id = order) => db.query("select save_buyer_store_review_with_observation($1,$2,$3,$4)", [id, buyer, value, note]);
  await t.test("only completed owned orders can be rated", async () => {
    await assert.rejects(rate(a, 5), /Review not allowed/);
    await assert.rejects(observe(a, 5, "No completado"), /Review not allowed/);
    await db.query("update orders set status='completed' where id=$1", [order]);
    await assert.rejects(rate(b, 5), /Review not allowed/);
    await assert.rejects(rate(a, 0), /Invalid rating/);
    await assert.rejects(rate(a, 6), /Invalid rating/);
    await assert.rejects(rate(a, null), /Invalid rating/);
    await rate(a, 5); await rate(a, 4);
    assert.deepEqual((await db.query("select rating from buyer_store_reviews")).rows, [{ rating: 4 }]);
  });
  await t.test("a merchant cannot rate their own store using the real user_id membership schema", async () => {
    await db.query("insert into store_users values ($1,$2,'owner')", [store, a]);
    await assert.rejects(rate(a, 5), /Review not allowed/);
    await assert.rejects(observe(a, 5, "Propio comercio"), /Review not allowed/);
    await db.query("update store_users set role='operator' where user_id=$1", [a]);
    await assert.rejects(rate(a, 5), /Review not allowed/);
    await db.exec("delete from store_users");
    await db.query("insert into store_users values ($1,$2,'owner')", ['20000000-0000-4000-8000-000000000002', a]);
    await rate(a, 4);
    await db.exec("delete from store_users");
  });
  await t.test("observations are optional, bounded, editable and owner-only; failed writes preserve both fields", async () => {
    await observe(a, 4, "  Buena atencion\n  ");
    assert.deepEqual((await db.query("select rating,observation from buyer_store_reviews")).rows, [{ rating: 4, observation: "Buena atencion" }]);
    await assert.rejects(observe(b, 1, "Ajeno"), /Review not allowed/);
    await assert.rejects(observe(a, 1, "x".repeat(501)), /Invalid observation/);
    await assert.rejects(observe(a, 9, "Invalido"), /Invalid rating/);
    assert.deepEqual((await db.query("select rating,observation from buyer_store_reviews")).rows, [{ rating: 4, observation: "Buena atencion" }]);
    await observe(a, 4, "x".repeat(500));
    await assert.rejects(db.query("update buyer_store_reviews set observation=$1", ["x".repeat(501)]), /buyer_review_observation_length/);
    await rate(a, 4);
    assert.equal((await db.query("select observation from buyer_store_reviews")).rows[0].observation.length, 500);
    for (const note of [null, "", " \n\t "]) {
      await observe(a, 4, note);
      assert.equal((await db.query("select observation from buyer_store_reviews")).rows[0].observation, null);
    }
    await observe(a, 4, "Comentario privado");
    assert.equal((await db.query("select count(*)::int as n from buyer_store_reviews")).rows[0].n, 1);
  });
  await t.test("public summary contains no buyer identity or observation and excludes cancelled orders", async () => {
    const rows = (await db.query("select * from buyer_store_rating_summaries($1::uuid[])", [[store]])).rows;
    assert.deepEqual(Object.keys(rows[0]).sort(), ["average", "count", "store_id"]);
    assert.equal(Number(rows[0].average), 4); assert.equal(Number(rows[0].count), 1);
    await db.query("update orders set status='cancelled' where id=$1", [order]);
    assert.equal((await db.query("select * from buyer_store_rating_summaries($1::uuid[])", [[store]])).rows.length, 0);
  });
  await t.test("anonymous and authenticated roles cannot read tables or invoke privileged RPCs", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      try {
        await assert.rejects(db.query("select * from buyer_order_accounts"), /permission denied/);
        await assert.rejects(db.query("select * from buyer_store_reviews"), /permission denied/);
        await assert.rejects(create(order, b), /permission denied/);
        await assert.rejects(rate(a, 5), /permission denied/);
        await assert.rejects(observe(a, 5, "Privado"), /permission denied/);
      } finally { await db.exec("reset role"); }
    }
  });
  await t.test("deleting a buyer removes account links and reviews but preserves the merchant order", async () => {
    assert.equal((await db.query("select count(*)::int as n from buyer_order_accounts where buyer_user_id=$1", [a])).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int as n from buyer_store_reviews where buyer_user_id=$1", [a])).rows[0].n, 1);
    await db.query("delete from auth.users where id=$1", [a]);
    assert.equal((await db.query("select count(*)::int as n from buyer_order_accounts where buyer_user_id=$1", [a])).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int as n from buyer_store_reviews where buyer_user_id=$1", [a])).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int as n from orders where id=$1", [order])).rows[0].n, 1);
  });
});
