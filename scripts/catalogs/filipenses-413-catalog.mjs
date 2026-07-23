import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const storeSlug = "filipenses-4-13";

const catalog = {
  categories: [
    {
      name: "Entradas",
      products: [
        {
          name: "Ración de Papas Fritas",
          description: "180 gramos de papas.",
          priceUsd: 2.5,
        },
        {
          name: "Nuggets",
          description: "5 Nuggets de pollo empanizado y 150g de papas fritas.",
          priceUsd: 5.5,
        },
      ],
    },
    {
      name: "Hot Dog",
      products: [
        {
          name: "Filipense Normal",
          description:
            "Pan, salchicha americana, ensalada, cebolla, salsas y papitas.",
          priceUsd: 3.5,
        },
        {
          name: "Filipense Un Adicional",
          description:
            "Pan, salchicha americana, ensalada, cebolla, salsas, papitas y un adicional.",
          priceUsd: 4,
          optionGroups: ["adicional-incluido"],
        },
        {
          name: "Filipense Especial",
          description:
            "Pan, salchicha americana, ensalada, cebolla, papitas, salsas, jamón, queso facilita y tocineta.",
          priceUsd: 4.5,
        },
        {
          name: "Filipense Polaco",
          description:
            "Pan artesanal, salchicha polaca, ensalada, cebolla, papitas y salsa especial de la casa.",
          priceUsd: 5,
        },
        {
          name: "Filipense Polaco Especial",
          description:
            "Pan artesanal, salchicha polaca, ensalada, cebolla, papitas, salsas, queso, jamón y tocineta.",
          priceUsd: 6,
        },
        {
          name: "Perro Básico",
          description:
            "Pan, salchicha Winner, ensalada, cebolla, salsas y papitas.",
          priceUsd: 2.5,
        },
        {
          name: "Perro Básico Cheddar",
          description:
            "Pan, salchicha Winner, ensalada, cebolla, salsas, papitas y queso cheddar rayado.",
          priceUsd: 3,
        },
      ],
    },
    {
      name: "Burgers",
      products: [
        {
          name: "Filipense Burger Normal",
          description:
            "Pan, carne o pollo de 110gr, tomate, lechuga, cebolla, salsas y papitas.",
          priceUsd: 5.5,
          optionGroups: ["proteina-carne-pollo"],
        },
        {
          name: "Filipense Burger Un Adicional",
          description:
            "Pan, carne o pollo de 110gr, tomate, lechuga, cebolla, salsas, papitas y un adicional.",
          priceUsd: 6,
          optionGroups: ["proteina-carne-pollo", "adicional-incluido-burger"],
        },
        {
          name: "Filipense Burger Especial",
          description:
            "Pan, carne o pollo de 110gr, tomate, lechuga, cebolla, salsas, papitas, queso, jamón y tocineta.",
          priceUsd: 6.5,
          optionGroups: ["proteina-carne-pollo"],
        },
        {
          name: "Filipense Burger Doble",
          description:
            "Pan, doble carne o mixta de 110gr, tomate, lechuga, cebolla, salsas, papitas, queso, jamón y tocineta.",
          priceUsd: 8.5,
          optionGroups: ["burger-doble"],
        },
        {
          name: "Filipense Burger Triple",
          description:
            "Pan, triple carne o combinada con chuleta y pollo de 110gr, tomate, lechuga, cebolla, salsas, papitas, queso, jamón y tocineta.",
          priceUsd: 10.5,
          optionGroups: ["burger-triple"],
        },
        {
          name: "Filipense Burger Chuletón",
          description:
            "Pan, chuletón ahumado, tomate, lechuga, cebolla, salsas, papitas, huevo y queso facilita.",
          priceUsd: 7,
        },
        {
          name: "Filipense Burger Crispy",
          description:
            "Pan, salsas, tomate, lechuga, queso facilita, tocineta y pollo crispy.",
          priceUsd: 7,
        },
      ],
    },
    {
      name: "Pepitos y Terneritos",
      products: [
        {
          name: "Ternerito Normal",
          description:
            "Pan granjero, 250 gramos de lomito o pollo, tomate, lechuga, cebolla, salsas y papitas.",
          priceUsd: 7.5,
          optionGroups: ["proteina-lomito-pollo"],
        },
        {
          name: "Ternerito Especial",
          description:
            "Pan granjero, 250 gramos de lomito o pollo, queso facilita, jamón, tocineta, salchicha polaca, tomate, lechuga, cebolla, salsas y papitas.",
          priceUsd: 9,
          optionGroups: ["proteina-lomito-pollo"],
        },
        {
          name: "Pepito Normal",
          description:
            "Pan artesanal, 500 gramos de lomito o pollo, tomate, lechuga, cebolla, salsas y papitas.",
          priceUsd: 13.5,
          optionGroups: ["proteina-lomito-pollo"],
        },
        {
          name: "Pepito Especial",
          description:
            "Pan artesanal, 500 gramos de lomito o pollo, queso facilita, jamón, tocineta, salchicha polaca, tomate, lechuga, cebolla, salsas y papitas.",
          priceUsd: 16.5,
          optionGroups: ["proteina-lomito-pollo"],
        },
      ],
    },
    {
      name: "Lo Nuevo Para Ti",
      products: [
        {
          name: "Filipenses Burguer Keto",
          description:
            "Tapa de queso paisa de 200g, lechuga, tomate con doble carne de res, doble pollo o mixta, tocineta crujiente, jamón, huevo y alfalfa.",
          priceUsd: 11.5,
          optionGroups: ["burger-keto"],
        },
        {
          name: "Salchipapa Normal",
          description: "200 gramos de papas, salchicha y queso.",
          priceUsd: 5,
        },
        {
          name: "Salchipapa Crispy",
          description:
            "200 gramos de papas, salchicha, pollo crispy y queso.",
          priceUsd: 6,
        },
        {
          name: "Salchipapa Especial",
          description:
            "200 gramos de papas, salchicha, carne, pollo, tocineta y queso.",
          priceUsd: 8,
        },
      ],
    },
    {
      name: "Extras",
      products: [
        {
          name: "Extra de Queso Facilita",
          description: "Extra de queso facilita.",
          priceUsd: 1,
        },
        {
          name: "Extra de Jamón",
          description: "Extra de jamón.",
          priceUsd: 1,
        },
        {
          name: "Extra de Tocineta",
          description: "Extra de tocineta.",
          priceUsd: 1,
        },
        {
          name: "Extra de Huevo",
          description: "Extra de huevo.",
          priceUsd: 1,
        },
      ],
    },
  ],
  optionGroups: [
    {
      key: "adicional-incluido",
      name: "Elige adicional hot dog",
      description: "Incluido en este producto.",
      selectionType: "single",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      values: ["Jamón", "Queso facilita", "Tocineta"],
    },
    {
      key: "adicional-incluido-burger",
      name: "Elige adicional burger",
      description: "Incluido en este producto.",
      selectionType: "single",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      values: ["Queso", "Jamón", "Tocineta"],
    },
    {
      key: "proteina-carne-pollo",
      name: "Elige proteína burger",
      description: "Selecciona carne o pollo.",
      selectionType: "single",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      values: ["Carne", "Pollo"],
    },
    {
      key: "proteina-lomito-pollo",
      name: "Elige proteína pepito/ternerito",
      description: "Selecciona lomito o pollo.",
      selectionType: "single",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      values: ["Lomito", "Pollo"],
    },
    {
      key: "burger-doble",
      name: "Elige combinación burger doble",
      description: "Selecciona doble carne o mixta.",
      selectionType: "single",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      values: ["Doble carne", "Mixta"],
    },
    {
      key: "burger-triple",
      name: "Elige combinación burger triple",
      description: "Selecciona triple carne o combinada.",
      selectionType: "single",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      values: ["Triple carne", "Combinada con chuleta y pollo"],
    },
    {
      key: "burger-keto",
      name: "Elige combinación keto",
      description: "Selecciona la proteína de la burger keto.",
      selectionType: "single",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      values: ["Doble carne de res", "Doble pollo", "Mixta"],
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
                        .map((key) =>
                          escapeHtml(
                            catalog.optionGroups.find((group) => group.key === key)?.name ||
                              key
                          )
                        )
                        .join(", ")}</small>`
                    : ""
                }
              </div>
              <strong>$${product.priceUsd}</strong>
            </article>`
        )
        .join("");

      return `<section><h2>${escapeHtml(category.name)}</h2>${products}</section>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vista previa catálogo Filipenses 4:13</title>
  <style>
    body { margin: 0; background: #120c09; color: #fff8f0; font-family: Arial, sans-serif; }
    main { max-width: 980px; margin: 0 auto; padding: 28px 18px 48px; }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 8vw, 54px); letter-spacing: -0.04em; }
    .meta { color: #ffb15d; font-weight: 700; margin-bottom: 28px; }
    section { margin-top: 24px; }
    h2 { color: #ff6b00; font-size: 28px; margin: 0 0 12px; text-transform: uppercase; }
    .product { display: flex; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,.12); }
    h3 { margin: 0 0 5px; color: #ff7a00; font-size: 18px; text-transform: uppercase; }
    p { margin: 0; line-height: 1.35; color: #f8f3e8; }
    small { display: block; margin-top: 6px; color: #ffd19a; font-weight: 700; }
    strong { color: #fff; font-size: 24px; white-space: nowrap; }
  </style>
</head>
<body>
  <main>
    <h1>Filipenses 4:13</h1>
    <div class="meta">${catalog.categories.length} categorías · ${
      flattenProducts().length
    } productos · Vista previa local, no producción</div>
    ${sections}
  </main>
</body>
</html>`;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html);
}

function printSummary(store, existingCounts) {
  const products = flattenProducts();
  console.log(`Catalogo: Filipenses 4:13`);
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
        ? ` | opciones: ${product.optionGroups
            .map((key) => catalog.optionGroups.find((group) => group.key === key)?.name || key)
            .join(", ")}`
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

    for (const [valueIndex, valueName] of group.values.entries()) {
      const valuePayload = {
        option_group_id: groupId,
        name: valueName,
        price_delta_usd: 0,
        is_active: true,
        sort_order: valueIndex + 1,
      };

      const currentValue = valuesByName.get(normalize(valueName));
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
    .select("id, name")
    .eq("store_id", storeId);
  if (error) throw error;

  const byName = new Map((existing || []).map((row) => [normalize(row.name), row]));
  const writtenProducts = [];

  for (const product of flattenProducts()) {
    const payload = {
      store_id: storeId,
      category_id: categoryIds.get(product.categoryName),
      name: product.name,
      description: product.description,
      price_usd: product.priceUsd,
      discount_percent: 0,
      image_url: null,
      is_available: true,
      is_featured: false,
      sort_order: product.sortOrder,
    };

    const current = byName.get(normalize(product.name));
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
    const wanted = new Set(flattenProducts().map((product) => normalize(product.name)));
    const staleIds = (existing || [])
      .filter((row) => !wanted.has(normalize(row.name)))
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
  const previewPath = path.resolve("tmp/catalogs/filipenses-413-preview.html");
  writePreviewHtml(previewPath);

  const { supabase, supabaseUrl } = await getSupabaseClient();
  const { store, counts } = await fetchStoreContext(supabase);

  printSummary(store, counts);
  console.log("");
  console.log(`Vista previa local: ${previewPath}`);

  if (!shouldApply) {
    console.log("");
    console.log("Modo dry-run: no se escribio nada en Supabase.");
    console.log("Para aplicar en un Supabase local, usa: node scripts/catalogs/filipenses-413-catalog.mjs --apply");
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
