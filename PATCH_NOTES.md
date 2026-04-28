# Upload these files to GitHub

Upload these two new files to the repository root:

- `weaver-guard.js`
- `item-type-filter.js`

Then update `index.html` so the scripts at the bottom are:

```html
<script src="./app.js?v=all-items-json-1"></script>
<script src="./weaver-guard.js?v=1"></script>
<script src="./item-type-filter.js?v=1"></script>
```

Do not remove existing files:

- `app.js`
- `styles.css`
- `data/offline_db.json`
- `data/item_dump.json`
- `data/affix_dump.json`

## What changed

### Weaver's Will guard

Blocks generation for Weaver's Will uniques and disables LP when:

```js
legendaryType === 1 || effectiveLevelForLegendaryPotential === -1
```

### Hidden item types

Hides these base types from item type dropdown and global search:

```text
Blessing [baseTypeID 34]
Eos Lens [baseTypeID 38]
Dysis Lens [baseTypeID 39]
Mesembria Lens [baseTypeID 37]
Arctus Lens [baseTypeID 36]
Greater Lens [baseTypeID 35]
```
