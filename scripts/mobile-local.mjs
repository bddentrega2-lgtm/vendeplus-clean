// Local-only runner. Credentials stay in the child process and are never printed or copied.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";

const mode = process.argv[2] || "dev";
if (!["dev", "build", "start"].includes(mode)) throw new Error("Use dev, build or start");
const env = { ...process.env };
for (const file of [resolve("../.env.local"), resolve(".env.local")]) {
  if (existsSync(file)) Object.assign(env, parseEnv(readFileSync(file, "utf8")));
}
const args = mode === "build" ? ["run", "build"] : ["run", mode, "--", "--hostname", "127.0.0.1", "--port", "3107"];
const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", args, { env, stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 1));
