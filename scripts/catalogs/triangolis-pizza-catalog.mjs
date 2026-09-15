import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const storeSlug = "triangolis-pizza";

const pizzaSizes = [
  ["22 cm", 1],
  ["26 cm", 2],
  ["33 cm", 3],
  ["40 cm", 4],
];

const pizzaExtras = [
  ["Cebolla", [0.15, 0.3, 0.4, 0.5]],
  ["Pimentón", [0.15, 0.3, 0.4, 0.5]],
  ["Maíz dulce", [1, 1, 1.5, 1.75]],
  ["Pepperoni", [1, 1, 1.5, 2]],
  ["Tocineta", [1, 1, 1.5, 2]],
  ["Champiñones", [1, 1, 1.5, 1.75]],
  ["Aceitunas", [1, 1, 1.5, 1.75]],
  ["Anchoas", [1, 1, 1.5, 2]],
  ["Jamón", [1, 1, 1.5, 2]],
  ["Pesto", [1, 1.25, 1.5, 2]],
  ["Pollo", [1, 1.5, 2, 2.5]],
  ["Mozzarella", [1, 1.5, 2, 2.5]],
  ["Queso cheddar", [1, 1, 1.5, 2]],
  ["Queso azul", [1, 1.5, 2, 3]],
  ["Parmesano", [0.75, 1, 1.5, 2]],
  ["Bordes de quesos", [1, 1.5, 2, 3]],
  ["Bordes de salchichas", [1, 1.5, 2, 3]],
  ["Papas fritas", [1, 1.5, 2, 3]],
  ["Salchichón", [1.5, 2, 2.5, 3.5]],
];

const catalog = {
  categories: [
    {
      name: "Entradas",
      products: [
        ["Papas fritas", "300 gramos de papas fritas con salsa ketchup.", 3.5],
        ["Tequeños", "6 tequeños acompañados de salsa de la casa.", 5],
        ["Nuggets", "Ración de 6 nuggets de pollo con salsa ketchup.", 3.5],
        ["Papas bacon", "300 gramos de papas fritas, queso fundido y tocineta.", 5.5],
      ],
    },
    {
      name: "Pastichos",
      products: [
        [
          "Pasticho",
          "Láminas de pasta intercaladas con salsa bolognesa, bechamel, mozzarella, jamón y parmesano gratinado. Incluye pan al ajillo.",
          8.5,
        ],
      ],
    },
    {
      name: "Pepi-pizzas",
      products: [
        ["Primavera", "Pan de pizza, salsa Triangoli's, 150 g de proteína al grill, maíz, tocineta, mozzarella, cheddar y papas fritas.", [["Pollo", 8.5], ["Carne", 10]]],
        ["4 quesos", "Pan de pizza, salsa Triangoli's, 150 g de proteína al grill, mozzarella, queso azul, cheddar, parmesano y papas fritas.", [["Pollo", 8.5], ["Carne", 10]]],
        ["Manhattan", "Pan de pizza, salsa Triangoli's, 150 g de proteina al grill, mozzarella, cheddar, pepperoni y papas fritas.", [["Pollo", 8], ["Carne", 9.5]]],
      ].map(([name, description, variants]) => ({ name, description, priceUsd: variants[0][1], variants, optionGroups: [] })),
    },
    {
      name: "Pizzas",
      products: [
        ["Margarita", "Salsa y queso mozzarella.", [4, 6, 8.5, 12]],
        ["Milán", "Salsa, queso mozzarella y jamón.", [4.5, 6.5, 9.5, 13]],
        ["Vegetariana", "Salsa, mozzarella, maíz, cebolla y pimentón.", [5, 7, 10, 14]],
        ["Manhattan", "Salsa, mozzarella y pepperoni.", [5, 7, 10, 14]],
        ["Romana", "Salsa, mozzarella, jamón y champiñones.", [6, 7.5, 11.5, 15.5]],
        ["Primavera", "Salsa, mozzarella, tocineta y maíz.", [6, 7.5, 11.5, 15.5]],
        ["Italiana", "Salsa, mozzarella y salchichón.", [6, 7.5, 11.5, 15.5]],
        ["Calabria", "Salsa, mozzarella, pepperoni, cebolla y pesto.", [6.5, 8, 12.5, 16.5]],
        ["Florencia", "Salsa, mozzarella, tocineta, maíz, cebolla y pimentón.", [6.5, 8, 12.5, 16.5]],
        ["Triangolis", "Salsa, mozzarella, maíz, tocineta, champiñones, cebolla y pimentón.", [7, 9, 14, 18]],
        ["Toci-papas", "Salsa, mozzarella, cheddar, tocineta y papas fritas.", [7, 9, 14, 18]],
        ["4 cheeses", "Salsa, mozzarella, cheddar, queso azul y parmesano.", [7, 9, 14, 18]],
        ["Puttanesca", "Salsa, mozzarella, aceitunas, anchoas, cebolla y pimentón.", [7, 9, 14, 18]],
        ["Granjera", "Salsa, mozzarella, pollo, maíz, tocineta, cebolla y pimentón.", [8, 10, 15, 19]],
        ["Capresa", "Salsa, mozzarella, rodajas de tomate, bocconcini y pesto.", [8, 10, 15, 19]],
      ].map(([name, description, prices]) => ({
        name,
        description,
        priceUsd: prices[0],
        variants: pizzaSizes.map(([size], index) => [size, prices[index]]),
        optionGroups: ["extras-pizza"],
      })),
    },
    {
      name: "Hamburguesas",
      products: [
        ["Cheeses", "Pan de la casa, 150 g de proteína a elegir, queso fundido, pepinillos y salsas. Incluye papas fritas.", [["Pollo al grill", 5.5], ["Pollo crispy", 6], ["Solomo", 7]]],
        ["Americana", "Pan de la casa, 150 g de proteína a elegir, queso fundido, tocineta, cebolla y tomates. Incluye papas fritas.", [["Pollo al grill", 6.5], ["Pollo crispy", 7], ["Solomo", 7.5]]],
        ["Triangoli's", "Pan de la casa, 150 g de proteína a elegir, tocineta, cebolla grillada y queso fundido con champiñones. Incluye papas fritas.", [["Pollo al grill", 7], ["Pollo crispy", 7.5], ["Solomo", 8]]],
        ["Caprichosa", "Pan de la casa, 150 g de proteína a elegir, tocineta, queso fundido, cebolla crispy y salsa spicy de pepperoni. Incluye papas fritas.", [["Pollo al grill", 7], ["Pollo crispy", 7.5], ["Solomo", 8]]],
      ].map(([name, description, variants]) => ({ name, description, priceUsd: variants[0][1], variants, optionGroups: ["extras-hamburguesa"] })),
    },
    {
      name: "Bebidas",
      products: [
        ["Refresco 350 ml", "", 1],
        ["Malta", "", 1],
        ["Refresco 1 litro", "", 2.5],
        ["Refresco 1.25 litros", "", 2.5],
        ["Refresco 1.5 litros", "", 3],
        ["Refresco 2 litros", "", 3.5],
        ["Vaso de Nestea 12 oz", "", 1.5],
        ["Batidos", "", 2],
      ],
    },
  ],
  optionGroups: [
    {
      key: "extras-pizza",
      name: "Extras para pizza",
      description: "Agrega ingredientes opcionales. El precio cambia según el tamaño elegido.",
      selectionType: "multiple",
      required: false,
      minSelect: 0,
      maxSelect: 19,
      values: pizzaExtras.map(([name, prices], index) => ({ name, priceUsd: prices[0], variantPrices: Object.fromEntries(pizzaSizes.map(([size], sizeIndex) => [size, prices[sizeIndex]])), sortOrder: index + 1 })),
    },
    {
      key: "extras-hamburguesa",
      name: "Adicionales para hamburguesas",
      description: "Agrega adicionales opcionales a tu hamburguesa.",
      selectionType: "multiple",
      required: false,
      minSelect: 0,
      maxSelect: 3,
      values: [
        { name: "Extra de proteína, 100 g", priceUsd: 1.5 },
        { name: "Extra de queso fundido", priceUsd: 0.5 },
        { name: "Agregar pepinillos", priceUsd: 0 },
      ],
    },
  ],
};

const args = new Set(process.argv.slice(2));
const shouldApply = args.has("--apply");
const allowRemoteWrite = args.has("--allow-remote-write");
const shouldPrintSql = args.has("--print-sql");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function isLocalSupabaseUrl(url) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(String(url || ""));
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function products() {
  const rows = [];
  catalog.categories.forEach((category, categoryIndex) => {
    category.products.forEach((product, productIndex) => {
      const row = Array.isArray(product)
        ? { name: product[0], description: product[1], priceUsd: product[2] }
        : product;
      rows.push({
        ...row,
        categoryName: category.name,
        sortOrder: categoryIndex * 100 + productIndex + 1,
      });
    });
  });
  return rows;
}

function sqlString(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function valuesSql(rows) {
  return rows.map((row) => `(${row.map(sqlString).join(",")})`).join(",\n");
}

function buildSql() {
  const productRows = products().map((product) => [
    product.categoryName,
    product.name,
    product.description,
    product.priceUsd,
    product.sortOrder,
  ]);
  const variantRows = products()
    .flatMap((product) => (product.variants || []).map((variant, index) => [
      product.categoryName,
      product.name,
      variant[0],
      variant[1],
      index + 1,
    ]));
  const groupRows = catalog.optionGroups.map((group, index) => [
    group.key,
    group.name,
    group.description,
    group.selectionType,
    group.required,
    group.minSelect,
    group.maxSelect,
    index + 1,
  ]);
  const valueRows = catalog.optionGroups.flatMap((group) =>
    group.values.map((value, index) => [
      group.key,
      value.name,
      value.priceUsd,
      value.sortOrder || index + 1,
    ])
  );
  const assignmentRows = products().flatMap((product) =>
    (product.optionGroups || []).map((key, index) => [product.categoryName, product.name, key, index + 1])
  );
  const variantPriceRows = catalog.optionGroups
    .find((group) => group.key === "extras-pizza")
    .values.flatMap((value) =>
      Object.entries(value.variantPrices).map(([variantName, price]) => [value.name, variantName, price])
    );

  return `do $$
declare
  v_store_id uuid;
  v_category_id uuid;
  v_product_id uuid;
  v_variant_id uuid;
  v_group_id uuid;
  v_value_id uuid;
  r record;
begin
  select id into v_store_id from public.stores where slug = 'triangolis-pizza' and lower(btrim(name)) = 'triangolis pizza';
  if v_store_id is null then
    raise exception 'No existe el comercio exacto Triangolis Pizza / triangolis-pizza';
  end if;

  create temp table tmp_tri_categories(name text primary key, sort_order int, id uuid) on commit drop;
  insert into tmp_tri_categories(name, sort_order) values
${valuesSql(catalog.categories.map((category, index) => [category.name, index + 1]))};

  for r in select * from tmp_tri_categories loop
    select id into v_category_id from public.categories where store_id = v_store_id and lower(btrim(name)) = lower(btrim(r.name)) order by created_at limit 1;
    if v_category_id is null then
      insert into public.categories(store_id, name, sort_order, is_active) values(v_store_id, r.name, r.sort_order, true) returning id into v_category_id;
    else
      update public.categories set name = r.name, sort_order = r.sort_order, is_active = true where id = v_category_id;
    end if;
    update tmp_tri_categories set id = v_category_id where name = r.name;
  end loop;

  create temp table tmp_tri_products(category_name text, name text, description text, price numeric, sort_order int, id uuid, primary key(category_name, name)) on commit drop;
  insert into tmp_tri_products(category_name, name, description, price, sort_order) values
${valuesSql(productRows)};

  for r in select p.*, c.id category_id from tmp_tri_products p join tmp_tri_categories c on c.name = p.category_name loop
    select products.id into v_product_id
      from public.products
      where store_id = v_store_id and category_id = r.category_id and lower(btrim(name)) = lower(btrim(r.name))
      order by created_at limit 1;
    if v_product_id is null then
      insert into public.products(store_id, category_id, name, description, price_usd, discount_percent, image_url, is_available, is_featured, sort_order)
      values(v_store_id, r.category_id, r.name, r.description, r.price, 0, null, true, false, r.sort_order) returning id into v_product_id;
    else
      update public.products
         set category_id = r.category_id, name = r.name, description = r.description, price_usd = r.price,
             discount_percent = 0, image_url = null, is_available = true, is_featured = false,
             sort_order = r.sort_order, updated_at = now()
       where id = v_product_id;
    end if;
    update tmp_tri_products set id = v_product_id where category_name = r.category_name and name = r.name;
  end loop;

  create temp table tmp_tri_variants(category_name text, product_name text, name text, price numeric, sort_order int, id uuid, primary key(category_name, product_name, name)) on commit drop;
  insert into tmp_tri_variants(category_name, product_name, name, price, sort_order) values
${valuesSql(variantRows)};

  for r in select v.*, p.id product_id from tmp_tri_variants v join tmp_tri_products p on p.category_name = v.category_name and p.name = v.product_name loop
    select id into v_variant_id from public.product_variants where product_id = r.product_id and lower(btrim(name)) = lower(btrim(r.name)) order by created_at limit 1;
    if v_variant_id is null then
      insert into public.product_variants(product_id, name, price_usd, is_available, sort_order) values(r.product_id, r.name, r.price, true, r.sort_order) returning id into v_variant_id;
    else
      update public.product_variants set name = r.name, price_usd = r.price, is_available = true, sort_order = r.sort_order where id = v_variant_id;
    end if;
    update tmp_tri_variants set id = v_variant_id where category_name = r.category_name and product_name = r.product_name and name = r.name;
  end loop;

  create temp table tmp_tri_groups(group_key text primary key, name text, description text, selection_type text, required boolean, min_select int, max_select int, sort_order int, id uuid) on commit drop;
  insert into tmp_tri_groups(group_key, name, description, selection_type, required, min_select, max_select, sort_order) values
${valuesSql(groupRows)};

  for r in select * from tmp_tri_groups loop
    select id into v_group_id from public.product_option_groups where store_id = v_store_id and lower(btrim(name)) = lower(btrim(r.name)) order by created_at limit 1;
    if v_group_id is null then
      insert into public.product_option_groups(store_id, name, description, selection_type, required, min_select, max_select, is_active, sort_order)
      values(v_store_id, r.name, r.description, r.selection_type, r.required, r.min_select, r.max_select, true, r.sort_order) returning id into v_group_id;
    else
      update public.product_option_groups
         set name = r.name, description = r.description, selection_type = r.selection_type, required = r.required,
             min_select = r.min_select, max_select = r.max_select, is_active = true, sort_order = r.sort_order, updated_at = now()
       where id = v_group_id;
    end if;
    update tmp_tri_groups set id = v_group_id where group_key = r.group_key;
  end loop;

  create temp table tmp_tri_values(group_key text, name text, price numeric, sort_order int, id uuid, primary key(group_key, name)) on commit drop;
  insert into tmp_tri_values(group_key, name, price, sort_order) values
${valuesSql(valueRows)};

  for r in select v.*, g.id group_id from tmp_tri_values v join tmp_tri_groups g on g.group_key = v.group_key loop
    select id into v_value_id from public.product_option_values where option_group_id = r.group_id and lower(btrim(name)) = lower(btrim(r.name)) order by created_at limit 1;
    if v_value_id is null then
      insert into public.product_option_values(option_group_id, name, description, price_delta_usd, is_active, sort_order)
      values(r.group_id, r.name, null, r.price, true, r.sort_order) returning id into v_value_id;
    else
      update public.product_option_values set name = r.name, description = null, price_delta_usd = r.price, is_active = true, sort_order = r.sort_order, updated_at = now() where id = v_value_id;
    end if;
    update tmp_tri_values set id = v_value_id where group_key = r.group_key and name = r.name;
  end loop;

  delete from public.product_option_group_products where product_id in (select id from tmp_tri_products);
  create temp table tmp_tri_assignments(category_name text, product_name text, group_key text, sort_order int) on commit drop;
  insert into tmp_tri_assignments(category_name, product_name, group_key, sort_order) values
${valuesSql(assignmentRows)};
  insert into public.product_option_group_products(store_id, product_id, option_group_id, sort_order)
  select v_store_id, p.id, g.id, a.sort_order
  from tmp_tri_assignments a
  join tmp_tri_products p on p.category_name = a.category_name and p.name = a.product_name
  join tmp_tri_groups g on g.group_key = a.group_key
  on conflict(product_id, option_group_id) do update set store_id = excluded.store_id, sort_order = excluded.sort_order, updated_at = now();

  create temp table tmp_tri_variant_prices(option_name text, variant_name text, price numeric, primary key(option_name, variant_name)) on commit drop;
  insert into tmp_tri_variant_prices(option_name, variant_name, price) values
${valuesSql(variantPriceRows)};
  insert into public.product_option_value_variant_prices(option_value_id, variant_id, price_delta_usd)
  select val.id, var.id, vp.price
  from tmp_tri_variant_prices vp
  join tmp_tri_values val on val.group_key = 'extras-pizza' and val.name = vp.option_name
  join tmp_tri_variants var on var.category_name = 'Pizzas' and var.name = vp.variant_name
  on conflict(option_value_id, variant_id) do update set price_delta_usd = excluded.price_delta_usd, updated_at = now();
end $$;`;
}

function duplicates() {
  const seen = new Set();
  return products().filter((product) => {
    const key = `${normalize(product.categoryName)}:${normalize(product.name)}`;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
}

async function getSupabaseClient() {
  readEnvFile(path.resolve(".env.local"));
  readEnvFile(path.resolve(".env"));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  return { supabaseUrl, supabase: createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }) };
}

async function fetchStoreContext(supabase) {
  const { data: store, error } = await supabase
    .from("stores")
    .select("id, slug, name, is_active, base_currency, subscription_status")
    .eq("slug", storeSlug)
    .maybeSingle();
  if (error) throw error;
  if (!store) throw new Error(`No existe el comercio con slug ${storeSlug}.`);
  if (normalize(store.name) !== normalize("Triangolis Pizza") && !normalize(store.name).includes("triangolis")) {
    throw new Error(`El slug ${storeSlug} existe, pero el nombre no parece Triangolis Pizza: ${store.name}.`);
  }

  const [categories, productRows, optionGroups, variants] = await Promise.all([
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("store_id", store.id),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id),
    supabase.from("product_option_groups").select("id", { count: "exact", head: true }).eq("store_id", store.id),
    supabase.from("product_variants").select("id", { count: "exact", head: true }).in("product_id", []),
  ]);
  for (const result of [categories, productRows, optionGroups, variants]) if (result.error) throw result.error;
  return { store, counts: { categories: categories.count || 0, products: productRows.count || 0, optionGroups: optionGroups.count || 0 } };
}

async function ensureCategories(supabase, storeId) {
  const { data: existing, error } = await supabase.from("categories").select("id, name").eq("store_id", storeId);
  if (error) throw error;
  const byName = new Map((existing || []).map((row) => [normalize(row.name), row]));
  const ids = new Map();
  for (const [index, category] of catalog.categories.entries()) {
    const payload = { store_id: storeId, name: category.name, sort_order: index + 1, is_active: true };
    const current = byName.get(normalize(category.name));
    const result = current
      ? await supabase.from("categories").update(payload).eq("id", current.id).select("id").single()
      : await supabase.from("categories").insert(payload).select("id").single();
    if (result.error) throw result.error;
    ids.set(category.name, result.data.id);
  }
  return ids;
}

async function ensureProducts(supabase, storeId, categoryIds) {
  const { data: existing, error } = await supabase.from("products").select("id, name, category_id").eq("store_id", storeId);
  if (error) throw error;
  const byCategoryAndName = new Map((existing || []).map((row) => [`${row.category_id}:${normalize(row.name)}`, row]));
  const written = [];
  for (const product of products()) {
    const categoryId = categoryIds.get(product.categoryName);
    const payload = {
      store_id: storeId,
      category_id: categoryId,
      name: product.name,
      description: product.description,
      price_usd: product.priceUsd,
      discount_percent: 0,
      image_url: null,
      is_available: true,
      is_featured: false,
      sort_order: product.sortOrder,
    };
    const current = byCategoryAndName.get(`${categoryId}:${normalize(product.name)}`);
    const result = current
      ? await supabase.from("products").update(payload).eq("id", current.id).select("id").single()
      : await supabase.from("products").insert(payload).select("id").single();
    if (result.error) throw result.error;
    written.push({ ...product, id: result.data.id, operation: current ? "updated" : "inserted" });
  }
  return written;
}

async function ensureVariants(supabase, writtenProducts) {
  const productIds = writtenProducts.map((product) => product.id);
  const { data: existing, error } = await supabase.from("product_variants").select("id, product_id, name").in("product_id", productIds);
  if (error) throw error;
  const byProductAndName = new Map((existing || []).map((row) => [`${row.product_id}:${normalize(row.name)}`, row]));
  const variantIdsByProductAndName = new Map();
  let upserted = 0;
  for (const product of writtenProducts) {
    for (const [index, variant] of (product.variants || []).entries()) {
      const [name, priceUsd] = variant;
      const payload = { product_id: product.id, name, price_usd: priceUsd, is_available: true, sort_order: index + 1 };
      const current = byProductAndName.get(`${product.id}:${normalize(name)}`);
      const result = current
        ? await supabase.from("product_variants").update(payload).eq("id", current.id).select("id").single()
        : await supabase.from("product_variants").insert(payload).select("id").single();
      if (result.error) throw result.error;
      variantIdsByProductAndName.set(`${product.id}:${name}`, result.data.id);
      upserted += 1;
    }
  }
  return { upserted, variantIdsByProductAndName };
}

async function ensureOptionGroups(supabase, storeId, writtenProducts, variantIdsByProductAndName) {
  const { data: existingGroups, error } = await supabase.from("product_option_groups").select("id, name").eq("store_id", storeId);
  if (error) throw error;
  const byName = new Map((existingGroups || []).map((row) => [normalize(row.name), row]));
  const groupIds = new Map();
  let valuesUpserted = 0;
  let variantPricesUpserted = 0;

  for (const [index, group] of catalog.optionGroups.entries()) {
    const payload = {
      store_id: storeId,
      name: group.name,
      description: group.description,
      selection_type: group.selectionType,
      required: group.required,
      min_select: group.minSelect,
      max_select: group.maxSelect,
      is_active: true,
      sort_order: index + 1,
    };
    const current = byName.get(normalize(group.name));
    const groupResult = current
      ? await supabase.from("product_option_groups").update(payload).eq("id", current.id).select("id").single()
      : await supabase.from("product_option_groups").insert(payload).select("id").single();
    if (groupResult.error) throw groupResult.error;
    const groupId = groupResult.data.id;
    groupIds.set(group.key, groupId);

    const { data: existingValues, error: valuesError } = await supabase.from("product_option_values").select("id, name").eq("option_group_id", groupId);
    if (valuesError) throw valuesError;
    const valuesByName = new Map((existingValues || []).map((row) => [normalize(row.name), row]));

    for (const [valueIndex, value] of group.values.entries()) {
      const valuePayload = {
        option_group_id: groupId,
        name: value.name,
        description: null,
        price_delta_usd: value.priceUsd,
        is_active: true,
        sort_order: value.sortOrder || valueIndex + 1,
      };
      const currentValue = valuesByName.get(normalize(value.name));
      const valueResult = currentValue
        ? await supabase.from("product_option_values").update(valuePayload).eq("id", currentValue.id).select("id").single()
        : await supabase.from("product_option_values").insert(valuePayload).select("id").single();
      if (valueResult.error) throw valueResult.error;
      valuesUpserted += 1;

      if (group.key === "extras-pizza" && value.variantPrices) {
        for (const product of writtenProducts.filter((row) => row.categoryName === "Pizzas")) {
          for (const [sizeName, price] of Object.entries(value.variantPrices)) {
            const variantId = variantIdsByProductAndName.get(`${product.id}:${sizeName}`);
            if (!variantId) throw new Error(`Falta variante ${sizeName} para ${product.name}.`);
            const priceResult = await supabase
              .from("product_option_value_variant_prices")
              .upsert({ option_value_id: valueResult.data.id, variant_id: variantId, price_delta_usd: price }, { onConflict: "option_value_id,variant_id" });
            if (priceResult.error) throw priceResult.error;
            variantPricesUpserted += 1;
          }
        }
      }
    }
  }

  const { error: deleteAssignmentsError } = await supabase.from("product_option_group_products").delete().in("product_id", writtenProducts.map((product) => product.id));
  if (deleteAssignmentsError) throw deleteAssignmentsError;
  const assignments = [];
  for (const product of writtenProducts) {
    for (const [index, key] of (product.optionGroups || []).entries()) {
      assignments.push({ store_id: storeId, product_id: product.id, option_group_id: groupIds.get(key), sort_order: index + 1 });
    }
  }
  if (assignments.length) {
    const { error: assignmentError } = await supabase.from("product_option_group_products").insert(assignments);
    if (assignmentError) throw assignmentError;
  }

  return { groups: groupIds.size, valuesUpserted, variantPricesUpserted, assignments: assignments.length };
}

function printSummary(store, counts) {
  console.log("Catalogo: Triangolis Pizza");
  console.log(`Slug: ${storeSlug}`);
  if (store) console.log(`Store encontrado: ${store.name} (${store.id})`);
  if (counts) console.log(`Actual remoto: ${counts.categories} categorias, ${counts.products} productos, ${counts.optionGroups} grupos de opciones`);
  console.log(`Preparado: ${catalog.categories.length} categorias, ${products().length} productos, ${catalog.optionGroups.length} grupos de opciones`);
  console.log(`Variantes: ${products().reduce((sum, product) => sum + (product.variants?.length || 0), 0)}`);
  console.log(`Precios de extras por tamano: ${pizzaExtras.length * 15 * 4}`);
}

async function main() {
  if (shouldPrintSql) {
    console.log(buildSql());
    return;
  }

  const repeated = duplicates();
  if (repeated.length) throw new Error(`Duplicados internos: ${repeated.map((product) => `${product.categoryName}/${product.name}`).join(", ")}`);
  const { supabase, supabaseUrl } = await getSupabaseClient();
  const { store, counts } = await fetchStoreContext(supabase);
  printSummary(store, counts);
  if (!shouldApply) {
    console.log("Modo dry-run: no se escribio nada en Supabase.");
    return;
  }
  if (!isLocalSupabaseUrl(supabaseUrl) && !allowRemoteWrite) {
    throw new Error(`Bloqueado: .env apunta a ${supabaseUrl}. Usa --allow-remote-write para aplicar remoto/produccion.`);
  }
  const categoryIds = await ensureCategories(supabase, store.id);
  const writtenProducts = await ensureProducts(supabase, store.id, categoryIds);
  const { upserted: variantsUpserted, variantIdsByProductAndName } = await ensureVariants(supabase, writtenProducts);
  const options = await ensureOptionGroups(supabase, store.id, writtenProducts, variantIdsByProductAndName);
  console.log(JSON.stringify({
    ok: true,
    insertedProducts: writtenProducts.filter((product) => product.operation === "inserted").map((product) => `${product.categoryName}/${product.name}`),
    updatedProducts: writtenProducts.filter((product) => product.operation === "updated").map((product) => `${product.categoryName}/${product.name}`),
    variantsUpserted,
    options,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
