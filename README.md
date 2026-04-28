# Last Epoch Offline Item Generator

A local/static web tool for generating compact Last Epoch item `data` arrays for offline save editing.

The generator is built around parsed item and affix DB data and supports:

- normal base items with prefix/suffix affixes;
- Unique and Set item lookup;
- Legendary Potential selection for supported Unique items;
- class-restricted affix filtering;
- hidden unsupported item categories that should not be manually generated.

> **Use this only in offline mode. Back up your save files before editing anything.**

Please note that Weaver's Will item creation is not available (detection and safe blocking until its save format is fully decoded)
---

## HOW TO USE

### 1. Force offline mode for the game

Start Last Epoch in **offline mode**.

This workflow is meant for offline saves only.

---

### 2. Clear your default stash tab

Go to your stash and clear out your **default / starting tab**.

We will use the core file for this tab to insert generated items.

---

### 3. Exit to the login screen

You can stay inside the game client, but exit to the **login screen** before editing the save file.

This helps ensure the stash file is not actively being rewritten while you edit it.

---

### 4. Open your save folder

Navigate to:

```text
%localappdata%low\Eleventh Hour Games\Last Epoch\Saves
```

---

### 5. Open the default stash tab file

Find this file:

```text
STASH_0_TAB_0
```

Open it with any text editor, for example:

- Notepad
- Notepad++
- VS Code

---

### 6. Find the `savedItems` item data

Look for a section similar to this:

```json
"savedItems":[{"itemData":null,"data":[5,51,50,22,41,7,1,210,131,99,1,43,97,77,178,175,0],"inventoryPosition":{"x":0,"y":15},"quantity":1,"formatVersion":2}]
```

This is dummy data. Do **not** copy this exact item data unless you specifically want to test with it.

Example of what it looks like in the stash file:

<img width="1311" height="96" alt="stash-saved-items-example" src="https://github.com/user-attachments/assets/d8ef0135-374f-4986-8487-7676a076bc24" />


---

### 7. Replace only the numbers inside `data:[ ... ]`

Generate an item on the site, then copy the generated value.

Replace only the numbers between the square brackets:

```json
"data":[PASTE_GENERATED_NUMBERS_HERE]
```

For example, replace this:

```json
"data":[5,51,50,22,41,7,1,210,131,99,1,43,97,77,178,175,0]
```

with the generated array from the site.

Do **not** remove the surrounding JSON fields unless you know what you are doing.

Keep:

```json
"itemData":null
"inventoryPosition":{"x":0,"y":15}
"quantity":1
"formatVersion":2
```

---

### 8. Save the file

Save `STASH_0_TAB_0`.

---

### 9. Log back into your character

Return to your character and open the default stash tab again.

The generated item should appear there.

---

## Bulletproof replacement method

Sometimes an item may not appear because of:

- stash position conflicts;
- item size conflicts;
- a rare bad random seed or implicit byte result;
- replacing a small item with a larger item;
- replacing an item with a very different base category.

The safest workflow is:

1. Put any item of the **same kind** into the default stash tab.
   - Example: if you want to generate a mace, place a mace in the tab first.
2. Exit to the login screen.
3. Open `STASH_0_TAB_0`.
4. Find that item's `"data":[ ... ]` section.
5. Replace only the numbers inside the brackets with the generated value.
6. Keep the existing `inventoryPosition`.

This helps prevent inventory grid size conflicts because the placeholder item already occupies a valid position for that item type.

Different items have different grid sizes, so replacing one item type with another can create conflicts.

---

## What the generated array represents

The generator produces compact Last Epoch item arrays such as:

```json
[5,18,166,1,6,7,1,201,131,198,1,98,255,255,255,255,255,255,255,255,4,255,255]
```

The exact meaning depends on item type, but the current model is:

### Normal rare/exalted-style items

```text
[5, seed1, seed2, baseTypeID, subTypeID, affixCount, rankByte,
 implicit1, implicit2, implicit3,
 forgingPotential, affixCount,
 ...affixBlocks,
 0]
```

Each affix block is 3 bytes:

```text
[encodedTierAndAffixHighBits, affixLowByte, rollByte]
```

Affix encoding:

```js
byte0 = ((tier - 1) << 4) | (affixId >> 8)
byte1 = affixId & 255
byte2 = rollByte
```

### Unique / Set items

Unique and Set items use a different compact format:

```text
[5, seed1, seed2, baseTypeID, subTypeID, 7, rankByte,
 implicit1, implicit2, implicit3,
 uniqueIdHigh, uniqueIdLow,
 ...uniqueRollBytes,
 LP-or-extra-data]
```

Normal Unique items can use Legendary Potential values:

```text
0, 1, 2, 3, 4
```

Set items cannot have Legendary Potential, so LP is forced to `0`.

### Weaver's Will items

Weaver's Will items are detected by DB properties such as:

```js
legendaryType === 1
```

or:

```js
effectiveLevelForLegendaryPotential === -1
```

These items **cannot have Legendary Potential**.

They gain random affixes while gaining experience, and their save-byte layout is not fully decoded yet. Because of that, the tool currently blocks generation for Weaver's Will items to avoid corrupting item data.

---

## Current feature set

### Item search

The site can search across:

- base items;
- Unique items;
- Set items;
- supported equippable item records.

Selecting a Unique or Set item automatically preselects its underlying base type and subtype.

### Affix filtering

Affix dropdowns are filtered by:

- selected item base type;
- prefix/suffix slot;
- class restrictions where applicable.

This prevents obvious invalid combinations, such as selecting Mage-only affixes on Sentinel-only items.

### Hidden item types

The following base types are hidden from selectable item types and global search because they are not useful/safe for current item generation:

```text
Blessing [baseTypeID 34]
Eos Lens [baseTypeID 38]
Dysis Lens [baseTypeID 39]
Mesembria Lens [baseTypeID 37]
Arctus Lens [baseTypeID 36]
Greater Lens [baseTypeID 35]
```

### Rank byte

The rank/faction byte is currently hidden and forced to:

```text
1
```

This keeps generated items consistent and avoids exposing a confusing low-level field.

### Seed and implicit bytes

The site can randomize seed and implicit bytes.

These bytes are separate from affix rolls:

```text
seed1, seed2
implicit1, implicit2, implicit3
```

They appear to affect internal item seed/identity and base implicit rolls. They are hidden behind advanced options because normal users usually do not need to edit them manually.

---

## Changelog

### Latest

- Added a guard for Weaver's Will items.
- Weaver's Will items now have LP disabled.
- Weaver's Will generation is blocked until the save layout is decoded.
- Added item type filtering for unsupported lens/blessing categories.
- Hid selected item categories from both item type dropdown and global search.
- Forced generated item rank byte to `1`.
- Hid the raw rank selector from the UI.
- Hid Forging Potential when a Unique or Set item is selected.
- Moved raw seed and implicit byte controls into advanced options.

### Unique item improvements

- Added Unique and Set item lookup.
- Added Legendary Potential selector for normal Unique items.
- Forced LP to `0` for Set items.
- Added unique roll byte generation.
- Adjusted LP byte positioning for Unique items with more than four unique roll slots.

### Affix generation improvements

- Added valid prefix/suffix dropdowns.
- Added tier selection.
- Added max/random roll modes.
- Added class-restriction filtering.
- Confirmed affix encoding format:

```js
byte0 = ((tier - 1) << 4) | (affixId >> 8)
byte1 = affixId & 255
byte2 = rollByte
```

### Data improvements

- Parsed the game DB bundle into formatted JSON files.
- Added item data in JSON format.
- Added affix data in JSON format.
- Added combined offline DB JSON.
- Added searchable base, Unique, and Set item lists.

---

## Known limitations

- Weaver's Will save layout is not fully decoded yet.
- Imprinted Legendary item format may differ from simple Unique + LP format.
- Some random seed/implicit combinations may produce undesirable or invalid results.
- Inventory position and item size conflicts can prevent an item from appearing.
- Always back up your save files before editing.

---

## Recommended testing workflow

Use the default stash tab as a controlled test area.

For best results:

1. Keep only one placeholder item in the tab.
2. Use a placeholder item of the same broad type.
3. Replace only the `data:[ ... ]` numbers.
4. Keep the existing `inventoryPosition`.
5. Log back in and check the tab.
6. If the item does not appear, try generating again with new randomized seed/implicit bytes.

---

## File structure

Typical hosted/static structure:

```text
index.html
app.js
styles.css
weaver-guard.js
item-type-filter.js
data/
  offline_db.json
  item_dump.json
  affix_dump.json
```

The site can be hosted on GitHub Pages, Netlify, Vercel, or any static hosting service.
