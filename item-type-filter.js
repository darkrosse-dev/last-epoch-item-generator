// Item type + selection overlay
// Includes a small recovery core in case app.js fails to parse.

(function () {
    const HIDDEN_BASE_TYPE_IDS = new Set([34, 35, 36, 37, 38, 39]);
    const CLASS_NAMES_FALLBACK = { 1: "Primalist", 2: "Mage", 4: "Sentinel", 8: "Acolyte", 16: "Rogue" };
    const IDS = [
        "itemTypeSelect", "itemSelect", "itemInfo", "loadStatus",
        "prefix1", "prefix1Tier", "prefix1RollMode", "prefix2", "prefix2Tier", "prefix2RollMode",
        "suffix1", "suffix1Tier", "suffix1RollMode", "suffix2", "suffix2Tier", "suffix2RollMode",
        "rankMarker", "forgingPotential", "randomiseHeader", "seed1", "seed2", "imp1", "imp2", "imp3",
        "generateBtn", "output", "preview", "copyBtn", "downloadBtn", "enforceClass", "hideCannotDrop", "itemSearch",
        "globalItemSearch", "globalItemResults", "selectGlobalItemBtn", "clearGlobalSearchBtn",
        "uniqueLp", "uniqueRollMode", "uniqueModeNotice", "rankMarkerWrap", "forgingPotentialWrap", "advancedBytesToggle", "advancedBytesPanel"
    ];

    const missingCore = typeof state === "undefined" || typeof el === "undefined" || typeof loadDb === "undefined";

    if (missingCore) defineRecoveryCore();
    installSelectionOverlay();
    if (missingCore) {
        attach();
        loadDb().catch(err => {
            console.error(err);
            if (el.loadStatus) {
                el.loadStatus.textContent = `Error: ${err.message}`;
                el.loadStatus.classList.add("error");
            }
        });
    }

    function defineRecoveryCore() {
        window.state = { db: null, itemTypes: [], nonEquippableItemTypes: [], uniqueItems: [], affixes: [], classes: [], allItems: [], selectedSpecialItem: null };
        window.el = Object.fromEntries(IDS.map(id => [id, document.getElementById(id)]));
        window.CLASS_NAMES = CLASS_NAMES_FALLBACK;
        window.hasEl = name => Boolean(el[name]);
        window.getChecked = (name, fallback = false) => hasEl(name) ? Boolean(el[name].checked) : fallback;
        window.getValue = (name, fallback = "") => hasEl(name) ? el[name].value : fallback;
        window.setValue = (name, value) => { if (hasEl(name)) el[name].value = value; };
        window.byteClamp = v => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(255, Math.trunc(n))) : 0; };
        window.randomByte = () => Math.floor(Math.random() * 256);
        window.encodeAffixBlock = (affixId, tier, rollByte) => [(((tier - 1) << 4) | (affixId >> 8)), affixId & 255, byteClamp(rollByte)];
        window.option = (value, label) => { const opt = document.createElement("option"); opt.value = value; opt.textContent = label; return opt; };
        window.optionWithDataset = (value, label, dataset = {}) => { const opt = option(value, label); for (const [k, v] of Object.entries(dataset)) opt.dataset[k] = String(v); return opt; };
        window.clear = s => { if (s) s.innerHTML = ""; };
        window.safeJson = value => { try { return JSON.stringify(value); } catch { return String(value); } };
        window.itemClassLabel = item => item?.classRequirement ? CLASS_NAMES[item.classRequirement] || `Class ${item.classRequirement}` : "Generic";
        window.itemDisplayName = itemName;
        window.loadJson = async path => { const r = await fetch(path, { cache: "no-store" }); if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`); return r.json(); };
        window.loadDb = async function () {
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
            el.loadStatus.textContent = `Loaded ${state.itemTypes.length} item types / ${meta.equippableSubItemCount || "?"} base items / ${state.uniqueItems.length} unique+set items / ${state.affixes.length} affixes`;
            el.loadStatus.classList.add("ok");
            populateItemTypes();
            populateGlobalItemResults("");
            updateUniqueControls();
        };
        window.findUniqueById = uniqueId => state.uniqueItems.find(u => Number(u.uniqueId) === Number(uniqueId));
        window.findEquippableType = baseTypeID => state.itemTypes.find(t => Number(t.baseTypeID) === Number(baseTypeID));
        window.getAffixById = id => state.affixes.find(a => Number(a.affixId) === Number(id));
        window.formatImplicit = imp => `property ${imp.property}, tags ${imp.tags}, type ${imp.type}: ${imp.implicitValue} → ${imp.implicitMaxValue}`;
        window.affixLabel = function (a) {
            const title = a.affixTitle ? ` — ${a.affixTitle}` : "";
            const kind = a.type === 0 ? "Prefix" : a.type === 1 ? "Suffix" : `Type ${a.type}`;
            const cls = a.classSpecificity ? ` / classSpec ${a.classSpecificity}` : "";
            return `${a.affixName || a.affixDisplayName || a.slug}${title} [id ${a.affixId}, ${kind}${cls}]`;
        };
        window.affixClassAllowed = function (item, affix) {
            if (!getChecked("enforceClass", true)) return true;
            if (!item || !item.classRequirement) return true;
            if (!affix.classSpecificity) return true;
            return (affix.classSpecificity & (item.classRequirement * 2)) !== 0;
        };
        window.validAffixes = function (slotType) {
            const t = getSelectedItemType();
            const item = getSelectedItem();
            if (!t) return [];
            return state.affixes.filter(a => a && Array.isArray(a.canRollOn))
                .filter(a => a.type === slotType)
                .filter(a => a.canRollOn.includes(t.baseTypeID))
                .filter(a => affixClassAllowed(item, a))
                .sort((a, b) => affixLabel(a).localeCompare(affixLabel(b)));
        };
        window.populateAffixSelect = function (select, tierSelect, rollSelect, affixes) {
            if (!select) return;
            const prev = select.value;
            clear(select); select.appendChild(option("", "— Empty —"));
            affixes.forEach(a => select.appendChild(option(a.affixId, affixLabel(a))));
            if ([...select.options].some(o => o.value === prev)) select.value = prev;
            populateTierSelect(select, tierSelect); populateRollSelect(rollSelect);
        };
        window.populateTierSelect = function (affixSelect, tierSelect) {
            if (!tierSelect) return;
            const prev = tierSelect.value;
            clear(tierSelect);
            const a = getAffixById(Number(affixSelect.value));
            if (!a) { tierSelect.appendChild(option("", "—")); tierSelect.disabled = true; return; }
            tierSelect.disabled = false;
            const n = a.tiers?.length || 0;
            for (let i = 1; i <= n; i++) tierSelect.appendChild(option(i, `T${i}`));
            tierSelect.value = [...tierSelect.options].some(o => o.value === prev) ? prev : String(Math.min(6, n || 1));
        };
        window.populateRollSelect = function (s) { if (!s) return; const p = s.value; clear(s); s.appendChild(option("random", "Random roll")); s.appendChild(option("max", "Max roll")); s.value = p || "random"; };
        window.populateAffixes = function () {
            populateAffixSelect(el.prefix1, el.prefix1Tier, el.prefix1RollMode, validAffixes(0));
            populateAffixSelect(el.prefix2, el.prefix2Tier, el.prefix2RollMode, validAffixes(0));
            populateAffixSelect(el.suffix1, el.suffix1Tier, el.suffix1RollMode, validAffixes(1));
            populateAffixSelect(el.suffix2, el.suffix2Tier, el.suffix2RollMode, validAffixes(1));
        };
        window.selectedAffix = function (slot, select, tierSelect, rollMode) {
            if (!select?.value) return null;
            const affixId = Number(select.value);
            const affix = getAffixById(affixId);
            const tier = Number(tierSelect.value);
            const rollByte = rollMode.value === "max" ? 255 : randomByte();
            return { slot, affix, affixId, tier, rollByte, block: encodeAffixBlock(affixId, tier, rollByte) };
        };
        window.uniqueVariableRollCount = function (unique) {
            const ids = new Set();
            for (const mod of (unique?.mods || [])) if (mod.canRoll && Number.isFinite(Number(mod.rollID)) && Number(mod.rollID) >= 0) ids.add(Number(mod.rollID));
            return ids.size ? Math.max(...ids) + 1 : 0;
        };
        window.buildUniqueRollBytes = function (unique) {
            const bytes = [];
            for (let i = 0; i < uniqueVariableRollCount(unique); i++) getValue("uniqueRollMode", "random") === "max" ? bytes.push(255, 255) : bytes.push(randomByte(), randomByte());
            return bytes;
        };
        window.uniqueAllowsLp = unique => Boolean(unique && !unique.isSetItem && unique.canHaveLegendaryPotential !== false);
        window.updateUniqueControls = function () {
            const unique = state.selectedSpecialItem;
            if (!hasEl("uniqueLp")) return;
            if (!unique) { el.uniqueLp.disabled = false; if (hasEl("uniqueModeNotice")) el.uniqueModeNotice.textContent = "Select a Unique or Set item from global search to activate this mode."; updateGenerationControls(); return; }
            const allows = uniqueAllowsLp(unique);
            el.uniqueLp.disabled = !allows;
            if (!allows) el.uniqueLp.value = "0";
            if (hasEl("uniqueModeNotice")) el.uniqueModeNotice.textContent = `${unique.isSetItem ? "Set item" : "Unique item"} selected: ${itemName(unique)}\n${allows ? "Legendary Potential can be selected from 0 to 4." : "Legendary Potential is disabled and forced to 0 for this item."}`;
            updateGenerationControls();
        };
        window.isUniqueOrSetMode = () => Boolean(state.selectedSpecialItem && state.selectedSpecialItem.uniqueId !== undefined);
        window.updateGenerationControls = function () {
            setValue("rankMarker", 1);
            if (hasEl("rankMarkerWrap")) el.rankMarkerWrap.classList.add("hidden");
            if (hasEl("forgingPotentialWrap")) el.forgingPotentialWrap.classList.toggle("hidden", isUniqueOrSetMode());
            updateAdvancedBytesControls();
        };
        window.updateAdvancedBytesControls = function () { if (hasEl("advancedBytesPanel")) el.advancedBytesPanel.classList.toggle("hidden", !getChecked("advancedBytesToggle", false)); };
        window.generateUnique = function (t, item, unique) {
            let seed1 = byteClamp(getValue("seed1", 65)), seed2 = byteClamp(getValue("seed2", 94)), imp1 = byteClamp(getValue("imp1", 58)), imp2 = byteClamp(getValue("imp2", 84)), imp3 = byteClamp(getValue("imp3", 140));
            if (getChecked("randomiseHeader", true)) { seed1 = randomByte(); seed2 = randomByte(); imp1 = randomByte(); imp2 = randomByte(); imp3 = randomByte(); setValue("seed1", seed1); setValue("seed2", seed2); setValue("imp1", imp1); setValue("imp2", imp2); setValue("imp3", imp3); }
            const uniqueId = Number(unique.uniqueId);
            const lp = uniqueAllowsLp(unique) ? Math.max(0, Math.min(4, byteClamp(getValue("uniqueLp", 0)))) : 0;
            const rollBytes = buildUniqueRollBytes(unique);
            const off = Math.min(8, rollBytes.length);
            const data = [5, seed1, seed2, byteClamp(t.baseTypeID), byteClamp(item.subTypeID), 7, byteClamp(getValue("rankMarker", 1)), imp1, imp2, imp3, uniqueId >> 8, uniqueId & 255, ...rollBytes.slice(0, off), lp, ...rollBytes.slice(off)];
            el.output.value = JSON.stringify(data);
            el.preview.textContent = `UNIQUE / SET ITEM MODE\nSelected: ${itemName(unique)}\nKind: ${unique.isSetItem ? "Set" : "Unique"}\nuniqueId: ${uniqueId}\nbaseTypeID/subTypeID: ${t.baseTypeID}/${item.subTypeID}\nLegendary Potential: ${lp}\nUnique roll slots: ${uniqueVariableRollCount(unique)}\nFaction/rank byte: ${byteClamp(getValue("rankMarker", 1))} (fixed Rank 1)\nImplicit bytes: [${imp1}, ${imp2}, ${imp3}]`;
        };
        window.generate = function () {
            const t = getSelectedItemType(), item = getSelectedItem();
            if (!t || !item) { alert("Select an equippable item first."); return; }
            if (state.selectedSpecialItem?.uniqueId !== undefined) { generateUnique(t, item, state.selectedSpecialItem); return; }
            let seed1 = byteClamp(getValue("seed1", 65)), seed2 = byteClamp(getValue("seed2", 94)), imp1 = byteClamp(getValue("imp1", 58)), imp2 = byteClamp(getValue("imp2", 84)), imp3 = byteClamp(getValue("imp3", 140));
            if (getChecked("randomiseHeader", true)) { seed1 = randomByte(); seed2 = randomByte(); imp1 = randomByte(); imp2 = randomByte(); imp3 = randomByte(); setValue("seed1", seed1); setValue("seed2", seed2); setValue("imp1", imp1); setValue("imp2", imp2); setValue("imp3", imp3); }
            const affixes = [selectedAffix("Prefix 1", el.prefix1, el.prefix1Tier, el.prefix1RollMode), selectedAffix("Prefix 2", el.prefix2, el.prefix2Tier, el.prefix2RollMode), selectedAffix("Suffix 1", el.suffix1, el.suffix1Tier, el.suffix1RollMode), selectedAffix("Suffix 2", el.suffix2, el.suffix2Tier, el.suffix2RollMode)].filter(Boolean);
            const data = [5, seed1, seed2, byteClamp(t.baseTypeID), byteClamp(item.subTypeID), affixes.length, 1, imp1, imp2, imp3, byteClamp(getValue("forgingPotential", 21)), affixes.length, ...affixes.flatMap(a => a.block), 0];
            el.output.value = JSON.stringify(data);
            el.preview.textContent = `Item: ${itemName(item)}\nbaseTypeID/subTypeID: ${t.baseTypeID}/${item.subTypeID}\nAffix count: ${affixes.length}`;
        };
        window.attach = function () {
            el.itemTypeSelect?.addEventListener("change", () => { state.selectedSpecialItem = null; updateUniqueControls(); populateItems(); });
            el.itemSelect?.addEventListener("change", () => { state.selectedSpecialItem = null; updateUniqueControls(); updateItemInfo(); populateAffixes(); });
            el.enforceClass?.addEventListener("change", populateAffixes);
            el.hideCannotDrop?.addEventListener("change", populateItems);
            el.itemSearch?.addEventListener("input", populateItems);
            el.globalItemSearch?.addEventListener("input", () => populateGlobalItemResults(el.globalItemSearch.value));
            el.globalItemResults?.addEventListener("dblclick", selectGlobalItem);
            el.globalItemResults?.addEventListener("change", selectGlobalItem);
            el.selectGlobalItemBtn?.addEventListener("click", selectGlobalItem);
            el.clearGlobalSearchBtn?.addEventListener("click", () => { setValue("globalItemSearch", ""); state.selectedSpecialItem = null; populateGlobalItemResults(""); updateUniqueControls(); updateItemInfo(); });
            el.advancedBytesToggle?.addEventListener("change", updateAdvancedBytesControls);
            [[el.prefix1, el.prefix1Tier], [el.prefix2, el.prefix2Tier], [el.suffix1, el.suffix1Tier], [el.suffix2, el.suffix2Tier]].forEach(([s, t]) => s?.addEventListener("change", () => populateTierSelect(s, t)));
            el.generateBtn?.addEventListener("click", generate);
            el.copyBtn?.addEventListener("click", async () => { await navigator.clipboard.writeText(el.output.value); el.copyBtn.textContent = "Copied"; setTimeout(() => el.copyBtn.textContent = "Copy", 1000); });
            el.downloadBtn?.addEventListener("click", () => { const blob = new Blob([el.output.value + "\n"], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "generated_item_data.txt"; a.click(); URL.revokeObjectURL(url); });
        };
    }

    function installSelectionOverlay() {
        window.isHiddenBaseTypeID = id => HIDDEN_BASE_TYPE_IDS.has(Number(id));
        window.itemDisplayName = itemName;
        window.buildAllItemsIndex = function () {
            const rows = [];
            for (const t of (state.itemTypes || []).filter(t => !isHiddenBaseTypeID(t.baseTypeID))) for (const i of (t.subItems || [])) rows.push({ kind: "base", baseTypeID: t.baseTypeID, baseTypeName: baseName(t), baseDisplayName: baseName(t), subTypeID: i.subTypeID, item: i });
            for (const t of (state.nonEquippableItemTypes || []).filter(t => !isHiddenBaseTypeID(t.baseTypeID))) for (const i of (t.subItems || [])) rows.push({ kind: "nonEquippable", baseTypeID: t.baseTypeID, baseTypeName: baseName(t), baseDisplayName: baseName(t), subTypeID: i.subTypeID, item: i });
            for (const u of (state.uniqueItems || [])) { const bt = uniqueBaseTypeID(u); if (Number.isFinite(bt) && !isHiddenBaseTypeID(bt)) rows.push({ kind: u.isSetItem ? "set" : "unique", baseTypeID: bt, baseTypeName: u.baseTypeName || "", baseDisplayName: u.baseTypeName || "", subTypeID: uniqueSubtypeIDs(u)[0] ?? null, item: u }); }
            return rows;
        };
        const oldFindType = typeof findEquippableType === "function" ? findEquippableType : null;
        window.findEquippableType = id => isHiddenBaseTypeID(id) ? undefined : oldFindType ? oldFindType(id) : (state.itemTypes || []).find(t => Number(t.baseTypeID) === Number(id));
        window.getSelectedItemType = function () { const v = getValue("itemTypeSelect", ""); return v === "" ? null : (state.itemTypes || []).find(t => Number(t.baseTypeID) === Number(v)) || null; };
        window.getSelectedItem = function () { const t = getSelectedItemType(); const opt = el.itemSelect?.selectedOptions?.[0]; if (!t || !opt || !opt.value) return null; if (opt.dataset.kind === "unique" || opt.dataset.kind === "set") return baseItem(t, opt.dataset.subTypeID) || baseItem(t, compatibleSubtype(selectedUniqueFromOption(), t)); return baseItem(t, opt.dataset.subTypeID ?? opt.value); };
        window.populateGlobalItemResults = populateGlobalItemResultsOverlay;
        window.populateItemTypes = populateItemTypesOverlay;
        window.populateItems = populateItemsOverlay;
        window.selectGlobalItem = selectGlobalItemOverlay;
        window.updateItemInfo = updateItemInfoOverlay;
        bootOverlay();
    }

    function itemName(i) { return i?.effectiveDisplayName || i?.displayName || i?.name || i?.slug || `Item ${i?.subTypeID ?? i?.uniqueId ?? ""}`; }
    function baseName(t) { return t?.baseTypeName || t?.displayName || t?.name || t?.baseDisplayName || `Base type ${t?.baseTypeID ?? ""}`; }
    function text(v) { return String(v ?? "").toLowerCase(); }
    function uniqueBaseTypeID(u) { return Number(u?.baseTypeID ?? u?.baseType); }
    function uniqueSubtypeIDs(u) { const ids = Array.isArray(u?.subTypeIDs) && u.subTypeIDs.length ? u.subTypeIDs : (Array.isArray(u?.subTypes) ? u.subTypes : []); return ids.map(Number).filter(Number.isFinite); }
    function baseItem(type, subTypeID) { return (type?.subItems || []).find(i => Number(i.subTypeID) === Number(subTypeID)) || null; }
    function compatibleSubtype(u, type) { const ids = uniqueSubtypeIDs(u); return ids.find(id => baseItem(type, id)) ?? ids[0] ?? null; }
    function selectedUniqueFromOption() { const id = el.itemSelect?.selectedOptions?.[0]?.dataset?.uniqueId; return id === undefined || id === "" ? null : (state.uniqueItems || []).find(u => Number(u.uniqueId) === Number(id)) || null; }
    function rowLabel(row) { const i = row.item || {}; const kind = row.kind === "base" ? "Base" : row.kind === "nonEquippable" ? "Non-equip" : row.kind === "set" ? "Set" : "Unique"; const id = row.kind === "unique" || row.kind === "set" ? `uniqueId ${i.uniqueId}` : `subTypeID ${row.subTypeID}`; return `${kind}: ${itemName(i)} [${row.baseTypeName || row.baseDisplayName || ""} ${row.baseTypeID}/${id}]${i.classRequirement ? ` — ${itemClassLabel(i)}` : ""}${i.cannotDrop ? " — cannotDrop" : ""}`; }
    function rowBlob(row) { const i = row.item || {}; return [row.kind, row.baseTypeID, row.subTypeID, row.baseTypeName, row.baseDisplayName, itemName(i), i.effectiveDisplayName, i.displayName, i.name, i.slug, i.uniqueId, i.setId, i.classRequirement, itemClassLabel(i)].map(text).join(" "); }
    function populateGlobalItemResultsOverlay(query) { if (!hasEl("globalItemResults")) return; const q = String(query || "").trim().toLowerCase(); clear(el.globalItemResults); const rows = (state.allItems || []).filter(r => !q || rowBlob(r).includes(q)).sort((a, b) => rowLabel(a).localeCompare(rowLabel(b))).slice(0, 500); if (!rows.length) { el.globalItemResults.appendChild(option("", "No matching items")); return; } rows.forEach((row, idx) => el.globalItemResults.appendChild(optionWithDataset(`${row.kind}:${row.baseTypeID}:${row.subTypeID ?? ""}:${row.item.uniqueId ?? ""}:${idx}`, rowLabel(row), { kind: row.kind, baseTypeID: row.baseTypeID, subTypeID: row.subTypeID ?? "", uniqueId: row.item.uniqueId ?? "" }))); }
    function populateItemTypesOverlay() { clear(el.itemTypeSelect); clear(el.itemSelect); el.itemTypeSelect.appendChild(option("", "— Search globally or choose item type —")); el.itemSelect.appendChild(option("", "— Choose item type first —")); (state.itemTypes || []).filter(t => !isHiddenBaseTypeID(t.baseTypeID)).slice().sort((a, b) => baseName(a).localeCompare(baseName(b))).forEach(t => el.itemTypeSelect.appendChild(option(t.baseTypeID, `${baseName(t)} [baseTypeID ${t.baseTypeID}]`))); state.selectedSpecialItem = null; updateItemInfo(); populateAffixes(); }
    function populateItemsOverlay() { const t = getSelectedItemType(); clear(el.itemSelect); if (!t) { el.itemSelect.appendChild(option("", "— Choose item type first —")); state.selectedSpecialItem = null; updateItemInfo(); populateAffixes(); return; } const q = getValue("itemSearch", "").trim().toLowerCase(); const hideNoDrop = getChecked("hideCannotDrop", false); const rows = []; for (const i of (t.subItems || [])) { if (hideNoDrop && i.cannotDrop) continue; rows.push({ kind: "base", label: `Base: ${itemName(i)} [subTypeID ${i.subTypeID}]${i.classRequirement ? ` — ${itemClassLabel(i)}` : ""}${i.cannotDrop ? " — cannotDrop" : ""}`, blob: ["base", itemName(i), i.name, i.slug, i.subTypeID, itemClassLabel(i)].map(text).join(" "), subTypeID: i.subTypeID }); } for (const u of (state.uniqueItems || [])) { if (uniqueBaseTypeID(u) !== Number(t.baseTypeID)) continue; if (hideNoDrop && u.canDropRandomly === false) continue; for (const st of uniqueSubtypeIDs(u)) { if (!baseItem(t, st)) continue; rows.push({ kind: u.isSetItem ? "set" : "unique", label: `${u.isSetItem ? "Set" : "Unique"}: ${itemName(u)} [uniqueId ${u.uniqueId}/subTypeID ${st}]`, blob: [u.isSetItem ? "set" : "unique", itemName(u), u.name, u.slug, u.uniqueId, st, u.baseTypeName].map(text).join(" "), subTypeID: st, uniqueId: u.uniqueId }); } } const shown = rows.filter(r => !q || r.blob.includes(q)).sort((a, b) => a.label.localeCompare(b.label)); el.itemSelect.appendChild(option("", shown.length ? "— Select item —" : "No matching items")); for (const r of shown) el.itemSelect.appendChild(optionWithDataset(`${r.kind}:${r.subTypeID ?? ""}:${r.uniqueId ?? ""}`, r.label, { kind: r.kind, baseTypeID: t.baseTypeID, subTypeID: r.subTypeID ?? "", uniqueId: r.uniqueId ?? "" })); state.selectedSpecialItem = null; updateItemInfo(); populateAffixes(); }
    function selectGlobalItemOverlay(event) { if (event) { event.preventDefault(); event.stopImmediatePropagation(); } const selected = el.globalItemResults?.selectedOptions?.[0]; if (!selected?.dataset?.kind) return; const kind = selected.dataset.kind; const bt = Number(selected.dataset.baseTypeID); const type = findEquippableType(bt); if (!type) { alert("This result is non-equippable, so it cannot be used for compact generated item data yet."); return; } let st = selected.dataset.subTypeID === "" ? null : Number(selected.dataset.subTypeID); state.selectedSpecialItem = null; if (kind === "unique" || kind === "set") { const u = findUniqueById(selected.dataset.uniqueId); if (!u) return; state.selectedSpecialItem = u; st = st ?? compatibleSubtype(u, type); } setValue("itemSearch", ""); setValue("itemTypeSelect", bt); populateItems(); const wanted = [...el.itemSelect.options].find(o => o.dataset.kind === kind && (kind === "base" ? String(o.dataset.subTypeID) === String(st) : String(o.dataset.uniqueId) === String(selected.dataset.uniqueId) && String(o.dataset.subTypeID) === String(st))); if (wanted) wanted.selected = true; if (kind === "unique" || kind === "set") state.selectedSpecialItem = findUniqueById(selected.dataset.uniqueId); updateUniqueControls(); updateItemInfo(); populateAffixes(); }
    function updateItemInfoOverlay() { const t = getSelectedItemType(); const i = getSelectedItem(); const u = state.selectedSpecialItem; if (!t || !i) { el.itemInfo.textContent = "No item selected."; return; } const imps = (i.implicits || []).map(formatImplicit).join("\n  "); if (u) { el.itemInfo.textContent = `Selected item: ${itemName(u)}\nKind: ${u.isSetItem ? "Set" : "Unique"}\nuniqueId: ${u.uniqueId}\nBase type: ${baseName(t)} / baseTypeID ${t.baseTypeID}\nUnderlying base item: ${itemName(i)} / subTypeID ${i.subTypeID}\nClass requirement: ${u.classRequirement || i.classRequirement ? itemClassLabel({ classRequirement: u.classRequirement || i.classRequirement }) : "none / generic"}\nLevel requirement: ${u.levelRequirement}\nCan drop randomly: ${u.canDropRandomly}\nCan drop as legendary: ${u.canDropAsLegendary}\nEffective LP level: ${u.effectiveLevelForLegendaryPotential}\nMods: ${(u.mods || []).length}\nSlug: ${u.slug || ""}\n\nUnderlying base implicits:\n  ${imps || "none"}`; return; } el.itemInfo.textContent = `Base type: ${baseName(t)} / baseTypeID ${t.baseTypeID}\nItem: ${itemName(i)} / subTypeID ${i.subTypeID}\nClass requirement: ${i.classRequirement ? itemClassLabel(i) : "none / generic"}\nLevel requirement: ${i.levelRequirement}\nMax affixes: ${t.maximumAffixes}\nItem affixEffectModifier: ${t.affixEffectModifier}\nAttack rate: ${i.attackRate}\nAdded weapon range: ${i.addedWeaponRange}\nname: ${safeJson(i.name)}\nslug: ${safeJson(i.slug)}\ncannotDrop: ${safeJson(i.cannotDrop)}\nitemTags: ${safeJson(i.itemTags)}\nImplicits:\n  ${imps || "none"}`; }
    function mergeLayout() { const cards = [...document.querySelectorAll("main.page > section.card")]; const searchCard = cards.find(c => c.querySelector("#globalItemSearch")); const baseCard = cards.find(c => c.querySelector("#itemTypeSelect")); if (!searchCard || !baseCard || searchCard === baseCard) return; searchCard.querySelector("h2").textContent = "Select item"; const hint = searchCard.querySelector(".hint"); if (hint) hint.textContent = "Use global search for a specific base, unique, or set item. Or choose an item type below and then select from all relevant base/unique/set items."; const h3 = document.createElement("h3"); h3.textContent = "Browse by item type"; h3.style.marginTop = "22px"; searchCard.appendChild(h3); baseCard.querySelector("h2")?.remove(); while (baseCard.firstChild) searchCard.appendChild(baseCard.firstChild); baseCard.remove(); }
    function handleBrowse(event) { if (event) { event.preventDefault(); event.stopImmediatePropagation(); } const kind = el.itemSelect?.selectedOptions?.[0]?.dataset?.kind; state.selectedSpecialItem = (kind === "unique" || kind === "set") ? selectedUniqueFromOption() : null; updateUniqueControls(); updateItemInfo(); populateAffixes(); }
    function bootOverlay() { mergeLayout(); el.globalItemResults?.addEventListener("change", selectGlobalItem, true); el.globalItemResults?.addEventListener("dblclick", selectGlobalItem, true); el.selectGlobalItemBtn?.addEventListener("click", selectGlobalItem, true); el.itemSelect?.addEventListener("change", handleBrowse, true); const refresh = () => { if (!state?.db) return; state.allItems = buildAllItemsIndex(); populateGlobalItemResults(getValue("globalItemSearch", "")); populateItemTypes(); updateUniqueControls(); updateItemInfo(); }; setTimeout(refresh, 0); setTimeout(refresh, 300); setTimeout(refresh, 1000); }
})();
