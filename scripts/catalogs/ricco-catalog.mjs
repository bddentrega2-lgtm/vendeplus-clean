import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const storeSlug = "ricco";

const catalog = {
  categories: [
    {
      name: "Gomitas Enchiladas",
      description: "Gomitas Trululu, salsa chamoy y Tajín.",
      products: [
        {
          name: "Mini Ricco 200g",
          description: "Gomitas Trululu, salsa chamoy y Tajín.",
          priceUsd: 5,
        },
        {
          name: "Super Ricco 300g",
          description: "Gomitas Trululu, salsa chamoy y Tajín.",
          priceUsd: 7.5,
        },
        {
          name: "Ultra Ricco 400g",
          description: "Gomitas Trululu, salsa chamoy y Tajín.",
          priceUsd: 10,
        },
      ],
    },
    {
      name: "Frutas Enchiladas",
      description: "Tajín, adobo, limón y salsa chamoy.",
      products: [
        {
          name: "Mini Ricco 10oz",
          description: "Frutas con Tajín, adobo, limón y salsa chamoy.",
          priceUsd: 3,
        },
        {
          name: "Super Ricco 16oz",
          description: "Frutas con Tajín, adobo, limón y salsa chamoy.",
          priceUsd: 4,
        },
        {
          name: "Ultra Ricco 24oz",
          description: "Frutas con Tajín, adobo, limón y salsa chamoy.",
          priceUsd: 4,
        },
      ],
    },
    {
      name: "Chamoyadas / Frappe",
      description: "Chamoyada con salsa chamoy, Tajín y topping; frappe con leche condensada y topping.",
      products: [
        {
          name: "Mini Ricco 12oz",
          description:
            "Elige Chamoyada o Frappe. Chamoyada: salsa chamoy, Tajín y topping. Frappe: leche condensada y topping.",
          priceUsd: 6,
          optionGroups: ["preparacion-chamoyada-frappe"],
        },
        {
          name: "Super Ricco 16oz",
          description:
            "Elige Chamoyada o Frappe. Chamoyada: salsa chamoy, Tajín y topping. Frappe: leche condensada y topping.",
          priceUsd: 8,
          optionGroups: ["preparacion-chamoyada-frappe"],
        },
      ],
    },
  ],
  optionGroups: [
    {
      key: "preparacion-chamoyada-frappe",
      name: "Elige preparación",
      description: "Selecciona Chamoyada o Frappe.",
      selectionType: "single",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      values: [
        {
          name: "Chamoyada",
          description: "Salsa chamoy, Tajín y topping.",
        },
        {
          name: "Frappe",
          description: "Leche condensada y topping.",
        },
      ],
    },
  ],
};

const args = new Set(process.argv.slice(2));
const shouldApply = args.has("--apply");
const allowRemoteWrite = args.has("--allow-remote-write");
const replaceUnlisted = args.has("--replace-unlisted");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function isLocalSupabaseUrl(url) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(String(url || ""));
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function flattenProducts() {
  const rows = [];
  catalog.categories.forEach((category, categoryIndex) => {
    category.products.forEach((product, productIndex) => {
      rows.push({
        ...product,
        categoryName: category.name,
        categorySortOrder: categoryIndex + 1,
        sortOrder: categoryIndex * 100 + productIndex + 1,
      });
    });
  });
  return rows;
}

function optionName(key) {
  return catalog.optionGroups.find((group) => group.key === key)?.name || key;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function writePreviewHtml(filePath) {
  const sections = catalog.categories
    .map((category) => {
      const products = category.products
        .map(
          (product) => `
            <article class="product">
              <div>
                <h3>${escapeHtml(product.name)}</h3>
                <p>${escapeHtml(product.description)}</p>
                ${
                  product.optionGroups?.length
                    ? `<small>Opciones: ${product.optionGroups
                        .map((key) => escapeHtml(optionName(key)))
                        .join(", ")}</small>`
                    : ""
                }
              </div>
              <strong>$${product.priceUsd}</strong>
            </article>`
        )
        .join("");

      return `<section><h2>${escapeHtml(category.name)}</h2><p class="section-description">${escapeHtml(
        category.description
      )}</p>${products}</section>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vista previa catálogo Ricco</title>
  <style>
    body { margin: 0; background: linear-gradient(180deg, #ff9f2e, #c91f17); color: #3f2114; font-family: Arial, sans-serif; }
    main { max-width: 980px; margin: 0 auto; padding: 28px 18px 48px; }
    h1 { margin: 0 0 8px; font-size: clamp(36px, 12vw, 72px); color: #3b2114; letter-spacing: -0.06em; }
    .meta { color: #fff7e8; font-weight: 900; margin-bottom: 28px; text-shadow: 0 1px 1px rgba(0,0,0,.18); }
    section { margin-top: 28px; padding: 18px; border-radius: 26px; background: rgba(255, 255, 255, .20); backdrop-filter: blur(2px); }
    h2 { color: #fff7e8; font-size: 32px; margin: 0 0 6px; text-shadow: 0 2px 1px rgba(0,0,0,.16); }
    .section-description { margin: 0 0 10px; font-weight: 800; color: #4b2818; }
    .product { display: flex; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid rgba(75,40,24,.18); }
    .product:last-child { border-bottom: 0; }
    h3 { margin: 0 0 5px; color: #4b2818; font-size: 22px; }
    p { margin: 0; line-height: 1.35; color: #4b2818; }
    small { display: block; margin-top: 6px; color: #fff7e8; font-weight: 900; }
    strong { color: #fff7e8; font-size: 28px; white-space: nowrap; text-shadow: 0 2px 1px rgba(0,0,0,.18); }
  </style>
</head>
<body>
  <main>
    <h1>Ricco</h1>
    <div class="meta">${catalog.categories.length} categorías · ${
      flattenProducts().length
    } productos · Vista previa local, no producción</div>
    ${sections}
    <p class="meta" style="margin-top: 32px;">“No te quedes con el antojo” · @Ricco.mcy</p>
  </main>
</body>
</html>`;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html);
}

function printSummary(store, existingCounts) {
  const products = flattenProducts();
  console.log("Catalogo: Ricco");
  console.log(`Slug: ${storeSlug}`);
  if (store) {
    console.log(`Store remoto encontrado: ${store.name} (${store.id})`);
  }
  if (existingCounts) {
    console.log(
      `Actual remoto: ${existingCounts.categories} categorias, ${existingCounts.products} productos, ${existingCounts.optionGroups} grupos de opciones`
    );
  }
  console.log(
    `Preparado: ${catalog.categories.length} categorias, ${products.length} productos, ${catalog.optionGroups.length} grupos de opciones`
  );
  console.log("");
  for (const category of catalog.categories) {
    console.log(`- ${category.name}`);
    for (const product of category.products) {
      const options = product.optionGroups?.length
        ? ` | opciones: ${product.optionGroups.map(optionName).join(", ")}`
        : "";
      console.log(`  - ${product.name}: $${product.priceUsd}${options}`);
    }
  }
}

async function getSupabaseClient() {
  readEnvFile(path.resolve(".env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }

  return {
    supabaseUrl,
    supabase: createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

async function fetchStoreContext(supabase) {
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, slug, name, is_active")
    .eq("slug", storeSlug)
    .maybeSingle();

  if (storeError) throw storeError;
  if (!store) throw new Error(`No existe el comercio con slug ${storeSlug}.`);

  const [categories, products, optionGroups] = await Promise.all([
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("store_id", store.id),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id),
    supabase
      .from("product_option_groups")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
  ]);

  for (const result of [categories, products, optionGroups]) {
    if (result.error) throw result.error;
  }

  return {
    store,
    counts: {
      categories: categories.count || 0,
      products: products.count || 0,
      optionGroups: optionGroups.count || 0,
    },
  };
}

async function ensureCategories(supabase, storeId) {
  const { data: existing, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("store_id", storeId);
  if (error) throw error;

  const byName = new Map((existing || []).map((row) => [normalize(row.name), row]));
  const categoryIds = new Map();

  for (const [index, category] of catalog.categories.entries()) {
    const payload = {
      store_id: storeId,
      name: category.name,
      sort_order: index + 1,
      is_active: true,
    };

    const current = byName.get(normalize(category.name));
    if (current) {
      const { data, error: updateError } = await supabase
        .from("categories")
        .update(payload)
        .eq("id", current.id)
        .select("id")
        .single();
      if (updateError) throw updateError;
      categoryIds.set(category.name, data.id);
    } else {
      const { data, error: insertError } = await supabase
        .from("categories")
        .insert(payload)
        .select("id")
        .single();
      if (insertError) throw insertError;
      categoryIds.set(category.name, data.id);
    }
  }

  if (replaceUnlisted) {
    const wanted = new Set(catalog.categories.map((category) => normalize(category.name)));
    const staleIds = (existing || [])
      .filter((row) => !wanted.has(normalize(row.name)))
      .map((row) => row.id);
    if (staleIds.length) {
      const { error: staleError } = await supabase
        .from("categories")
        .update({ is_active: false })
        .in("id", staleIds);
      if (staleError) throw staleError;
    }
  }

  return categoryIds;
}

async function ensureOptionGroups(supabase, storeId) {
  const { data: existingGroups, error } = await supabase
    .from("product_option_groups")
    .select("id, name")
    .eq("store_id", storeId);
  if (error) throw error;

  const byName = new Map((existingGroups || []).map((row) => [normalize(row.name), row]));
  const groupIdsByKey = new Map();

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
    let groupId;
    if (current) {
      const { data, error: updateError } = await supabase
        .from("product_option_groups")
        .update(payload)
        .eq("id", current.id)
        .select("id")
        .single();
      if (updateError) throw updateError;
      groupId = data.id;
    } else {
      const { data, error: insertError } = await supabase
        .from("product_option_groups")
        .insert(payload)
        .select("id")
        .single();
      if (insertError) throw insertError;
      groupId = data.id;
    }

    groupIdsByKey.set(group.key, groupId);

    const { data: existingValues, error: valuesError } = await supabase
      .from("product_option_values")
      .select("id, name")
      .eq("option_group_id", groupId);
    if (valuesError) throw valuesError;

    const valuesByName = new Map((existingValues || []).map((row) => [normalize(row.name), row]));

    for (const [valueIndex, value] of group.values.entries()) {
      const valuePayload = {
        option_group_id: groupId,
        name: value.name,
        description: value.description || null,
        price_delta_usd: 0,
        is_active: true,
        sort_order: valueIndex + 1,
      };

      const currentValue = valuesByName.get(normalize(value.name));
      if (currentValue) {
        const { error: updateValueError } = await supabase
          .from("product_option_values")
          .update(valuePayload)
          .eq("id", currentValue.id);
        if (updateValueError) throw updateValueError;
      } else {
        const { error: insertValueError } = await supabase
          .from("product_option_values")
          .insert(valuePayload);
        if (insertValueError) throw insertValueError;
      }
    }
  }

  return groupIdsByKey;
}

async function ensureProducts(supabase, storeId, categoryIds, groupIdsByKey) {
  const { data: existing, error } = await supabase
    .from("products")
    .select("id, name, category_id")
    .eq("store_id", storeId);
  if (error) throw error;

  const byCategoryAndName = new Map(
    (existing || []).map((row) => [
      `${row.category_id || "none"}:${normalize(row.name)}`,
      row,
    ])
  );
  const writtenProducts = [];

  for (const product of flattenProducts()) {
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

    const current = byCategoryAndName.get(`${categoryId || "none"}:${normalize(product.name)}`);
    let productId;
    if (current) {
      const { data, error: updateError } = await supabase
        .from("products")
        .update(payload)
        .eq("id", current.id)
        .select("id")
        .single();
      if (updateError) throw updateError;
      productId = data.id;
    } else {
      const { data, error: insertError } = await supabase
        .from("products")
        .insert(payload)
        .select("id")
        .single();
      if (insertError) throw insertError;
      productId = data.id;
    }

    writtenProducts.push({ ...product, id: productId });

    const { error: deleteAssignmentsError } = await supabase
      .from("product_option_group_products")
      .delete()
      .eq("product_id", productId);
    if (deleteAssignmentsError) throw deleteAssignmentsError;

    const assignments = (product.optionGroups || [])
      .map((key, index) => ({
        store_id: storeId,
        product_id: productId,
        option_group_id: groupIdsByKey.get(key),
        sort_order: index + 1,
      }))
      .filter((row) => row.option_group_id);

    if (assignments.length) {
      const { error: insertAssignmentsError } = await supabase
        .from("product_option_group_products")
        .insert(assignments);
      if (insertAssignmentsError) throw insertAssignmentsError;
    }
  }

  if (replaceUnlisted) {
    const wanted = new Set(
      flattenProducts().map((product) => {
        const categoryId = categoryIds.get(product.categoryName);
        return `${categoryId || "none"}:${normalize(product.name)}`;
      })
    );
    const staleIds = (existing || [])
      .filter((row) => !wanted.has(`${row.category_id || "none"}:${normalize(row.name)}`))
      .map((row) => row.id);
    if (staleIds.length) {
      const { error: staleError } = await supabase
        .from("products")
        .update({ is_available: false })
        .in("id", staleIds);
      if (staleError) throw staleError;
    }
  }

  return writtenProducts;
}

async function main() {
  const previewPath = path.resolve("tmp/catalogs/ricco-preview.html");
  writePreviewHtml(previewPath);

  const { supabase, supabaseUrl } = await getSupabaseClient();
  const { store, counts } = await fetchStoreContext(supabase);

  printSummary(store, counts);
  console.log("");
  console.log(`Vista previa local: ${previewPath}`);

  if (!shouldApply) {
    console.log("");
    console.log("Modo dry-run: no se escribio nada en Supabase.");
    console.log("Para aplicar en un Supabase local, usa: node scripts/catalogs/ricco-catalog.mjs --apply");
    console.log(
      "Para remoto/produccion se requiere autorizacion expresa y el flag adicional --allow-remote-write."
    );
    return;
  }

  if (!isLocalSupabaseUrl(supabaseUrl) && !allowRemoteWrite) {
    throw new Error(
      `Bloqueado: .env.local apunta a ${supabaseUrl}. No aplico cambios remotos sin --allow-remote-write.`
    );
  }

  const categoryIds = await ensureCategories(supabase, store.id);
  const groupIdsByKey = await ensureOptionGroups(supabase, store.id);
  const writtenProducts = await ensureProducts(supabase, store.id, categoryIds, groupIdsByKey);

  console.log("");
  console.log(
    `Aplicado: ${categoryIds.size} categorias y ${writtenProducts.length} productos para ${store.name}.`
  );
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
