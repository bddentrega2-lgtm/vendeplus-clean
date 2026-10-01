import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const productCard = readFileSync("src/components/public/ProductCard.tsx", "utf8");
const catalogClient = readFileSync("src/components/public/CatalogClient.tsx", "utf8");
const optionsRoute = readFileSync("src/app/api/catalog/product-options/route.ts", "utf8");

assert.match(productCard, /const optionGroupsCache = new Map/);
assert.match(productCard, /cached\?\.promise/);
assert.match(productCard, /function useOptionGroupsPrefetch/);
assert.match(productCard, /new IntersectionObserver/);
assert.match(productCard, /OPTION_GROUPS_AUTOPREFETCH_LIMIT = 2/);
assert.match(productCard, /reserveOptionGroupsAutoPrefetch/);
assert.ok(
  (productCard.match(/setIsCustomizing\(true\);/g) || []).length >= 2,
  "Ambas presentaciones deben abrir el modal antes de esperar la red.",
);
assert.ok(
  (productCard.match(/onPointerDown=\{prefetchOptions\}/g) || []).length >= 2,
  "Ambas presentaciones de producto deben anticipar los extras al tocar.",
);
assert.ok(
  (productCard.match(/fetchProductOptionGroups\(storeSlug, product\.id\)/g) || []).length >= 2,
  "Las tarjetas deben compartir el mismo cargador de extras.",
);
assert.match(optionsRoute, /s-maxage=120/);
assert.match(optionsRoute, /stale-while-revalidate=600/);
assert.match(productCard, /loading=\{eagerImage \? "eager" : undefined\}/);
assert.match(productCard, /fetchPriority=\{eagerImage \? "high" : undefined\}/);
assert.match(catalogClient, /const eagerProductId = showFeatured/);
assert.ok(
  (catalogClient.match(/eagerImage=\{product\.id === eagerProductId\}/g) || []).length >= 3,
  "Cada vista del catalogo debe marcar solo el primer producto visible.",
);

console.log("catalog-options-performance: PASS");
