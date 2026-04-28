#!/usr/bin/env node
/**
 * Download Last Epoch item images from TunkLab into assets/items.
 *
 * Usage:
 *   node scripts/download-item-images.mjs
 *
 * This reads data/item_images.json and downloads all unique image URLs into
 * the localPath listed in the manifest.
 */

import fs from "node:fs/promises";
import path from "node:path";

const manifestPath = "data/item_images.json";
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

const uniqueByLocalPath = new Map();

for (const item of manifest.items || []) {
  if (!item.imageUrl || !item.localPath) continue;
  if (!uniqueByLocalPath.has(item.localPath)) {
    uniqueByLocalPath.set(item.localPath, item.imageUrl);
  }
}

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
      // file does not exist; download it
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    await fs.writeFile(localPath, Buffer.from(arrayBuffer));
    ok++;

    if ((ok + failed) % 50 === 0) {
      console.log(`Downloaded ${ok}, skipped ${skipped}, failed ${failed}`);
    }
  } catch (err) {
    failed++;
    console.error(`Failed: ${url} -> ${localPath}: ${err.message}`);
  }
}

console.log(`Done. Downloaded ${ok}, skipped ${skipped}, failed ${failed}.`);
