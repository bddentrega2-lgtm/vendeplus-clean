import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const STORE_ID = "85ffbf6d-2473-45c9-afe9-8032d65acaa8";
const STORE_SLUG = "porkys-food";
const SOURCE = "tmp/porkys-catalog/catalogo.json";
const IMPORT_FOLDER = "porkys-catalog-20261003";
const APPLY_FLAG = "--apply";

const args = new Set(process.argv.slice(2));
const apply = args.has(APPLY_FLAG);
const confirmedStore = process.argv.slice(2).find(value => value.startsWith("--confirm-store="))?.split("=")[1];
const confirmedProject = process.argv.slice(2).find(value => value.startsWith("--confirm-project="))?.split("=")[1];
const sourcePath = path.resolve(SOURCE);
const sourceDir = path.dirname(sourcePath);

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
}

function cleanName(value) {
  return String(value || "")
    .replace(/ referencia \d+$/iu, "")
    .replace(/^Salchipapas con cheddar y BA…$/u, "Salchipapas con cheddar")
    .trim();
}

function environment() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Faltan las variables privadas de Supabase.");
  return { url, key };
}

function storagePath(product) {
  return `${STORE_ID}/${IMPORT_FOLDER}/${product.id_referencia}.jpg`;
}

async function ensureBucket(client) {
  const result = await client.storage.listBuckets();
  if (result.error) throw result.error;
  if (result.data.some(bucket => bucket.id === "product-images")) return;
  const created = await client.storage.createBucket("product-images", {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (created.error) throw created.error;
}

async function main() {
  const { url, key } = environment();
  const projectRef = new URL(url).hostname.split(".")[0];
  if (apply && (confirmedStore !== STORE_SLUG || confirmedProject !== projectRef)) {
    throw new Error(`Confirma --confirm-store=${STORE_SLUG} --confirm-project=${projectRef}.`);
  }

  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  if (!Array.isArray(source.categorias) || source.categorias.length !== 8 || !Array.isArray(source.productos) || source.productos.length !== 29) {
    throw new Error("El paquete de Porkys no contiene las 8 categorias y 29 productos esperados.");
  }
  const products = source.productos.map((product, index) => ({
    ...product,
    name: cleanName(product.nombre_referencia),
    price: Number(product.precio_publicado),
    image: product.foto_alternativa || product.foto,
    sortOrder: index + 1,
  }));
  if (products.some(product => !product.name || !Number.isFinite(product.price) || product.price < 0)) {
    throw new Error("Hay nombres o precios invalidos en el paquete.");
  }

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [storeResult, productsResult, categoriesResult] = await Promise.all([
    client.from("stores").select("id,slug,name,is_active,base_currency,product_limit,logo_url").eq("id", STORE_ID).single(),
    client.from("products").select("id,name,price_usd,image_url,category_id,is_available").eq("store_id", STORE_ID),
    client.from("categories").select("id,name,is_active,sort_order").eq("store_id", STORE_ID),
  ]);
  for (const result of [storeResult, productsResult, categoriesResult]) if (result.error) throw result.error;
  const store = storeResult.data;
  if (store.slug !== STORE_SLUG || normalize(store.name) !== "porkys food" || store.is_active !== true) {
    throw new Error("La identidad del comercio Porkys Food no coincide.");
  }
  if (String(store.base_currency || "USD").toUpperCase() !== "USD") {
    throw new Error("Porkys Food no esta configurado en USD.");
  }

  const publicUrls = new Map(products.map(product => [
    product.id_referencia,
    client.storage.from("product-images").getPublicUrl(storagePath(product)).data.publicUrl,
  ]));
  const existingByImage = new Map((productsResult.data || []).filter(row => row.image_url).map(row => [row.image_url, row]));
  const matches = products.filter(product => existingByImage.has(publicUrls.get(product.id_referencia))).length;
  const creates = products.length - matches;
  if ((productsResult.data || []).length + creates > Number(store.product_limit || 30)) {
    throw new Error("La carga superaria el cupo de productos de Porkys Food.");
  }

  const plan = {
    mode: apply ? "apply" : "dry-run",
    project: projectRef,
    store: { id: store.id, slug: store.slug, name: store.name, currency: store.base_currency, productLimit: store.product_limit },
    source: { categories: source.categorias.length, products: products.length, images: products.length },
    changes: { createCategories: source.categorias.filter(name => !(categoriesResult.data || []).some(row => normalize(row.name) === normalize(name))).length, createProducts: creates, updateImportedProducts: matches },
    preserved: { existingProducts: (productsResult.data || []).length - matches, existingLogo: Boolean(store.logo_url) },
    names: products.map(product => ({ ref: product.id_referencia, name: product.name, priceUsd: product.price })),
  };
  console.log(JSON.stringify(plan, null, 2));
  if (!apply) return;

  await ensureBucket(client);
  const categories = new Map((categoriesResult.data || []).map(row => [normalize(row.name), row]));
  for (const [index, name] of source.categorias.entries()) {
    const keyName = normalize(name);
    let category = categories.get(keyName);
    if (!category) {
      const created = await client.from("categories").insert({
        store_id: STORE_ID,
        name,
        is_active: true,
        sort_order: index + 1,
      }).select("id,name,is_active,sort_order").single();
      if (created.error) throw created.error;
      category = created.data;
      categories.set(keyName, category);
    }
  }

  let createdCount = 0;
  let updatedCount = 0;
  let uploadedCount = 0;
  for (const product of products) {
    const imagePath = path.resolve(sourceDir, product.image);
    const bytes = await readFile(imagePath);
    if (bytes.length > 5 * 1024 * 1024) throw new Error(`La imagen ${product.image} supera 5 MB.`);
    const upload = await client.storage.from("product-images").upload(storagePath(product), bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (upload.error) throw upload.error;
    uploadedCount += 1;

    const imageUrl = publicUrls.get(product.id_referencia);
    const category = categories.get(normalize(product.categoria));
    if (!category) throw new Error(`No se encontro la categoria ${product.categoria}.`);
    const payload = {
      store_id: STORE_ID,
      category_id: category.id,
      name: product.name,
      description: null,
      price_usd: product.price,
      discount_percent: 0,
      image_url: imageUrl,
      is_available: true,
      is_featured: false,
      sort_order: product.sortOrder,
    };
    const existing = existingByImage.get(imageUrl);
    if (existing) {
      const updated = await client.from("products").update(payload).eq("id", existing.id).eq("store_id", STORE_ID);
      if (updated.error) throw updated.error;
      updatedCount += 1;
    } else {
      const created = await client.from("products").insert(payload).select("id,image_url").single();
      if (created.error) throw created.error;
      existingByImage.set(imageUrl, created.data);
      createdCount += 1;
    }
  }

  const [verifyProducts, verifyCategories] = await Promise.all([
    client.from("products").select("id,name,price_usd,image_url,is_available,category_id").eq("store_id", STORE_ID),
    client.from("categories").select("id,name,is_active").eq("store_id", STORE_ID),
  ]);
  if (verifyProducts.error) throw verifyProducts.error;
  if (verifyCategories.error) throw verifyCategories.error;
  const imported = products.map(product => {
    const row = (verifyProducts.data || []).find(item => item.image_url === publicUrls.get(product.id_referencia));
    if (!row || row.name !== product.name || Number(row.price_usd) !== product.price || row.is_available !== true) {
      throw new Error(`La verificacion fallo para ${product.id_referencia}.`);
    }
    return row;
  });
  const activeCategoryNames = new Set((verifyCategories.data || []).filter(row => row.is_active).map(row => normalize(row.name)));
  if (source.categorias.some(name => !activeCategoryNames.has(normalize(name)))) throw new Error("La verificacion de categorias fallo.");
  if (new Set(imported.map(row => row.id)).size !== 29) throw new Error("La carga no produjo 29 productos unicos.");

  console.log(JSON.stringify({ ok: true, created: createdCount, updated: updatedCount, uploaded: uploadedCount, categories: source.categorias.length, products: imported.length }));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
