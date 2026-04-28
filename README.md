# Last Epoch Item JSON Generator — All Items JSON Build

This build parses the supplied JS database bundle into clean JSON files and uses them offline.

## Included JSON dumps

- `data/item_dump.json`
  - equippable base items
  - non-equippable items
  - unique and set items
  - classes
- `data/affix_dump.json`
  - all affixes
- `data/offline_db.json`
  - combined compact DB used by the site

## Counts

- 39 equippable item types
- 897 equippable base item records
- 7 non-equippable item types
- 610 non-equippable item records
- 469 unique/set records
- 1112 affix records
- 5 class records

## How to run

Unzip this folder, then run:

```bat
cd %USERPROFILE%\Downloads\last_epoch_item_generator_all_items
py -m http.server 8000
```

Open:

```text
http://localhost:8000
```

## Important note about unique/set items

The search includes unique and set items. Selecting a unique/set item will preselect its underlying base type and first subtype.

The compact generated item array still uses the rare/exalted-style format that was reverse engineered earlier:

```text
[5, seed1, seed2, baseTypeID, subTypeID, affixCount, rankMarker,
 implicit1, implicit2, implicit3, forgingPotential, affixCount,
 ...affixBlocks,
 0]
```

Unique/set save encoding may differ, so this generator treats unique/set entries as searchable metadata and base-reference helpers unless we later reverse-engineer their exact save format.


## Unique / Set item generation with Legendary Potential

This build adds an inferred Unique/Set generation path.

When you select a unique or set item from global search, the Generate button uses this structure:

```text
[5, seed1, seed2, baseTypeID, subTypeID, 7, factionByte,
 implicit1, implicit2, implicit3,
 uniqueIdHigh, uniqueIdLow,
 ...uniqueRollBytes,
 LP]
```

Observed examples used for this inference:

```text
Whetstone Gavel, uniqueId 438 -> [1,182]
Last byte 0 -> no Legendary Potential
Last byte 1 -> 1 Legendary Potential
```

For Whetstone Gavel, the DB has 4 unique roll slots, so the generated unique roll section uses 8 bytes.

Notes:

- This build generates un-imprinted unique/set items with LP.
- A post-imprint Legendary item may use an additional or different format and still needs separate testing.
- Faction/rank byte `5` showed Rank 5 in the provided example.
- Faction/rank byte `128` matched the no-rank example.


## v2 change: Set items cannot have LP

Set items now automatically force Legendary Potential to `0`.

When a Set item is selected from global search:

- the LP dropdown is disabled
- the generated final LP byte is forced to `0`
- the preview marks LP as forced to 0

Unique items still allow LP `0–4`.


## v3 correction: LP position for uniques with more than 4 roll slots

`Wall of Nothing` showed that LP is not always the final byte.

Corrected inferred unique structure:

```text
[5, seed1, seed2, baseTypeID, subTypeID, 7, factionByte,
 implicit1, implicit2, implicit3,
 uniqueIdHigh, uniqueIdLow,
 first 8 uniqueRollBytes,
 LP,
 remaining uniqueRollBytes]
```

Why:

- Whetstone Gavel has 4 unique roll slots = 8 roll bytes, so LP appears at the end.
- Wall of Nothing has 5 unique roll slots = 10 roll bytes. If LP is placed after all 10 roll bytes, the game reads a roll byte (`255` in max mode) as LP.
- Inserting LP after the first 8 roll bytes should make Wall of Nothing show LP 4 while preserving the final roll bytes.


## v4 UI changes

- Rank/faction byte is now hidden and forced to `1` for generated items.
- Forging Potential is automatically hidden for Unique and Set items.
- Raw seed and implicit byte inputs are now hidden under an advanced toggle.
- The randomise seed/implicit option remains visible because these bytes still need valid values in the compact item array.

### Seed and implicit bytes

In the compact item arrays, bytes 1–2 are currently treated as item seed / identity bytes.
Bytes 7–9 are currently treated as base implicit roll bytes.

They are not the same thing as affix roll bytes. Affix roll mode controls only the selected prefix/suffix affix blocks.
Unique roll mode controls unique mod roll bytes after uniqueId. The seed and implicit bytes are separate low-level bytes, so the UI now keeps them automatic by default.
