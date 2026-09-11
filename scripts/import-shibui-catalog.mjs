import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const STORE_ID = "126f8168-f1ca-4a08-8eaf-c3816b9d9195";
const STORE_SLUG = "shibui";
const DEFAULT_SOURCE = "tmp/imports/shibui-20260910/catalogo_para_importar.json";
const APPLY_FLAG = "--apply";

const args = new Set(process.argv.slice(2));
const apply = args.has(APPLY_FLAG);
const sourceArg = process.argv.slice(2).find((value) => !value.startsWith("--"));
const confirmedStore = process.argv.slice(2).find((value) => value.startsWith("--confirm-store="))?.split("=")[1];
const confirmedProject = process.argv.slice(2).find((value) => value.startsWith("--confirm-project="))?.split("=")[1];
const sourcePath = path.resolve(sourceArg || DEFAULT_SOURCE);
const sourceDir = path.dirname(sourcePath);

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
}

function slugPart(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sin-dato";
}

function productKeys(value) {
  const full = normalize(value);
  const withoutSwimwearPrefix = full.replace(/^traje de bano\s+/, "");
  return [...new Set([full, withoutSwimwearPrefix].filter(Boolean))];
}

function skuCode(productId, variant, index) {
  const readable = [productId, variant.color, variant.talla, variant.detalle]
    .filter(Boolean)
    .map(slugPart)
    .join("-")
    .toUpperCase();
  const fingerprint = createHash("sha1")
    .update(JSON.stringify([productId, variant.color || "", variant.talla || "", variant.detalle || "", index]))
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
  return `${readable}-${fingerprint}`.slice(0, 120);
}

function requireEnvironment() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { url, key };
}

async function loadSource() {
  const document = JSON.parse(await readFile(sourcePath, "utf8"));
  if (document.catalog !== "SHIBUI" || !Array.isArray(document.products) || !Array.isArray(document.variants)) {
    throw new Error("El archivo no tiene el formato esperado del catálogo SHIBUI.");
  }
  const variantsByProduct = new Map();
  for (const variant of document.variants) {
    const list = variantsByProduct.get(variant.product_id) || [];
    list.push(variant);
    variantsByProduct.set(variant.product_id, list);
  }
  return { document, variantsByProduct };
}

async function uploadProductImage(client, product) {
  if (!product.imagen) return null;
  const absolutePath = path.resolve(sourceDir, product.imagen);
  const bytes = await readFile(absolutePath);
  const extension = path.extname(absolutePath).toLowerCase() || ".jpg";
  const storagePath = `${STORE_ID}/shibui-import/${product.product_id}${extension}`;
  const upload = await client.storage.from("product-images").upload(storagePath, bytes, {
    contentType: extension === ".png" ? "image/png" : "image/jpeg",
    upsert: true,
  });
  if (upload.error) throw upload.error;
  return client.storage.from("product-images").getPublicUrl(storagePath).data.publicUrl;
}

async function ensureBucket(client) {
  const buckets = await client.storage.listBuckets();
  if (buckets.error) throw buckets.error;
  if (buckets.data.some((bucket) => bucket.id === "product-images")) return;
  const created = await client.storage.createBucket("product-images", {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (created.error) throw created.error;
}

async function main() {
  const { url, key } = requireEnvironment();
  const projectRef = new URL(url).hostname.split(".")[0];
  if (apply && (confirmedStore !== STORE_SLUG || confirmedProject !== projectRef)) {
    throw new Error(`Para aplicar confirma explícitamente --confirm-store=${STORE_SLUG} --confirm-project=${projectRef}.`);
  }
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { document, variantsByProduct } = await loadSource();

  const storeResult = await client.from("stores").select("id, slug, name").eq("id", STORE_ID).single();
  if (storeResult.error) throw storeResult.error;
  if (storeResult.data.slug !== STORE_SLUG) throw new Error("La identidad del comercio no coincide con SHIBUI.");

  const settingsResult = await client
    .from("store_inventory_settings")
    .select("enabled")
    .eq("store_id", STORE_ID)
    .maybeSingle();
  if (settingsResult.error) throw settingsResult.error;
  if (!settingsResult.data?.enabled) throw new Error("El inventario básico no está habilitado para SHIBUI.");

  const [productsResult, categoriesResult] = await Promise.all([
    client.from("products").select("id, store_id, category_id, name, price_usd, image_url").eq("store_id", STORE_ID),
    client.from("categories").select("id, store_id, name").eq("store_id", STORE_ID),
  ]);
  if (productsResult.error) throw productsResult.error;
  if (categoriesResult.error) throw categoriesResult.error;

  const existingProducts = new Map();
  for (const row of productsResult.data || []) {
    for (const key of productKeys(row.name)) {
      const collision = existingProducts.get(key);
      if (collision && collision.id !== row.id) {
        throw new Error(`Hay productos duplicados o ambiguos por nombre en SHIBUI: ${row.name}.`);
      }
      existingProducts.set(key, row);
    }
  }
  const existingCategories = new Map((categoriesResult.data || []).map((row) => [normalize(row.name), row]));
  const hasValidPrice = (product) => product.precio_usd !== null
    && product.precio_usd !== undefined
    && String(product.precio_usd).trim() !== ""
    && Number.isFinite(Number(product.precio_usd));
  const eligible = document.products.filter(hasValidPrice);
  const omitted = document.products.filter((product) => !hasValidPrice(product));
  const conflicts = [];
  let newProducts = 0;
  let existingMatches = 0;
  let skuCount = 0;
  let stockTotal = 0;
  let imageCount = 0;

  for (const product of eligible) {
    const existing = productKeys(product.nombre).map((key) => existingProducts.get(key)).find(Boolean);
    if (existing) {
      existingMatches += 1;
      if (Number(existing.price_usd) !== Number(product.precio_usd)) {
        conflicts.push({ product: product.nombre, source: Number(product.precio_usd), preserved: Number(existing.price_usd) });
      }
    } else {
      newProducts += 1;
    }
    const variants = variantsByProduct.get(product.product_id) || [];
    const variantStock = variants.reduce((sum, variant) => sum + Number(variant.cantidad || 0), 0);
    if (variantStock !== Number(product.stock_total)) {
      throw new Error(`El stock por combinaciones no coincide con ${product.product_id}.`);
    }
    skuCount += variants.length;
    stockTotal += variantStock;
    if (product.imagen) imageCount += 1;
  }

  const plan = {
    mode: apply ? "apply" : "dry-run",
    store: { id: STORE_ID, slug: STORE_SLUG, name: storeResult.data.name },
    source: path.relative(process.cwd(), sourcePath),
    products: { source: document.products.length, eligible: eligible.length, new: newProducts, existing: existingMatches, omitted: omitted.map((row) => row.nombre) },
    inventory: { skus: skuCount, stock: stockTotal },
    images: imageCount,
    priceConflicts: conflicts,
  };
  console.log(JSON.stringify(plan, null, 2));
  if (!apply) return;

  await ensureBucket(client);
  let sortOrder = 0;
  for (const product of eligible) {
    sortOrder += 1;
    const categoryKey = normalize(product.categoria);
    let category = existingCategories.get(categoryKey);
    if (!category) {
      const createdCategory = await client.from("categories").insert({
        store_id: STORE_ID,
        name: product.categoria,
        sort_order: existingCategories.size + 1,
        is_active: true,
      }).select("id, store_id, name").single();
      if (createdCategory.error) throw createdCategory.error;
      category = createdCategory.data;
      existingCategories.set(categoryKey, category);
    }

    let target = productKeys(product.nombre).map((key) => existingProducts.get(key)).find(Boolean);
    let imageUrl = target?.image_url || null;
    if (!imageUrl && product.imagen) imageUrl = await uploadProductImage(client, product);
    if (!target) {
      const createdProduct = await client.from("products").insert({
        store_id: STORE_ID,
        category_id: category.id,
        name: product.nombre,
        description: product.notas || null,
        price_usd: Number(product.precio_usd),
        discount_percent: 0,
        image_url: imageUrl,
        is_available: true,
        is_featured: false,
        sort_order: sortOrder,
      }).select("id, store_id, category_id, name, price_usd, image_url").single();
      if (createdProduct.error) throw createdProduct.error;
      target = createdProduct.data;
      for (const key of productKeys(product.nombre)) existingProducts.set(key, target);
    } else {
      const updates = {};
      if (!target.category_id) updates.category_id = category.id;
      if (!target.image_url && imageUrl) updates.image_url = imageUrl;
      if (Object.keys(updates).length) {
        const updated = await client.from("products").update(updates).eq("id", target.id).eq("store_id", STORE_ID);
        if (updated.error) throw updated.error;
      }
    }

    const variants = variantsByProduct.get(product.product_id) || [];
    for (const [index, variant] of variants.entries()) {
      const attributes = Object.fromEntries([
        ["color", variant.color],
        ["talla", variant.talla],
        ["detalle", variant.detalle],
      ].filter(([, value]) => String(value || "").trim()).map(([key, value]) => [key, String(value).trim()]));
      const stock = Number(variant.cantidad || 0);
      if (!Number.isInteger(stock) || stock < 0) throw new Error(`Existencia inválida en ${product.product_id}.`);
      const imported = await client.rpc("import_inventory_stock", {
        p_store_id: STORE_ID,
        p_product_id: target.id,
        p_code: skuCode(product.product_id, variant, index),
        p_attributes: attributes,
        p_stock_on_hand: stock,
        p_reference: `Catálogo SHIBUI ${product.product_id}`,
      });
      if (imported.error) throw imported.error;
    }
  }
  console.log(JSON.stringify({ ok: true, applied: { products: eligible.length, skus: skuCount, stock: stockTotal } }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
