import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function add(status, label, detail = "") {
  results.push({ status, label, detail });
}

function readJson(file) {
  return JSON.parse(readFileSync(path.join(root, file), "utf8"));
}

function readEnvFile(file) {
  const fullPath = path.join(root, file);
  if (!existsSync(fullPath)) return {};

  return Object.fromEntries(
    readFileSync(fullPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
        return [key, value];
      })
  );
}

const localEnv = readEnvFile(".env.local");
const mergedEnv = { ...localEnv, ...process.env };

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FOUNDER_EMAILS",
];
const missingEnv = requiredEnv.filter((key) => !String(mergedEnv[key] || "").trim());

if (missingEnv.length) {
  add("FAIL", "Variables obligatorias", `Faltan: ${missingEnv.join(", ")}`);
} else {
  add("PASS", "Variables obligatorias", "Supabase y founder configurados.");
}

if (String(mergedEnv.NEXT_PUBLIC_ALLOW_DEMO_FALLBACKS || "").toLowerCase() === "true") {
  add("FAIL", "Fallbacks demo", "NEXT_PUBLIC_ALLOW_DEMO_FALLBACKS no debe ser true en produccion.");
} else {
  add("PASS", "Fallbacks demo", "No estan habilitados por env.");
}

const entrega2Keys = [
  "ENTREGA2_API_BASE_URL",
  "ENTREGA2_API_KEY",
  "ENTREGA2_WEBHOOK_SECRET",
];
const entrega2Set = entrega2Keys.filter((key) => String(mergedEnv[key] || "").trim());

if (entrega2Set.length > 0 && entrega2Set.length < entrega2Keys.length) {
  add("WARN", "Entrega2", `Configuracion incompleta: ${entrega2Keys.filter((key) => !entrega2Set.includes(key)).join(", ")}`);
} else if (entrega2Set.length === entrega2Keys.length) {
  add("PASS", "Entrega2", "Variables completas.");
} else {
  add("WARN", "Entrega2", "Sin variables; mantenlo apagado hasta probar staging.");
}

if (!String(mergedEnv.OPENAI_API_KEY || "").trim()) {
  add("WARN", "Pedido asistido", "OPENAI_API_KEY no esta configurado; se usara interpretacion local.");
} else {
  const model = String(mergedEnv.OPENAI_ORDER_MODEL || "gpt-5.4-mini").trim();
  add("PASS", "Pedido asistido", `OPENAI_API_KEY configurada. Modelo: ${model}.`);
}

const packageJson = readJson("package.json");
const allDependencies = {
  ...(packageJson.dependencies || {}),
  ...(packageJson.devDependencies || {}),
};
const floatingDependencies = Object.entries(allDependencies)
  .filter(([, version]) => /^(latest|\*|\^|~|>|<)/.test(String(version)))
  .map(([name, version]) => `${name}@${version}`);

if (floatingDependencies.length) {
  add("FAIL", "Dependencias fijadas", floatingDependencies.join(", "));
} else {
  add("PASS", "Dependencias fijadas", "No hay latest ni rangos flotantes.");
}

const migrationsDir = path.join(root, "supabase", "migrations");
const migrations = existsSync(migrationsDir) ? readdirSync(migrationsDir) : [];
const requiredMigrations = [
  "20260621090000_production_hardening.sql",
  "20260623133000_restore_delivery_settings_compatibility.sql",
  "20260623143000_admin_subscription_controls.sql",
];
const missingMigrations = requiredMigrations.filter((file) => !migrations.includes(file));

if (missingMigrations.length) {
  add("FAIL", "Migraciones criticas", `Faltan archivos: ${missingMigrations.join(", ")}`);
} else {
  add("PASS", "Migraciones criticas", "Archivos presentes. Falta confirmar que esten aplicados en Supabase.");
}

const searchableFiles = [
  "src",
  "supabase",
  "README.md",
  "PRODUCTION_CHECKLIST.md",
  "AGENTS.md",
].filter((entry) => existsSync(path.join(root, entry)));
const mojibakePattern = /[ÃÂ�]/;
const mojibakeHits = [];

function scanPath(relativePath) {
  const fullPath = path.join(root, relativePath);
  const stat = existsSync(fullPath) ? readdirOrNull(fullPath) : null;

  if (stat === null) {
    const content = readFileSync(fullPath, "utf8");
    if (mojibakePattern.test(content)) mojibakeHits.push(relativePath);
    return;
  }

  for (const child of stat) {
    scanPath(path.join(relativePath, child));
  }
}

function readdirOrNull(fullPath) {
  try {
    return readdirSync(fullPath);
  } catch {
    return null;
  }
}

for (const entry of searchableFiles) scanPath(entry);

if (mojibakeHits.length) {
  add("FAIL", "Textos mojibake", mojibakeHits.slice(0, 20).join(", "));
} else {
  add("PASS", "Textos mojibake", "No se detectaron caracteres rotos obvios.");
}

const hasFailure = results.some((result) => result.status === "FAIL");

for (const result of results) {
  console.log(`[${result.status}] ${result.label}${result.detail ? ` - ${result.detail}` : ""}`);
}

console.log("");
console.log(
  hasFailure
    ? "Resultado: NO listo para produccion. Corrige los FAIL antes de deploy."
    : "Resultado: gates locales OK. Ejecuta npm.cmd run lint, npm.cmd run build y QA end-to-end."
);

process.exit(hasFailure ? 1 : 0);
