import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const storeSlug = "realza";

const palette = {
  baseCurrency: "EUR",
  primaryColor: "#7c5d45",
  accentColor: "#890b00",
  buttonTextColor: "#f5f5dc",
  colors: ["#f5f5dc", "#f2e5c5", "#b38f6f", "#7c5d45", "#890b00"],
};

const catalog = {
  categories: [
    {
      name: "Tops",
      description: "Tops Realza en tonos neutros, claros y acentos rojos.",
      products: [
        { name: "Top Lauren", description: "Hecho con microdurazno.", priceUsd: 12 },
        { name: "Top charlotte", description: "Solo disponible en colores claros.", priceUsd: 10 },
        { name: "Backless manga larga", description: "Desde la talla XS hasta la L.", priceUsd: 12 },
        { name: "Top Zara 1", description: "Color crema (primera foto).", priceUsd: 12 },
        { name: "Top Sienna", description: "4 colores.", priceUsd: 10 },
        { name: "Ciara Nuevo", description: "Colores: rojo, negro, blanco hueso y otros tonos disponibles.", priceUsd: 12 },
        { name: "Zara versión 2", description: "Desde la XS hasta la L.", priceUsd: 12 },
        { name: "Top Lana", description: "Variedad de colores: rojo, blanco, azul y otros tonos disponibles.", priceUsd: 10 },
        { name: "Top Khloe", description: "Colores: negro, blanco, beige, rojo, vino, rosado y otros tonos.", priceUsd: 14 },
        { name: "Top Ziany", description: "Doble capa de tela adelante y atrás.", priceUsd: 12 },
        { name: "Top Lina", description: "Se realiza en blanco, negro, rojo, marrón y otros tonos.", priceUsd: 12 },
        { name: "Top Ciara, versión corta", description: "Colores disponibles.", priceUsd: 10 },
        { name: "Top Aria", description: "Top de colección Realza.", priceUsd: 16 },
        { name: "Top Amanda", description: "Hecho con microdurazno.", priceUsd: 12 },
      ],
    },
    {
      name: "Promos",
      description: "Promociones activas del catálogo Realza.",
      products: [
        {
          name: "Básicos esenciales promo",
          description: "Arma tu pack con 3 básicos esenciales. Precio indicado en captura: 20$; confirmar divisa con el comercio.",
          priceUsd: 20,
        },
        {
          name: "Strapples cortos ⚡",
          description: "Promoción activa 2x10€. 6 colores disponibles.",
          priceUsd: 10,
        },
      ],
    },
    {
      name: "Vestidos",
      description: "Vestidos y básicos largos Realza.",
      products: [
        { name: "Backless Dress", description: "Doble capa de tela.", priceUsd: 25 },
        { name: "Backless dress manga larga", description: "Hecho con microdurazno.", priceUsd: 25 },
        { name: "LUNA DRESS 🐚", description: "Hecho con microdurazno.", priceUsd: 22 },
        { name: "Vestido básico", description: "Rojo, blanco y negro disponibles.", priceUsd: 22 },
        { name: "Vestido Lana versión larga", description: "Versión larga en rojo, blanco, azul marino y otros tonos.", priceUsd: 25 },
        {
          name: "Vestido Zara",
          description: "Abertura en la parte de atrás. Precio indicado en captura: 25$; confirmar divisa con el comercio.",
          priceUsd: 25,
        },
        { name: "Vestido Ciara", description: "Rojo, blanco, vinotinto y negro.", priceUsd: 25 },
        { name: "Básico de tirantes grueso", description: "Hecho en microdurazno.", priceUsd: 22 },
        { name: "Básico de tirantes", description: "Hecho en microdurazno.", priceUsd: 22 },
      ],
    },
    {
      name: "Básicos para el día a día",
      description: "Básicos cómodos para uso diario.",
      products: [
        { name: "BACKLESS TOP", description: "Azul marino, rojo, negro, vinotinto y otros tonos.", priceUsd: 10 },
        { name: "Básico clásico", description: "Escote abierto.", priceUsd: 10 },
        { name: "Básico de escote cuadrado", description: "Variedad de colores disponibles.", priceUsd: 12 },
        {
          name: "CROPTOP",
          description: "Producto existente pero no disponible por ahora. Precio indicado en captura: 8$; confirmar divisa con el comercio.",
          priceUsd: 8,
          isAvailable: false,
        },
        { name: "Básicos", description: "Vinotinto, azul marino, beige, blanco y otros tonos.", priceUsd: 10 },
        { name: "Básicos cuello redondo largo", description: "Dos versiones de largo: largo medio y corto.", priceUsd: 12 },
        { name: "Básicos cuello redondo", description: "Básicos manga corta.", priceUsd: 10 },
        { name: "Top Nia", description: "Hecho con microdurazno.", priceUsd: 9.5 },
        { name: "Básico de tirantes", description: "Básico de tirantes delgado.", priceUsd: 9.5 },
        { name: "Top de tirantes grueso", description: "Hecho en microdurazno.", priceUsd: 9.5 },
        { name: "Top escote engomado", description: "Hecho en microdurazno.", priceUsd: 9.5 },
        { name: "Top doble agarre", description: "Realizado en microdurazno.", priceUsd: 9.5 },
        { name: "Top corto manga larga", description: "Colores: vinotinto, blanco, negro, rojo y otros tonos.", priceUsd: 10 },
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
        categorySortOrder: categoryIndex + 1,
        sortOrder: categoryIndex * 100 + productIndex + 1,
        isAvailable: product.isAvailable !== false,
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

function formatPrice(value) {
  return `€${Number(value || 0).toFixed(2)}`;
}

function findDuplicateProducts() {
  const seen = new Map();
  const duplicates = [];

  for (const product of flattenProducts()) {
    const key = `${normalize(product.categoryName)}:${normalize(product.name)}`;
    if (seen.has(key)) duplicates.push({ ...product, duplicatedWith: seen.get(key) });
    seen.set(key, product);
  }

  return duplicates;
}

function writePreviewHtml(filePath) {
  const sections = catalog.categories
    .map((category) => {
      const products = category.products
        .map((product) => {
          const available = product.isAvailable !== false;
          return `
            <article class="product ${available ? "" : "hidden-product"}">
              <div class="product-main">
                <span class="status">${available ? "Disponible" : "Oculto / no disponible"}</span>
                <h3>${escapeHtml(product.name)}</h3>
                <p>${escapeHtml(product.description)}</p>
              </div>
              <strong>${formatPrice(product.priceUsd)}</strong>
            </article>`;
        })
        .join("");

      return `<section><h2>${escapeHtml(category.name)}</h2><p class="section-description">${escapeHtml(
        category.description
      )}</p>${products}</section>`;
    })
    .join("");

  const swatches = palette.colors
    .map((color) => `<div class="swatch" style="background:${color}"><span>${color}</span></div>`)
    .join("");

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vista previa catálogo Realza</title>
  <style>
    :root {
      --bone: ${palette.colors[0]};
      --beige: ${palette.colors[1]};
      --camel: ${palette.colors[2]};
      --brown: ${palette.primaryColor};
      --red: ${palette.accentColor};
    }
    body { margin: 0; background: var(--bone); color: #2d2119; font-family: Inter, Arial, sans-serif; }
    main { max-width: 1020px; margin: 0 auto; padding: 28px 18px 48px; }
    .hero { border-radius: 34px; background: linear-gradient(135deg, var(--beige), var(--camel)); padding: 26px; box-shadow: 0 22px 60px rgba(124,93,69,.18); }
    h1 { margin: 0; font-size: clamp(42px, 12vw, 86px); letter-spacing: -0.08em; color: var(--brown); }
    .meta { margin-top: 10px; color: var(--brown); font-weight: 900; }
    .palette { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 18px; }
    .swatch { min-height: 78px; border-radius: 22px; display: flex; align-items: end; padding: 10px; box-shadow: inset 0 0 0 1px rgba(45,33,25,.16); }
    .swatch span { padding: 5px 8px; border-radius: 999px; background: rgba(255,255,255,.72); font-size: 12px; font-weight: 900; color: #2d2119; }
    section { margin-top: 24px; padding: 20px; border-radius: 30px; background: #fffaf0; box-shadow: 0 16px 38px rgba(124,93,69,.10); border: 1px solid rgba(124,93,69,.14); }
    h2 { color: var(--brown); font-size: 30px; margin: 0 0 6px; }
    .section-description { margin: 0 0 12px; font-weight: 800; color: #7c5d45; }
    .product { display: flex; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid rgba(124,93,69,.15); }
    .product:last-child { border-bottom: 0; }
    .hidden-product { opacity: .45; }
    .product-main { min-width: 0; }
    .status { display: inline-flex; margin-bottom: 6px; border-radius: 999px; background: rgba(137,11,0,.08); color: var(--red); padding: 4px 8px; font-size: 11px; font-weight: 950; text-transform: uppercase; letter-spacing: .06em; }
    h3 { margin: 0 0 5px; color: #2d2119; font-size: 20px; }
    p { margin: 0; line-height: 1.35; color: #7c5d45; font-weight: 700; }
    strong { color: var(--red); font-size: 25px; white-space: nowrap; }
    @media (max-width: 640px) {
      .palette { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .product { align-items: flex-start; }
    }
  </style>
</head>
<body>
  <main>
    <div class="hero">
      <h1>Realza</h1>
      <div class="meta">${catalog.categories.length} categorías · ${
        flattenProducts().length
      } productos únicos · ${flattenProducts().filter((product) => !product.isAvailable).length} oculto · Vista previa local</div>
      <div class="palette">${swatches}</div>
    </div>
    ${sections}
  </main>
</body>
</html>`;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html);
}

function printSummary(store, counts, duplicates) {
  const products = flattenProducts();
  console.log("Catalogo: Realza");
  console.log(`Slug: ${storeSlug}`);
  if (store) console.log(`Store encontrado: ${store.name} (${store.id})`);
  if (counts) console.log(`Actual remoto: ${counts.categories} categorias, ${counts.products} productos`);
  console.log(`Preparado: ${catalog.categories.length} categorias, ${products.length} productos`);
  console.log(`Ocultos/no disponibles: ${products.filter((product) => !product.isAvailable).length}`);
  console.log(`Duplicados internos detectados: ${duplicates.length}`);
  console.log("");
  for (const category of catalog.categories) {
    console.log(`- ${category.name}`);
    for (const product of category.products) {
      const status = product.isAvailable === false ? " (oculto)" : "";
      console.log(`  - ${product.name}: ${formatPrice(product.priceUsd)}${status}`);
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

  const [categories, products] = await Promise.all([
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("store_id", store.id),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id),
  ]);

  for (const result of [categories, products]) {
    if (result.error) throw result.error;
  }

  return {
    store,
    counts: {
      categories: categories.count || 0,
      products: products.count || 0,
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

async function ensureProducts(supabase, storeId, categoryIds) {
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
      is_featured: false,
      sort_order: product.sortOrder,
    };

    const current = byCategoryAndName.get(`${categoryId || "none"}:${normalize(product.name)}`);
    if (current) {
      const { data, error: updateError } = await supabase
        .from("products")
        .update(payload)
        .eq("id", current.id)
        .select("id")
        .single();
      if (updateError) throw updateError;
      writtenProducts.push({ ...product, id: data.id, operation: "updated" });
    } else {
      const { data, error: insertError } = await supabase
        .from("products")
        .insert(payload)
        .select("id")
        .single();
      if (insertError) throw insertError;
      writtenProducts.push({ ...product, id: data.id, operation: "inserted" });
    }
  }

  return writtenProducts;
}

async function main() {
  const previewPath = path.resolve("tmp/catalogs/realza-preview.html");
  writePreviewHtml(previewPath);

  const duplicates = findDuplicateProducts();
  const { supabase, supabaseUrl } = await getSupabaseClient();
  const { store, counts } = await fetchStoreContext(supabase);

  printSummary(store, counts, duplicates);
  console.log("");
  console.log(`Vista previa local: ${previewPath}`);

  if (duplicates.length) {
    throw new Error("Hay productos duplicados dentro del catalogo preparado. Revisa antes de aplicar.");
  }

  if (!shouldApply) {
    console.log("");
    console.log("Modo dry-run: no se escribio nada en Supabase.");
    console.log("Para aplicar en un Supabase local, usa: node scripts/catalogs/realza-catalog.mjs --apply");
    console.log("Para remoto/produccion se requiere autorizacion expresa y el flag adicional --allow-remote-write.");
    return;
  }

  if (!isLocalSupabaseUrl(supabaseUrl) && !allowRemoteWrite) {
    throw new Error(`Bloqueado: .env.local apunta a ${supabaseUrl}. No aplico cambios remotos sin --allow-remote-write.`);
  }

  await ensureStorePalette(supabase, store.id);
  const categoryIds = await ensureCategories(supabase, store.id);
  const writtenProducts = await ensureProducts(supabase, store.id, categoryIds);

  const inserted = writtenProducts.filter((product) => product.operation === "inserted").length;
  const updated = writtenProducts.filter((product) => product.operation === "updated").length;
  console.log("");
  console.log(`Aplicado: ${categoryIds.size} categorias, ${inserted} productos nuevos, ${updated} productos actualizados.`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
