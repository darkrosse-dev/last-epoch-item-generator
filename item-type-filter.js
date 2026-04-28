// Item type + selection overlay
// - hides unsupported item categories
// - uses baseTypeName/effectiveDisplayName in labels
// - item dropdown can browse base + unique + set items for the selected type
// - no item is selected by default

(function () {
    const HIDDEN_BASE_TYPE_IDS = new Set([34, 35, 36, 37, 38, 39]);

    function isHiddenBaseTypeID(baseTypeID) {
        return HIDDEN_BASE_TYPE_IDS.has(Number(baseTypeID));
    }
    window.isHiddenBaseTypeID = isHiddenBaseTypeID;

    function text(v) { return String(v ?? "").toLowerCase(); }
    function baseName(t) { return t?.baseTypeName || t?.displayName || t?.name || t?.baseDisplayName || `Base type ${t?.baseTypeID ?? ""}`; }
    function itemName(i) { return i?.effectiveDisplayName || i?.displayName || i?.name || i?.slug || `Item ${i?.subTypeID ?? i?.uniqueId ?? ""}`; }
    itemDisplayName = itemName;

    function visibleTypes() { return (state.itemTypes || []).filter(t => !isHiddenBaseTypeID(t.baseTypeID)); }
    function visibleNonEquipTypes() { return (state.nonEquippableItemTypes || []).filter(t => !isHiddenBaseTypeID(t.baseTypeID)); }
    function uniqueBaseTypeID(u) { return Number(u?.baseTypeID ?? u?.baseType); }
    function uniqueSubtypeIDs(u) {
        const ids = Array.isArray(u?.subTypeIDs) && u.subTypeIDs.length ? u.subTypeIDs : (Array.isArray(u?.subTypes) ? u.subTypes : []);
        return ids.map(Number).filter(Number.isFinite);
    }
    function selectedOpt() { return el.itemSelect?.selectedOptions?.[0] || null; }
    function baseItem(type, subTypeID) { return (type?.subItems || []).find(i => Number(i.subTypeID) === Number(subTypeID)) || null; }
    function compatibleSubtype(u, type) {
        const ids = uniqueSubtypeIDs(u);
        return ids.find(id => baseItem(type, id)) ?? ids[0] ?? null;
    }
    function selectedUniqueFromOption() {
        const id = selectedOpt()?.dataset?.uniqueId;
        return id === undefined || id === "" ? null : (state.uniqueItems || []).find(u => Number(u.uniqueId) === Number(id)) || null;
    }

    buildAllItemsIndex = function () {
        const rows = [];
        for (const t of visibleTypes()) for (const i of (t.subItems || [])) rows.push({ kind: "base", baseTypeID: t.baseTypeID, baseTypeName: baseName(t), baseDisplayName: baseName(t), subTypeID: i.subTypeID, item: i });
        for (const t of visibleNonEquipTypes()) for (const i of (t.subItems || [])) rows.push({ kind: "nonEquippable", baseTypeID: t.baseTypeID, baseTypeName: baseName(t), baseDisplayName: baseName(t), subTypeID: i.subTypeID, item: i });
        for (const u of (state.uniqueItems || [])) {
            const bt = uniqueBaseTypeID(u);
            if (!Number.isFinite(bt) || isHiddenBaseTypeID(bt)) continue;
            rows.push({ kind: u.isSetItem ? "set" : "unique", baseTypeID: bt, baseTypeName: u.baseTypeName || "", baseDisplayName: u.baseTypeName || "", subTypeID: uniqueSubtypeIDs(u)[0] ?? null, item: u });
        }
        return rows;
    };

    function rowLabel(row) {
        const i = row.item || {};
        const kind = row.kind === "base" ? "Base" : row.kind === "nonEquippable" ? "Non-equip" : row.kind === "set" ? "Set" : "Unique";
        const id = row.kind === "unique" || row.kind === "set" ? `uniqueId ${i.uniqueId}` : `subTypeID ${row.subTypeID}`;
        return `${kind}: ${itemName(i)} [${row.baseTypeName || row.baseDisplayName || ""} ${row.baseTypeID}/${id}]${i.classRequirement ? ` — ${itemClassLabel(i)}` : ""}${i.cannotDrop ? " — cannotDrop" : ""}`;
    }
    function rowBlob(row) {
        const i = row.item || {};
        return [row.kind, row.baseTypeID, row.subTypeID, row.baseTypeName, row.baseDisplayName, itemName(i), i.effectiveDisplayName, i.displayName, i.name, i.slug, i.uniqueId, i.setId, i.classRequirement, itemClassLabel(i)].map(text).join(" ");
    }

    populateGlobalItemResults = function (query) {
        if (!hasEl("globalItemResults")) return;
        const q = String(query || "").trim().toLowerCase();
        clear(el.globalItemResults);
        const rows = (state.allItems || []).filter(r => !q || rowBlob(r).includes(q)).sort((a, b) => rowLabel(a).localeCompare(rowLabel(b))).slice(0, 500);
        if (!rows.length) { el.globalItemResults.appendChild(option("", "No matching items")); return; }
        rows.forEach((row, idx) => el.globalItemResults.appendChild(optionWithDataset(`${row.kind}:${row.baseTypeID}:${row.subTypeID ?? ""}:${row.item.uniqueId ?? ""}:${idx}`, rowLabel(row), { kind: row.kind, baseTypeID: row.baseTypeID, subTypeID: row.subTypeID ?? "", uniqueId: row.item.uniqueId ?? "" })));
    };

    const originalFindEquippableType = findEquippableType;
    findEquippableType = function (baseTypeID) { return isHiddenBaseTypeID(baseTypeID) ? undefined : originalFindEquippableType(baseTypeID); };

    getSelectedItemType = function () {
        const v = getValue("itemTypeSelect", "");
        if (v === "") return null;
        return (state.itemTypes || []).find(t => Number(t.baseTypeID) === Number(v)) || null;
    };

    getSelectedItem = function () {
        const t = getSelectedItemType();
        const opt = selectedOpt();
        if (!t || !opt || !opt.value) return null;
        if (opt.dataset.kind === "unique" || opt.dataset.kind === "set") return baseItem(t, opt.dataset.subTypeID) || baseItem(t, compatibleSubtype(selectedUniqueFromOption(), t));
        return baseItem(t, opt.dataset.subTypeID ?? opt.value);
    };

    populateItemTypes = function () {
        clear(el.itemTypeSelect); clear(el.itemSelect);
        el.itemTypeSelect.appendChild(option("", "— Search globally or choose item type —"));
        el.itemSelect.appendChild(option("", "— Choose item type first —"));
        visibleTypes().slice().sort((a, b) => baseName(a).localeCompare(baseName(b))).forEach(t => el.itemTypeSelect.appendChild(option(t.baseTypeID, `${baseName(t)} [baseTypeID ${t.baseTypeID}]`)));
        state.selectedSpecialItem = null;
        updateItemInfo(); populateAffixes();
    };

    populateItems = function () {
        const t = getSelectedItemType();
        clear(el.itemSelect);
        if (!t) { el.itemSelect.appendChild(option("", "— Choose item type first —")); state.selectedSpecialItem = null; updateItemInfo(); populateAffixes(); return; }
        const q = getValue("itemSearch", "").trim().toLowerCase();
        const hideNoDrop = getChecked("hideCannotDrop", false);
        const rows = [];
        for (const i of (t.subItems || [])) {
            if (hideNoDrop && i.cannotDrop) continue;
            rows.push({ kind: "base", label: `Base: ${itemName(i)} [subTypeID ${i.subTypeID}]${i.classRequirement ? ` — ${itemClassLabel(i)}` : ""}${i.cannotDrop ? " — cannotDrop" : ""}`, blob: ["base", itemName(i), i.name, i.slug, i.subTypeID, itemClassLabel(i)].map(text).join(" "), subTypeID: i.subTypeID });
        }
        for (const u of (state.uniqueItems || [])) {
            if (uniqueBaseTypeID(u) !== Number(t.baseTypeID)) continue;
            if (hideNoDrop && u.canDropRandomly === false) continue;
            for (const st of uniqueSubtypeIDs(u)) {
                if (!baseItem(t, st)) continue;
                rows.push({ kind: u.isSetItem ? "set" : "unique", label: `${u.isSetItem ? "Set" : "Unique"}: ${itemName(u)} [uniqueId ${u.uniqueId}/subTypeID ${st}]`, blob: [u.isSetItem ? "set" : "unique", itemName(u), u.name, u.slug, u.uniqueId, st, u.baseTypeName].map(text).join(" "), subTypeID: st, uniqueId: u.uniqueId });
            }
        }
        const visibleRows = rows.filter(r => !q || r.blob.includes(q)).sort((a, b) => a.label.localeCompare(b.label));
        el.itemSelect.appendChild(option("", visibleRows.length ? "— Select item —" : "No matching items"));
        for (const r of visibleRows) el.itemSelect.appendChild(optionWithDataset(`${r.kind}:${r.subTypeID ?? ""}:${r.uniqueId ?? ""}`, r.label, { kind: r.kind, baseTypeID: t.baseTypeID, subTypeID: r.subTypeID ?? "", uniqueId: r.uniqueId ?? "" }));
        state.selectedSpecialItem = null;
        updateItemInfo(); populateAffixes();
    };

    selectGlobalItem = function (event) {
        if (event) { event.preventDefault(); event.stopImmediatePropagation(); }
        const selected = el.globalItemResults?.selectedOptions?.[0];
        if (!selected?.dataset?.kind) return;
        const kind = selected.dataset.kind;
        const bt = Number(selected.dataset.baseTypeID);
        const type = findEquippableType(bt);
        if (!type) { alert("This result is non-equippable, so it cannot be used for compact generated item data yet."); return; }
        let st = selected.dataset.subTypeID === "" ? null : Number(selected.dataset.subTypeID);
        state.selectedSpecialItem = null;
        if (kind === "unique" || kind === "set") {
            const u = findUniqueById(selected.dataset.uniqueId);
            if (!u) return;
            state.selectedSpecialItem = u;
            st = st ?? compatibleSubtype(u, type);
        }
        setValue("itemSearch", ""); setValue("itemTypeSelect", bt); populateItems();
        const wanted = [...el.itemSelect.options].find(o => o.dataset.kind === kind && (kind === "base" ? String(o.dataset.subTypeID) === String(st) : String(o.dataset.uniqueId) === String(selected.dataset.uniqueId) && String(o.dataset.subTypeID) === String(st)));
        if (wanted) wanted.selected = true;
        if (kind === "unique" || kind === "set") state.selectedSpecialItem = findUniqueById(selected.dataset.uniqueId);
        updateUniqueControls(); updateItemInfo(); populateAffixes();
    };

    function handleItemSelect(event) {
        if (event) { event.preventDefault(); event.stopImmediatePropagation(); }
        const kind = selectedOpt()?.dataset?.kind;
        state.selectedSpecialItem = (kind === "unique" || kind === "set") ? selectedUniqueFromOption() : null;
        updateUniqueControls(); updateItemInfo(); populateAffixes();
    }

    function installMergedLayout() {
        const cards = [...document.querySelectorAll("main.page > section.card")];
        const searchCard = cards.find(c => c.querySelector("#globalItemSearch"));
        const baseCard = cards.find(c => c.querySelector("#itemTypeSelect"));
        if (!searchCard || !baseCard || searchCard === baseCard) return;
        searchCard.querySelector("h2").textContent = "Select item";
        const hint = searchCard.querySelector(".hint");
        if (hint) hint.textContent = "Use global search for a specific base, unique, or set item. Or choose an item type below and then select from all relevant base/unique/set items.";
        const h3 = document.createElement("h3"); h3.textContent = "Browse by item type"; h3.style.marginTop = "22px"; searchCard.appendChild(h3);
        const oldTitle = baseCard.querySelector("h2"); if (oldTitle) oldTitle.remove();
        while (baseCard.firstChild) searchCard.appendChild(baseCard.firstChild);
        baseCard.remove();
    }

    window.addEventListener("DOMContentLoaded", () => {
        installMergedLayout();
        el.globalItemResults?.addEventListener("change", selectGlobalItem, true);
        el.globalItemResults?.addEventListener("dblclick", selectGlobalItem, true);
        el.selectGlobalItemBtn?.addEventListener("click", selectGlobalItem, true);
        el.itemSelect?.addEventListener("change", handleItemSelect, true);
        setTimeout(() => {
            if (!state?.db) return;
            state.allItems = buildAllItemsIndex();
            populateGlobalItemResults(getValue("globalItemSearch", ""));
            populateItemTypes();
            updateUniqueControls();
            updateItemInfo();
        }, 0);
    });
})();
