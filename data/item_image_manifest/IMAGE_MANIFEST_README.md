# Last Epoch Item Image Manifest

This package contains parsed image metadata for Last Epoch items from the TunkLab item DB data.

## Files

```text
data/item_images.json
data/item_images.csv
scripts/download-item-images.mjs
assets/items/base/.gitkeep
assets/items/unique/.gitkeep
assets/items/set/.gitkeep
```

## Manifest counts

```text
Total item records: 1976
Base item records: 1507
Equippable base item records: 897
Non-equippable base item records: 610
Unique item records: 410
Set item records: 59
Records with image filename: 1469
Unique image files: 1318
Records missing image filename: 507
```

The missing image records are mostly non-equippable/utility records where the parsed DB did not expose a direct item image filename.

## How image URLs are built

TunkLab item pages use image URLs like:

```text
https://lastepoch.tunklab.com/img/item/wall_of_nothing.png
```

The manifest stores both:

```json
{
  "imageFile": "wall_of_nothing.png",
  "imageUrl": "https://lastepoch.tunklab.com/img/item/wall_of_nothing.png",
  "localPath": "assets/items/unique/wall_of_nothing.png"
}
```

## How to download images locally

After uploading this package to the repo root, run:

```bash
node scripts/download-item-images.mjs
```

This downloads the images into:

```text
assets/items/base/
assets/items/unique/
assets/items/set/
```

Then commit the downloaded assets if you want GitHub Pages to serve images locally.

## Later site wiring idea

The UI can load:

```js
const imageManifest = await fetch("./data/item_images.json").then(r => r.json());
```

Then look up images by:

```text
base:<baseTypeID>:<subTypeID>
unique:<uniqueId>
```

Examples:

```js
imageManifest.lookup["base:1:6"]
imageManifest.lookup["unique:354"]
```

This will return the matching image filename, remote URL, and local path.
