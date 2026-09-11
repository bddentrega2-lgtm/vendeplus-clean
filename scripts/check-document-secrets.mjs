import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

// Bulk mechanical redaction. Never print matched values, snippets, or patches.
// This removes local copies only: rotation and history cleanup are separate.
const root = resolve(process.argv.find((arg) => arg.startsWith("--root="))?.slice(7) || ".");
const redact = process.argv.includes("--redact");
const list = spawnSync("rg", ["--files", "--hidden", "-g", "*.md", "-g", "!.git",
  "-g", "!node_modules", "-g", "!.node_modules-shared-link", "-g", "!desktop", "-g", "!.next"], {
  cwd: root, encoding: "utf8",
});
if (list.status !== 0) throw new Error("No se pudo enumerar documentos.");
let total = 0;
for (const name of list.stdout.split(/\r?\n/).filter(Boolean)) {
  const path = resolve(root, name);
  const original = readFileSync(path, "utf8");
  let changes = 0;
  const updated = original.split("\n").map((line, index) => {
    // Literal quoted credentials, not names of environment variables or code paths.
    if (!/contrase(?:ña|na)|password|credencial|clave|acceso|login/i.test(line)) return line;
    return line.replace(/`([^`\r\n]+)`/g, (whole, value) => {
      const candidate = value.trim();
      const obviousTechnical = /[\/\\\s]|^(?:dpl_|https?:|[A-Z][A-Z0-9_]+$)|\.(?:ts|tsx|md|mjs|cjs|json|sql)$/.test(candidate);
      const documentedPassword = /contrase(?:ña|na)|password|clave/i.test(line);
      const knownIdentifier = /^(?:entrega2|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})$/i.test(candidate);
      const passwordLike = candidate.length >= 8 && (documentedPassword || /[A-Z]/.test(candidate))
        && /[a-z]/.test(candidate) && /[0-9]/.test(candidate) && !candidate.includes("@") && !knownIdentifier;
      if (obviousTechnical || !passwordLike || candidate.startsWith("[RETIRADO")) return whole;
      changes++; total++;
      console.log(JSON.stringify({ file: name, line: index + 1, action: redact ? "redacted" : "suspected_credential" }));
      return "`[RETIRADO: rotación pendiente]`";
    });
  }).join("\n");
  if (redact && changes) writeFileSync(path, updated, "utf8");
}
console.log(JSON.stringify({ filesRoot: root, findings: total, mode: redact ? "redact" : "check" }));
if (total && !redact) process.exitCode = 1;
