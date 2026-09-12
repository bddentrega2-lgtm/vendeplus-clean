import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const STORE_ID = "78f9a439-223a-4f97-ab48-7c2234b38da6";
const STORE_SLUG = "sam-maracay";
const EXPECTED_SOURCE_ROWS = 138;
const EXPECTED_SOURCE_CATEGORIES = 14;
const DEFAULT_SOURCE_DIR = "scripts/catalogs/sam";
const DEFAULT_IMAGE_DIR = "tmp/imports/sam-20260911/imagenes";
const BUCKET = "product-images";
const UUID_NAMESPACE = "0ceba4df-9de5-4c41-b2d7-ef3c51b8099e";

const CATEGORY_ALIASES = new Map([
  ["topping", "toppings"],
  ["snacks", "snacks salados"],
  ["dulces", "snacks dulces"],
]);

// These source rows are already represented by SAM's current catalog. They are
// deliberately preserved instead of being overwritten or inserted again.
const PRESERVE_RULES = new Map([
  ["SAM-005", { names: ["Ramen pollo champiñon"], reason: "Mismo nombre normalizado y precio." }],
  ["SAM-014", { names: ["Ramen carne con vegetales"], reason: "Mismo producto, precio y familia de ramen." }],
  ["SAM-017", { names: ["Ramen carne picante", "Ramen"], reason: "Ya está representado por ramen de carne picante; hay dos filas actuales relacionadas." }],
  ["SAM-030", { names: ["Huevo cocido"], reason: "El topping ya existe; se conserva su precio y estado actuales." }],
  ["SAM-032", { names: ["Queso mozzarella"], reason: "El topping ya existe; se conserva su precio y estado actuales." }],
  ["SAM-127", { names: ["K-Dog salchicha / queso"], reason: "La cubierta Panko ya es una opción del K-Dog existente." }],
  ["SAM-128", { names: ["K-Dog chorizo / queso"], reason: "La cubierta Panko ya es una opción del K-Dog existente." }],
  ["SAM-129", { names: ["K-Dog queso mozzarella"], reason: "La cubierta Panko ya es una opción del K-Dog existente." }],
  ["SAM-130", { names: ["K-Dog salchicha / queso"], reason: "La cubierta Papa ya es una opción del K-Dog existente." }],
  ["SAM-131", { names: ["K-Dog queso mozzarella"], reason: "La cubierta Papa ya es una opción del K-Dog existente." }],
  ["SAM-132", { names: ["K-Dog chorizo / queso"], reason: "La cubierta Papa ya es una opción del K-Dog existente." }],
  ["SAM-133", { names: ["Malteada de chocolate"], reason: "Mismo producto y fotografía; se conserva el precio actual." }],
  ["SAM-134", { names: ["Malteada de fresa"], reason: "Mismo producto y fotografía; se conserva el precio actual." }],
]);

const REVIEW_RULES = new Map([
  ["SAM-121", { names: ["Kit de Sushi con Surimi"], reason: "Posible coincidencia, pero cambian nombre, composición y precio ($25 frente a $30)." }],
]);

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((value) => value.startsWith("--") && !value.includes("=")));
const option = (name, fallback) => argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) || fallback;
const apply = flags.has("--apply");
const allowRemoteWrite = flags.has("--allow-remote-write");
const skipConflicts = flags.has("--skip-conflicts");
const sourceDir = path.resolve(option("--source-dir", DEFAULT_SOURCE_DIR));
const imageDir = path.resolve(option("--image-dir", DEFAULT_IMAGE_DIR));
const confirmedStore = option("--confirm-store", "");
const confirmedProject = option("--confirm-project", "");

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const headers = rows.shift()?.map((value) => value.replace(/^\uFEFF/, "")) || [];
  return rows
    .filter((values) => values.some(Boolean))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function uuidFromSource(value) {
  const namespace = Buffer.from(UUID_NAMESPACE.replaceAll("-", ""), "hex");
  const digest = createHash("sha1").update(namespace).update(value).digest().subarray(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function requireEnvironment() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { url, key };
}

async function loadAndValidateSource() {
  const [csvText, descriptionsText] = await Promise.all([
    readFile(path.join(sourceDir, "productos.csv"), "utf8"),
    readFile(path.join(sourceDir, "descriptions.json"), "utf8"),
  ]);
  const descriptions = JSON.parse(descriptionsText);
  const products = parseCsv(csvText).map((row, index) => {
    const rawPrice = String(row.precio_usd || "").trim();
    const hasPrice = rawPrice !== "";
    const price = hasPrice ? Number(rawPrice) : 0;
    return {
      ...row,
      sourceIndex: index,
      hasPrice,
      price,
      description: descriptions.products?.[row.id] || null,
    };
  });

  if (products.length !== EXPECTED_SOURCE_ROWS) {
    throw new Error(`Se esperaban ${EXPECTED_SOURCE_ROWS} filas y se encontraron ${products.length}.`);
  }
  const ids = new Set();
  const urls = new Set();
  const categories = new Set();
  for (const product of products) {
    if (!/^SAM-\d{3}$/.test(product.id) || ids.has(product.id)) throw new Error(`ID inválido o duplicado: ${product.id}.`);
    if (!product.nombre.trim() || !product.categoria.trim()) throw new Error(`Nombre o categoría vacíos en ${product.id}.`);
    if (!product.url_producto.startsWith("https://sam-venezuela.ola.click/") || urls.has(product.url_producto)) {
      throw new Error(`URL inválida o duplicada en ${product.id}.`);
    }
    if (product.hasPrice && (!Number.isFinite(product.price) || product.price < 0)) throw new Error(`Precio inválido en ${product.id}.`);
    ids.add(product.id);
    urls.add(product.url_producto);
    categories.add(product.categoria);
  }
  if (categories.size !== EXPECTED_SOURCE_CATEGORIES) {
    throw new Error(`Se esperaban ${EXPECTED_SOURCE_CATEGORIES} categorías y se encontraron ${categories.size}.`);
  }
  return { products, categories: [...categories], descriptions };
}

async function inspectImages(products) {
  const images = [];
  for (const product of products) {
    const filename = path.basename(product.archivo_imagen);
    const absolutePath = path.join(imageDir, filename);
    const bytes = await readFile(absolutePath);
    if (!bytes.length) throw new Error(`La imagen de ${product.id} está vacía.`);
    const metadata = await sharp(bytes).metadata();
    if (metadata.format !== "webp" || !metadata.width || !metadata.height) {
      throw new Error(`La imagen de ${product.id} no es un WebP válido.`);
    }
    images.push({
      sourceId: product.id,
      absolutePath,
      bytes,
      size: bytes.length,
      width: metadata.width,
      height: metadata.height,
      hash: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  return images;
}

async function readRemote(client) {
  const storeResult = await client.from("stores").select("id, slug, name, is_active").eq("id", STORE_ID).single();
  if (storeResult.error) throw storeResult.error;
  if (storeResult.data.slug !== STORE_SLUG) throw new Error("La identidad del comercio SAM no coincide.");
  const [categoriesResult, productsResult, groupsResult] = await Promise.all([
    client.from("categories").select("id, name, is_active, sort_order").eq("store_id", STORE_ID),
    client.from("products").select("id, category_id, name, description, price_usd, image_url, is_available, sort_order").eq("store_id", STORE_ID),
    client.from("product_option_groups").select("id, name, product_option_values(name, price_delta_usd, is_active)").eq("store_id", STORE_ID),
  ]);
  for (const result of [categoriesResult, productsResult, groupsResult]) if (result.error) throw result.error;
  return {
    store: storeResult.data,
    categories: categoriesResult.data || [],
    products: productsResult.data || [],
    optionGroups: groupsResult.data || [],
  };
}

function locateExistingProducts(remoteProducts, rule) {
  const wanted = new Set(rule.names.map(normalize));
  return remoteProducts.filter((product) => wanted.has(normalize(product.name)));
}

function createPlan(source, images, remote) {
  const existingCategories = new Map(remote.categories.map((row) => [normalize(row.name), row]));
  const categoryPlan = source.categories.map((name, index) => {
    const sourceKey = normalize(name);
    const targetKey = CATEGORY_ALIASES.get(sourceKey) || sourceKey;
    const existing = existingCategories.get(targetKey);
    return {
      source: name,
      operation: existing ? (existing.is_active ? "reuse" : "reactivate") : "create",
      targetName: existing?.name || name,
      targetId: existing?.id || uuidFromSource(`sam-category:${name}`),
      sourceIndex: index,
    };
  });
  const categoriesBySource = new Map(categoryPlan.map((row) => [row.source, row]));
  const imageBySourceId = new Map(images.map((image) => [image.sourceId, image]));
  const duplicateRows = [];
  const conflictRows = [];
  const newRows = [];

  for (const product of source.products) {
    const preserveRule = PRESERVE_RULES.get(product.id);
    const reviewRule = REVIEW_RULES.get(product.id);
    if (preserveRule) {
      const matches = locateExistingProducts(remote.products, preserveRule);
      if (!matches.length) throw new Error(`La regla de preservación de ${product.id} ya no coincide con el catálogo remoto.`);
      duplicateRows.push({
        sourceId: product.id,
        sourceName: product.nombre,
        existing: matches.map((row) => ({ id: row.id, name: row.name, price: Number(row.price_usd), available: row.is_available })),
        sourcePrice: product.hasPrice ? product.price : null,
        reason: preserveRule.reason,
      });
      continue;
    }
    if (reviewRule) {
      const matches = locateExistingProducts(remote.products, reviewRule);
      conflictRows.push({
        sourceId: product.id,
        sourceName: product.nombre,
        existing: matches.map((row) => ({ id: row.id, name: row.name, price: Number(row.price_usd), available: row.is_available })),
        sourcePrice: product.hasPrice ? product.price : null,
        reason: reviewRule.reason,
      });
      continue;
    }
    const targetId = uuidFromSource(`sam-product:${product.url_producto}`);
    const deterministicExisting = remote.products.find((row) => row.id === targetId);
    newRows.push({
      ...product,
      targetId,
      category: categoriesBySource.get(product.categoria),
      image: imageBySourceId.get(product.id),
      operation: deterministicExisting ? "preserve-imported" : "create",
    });
  }

  const newImageHashes = new Set(newRows.filter((row) => row.operation === "create").map((row) => row.image.hash));
  return { categoryPlan, duplicateRows, conflictRows, newRows, newImageHashes };
}

function publicImageUrl(client, hash) {
  return client.storage.from(BUCKET).getPublicUrl(`${STORE_ID}/sam-import/${hash}.webp`).data.publicUrl;
}

async function uploadMissingImages(client, rows) {
  const unique = new Map();
  for (const row of rows) if (row.operation === "create") unique.set(row.image.hash, row.image);
  const listed = await client.storage.from(BUCKET).list(`${STORE_ID}/sam-import`, { limit: 1000 });
  if (listed.error) throw listed.error;
  const existing = new Set((listed.data || []).map((row) => row.name));
  let uploaded = 0;
  for (const [hash, image] of unique) {
    const filename = `${hash}.webp`;
    if (existing.has(filename)) continue;
    const result = await client.storage.from(BUCKET).upload(`${STORE_ID}/sam-import/${filename}`, image.bytes, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
    if (result.error) throw result.error;
    uploaded += 1;
  }
  return { required: unique.size, uploaded, reused: unique.size - uploaded };
}

async function applyPlan(client, remote, plan) {
  const buckets = await client.storage.listBuckets();
  if (buckets.error) throw buckets.error;
  if (!buckets.data.some((bucket) => bucket.id === BUCKET && bucket.public)) {
    throw new Error(`El bucket público ${BUCKET} no existe o no es público.`);
  }
  const imageResult = await uploadMissingImages(client, plan.newRows);
  const maxCategoryOrder = remote.categories.reduce((max, row) => Math.max(max, Number(row.sort_order) || 0), 0);
  let categoriesCreated = 0;
  let categoriesReactivated = 0;
  for (const category of plan.categoryPlan) {
    if (category.operation === "reactivate") {
      const result = await client
        .from("categories")
        .update({ is_active: true })
        .eq("id", category.targetId)
        .eq("store_id", STORE_ID);
      if (result.error) throw result.error;
      categoriesReactivated += 1;
      continue;
    }
    if (category.operation !== "create") continue;
    const result = await client.from("categories").insert({
      id: category.targetId,
      store_id: STORE_ID,
      name: category.targetName,
      is_active: true,
      sort_order: maxCategoryOrder + category.sourceIndex + 1,
    });
    if (result.error) throw result.error;
    categoriesCreated += 1;
  }
  const maxProductOrder = remote.products.reduce((max, row) => Math.max(max, Number(row.sort_order) || 0), 0);
  let productsCreated = 0;
  for (const row of plan.newRows) {
    if (row.operation !== "create") continue;
    const result = await client.from("products").insert({
      id: row.targetId,
      store_id: STORE_ID,
      category_id: row.category.targetId,
      name: row.nombre,
      description: row.description,
      price_usd: row.hasPrice ? row.price : 0,
      discount_percent: 0,
      image_url: publicImageUrl(client, row.image.hash),
      is_available: row.hasPrice,
      is_featured: false,
      sort_order: maxProductOrder + row.sourceIndex + 1,
    });
    if (result.error) throw result.error;
    productsCreated += 1;
  }
  return { categoriesCreated, categoriesReactivated, productsCreated, images: imageResult };
}

async function main() {
  const { url, key } = requireEnvironment();
  const projectRef = new URL(url).hostname.split(".")[0];
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [source, remote] = await Promise.all([loadAndValidateSource(), readRemote(client)]);
  const images = await inspectImages(source.products);
  const plan = createPlan(source, images, remote);
  const missingPrice = source.products.filter((row) => !row.hasPrice);
  const report = {
    mode: apply ? "apply" : "dry-run",
    store: remote.store,
    source: {
      rows: source.products.length,
      categories: source.categories.length,
      distinctUrls: new Set(source.products.map((row) => row.url_producto)).size,
      descriptions: source.products.filter((row) => row.description).length,
      missingDescriptions: source.products.filter((row) => !row.description).length,
    },
    current: { categories: remote.categories.length, products: remote.products.length },
    categories: {
      create: plan.categoryPlan.filter((row) => row.operation === "create").map((row) => row.source),
      reactivate: plan.categoryPlan.filter((row) => row.operation === "reactivate").map((row) => ({ source: row.source, existing: row.targetName })),
      reuse: plan.categoryPlan.filter((row) => row.operation === "reuse").map((row) => ({ source: row.source, existing: row.targetName })),
    },
    products: {
      create: plan.newRows.filter((row) => row.operation === "create").length,
      alreadyImported: plan.newRows.filter((row) => row.operation === "preserve-imported").length,
      preservedDuplicates: plan.duplicateRows,
      conflicts: plan.conflictRows,
      withoutPrice: missingPrice.map((row) => ({ id: row.id, name: row.nombre, action: "create-inactive-at-zero" })),
    },
    images: {
      downloadedAndValid: images.length,
      uniqueInSource: new Set(images.map((image) => image.hash)).size,
      uniqueNeededForNewProducts: plan.newImageHashes.size,
      invalid: 0,
    },
    stock: "El origen no aporta cantidades; no se crearán SKU ni existencias.",
  };
  console.log(JSON.stringify(report, null, 2));
  if (!apply) return;
  if (!allowRemoteWrite || confirmedStore !== STORE_SLUG || confirmedProject !== projectRef) {
    throw new Error(`Escritura bloqueada. Usa --allow-remote-write --confirm-store=${STORE_SLUG} --confirm-project=${projectRef}.`);
  }
  if (plan.conflictRows.length && !skipConflicts) {
    throw new Error("Hay conflictos pendientes. Resuélvelos o confirma expresamente --skip-conflicts.");
  }
  const result = await applyPlan(client, remote, plan);
  console.log(JSON.stringify({ ok: true, applied: result }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
