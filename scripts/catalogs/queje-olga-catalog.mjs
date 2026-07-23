import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const storeSlug = "queje-olga";

const palette = {
  baseCurrency: "USD",
  primaryColor: "#b50808",
  accentColor: "#ffd21f",
  buttonTextColor: "#241b12",
};

const catalog = {
  categories: [
    {
      name: "Almuerzos",
      description: "Platos completos con tres guarniciones y una proteína.",
      products: [
        {
          name: "Almuerzo Queje Olga",
          description: "Incluye 3 guarniciones + 1 proteína.",
          priceUsd: 3.9,
          optionGroups: ["contornos-almuerzo", "proteina-almuerzo"],
        },
      ],
    },
    {
      name: "Extras - Contornos",
      description: "Porciones adicionales para completar el plato.",
      products: [
        { name: "Papas a la francesa", description: "Porción adicional de papas a la francesa.", priceUsd: 1.6 },
        { name: "Tostones", description: "Porción adicional de tostones.", priceUsd: 1.3 },
        { name: "Tajadas", description: "Porción adicional de tajadas.", priceUsd: 1.3 },
        { name: "Arroz", description: "Porción adicional de arroz.", priceUsd: 1.25 },
        { name: "Ensalada cesar", description: "Porción adicional de ensalada cesar.", priceUsd: 1.5 },
        { name: "Ensalada mixta", description: "Porción adicional de ensalada mixta.", priceUsd: 1.3 },
      ],
    },
    {
      name: "Extras - Proteínas",
      description: "Proteínas adicionales para sumar al pedido.",
      products: [
        { name: "Milanesa de pollo krispy", description: "Proteína adicional.", priceUsd: 1.7 },
        { name: "Milanesa de pollo asada", description: "Proteína adicional.", priceUsd: 1.6 },
        { name: "Milanesa de pollo al graten", description: "Proteína adicional.", priceUsd: 1.75 },
        { name: "Cordon bleu de pollo", description: "Proteína adicional.", priceUsd: 2 },
      ],
    },
    {
      name: "Salads",
      description: "Ensaladas listas para ordenar.",
      products: [
        { name: "Cesar clásica", description: "No incluye proteína.", priceUsd: 2.8 },
        { name: "Cesar normal", description: "Incluye 1 proteína.", priceUsd: 3.2 },
        { name: "Super cesar", description: "Incluye 2 proteínas.", priceUsd: 4.7 },
        { name: "Ensalada mixta", description: "Ensalada mixta lista para ordenar.", priceUsd: 2.8 },
      ],
    },
    {
      name: "Bebidas",
      description: "Bebidas disponibles.",
      products: [
        {
          name: "Refrescos",
          description: "Precio no indicado en el menú. Producto oculto hasta confirmar precio.",
          priceUsd: 0,
          isAvailable: false,
        },
      ],
    },
  ],
  optionGroups: [
    {
      key: "contornos-almuerzo",
      name: "Elige 3 contornos",
      description: "Selecciona tres guarniciones para tu almuerzo.",
      selectionType: "multiple",
      required: true,
      minSelect: 3,
      maxSelect: 3,
      values: [
        "Papas a la francesa",
        "Tostones",
        "Tajadas",
        "Arroz blanco",
        "Ensalada cesar",
        "Ensalada mixta",
      ],
    },
    {
      key: "proteina-almuerzo",
      name: "Elige 1 proteína",
      description: "Selecciona la proteína incluida en tu almuerzo.",
      selectionType: "single",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      values: [
        "Milanesa de pollo krispy",
        "Milanesa de pollo asada",
        "Milanesa de pollo al graten",
        "Cordon bleu de pollo",
      ],
    },
  ],
};

const args = new Set(process.argv.slice(2));
const shouldApply = args.has("--apply");
const allowRemoteWrite = args.has("--allow-remote-write");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
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
        sortOrder: categoryIndex * 100 + productIndex + 1,
        isAvailable: product.isAvailable !== false,
      });
    });
  });
  return rows;
}

function findDuplicateProducts() {
  const seen = new Map();
  const duplicates = [];

  for (const product of flattenProducts()) {
    const key = `${normalize(product.categoryName)}:${normalize(product.name)}`;
    if (seen.has(key)) duplicates.push(product);
    seen.set(key, product);
  }

  return duplicates;
}

function printSummary(store, counts, duplicates) {
  const products = flattenProducts();
  console.log("Catalogo: Queje Olga");
  console.log(`Slug: ${storeSlug}`);
  if (store) console.log(`Store encontrado: ${store.name} (${store.id})`);
  if (counts) {
    console.log(
      `Actual remoto: ${counts.categories} categorias, ${counts.products} productos, ${counts.optionGroups} grupos de opciones`
    );
  }
  console.log(
    `Preparado: ${catalog.categories.length} categorias, ${products.length} productos, ${catalog.optionGroups.length} grupos de opciones`
  );
  console.log(`Ocultos/no disponibles: ${products.filter((product) => !product.isAvailable).length}`);
  console.log(`Duplicados internos detectados: ${duplicates.length}`);
  console.log("");
  for (const category of catalog.categories) {
    console.log(`- ${category.name}`);
    for (const product of category.products) {
      const status = product.isAvailable === false ? " (oculto)" : "";
      const options = product.optionGroups?.length ? ` | opciones: ${product.optionGroups.join(", ")}` : "";
      console.log(`  - ${product.name}: $${Number(product.priceUsd || 0).toFixed(2)}${status}${options}`);
    }
  }
}

async function getSupabaseClient() {
  readEnvFile(path.resolve(".env.local"));
  readEnvFile(path.resolve(".env"));

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
    .select("id, slug, name, is_active, base_currency, primary_color, accent_color, button_text_color")
    .eq("slug", storeSlug)
    .maybeSingle();

  if (storeError) throw storeError;
  if (!store) throw new Error(`No existe el comercio con slug ${storeSlug}.`);

  const [categories, products, optionGroups] = await Promise.all([
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("store_id", store.id),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id),
    supabase.from("product_option_groups").select("id", { count: "exact", head: true }).eq("store_id", store.id),
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

async function ensureStorePalette(supabase, storeId) {
  const { error } = await supabase
    .from("stores")
    .update({
      base_currency: palette.baseCurrency,
      primary_color: palette.primaryColor,
      accent_color: palette.accentColor,
      button_text_color: palette.buttonTextColor,
    })
    .eq("id", storeId);

  if (error) throw error;
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
        description: null,
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
    .select("id, name, category_id")
    .eq("store_id", storeId);
  if (error) throw error;

  const byCategoryAndName = new Map(
    (existing || []).map((row) => [`${row.category_id || "none"}:${normalize(row.name)}`, row])
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
      is_available: product.isAvailable,
      is_featured: product.name === "Almuerzo Queje Olga",
      sort_order: product.sortOrder,
    };

    const current = byCategoryAndName.get(`${categoryId || "none"}:${normalize(product.name)}`);
    let productId;
    let operation;
    if (current) {
      const { data, error: updateError } = await supabase
        .from("products")
        .update(payload)
        .eq("id", current.id)
        .select("id")
        .single();
      if (updateError) throw updateError;
      productId = data.id;
      operation = "updated";
    } else {
      const { data, error: insertError } = await supabase
        .from("products")
        .insert(payload)
        .select("id")
        .single();
      if (insertError) throw insertError;
      productId = data.id;
      operation = "inserted";
    }

    writtenProducts.push({ ...product, id: productId, operation });

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

  return writtenProducts;
}

async function main() {
  const duplicates = findDuplicateProducts();
  const { supabase, supabaseUrl } = await getSupabaseClient();
  const { store, counts } = await fetchStoreContext(supabase);

  printSummary(store, counts, duplicates);

  if (duplicates.length) {
    throw new Error("Hay productos duplicados dentro del catalogo preparado. Revisa antes de aplicar.");
  }

  if (!shouldApply) {
    console.log("");
    console.log("Modo dry-run: no se escribio nada en Supabase.");
    console.log("Para aplicar en un Supabase local, usa: node scripts/catalogs/queje-olga-catalog.mjs --apply");
    console.log("Para remoto/produccion se requiere autorizacion expresa y el flag adicional --allow-remote-write.");
    return;
  }

  if (!isLocalSupabaseUrl(supabaseUrl) && !allowRemoteWrite) {
    throw new Error(`Bloqueado: .env.local apunta a ${supabaseUrl}. No aplico cambios remotos sin --allow-remote-write.`);
  }

  await ensureStorePalette(supabase, store.id);
  const categoryIds = await ensureCategories(supabase, store.id);
  const groupIdsByKey = await ensureOptionGroups(supabase, store.id);
  const writtenProducts = await ensureProducts(supabase, store.id, categoryIds, groupIdsByKey);

  const inserted = writtenProducts.filter((product) => product.operation === "inserted").length;
  const updated = writtenProducts.filter((product) => product.operation === "updated").length;
  console.log("");
  console.log(
    `Aplicado: ${categoryIds.size} categorias, ${groupIdsByKey.size} grupos de opciones, ${inserted} productos nuevos, ${updated} productos actualizados.`
  );
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
