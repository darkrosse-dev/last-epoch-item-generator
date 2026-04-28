#!/usr/bin/env node
/**
 * Download Last Epoch item images from TunkLab into:
 *
 *   data/item_image_manifest/items/base/
 *   data/item_image_manifest/items/unique/
 *   data/item_image_manifest/items/set/
 *
 * Usage from repository root:
 *
 *   node scripts/download-item-images.mjs
 *
 * This reads:
 *
 *   data/item_image_manifest/item_images.json
 *
 * and downloads every unique image URL into the localPath listed in the manifest.
 */

import fs from "node:fs/promises";
import path from "node:path";

const manifestPath = "data/item_image_manifest/item_images.json";
const fallbackAssetRoot = "data/item_image_manifest/items";

function normalizeKind(kind) {
  return ["base", "unique", "set"].includes(kind) ? kind : "base";
}

function destinationFor(item) {
  if (item.localPath) return item.localPath;
  if (!item.imageFile) return null;

  const kind = normalizeKind(item.kind);
  return path.join(fallbackAssetRoot, kind, item.imageFile).replaceAll("\\", "/");
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

const uniqueByLocalPath = new Map();

for (const item of manifest.items || []) {
  if (!item.imageUrl || !item.imageFile) continue;

  const localPath = destinationFor(item);
  if (!localPath) continue;

  if (!uniqueByLocalPath.has(localPath)) {
    uniqueByLocalPath.set(localPath, item.imageUrl);
  }
}

console.log(`Manifest: ${manifestPath}`);
console.log(`Images to download: ${uniqueByLocalPath.size}`);

let ok = 0;
let skipped = 0;
let failed = 0;

for (const [localPath, url] of uniqueByLocalPath.entries()) {
  try {
    await fs.mkdir(path.dirname(localPath), { recursive: true });

    try {
      await fs.access(localPath);
      skipped++;
      continue;
    } catch {
      // File does not exist; download it.
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    await fs.writeFile(localPath, Buffer.from(arrayBuffer));
    ok++;

    if ((ok + skipped + failed) % 50 === 0) {
      console.log(`Downloaded ${ok}, skipped ${skipped}, failed ${failed}`);
    }
  } catch (err) {
    failed++;
    console.error(`Failed: ${url} -> ${localPath}: ${err.message}`);
  }
}

console.log(`Done. Downloaded ${ok}, skipped ${skipped}, failed ${failed}.`);
