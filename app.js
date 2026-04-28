// Last Epoch Item JSON Generator — all-items offline app.js
// Loads JSON dumps generated from the JS DB bundle:
//   ./data/offline_db.json
//   ./data/item_dump.json
//   ./data/affix_dump.json

const state = {
    db: null,
    itemTypes: [],
    nonEquippableItemTypes: [],
    uniqueItems: [],
    affixes: [],
    classes: [],
    allItems: [],
    selectedSpecialItem: null
};

const ids = [
    "itemTypeSelect", "itemSelect", "itemInfo", "loadStatus",
    "prefix1", "prefix1Tier", "prefix1RollMode",
    "prefix2", "prefix2Tier", "prefix2RollMode",
    "suffix1", "suffix1Tier", "suffix1RollMode",
    "suffix2", "suffix2Tier", "suffix2RollMode",
    "rankMarker", "forgingPotential", "randomiseHeader",
    "seed1", "seed2", "imp1", "imp2", "imp3",
    "generateBtn", "output", "preview", "copyBtn", "downloadBtn",
    "enforceClass", "hideCannotDrop", "itemSearch",
    "globalItemSearch", "globalItemResults", "selectGlobalItemBtn", "clearGlobalSearchBtn",
    "uniqueLp", "uniqueRollMode", "uniqueModeNotice",
    "rankMarkerWrap", "forgingPotentialWrap", "advancedBytesToggle", "advancedBytesPanel"
];

const el = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));

const CLASS_NAMES = {
    1: "Primalist",
    2: "Mage",
    4: "Sentinel",
    8: "Acolyte",
    16: "Rogue"
};

function hasEl(name) {
    return Boolean(el[name]);
}

function getChecked(name, fallback = false) {
    return hasEl(name) ? Boolean(el[name].checked) : fallback;
}

function getValue(name, fallback = "") {
    return hasEl(name) ? el[name].value : fallback;
}

function setValue(name, value) {
    if (hasEl(name)) el[name].value = value;
}

function byteClamp(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(255, Math.trunc(n))) : 0;
}

function randomByte() {
    return Math.floor(Math.random() * 256);
}

function encodeAffixBlock(affixId, tier, rollByte) {
    const tierIndex = tier - 1;
    return [((tierIndex << 4) | (affixId >> 8)), affixId & 255, byteClamp(rollByte)];
}

async function loadJson(path) {
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`);
    return r.json();
}

async function loadDb() {
    const db = await loadJson("./data/offline_db.json");

    state.db = db;
    state.itemTypes = db.itemTypes || [];
    state.nonEquippableItemTypes = db.nonEquippableItemTypes || [];
    state.uniqueItems = db.uniqueItems || [];
    state.affixes = db.affixes || [];
    state.classes = db.classes || [];

    if (!state.itemTypes.length) throw new Error("offline_db.json loaded, but itemTypes is empty.");
    if (!state.affixes.length) throw new Error("offline_db.json loaded, but affixes is empty.");

    state.allItems = buildAllItemsIndex();

    const meta = db.metadata || {};
    el.loadStatus.textContent =
        `Loaded ${state.itemTypes.length} item types / ${meta.equippableSubItemCount || "?"} base items / ` +
        `${state.uniqueItems.length} unique+set items / ${state.affixes.length} affixes`;
    el.loadStatus.classList.add("ok");

    populateItemTypes();
    populateGlobalItemResults("");
    updateUniqueControls();
}

function buildAllItemsIndex() {
    const rows = [];

    for (const type of state.itemTypes) {
        for (const item of (type.subItems || [])) {
            rows.push({
                kind: "base",
                baseTypeID: type.baseTypeID,
                baseTypeName: type.baseTypeName || type.displayName || "",
                baseDisplayName: type.displayName || type.baseTypeName || "",
                subTypeID: item.subTypeID,
                item
            });
        }
    }

    for (const type of state.nonEquippableItemTypes) {
        for (const item of (type.subItems || [])) {
            rows.push({
                kind: "nonEquippable",
                baseTypeID: type.baseTypeID,
                baseTypeName: type.baseTypeName || type.displayName || "",
                baseDisplayName: type.displayName || type.baseTypeName || "",
                subTypeID: item.subTypeID,
                item
            });
        }
    }

    for (const u of state.uniqueItems) {
        const firstSubtype = Array.isArray(u.subTypeIDs) && u.subTypeIDs.length ? u.subTypeIDs[0] : null;
        rows.push({
            kind: u.isSetItem ? "set" : "unique",
            baseTypeID: u.baseTypeID ?? u.baseType,
            baseTypeName: u.baseTypeName || "",
            baseDisplayName: u.baseTypeName || "",
            subTypeID: firstSubtype,
            item: u
        });
    }

    return rows;
}

function option(value, label) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    return opt;
}

function optionWithDataset(value, label, dataset = {}) {
    const opt = option(value, label);
    for (const [key, val] of Object.entries(dataset)) opt.dataset[key] = String(val);
    return opt;
}

function clear(s) {
    if (s) s.innerHTML = "";
}

function itemClassLabel(item) {
    return item.classRequirement ? CLASS_NAMES[item.classRequirement] || `Class ${item.classRequirement}` : "Generic";
}

function itemDisplayName(item) {
    return item.effectiveDisplayName || item.displayName || item.name || item.slug || `Item ${item.subTypeID ?? item.uniqueId ?? ""}`;
}

function itemSearchBlob(row) {
    const item = row.item || {};
    return [
        row.kind,
        row.baseTypeID,
        row.subTypeID,
        row.baseTypeName,
        row.baseDisplayName,
        itemDisplayName(item),
        item.displayName,
        item.name,
        item.slug,
        item.uniqueId,
        item.setId,
        item.itemKind,
        item.rarity,
        item.classRequirement,
        itemClassLabel(item)
    ].map(v => String(v ?? "").toLowerCase()).join(" ");
}

function globalItemLabel(row) {
    const item = row.item;
    const kind = row.kind === "base" ? "Base" : row.kind === "nonEquippable" ? "Non-equip" : row.kind === "set" ? "Set" : "Unique";
    const idText = row.kind === "unique" || row.kind === "set"
        ? `uniqueId ${item.uniqueId}`
        : `subTypeID ${row.subTypeID}`;
    const classText = item.classRequirement ? ` — ${itemClassLabel(item)}` : "";
    const noDrop = item.cannotDrop ? " — cannotDrop" : "";
    return `${kind}: ${itemDisplayName(item)} [${row.baseDisplayName || row.baseTypeName} ${row.baseTypeID}/${idText}]${classText}${noDrop}`;
}

function populateGlobalItemResults(query) {
    if (!hasEl("globalItemResults")) return;

    const q = String(query || "").trim().toLowerCase();
    clear(el.globalItemResults);

    const rows = state.allItems
        .filter(row => !q || itemSearchBlob(row).includes(q))
        .sort((a, b) => globalItemLabel(a).localeCompare(globalItemLabel(b)))
        .slice(0, 350);

    if (!rows.length) {
        el.globalItemResults.appendChild(option("", "No matching items"));
        return;
    }

    rows.forEach((row, index) => {
        const value = `${row.kind}:${row.baseTypeID}:${row.subTypeID ?? ""}:${row.item.uniqueId ?? ""}:${index}`;
        el.globalItemResults.appendChild(optionWithDataset(
            value,
            globalItemLabel(row),
            {
                kind: row.kind,
                baseTypeID: row.baseTypeID,
                subTypeID: row.subTypeID ?? "",
                uniqueId: row.item.uniqueId ?? ""
            }
        ));
    });
}

function findUniqueById(uniqueId) {
    return state.uniqueItems.find(u => Number(u.uniqueId) === Number(uniqueId));
}

function findEquippableType(baseTypeID) {
    return state.itemTypes.find(t => Number(t.baseTypeID) === Number(baseTypeID));
}

function selectGlobalItem() {
    if (!hasEl("globalItemResults")) return;

    const selected = el.globalItemResults.selectedOptions[0];
    if (!selected || !selected.dataset.kind) return;

    const kind = selected.dataset.kind;
    const baseTypeID = Number(selected.dataset.baseTypeID);
    let subTypeID = selected.dataset.subTypeID === "" ? null : Number(selected.dataset.subTypeID);

    state.selectedSpecialItem = null;

    if (kind === "unique" || kind === "set") {
        const unique = findUniqueById(selected.dataset.uniqueId);
        if (unique) {
            state.selectedSpecialItem = unique;
            if (subTypeID === null && Array.isArray(unique.subTypeIDs) && unique.subTypeIDs.length) {
                subTypeID = unique.subTypeIDs[0];
            }
        }
    }

    const type = findEquippableType(baseTypeID);
    if (!type) {
        alert("This result is non-equippable, so it cannot be used for compact generated item data yet.");
        updateItemInfo();
        return;
    }

    setValue("itemSearch", "");
    setValue("itemTypeSelect", baseTypeID);

    populateItems();

    if (subTypeID !== null && Number.isFinite(subTypeID)) {
        setValue("itemSelect", subTypeID);

        if (Number(getValue("itemSelect")) !== subTypeID || !getSelectedItem()) {
            if (hasEl("hideCannotDrop")) el.hideCannotDrop.checked = false;
            populateItems();
            setValue("itemSelect", subTypeID);
        }
    }

    updateUniqueControls();
    updateItemInfo();
    populateAffixes();
}

function clearGlobalSearch() {
    setValue("globalItemSearch", "");
    state.selectedSpecialItem = null;
    populateGlobalItemResults("");
    updateUniqueControls();
    updateItemInfo();
}

function populateItemTypes() {
    clear(el.itemTypeSelect);

    state.itemTypes
        .slice()
        .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)))
        .forEach(t => {
            el.itemTypeSelect.appendChild(option(t.baseTypeID, `${t.displayName} [baseTypeID ${t.baseTypeID}]`));
        });

    populateItems();
}

function getSelectedItemType() {
    return state.itemTypes.find(t => t.baseTypeID === Number(getValue("itemTypeSelect")));
}

function getSelectedItem() {
    const t = getSelectedItemType();
    if (!t) return null;
    return (t.subItems || []).find(i => i.subTypeID === Number(getValue("itemSelect")));
}

function populateItems() {
    const t = getSelectedItemType();
    clear(el.itemSelect);

    if (!t) return;

    const q = getValue("itemSearch", "").trim().toLowerCase();
    const hideCannotDrop = getChecked("hideCannotDrop", false);

    (t.subItems || [])
        .slice()
        .filter(i => !hideCannotDrop || !i.cannotDrop)
        .filter(i =>
            !q ||
            String(i.displayName || "").toLowerCase().includes(q) ||
            String(i.name || "").toLowerCase().includes(q) ||
            String(i.slug || "").toLowerCase().includes(q) ||
            String(i.subTypeID || "").toLowerCase().includes(q)
        )
        .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)))
        .forEach(i => {
            el.itemSelect.appendChild(option(
                i.subTypeID,
                `${i.displayName || i.name || i.slug} [subTypeID ${i.subTypeID}]` +
                `${i.classRequirement ? ` — ${CLASS_NAMES[i.classRequirement] || "Class " + i.classRequirement}` : ""}` +
                `${i.cannotDrop ? " — cannotDrop" : ""}`
            ));
        });

    updateItemInfo();
    populateAffixes();
}

function formatImplicit(imp) {
    return `property ${imp.property}, tags ${imp.tags}, type ${imp.type}: ${imp.implicitValue} → ${imp.implicitMaxValue}`;
}

function safeJson(value) {
    try { return JSON.stringify(value); } catch { return String(value); }
}

function summarizeUnique(u) {
    if (!u) return "";
    const lines = [
        "",
        "Selected unique/set metadata:",
        `Kind: ${u.isSetItem ? "Set" : "Unique"}`,
        `Name: ${itemDisplayName(u)} / uniqueId ${u.uniqueId}`,
        `Base: ${u.baseTypeName || u.baseTypeID || u.baseType} / subTypes: ${(u.subTypeIDs || u.subTypes || []).join(", ")}`,
        `Level requirement: ${u.levelRequirement}`,
        `Can drop randomly: ${u.canDropRandomly}`,
        `Can drop as legendary: ${u.canDropAsLegendary}`,
        `Effective LP level: ${u.effectiveLevelForLegendaryPotential}`,
        `Mods: ${(u.mods || []).length}`,
        `Description entries: ${(u.tooltipDescriptions || []).length}`,
        `Slug: ${u.slug || ""}`
    ];
    return lines.join("\\n");
}

function updateItemInfo() {
    const t = getSelectedItemType();
    const i = getSelectedItem();

    if (!t || !i) {
        el.itemInfo.textContent = "No item selected." + summarizeUnique(state.selectedSpecialItem);
        return;
    }

    const cls = i.classRequirement
        ? `${CLASS_NAMES[i.classRequirement] || "Class " + i.classRequirement} only`
        : "none / generic";

    const imps = (i.implicits || []).map(formatImplicit).join("\\n  ");

    const extraLines = [];
    for (const key of ["name", "slug", "cannotDrop", "itemTags"]) {
        if (i[key] !== undefined) extraLines.push(`${key}: ${safeJson(i[key])}`);
    }

    el.itemInfo.textContent =
`Base type: ${t.displayName} / baseTypeID ${t.baseTypeID}
Item: ${i.displayName} / subTypeID ${i.subTypeID}
Class requirement: ${cls}
Level requirement: ${i.levelRequirement}
Max affixes: ${t.maximumAffixes}
Item affixEffectModifier: ${t.affixEffectModifier}
Attack rate: ${i.attackRate}
Added weapon range: ${i.addedWeaponRange}
${extraLines.join("\\n")}
Implicits:
  ${imps || "none"}${summarizeUnique(state.selectedSpecialItem)}`;
}

function affixLabel(a) {
    const title = a.affixTitle ? ` — ${a.affixTitle}` : "";
    const kind = a.type === 0 ? "Prefix" : a.type === 1 ? "Suffix" : `Type ${a.type}`;
    const cls = a.classSpecificity ? ` / classSpec ${a.classSpecificity}` : "";
    return `${a.affixName || a.affixDisplayName || a.slug}${title} [id ${a.affixId}, ${kind}${cls}]`;
}

function affixClassAllowed(item, affix) {
    if (!getChecked("enforceClass", true)) return true;
    if (!item || !item.classRequirement) return true;
    if (!affix.classSpecificity) return true;
    const allowedBit = item.classRequirement * 2;
    return (affix.classSpecificity & allowedBit) !== 0;
}

function validAffixes(slotType) {
    const t = getSelectedItemType();
    const item = getSelectedItem();

    if (!t) return [];

    return state.affixes
        .filter(a => a && Array.isArray(a.canRollOn))
        .filter(a => a.type === slotType)
        .filter(a => a.canRollOn.includes(t.baseTypeID))
        .filter(a => affixClassAllowed(item, a))
        .sort((a, b) => affixLabel(a).localeCompare(affixLabel(b)));
}

function getAffixById(id) {
    return state.affixes.find(a => a.affixId === id);
}

function populateAffixSelect(select, tierSelect, rollSelect, affixes) {
    const prev = select.value;

    clear(select);
    select.appendChild(option("", "— Empty —"));

    affixes.forEach(a => select.appendChild(option(a.affixId, affixLabel(a))));

    if ([...select.options].some(o => o.value === prev)) select.value = prev;

    populateTierSelect(select, tierSelect);
    populateRollSelect(rollSelect);
}

function populateTierSelect(affixSelect, tierSelect) {
    const prev = tierSelect.value;

    clear(tierSelect);

    const a = getAffixById(Number(affixSelect.value));

    if (!a) {
        tierSelect.appendChild(option("", "—"));
        tierSelect.disabled = true;
        return;
    }

    tierSelect.disabled = false;

    const n = a.tiers?.length || 0;

    for (let i = 1; i <= n; i++) {
        tierSelect.appendChild(option(i, `T${i}${i >= 6 ? " / drop-only" : ""}`));
    }

    tierSelect.value = [...tierSelect.options].some(o => o.value === prev)
        ? prev
        : String(Math.min(6, n || 1));
}

function populateRollSelect(s) {
    const p = s.value;

    clear(s);

    s.appendChild(option("random", "Random within tier"));
    s.appendChild(option("max", "Max roll byte 255"));

    s.value = p || "random";
}

function populateAffixes() {
    populateAffixSelect(el.prefix1, el.prefix1Tier, el.prefix1RollMode, validAffixes(0));
    populateAffixSelect(el.prefix2, el.prefix2Tier, el.prefix2RollMode, validAffixes(0));
    populateAffixSelect(el.suffix1, el.suffix1Tier, el.suffix1RollMode, validAffixes(1));
    populateAffixSelect(el.suffix2, el.suffix2Tier, el.suffix2RollMode, validAffixes(1));
}

function selectedAffix(slot, select, tierSelect, rollMode) {
    if (!select.value) return null;

    const affixId = Number(select.value);
    const affix = getAffixById(affixId);
    const tier = Number(tierSelect.value);
    const rollByte = rollMode.value === "max" ? 255 : randomByte();

    return {
        slot,
        affix,
        affixId,
        tier,
        rollByte,
        block: encodeAffixBlock(affixId, tier, rollByte)
    };
}

function uniqueVariableRollCount(unique) {
    const rollIds = new Set();

    for (const mod of (unique.mods || [])) {
        const rollID = Number(mod.rollID);
        if (mod.canRoll && Number.isFinite(rollID) && rollID >= 0) {
            rollIds.add(rollID);
        }
    }

    if (!rollIds.size) return 0;

    // The save format appears to allocate two bytes per roll slot.
    // Whetstone Gavel has rollIDs 0..3, therefore 4 roll slots = 8 bytes.
    return Math.max(...rollIds) + 1;
}

function buildUniqueRollBytes(unique) {
    const slotCount = uniqueVariableRollCount(unique);
    const mode = getValue("uniqueRollMode", "random");
    const bytes = [];

    for (let i = 0; i < slotCount; i++) {
        if (mode === "max") {
            bytes.push(255, 255);
        } else {
            bytes.push(randomByte(), randomByte());
        }
    }

    return bytes;
}

function uniqueAllowsLp(unique) {
    if (!unique) return false;
    if (unique.isSetItem) return false;
    if (unique.canHaveLegendaryPotential === false) return false;
    return true;
}

function updateUniqueControls() {
    const unique = state.selectedSpecialItem;

    if (!hasEl("uniqueLp")) return;

    if (!unique) {
        el.uniqueLp.disabled = false;
        if (hasEl("uniqueModeNotice")) {
            el.uniqueModeNotice.textContent = "Select a Unique or Set item from global search to activate this mode.";
        }
        updateGenerationControls();
        return;
    }

    const allowsLp = uniqueAllowsLp(unique);

    if (!allowsLp) {
        el.uniqueLp.value = "0";
        el.uniqueLp.disabled = true;
    } else {
        el.uniqueLp.disabled = false;
    }

    if (hasEl("uniqueModeNotice")) {
        el.uniqueModeNotice.textContent =
            `${unique.isSetItem ? "Set item" : "Unique item"} selected: ${itemDisplayName(unique)}\n` +
            `${allowsLp ? "Legendary Potential can be selected from 0 to 4." : "Legendary Potential is disabled and forced to 0 for this item."}`;
    }

    updateGenerationControls();
}


function isUniqueOrSetMode() {
    return Boolean(state.selectedSpecialItem && (state.selectedSpecialItem.itemKind === "unique" || state.selectedSpecialItem.itemKind === "set" || state.selectedSpecialItem.uniqueId !== undefined));
}

function updateGenerationControls() {
    // User-facing requirement: generated items should be Rank 1.
    // Keep this byte hidden, but force it in the underlying value.
    setValue("rankMarker", 1);

    if (hasEl("rankMarkerWrap")) {
        el.rankMarkerWrap.classList.add("hidden");
    }

    if (hasEl("forgingPotentialWrap")) {
        el.forgingPotentialWrap.classList.toggle("hidden", isUniqueOrSetMode());
    }

    updateAdvancedBytesControls();
}

function updateAdvancedBytesControls() {
    if (!hasEl("advancedBytesPanel")) return;
    const show = getChecked("advancedBytesToggle", false);
    el.advancedBytesPanel.classList.toggle("hidden", !show);
}


function generateUnique(t, item, unique) {
    let seed1 = byteClamp(getValue("seed1", 65));
    let seed2 = byteClamp(getValue("seed2", 94));
    let imp1 = byteClamp(getValue("imp1", 58));
    let imp2 = byteClamp(getValue("imp2", 84));
    let imp3 = byteClamp(getValue("imp3", 140));

    if (getChecked("randomiseHeader", true)) {
        seed1 = randomByte();
        seed2 = randomByte();
        imp1 = randomByte();
        imp2 = randomByte();
        imp3 = randomByte();

        setValue("seed1", seed1);
        setValue("seed2", seed2);
        setValue("imp1", imp1);
        setValue("imp2", imp2);
        setValue("imp3", imp3);
    }

    const uniqueId = Number(unique.uniqueId);
    const lp = uniqueAllowsLp(unique) ? Math.max(0, Math.min(4, byteClamp(getValue("uniqueLp", 0)))) : 0;
    const uniqueRollBytes = buildUniqueRollBytes(unique);

    // v3 correction:
    // Wall of Nothing has 5 roll slots = 10 roll bytes. If LP is placed after all
    // 10 bytes, the game reads the 9th unique-roll byte as LP and shows 255.
    // The LP byte appears to belong after the first 8 unique-roll bytes
    // (4 roll slots); any remaining unique-roll bytes continue after LP.
    const lpInsertOffset = Math.min(8, uniqueRollBytes.length);
    const rollBytesBeforeLp = uniqueRollBytes.slice(0, lpInsertOffset);
    const rollBytesAfterLp = uniqueRollBytes.slice(lpInsertOffset);

    const data = [
        5,
        seed1,
        seed2,
        byteClamp(t.baseTypeID),
        byteClamp(item.subTypeID),
        7,
        byteClamp(getValue("rankMarker", 1)),
        imp1,
        imp2,
        imp3,
        uniqueId >> 8,
        uniqueId & 255,
        ...rollBytesBeforeLp,
        lp,
        ...rollBytesAfterLp
    ];

    el.output.value = JSON.stringify(data);

    el.preview.textContent =
`UNIQUE / SET ITEM MODE
Selected: ${itemDisplayName(unique)}
Kind: ${unique.isSetItem ? "Set" : "Unique"}
uniqueId: ${uniqueId}
baseTypeID/subTypeID: ${t.baseTypeID}/${item.subTypeID}
Legendary Potential: ${lp}${uniqueAllowsLp(unique) ? "" : " (forced to 0 — set/non-LP item)"}
Unique roll slots: ${uniqueVariableRollCount(unique)}
Unique roll bytes total: ${uniqueRollBytes.length}
LP insert offset inside unique section: after ${lpInsertOffset} roll bytes
Roll bytes before LP: [${rollBytesBeforeLp.join(", ")}]
Roll bytes after LP: [${rollBytesAfterLp.join(", ")}]
Faction/rank byte: ${byteClamp(getValue("rankMarker", 1))} (fixed Rank 1)
Implicit bytes: [${imp1}, ${imp2}, ${imp3}]

Generated structure:
[5, seed1, seed2, baseTypeID, subTypeID, 7, factionByte, imp1, imp2, imp3, uniqueIdHigh, uniqueIdLow, first 8 uniqueRollBytes, LP, remaining uniqueRollBytes]

Why this changed:
- Whetstone Gavel has 4 roll slots = 8 roll bytes, so LP appears at the end.
- Wall of Nothing has 5 roll slots = 10 roll bytes. If LP is placed at the very end, the game reads the 9th roll byte as LP and displays 255.
- LP is now inserted after the first 8 unique-roll bytes; remaining roll bytes continue after it.`;
}


function generate() {
    const t = getSelectedItemType();
    const item = getSelectedItem();

    if (!t || !item) {
        alert("Select an equippable base item first.");
        return;
    }

    if (state.selectedSpecialItem && (state.selectedSpecialItem.itemKind === "unique" || state.selectedSpecialItem.itemKind === "set" || state.selectedSpecialItem.uniqueId !== undefined)) {
        generateUnique(t, item, state.selectedSpecialItem);
        return;
    }

    let seed1 = byteClamp(getValue("seed1", 65));
    let seed2 = byteClamp(getValue("seed2", 94));
    let imp1 = byteClamp(getValue("imp1", 58));
    let imp2 = byteClamp(getValue("imp2", 84));
    let imp3 = byteClamp(getValue("imp3", 140));

    if (getChecked("randomiseHeader", true)) {
        seed1 = randomByte();
        seed2 = randomByte();
        imp1 = randomByte();
        imp2 = randomByte();
        imp3 = randomByte();

        setValue("seed1", seed1);
        setValue("seed2", seed2);
        setValue("imp1", imp1);
        setValue("imp2", imp2);
        setValue("imp3", imp3);
    }

    const affixes = [
        selectedAffix("Prefix 1", el.prefix1, el.prefix1Tier, el.prefix1RollMode),
        selectedAffix("Prefix 2", el.prefix2, el.prefix2Tier, el.prefix2RollMode),
        selectedAffix("Suffix 1", el.suffix1, el.suffix1Tier, el.suffix1RollMode),
        selectedAffix("Suffix 2", el.suffix2, el.suffix2Tier, el.suffix2RollMode)
    ].filter(Boolean);

    const count = affixes.length;

    const data = [
        5,
        seed1,
        seed2,
        byteClamp(t.baseTypeID),
        byteClamp(item.subTypeID),
        count,
        byteClamp(getValue("rankMarker", 1)),
        imp1,
        imp2,
        imp3,
        byteClamp(getValue("forgingPotential", 21)),
        count,
        ...affixes.flatMap(a => a.block),
        0
    ];

    el.output.value = JSON.stringify(data);

    el.preview.textContent =
`Item: ${item.displayName}
baseTypeID/subTypeID: ${t.baseTypeID}/${item.subTypeID}
${state.selectedSpecialItem ? `Selected unique/set reference: ${itemDisplayName(state.selectedSpecialItem)}\\n` : ""}Class requirement: ${item.classRequirement ? CLASS_NAMES[item.classRequirement] || item.classRequirement : "generic"}
Seeds: [${seed1}, ${seed2}]
Implicit bytes: [${imp1}, ${imp2}, ${imp3}]
Rank/faction byte: ${byteClamp(getValue("rankMarker", 1))} (fixed Rank 1)
Forging potential: ${byteClamp(getValue("forgingPotential", 21))}
Affix count: ${count}

` + affixes.map(a => {
        const r = a.affix.tiers?.[a.tier - 1];
        return `${a.slot}: ${a.affix.affixName}
  affixId ${a.affixId}, T${a.tier}, rollByte ${a.rollByte}
  block [${a.block.join(",")}]
  ${r ? `range ${JSON.stringify(r.minRoll)} → ${JSON.stringify(r.maxRoll)}` : "range unknown"}`;
    }).join("\\n\\n");
}

function attach() {
    el.itemTypeSelect.addEventListener("change", () => {
        state.selectedSpecialItem = null;
        updateUniqueControls();
        populateItems();
    });

    el.itemSelect.addEventListener("change", () => {
        state.selectedSpecialItem = null;
        updateUniqueControls();
        updateItemInfo();
        populateAffixes();
    });

    if (hasEl("enforceClass")) el.enforceClass.addEventListener("change", populateAffixes);
    if (hasEl("hideCannotDrop")) el.hideCannotDrop.addEventListener("change", populateItems);
    if (hasEl("itemSearch")) el.itemSearch.addEventListener("input", populateItems);

    if (hasEl("globalItemSearch")) {
        el.globalItemSearch.addEventListener("input", () => populateGlobalItemResults(el.globalItemSearch.value));
    }

    if (hasEl("globalItemResults")) {
        el.globalItemResults.addEventListener("dblclick", selectGlobalItem);
        el.globalItemResults.addEventListener("change", selectGlobalItem);
    }

    if (hasEl("selectGlobalItemBtn")) {
        el.selectGlobalItemBtn.addEventListener("click", selectGlobalItem);
    }

    if (hasEl("clearGlobalSearchBtn")) {
        el.clearGlobalSearchBtn.addEventListener("click", clearGlobalSearch);
    }

    if (hasEl("advancedBytesToggle")) {
        el.advancedBytesToggle.addEventListener("change", updateAdvancedBytesControls);
    }

    [
        [el.prefix1, el.prefix1Tier],
        [el.prefix2, el.prefix2Tier],
        [el.suffix1, el.suffix1Tier],
        [el.suffix2, el.suffix2Tier]
    ].forEach(([s, t]) => s.addEventListener("change", () => populateTierSelect(s, t)));

    el.generateBtn.addEventListener("click", generate);

    el.copyBtn.addEventListener("click", async () => {
        await navigator.clipboard.writeText(el.output.value);
        el.copyBtn.textContent = "Copied";
        setTimeout(() => el.copyBtn.textContent = "Copy", 1000);
    });

    el.downloadBtn.addEventListener("click", () => {
        const blob = new Blob([el.output.value + "\\n"], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = "generated_item_data.txt";
        a.click();

        URL.revokeObjectURL(url);
    });
}

attach();

loadDb().catch(err => {
    console.error(err);
    el.loadStatus.textContent = `Error: ${err.message}`;
    el.loadStatus.classList.add("error");
});
