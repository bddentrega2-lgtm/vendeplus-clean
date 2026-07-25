import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

function timestampForFolder(date = new Date()) {
  return date
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "_UTC");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function listFilesRecursive(storage, bucketName, prefix = "") {
  const { data, error } = await storage.from(bucketName).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) throw error;

  const files = [];
  for (const item of data || []) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    const isFolder = item.id === null || item.metadata === null;

    if (isFolder) {
      files.push(...(await listFilesRecursive(storage, bucketName, fullPath)));
    } else {
      files.push({
        path: fullPath,
        size: Number(item.metadata?.size || 0),
        mimetype: item.metadata?.mimetype || null,
        updated_at: item.updated_at || item.created_at || null,
      });
    }
  }

  return files;
}

async function downloadFile(storage, bucketName, file, destinationRoot) {
  const destinationPath = path.join(destinationRoot, bucketName, ...file.path.split("/"));

  if (fs.existsSync(destinationPath)) {
    const existing = fs.readFileSync(destinationPath);
    if (!file.size || existing.length === file.size) {
      return {
        ...file,
        bucket: bucketName,
        local_path: destinationPath,
        downloaded_bytes: existing.length,
        sha256: sha256(existing),
        reused: true,
      };
    }
  }

  const { data, error } = await storage.from(bucketName).download(file.path);
  if (error) throw error;

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const tempPath = `${destinationPath}.tmp`;
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.writeFileSync(tempPath, buffer);
  fs.renameSync(tempPath, destinationPath);

  return {
    ...file,
    bucket: bucketName,
    local_path: destinationPath,
    downloaded_bytes: buffer.length,
    sha256: sha256(buffer),
    reused: false,
  };
}

async function main() {
  readEnvFile(path.resolve(".env.local"));
  readEnvFile(path.resolve(".env"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }

  const backupRoot =
    process.argv[2] ||
    path.resolve(process.env.USERPROFILE || process.cwd(), "Desktop", "vendeplus-backups", "storage", timestampForFolder());

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) throw bucketsError;

  fs.mkdirSync(backupRoot, { recursive: true });

  const manifest = {
    created_at: new Date().toISOString(),
    source_url_host: new URL(supabaseUrl).host,
    backup_root: backupRoot,
    buckets: [],
    files: [],
  };

  for (const bucket of buckets || []) {
    const files = await listFilesRecursive(supabase.storage, bucket.name);
    const bucketSummary = {
      name: bucket.name,
      public: Boolean(bucket.public),
      files: files.length,
      bytes: files.reduce((sum, file) => sum + file.size, 0),
    };
    manifest.buckets.push(bucketSummary);

    console.log(`Bucket ${bucket.name}: ${files.length} archivos`);
    let index = 0;
    for (const file of files) {
      index += 1;
      const downloaded = await downloadFile(supabase.storage, bucket.name, file, backupRoot);
      manifest.files.push(downloaded);
      if (index % 25 === 0 || index === files.length) {
        console.log(`  ${index}/${files.length} descargados`);
      }
    }
  }

  fs.writeFileSync(path.join(backupRoot, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("");
  console.log(`Respaldo completo: ${backupRoot}`);
  console.log(`Buckets: ${manifest.buckets.length}`);
  console.log(`Archivos: ${manifest.files.length}`);
  console.log(`Bytes: ${manifest.files.reduce((sum, file) => sum + file.downloaded_bytes, 0)}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
