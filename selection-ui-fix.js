// Unified item-selection overlay
// Fixes confusing unique/base display:
// - global search and item-type browsing now select the actual unique/set row
// - item dropdown can show base + unique + set records for the selected item type
// - no base item is preselected by default
// - labels prefer effectiveDisplayName/baseTypeName where available

(function () {
    function normalizeText(value) {
        return String(value ?? "").toLowerCase();
    }

    function visibleType(type) {
        try {
            return !(typeof isHiddenBaseTypeID === "function" && isHiddenBaseTypeID(type?.baseTypeID));
        } catch {
            return true;
        }
    }

    function preferredItemName(item) {
        return item?.effectiveDisplayName ||
            item?.displayName ||
            item?.name ||
            item?.slug ||
            `Item ${item?.subTypeID ?? item?.uniqueId ?? ""}`;
    }

    function preferredBaseTypeName(typeOrRecord) {
        return typeOrRecord?.baseTypeName ||
            typeOrRecord?.displayName ||
            typeOrRecord?.name ||
            typeOrRecord?.baseDisplayName ||
            `Base type ${typeOrRecord?.baseTypeID ?? ""}`;
    }

    // Keep compatibility with the rest of the app and other overlays.
    itemDisplayName = preferredItemName;

    function selectedOption() {
        return el?.itemSelect?.selectedOptions?.[0] || null;
    }

    function selectedKind() {
        return selectedOption()?.dataset?.kind || "";
    }

    function selectedUniqueId() {
        const raw = selectedOption()?.dataset?.uniqueId;
        return raw === undefined || raw === "" ? null : Number(raw);
    }

    function findBaseItem(type, subTypeID) {
        if (!type || subTypeID === null || subTypeID === undefined || subTypeID === "") return null;
        return (type.subItems || []).find(item => Number(item.subTypeID) === Number(subTypeID)) || null;
    }

    function uniqueBaseTypeID(unique) {
        return Number(unique?.baseTypeID ?? unique?.baseType);
    }

    function uniqueSubtypeIDs(unique) {
        const ids = Array.isArray(unique?.subTypeIDs) && unique.subTypeIDs.length
            ? unique.subTypeIDs
            : Array.isArray(unique?.subTypes) && unique.subTypes.length
                ? unique.subTypes
                : [];
        return ids.map(Number).filter(Number.isFinite);
    }

    function findCompatibleSubtype(unique, type) {
        const ids = uniqueSubtypeIDs(unique);
        if (!ids.length) return null;
        if (!type) return ids[0];

        const exact = ids.find(id => findBaseItem(type, id));
        return exact ?? ids[0];
    }

    function findUniqueByOption() {
        const id = selectedUniqueId();
        if (id === null || !Number.isFinite(id)) return null;
        return (state.uniqueItems || []).find(u => Number(u.uniqueId) === id) || null;
    }

    function rowSearchBlob(row) {
        const item = row.item || {};
        return [
            row.kind,
            row.baseTypeID,
            row.subTypeID,
            row.baseTypeName,
            row.baseDisplayName,
            preferredItemName(item),
            item.effectiveDisplayName,
            item.displayName,
            item.name,
            item.slug,
            item.uniqueId,
            item.setId,
            item.classRequirement,
            itemClassLabel(item)
        ].map(normalizeText).join(" ");
    }

    function labelForGlobalRow(row) {
        const item = row.item || {};
        const kind = row.kind === "base" ? "Base" : row.kind === "nonEquippable" ? "Non-equip" : row.kind === "set" ? "Set" : "Unique";
        const baseName = row.baseTypeName || row.baseDisplayName || "";
        const idText = row.kind === "unique" || row.kind === "set"
            ? `uniqueId ${item.uniqueId}`
            : `subTypeID ${row.subTypeID}`;
        const classText = item.classRequirement ? ` — ${itemClassLabel(item)}` : "";
        const noDrop = item.cannotDrop ? " — cannotDrop" : "";
        return `${kind}: ${preferredItemName(item)} [${baseName} ${row.baseTypeID}/${idText}]${classText}${noDrop}`;
    }

    buildAllItemsIndex = function buildAllItemsIndexUnified() {
        const rows = [];

        for (const type of (state.itemTypes || []).filter(visibleType)) {
            for (const item of (type.subItems || [])) {
                rows.push({
                    kind: "base",
                    baseTypeID: type.baseTypeID,
                    baseTypeName: preferredBaseTypeName(type),
                    baseDisplayName: preferredBaseTypeName(type),
                    subTypeID: item.subTypeID,
                    item
                });
            }
        }

        for (const type of (state.nonEquippableItemTypes || []).filter(visibleType)) {
            for (const item of (type.subItems || [])) {
                rows.push({
                    kind: "nonEquippable",
                    baseTypeID: type.baseTypeID,
                    baseTypeName: preferredBaseTypeName(type),
                    baseDisplayName: preferredBaseTypeName(type),
                    subTypeID: item.subTypeID,
                    item
                });
            }
        }

        for (const unique of (state.uniqueItems || [])) {
            const baseTypeID = uniqueBaseTypeID(unique);
            if (!Number.isFinite(baseTypeID)) continue;
            if (typeof isHiddenBaseTypeID === "function" && isHiddenBaseTypeID(baseTypeID)) continue;

            const firstSubtype = uniqueSubtypeIDs(unique)[0] ?? null;
            rows.push({
                kind: unique.isSetItem ? "set" : "unique",
                baseTypeID,
                baseTypeName: unique.baseTypeName || "",
                baseDisplayName: unique.baseTypeName || "",
                subTypeID: firstSubtype,
                item: unique
            });
        }

        return rows;
    };

    populateGlobalItemResults = function populateGlobalItemResultsUnified(query) {
        if (!hasEl("globalItemResults")) return;

        const q = String(query || "").trim().toLowerCase();
        clear(el.globalItemResults);

        const rows = (state.allItems || [])
            .filter(row => !q || rowSearchBlob(row).includes(q))
            .sort((a, b) => labelForGlobalRow(a).localeCompare(labelForGlobalRow(b)))
            .slice(0, 500);

        if (!rows.length) {
            el.globalItemResults.appendChild(option("", "No matching items"));
            return;
        }

        rows.forEach((row, index) => {
            const value = `${row.kind}:${row.baseTypeID}:${row.subTypeID ?? ""}:${row.item.uniqueId ?? ""}:${index}`;
            el.globalItemResults.appendChild(optionWithDataset(
                value,
                labelForGlobalRow(row),
                {
                    kind: row.kind,
                    baseTypeID: row.baseTypeID,
                    subTypeID: row.subTypeID ?? "",
                    uniqueId: row.item.uniqueId ?? ""
                }
            ));
        });
    };

    getSelectedItemType = function getSelectedItemTypeUnified() {
        const raw = getValue("itemTypeSelect", "");
        if (raw === "") return null;
        return (state.itemTypes || []).find(t => Number(t.baseTypeID) === Number(raw)) || null;
    };

    getSelectedItem = function getSelectedItemUnified() {
        const type = getSelectedItemType();
        if (!type) return null;

        const opt = selectedOption();
        if (!opt || !opt.value) return null;

        if (opt.dataset.kind === "unique" || opt.dataset.kind === "set") {
            return findBaseItem(type, opt.dataset.subTypeID) || findBaseItem(type, findCompatibleSubtype(findUniqueByOption(), type));
        }

        return findBaseItem(type, opt.dataset.subTypeID ?? opt.value);
    };

    function makeBrowseOption(kind, label, dataset) {
        const opt = optionWithDataset(`${kind}:${dataset.subTypeID ?? ""}:${dataset.uniqueId ?? ""}`, label, {
            kind,
            baseTypeID: dataset.baseTypeID ?? "",
            subTypeID: dataset.subTypeID ?? "",
            uniqueId: dataset.uniqueId ?? ""
        });
        return opt;
    }

    populateItemTypes = function populateItemTypesUnified() {
        clear(el.itemTypeSelect);
        clear(el.itemSelect);

        el.itemTypeSelect.appendChild(option("", "— Search globally or choose item type —"));
        el.itemSelect.appendChild(option("", "— Choose item type first —"));

        (state.itemTypes || [])
            .filter(visibleType)
            .slice()
            .sort((a, b) => preferredBaseTypeName(a).localeCompare(preferredBaseTypeName(b)))
            .forEach(type => {
                el.itemTypeSelect.appendChild(option(type.baseTypeID, `${preferredBaseTypeName(type)} [baseTypeID ${type.baseTypeID}]`));
            });

        state.selectedSpecialItem = null;
        updateItemInfo();
        populateAffixes();
    };

    populateItems = function populateItemsUnified() {
        const type = getSelectedItemType();
        clear(el.itemSelect);

        if (!type) {
            el.itemSelect.appendChild(option("", "— Choose item type first —"));
            state.selectedSpecialItem = null;
            updateItemInfo();
            populateAffixes();
            return;
        }

        const q = getValue("itemSearch", "").trim().toLowerCase();
        const hideCannotDrop = getChecked("hideCannotDrop", false);
        const rows = [];

        for (const item of (type.subItems || [])) {
            if (hideCannotDrop && item.cannotDrop) continue;
            rows.push({
                kind: "base",
                label: `Base: ${preferredItemName(item)} [subTypeID ${item.subTypeID}]${item.classRequirement ? ` — ${itemClassLabel(item)}` : ""}${item.cannotDrop ? " — cannotDrop" : ""}`,
                search: ["base", preferredItemName(item), item.name, item.slug, item.subTypeID, itemClassLabel(item)].map(normalizeText).join(" "),
                subTypeID: item.subTypeID
            });
        }

        for (const unique of (state.uniqueItems || [])) {
            const baseTypeID = uniqueBaseTypeID(unique);
            if (baseTypeID !== Number(type.baseTypeID)) continue;
            if (hideCannotDrop && unique.canDropRandomly === false) continue;

            const subtypeIDs = uniqueSubtypeIDs(unique);
            const usableSubtypeIDs = subtypeIDs.length ? subtypeIDs : [null];

            for (const subTypeID of usableSubtypeIDs) {
                if (subTypeID !== null && !findBaseItem(type, subTypeID)) continue;
                rows.push({
                    kind: unique.isSetItem ? "set" : "unique",
                    label: `${unique.isSetItem ? "Set" : "Unique"}: ${preferredItemName(unique)} [uniqueId ${unique.uniqueId}${subTypeID !== null ? `/subTypeID ${subTypeID}` : ""}]`,
                    search: [unique.isSetItem ? "set" : "unique", preferredItemName(unique), unique.name, unique.slug, unique.uniqueId, subTypeID, unique.baseTypeName].map(normalizeText).join(" "),
                    subTypeID,
                    uniqueId: unique.uniqueId
                });
            }
        }

        const visibleRows = rows
            .filter(row => !q || row.search.includes(q))
            .sort((a, b) => a.label.localeCompare(b.label));

        el.itemSelect.appendChild(option("", visibleRows.length ? "— Select item —" : "No matching items"));

        for (const row of visibleRows) {
            el.itemSelect.appendChild(makeBrowseOption(row.kind, row.label, {
                baseTypeID: type.baseTypeID,
                subTypeID: row.subTypeID,
                uniqueId: row.uniqueId
            }));
        }

        state.selectedSpecialItem = null;
        updateItemInfo();
        populateAffixes();
    };

    selectGlobalItem = function selectGlobalItemUnified(event) {
        if (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }

        if (!hasEl("globalItemResults")) return;

        const selected = el.globalItemResults.selectedOptions[0];
        if (!selected || !selected.dataset.kind) return;

        const kind = selected.dataset.kind;
        const baseTypeID = Number(selected.dataset.baseTypeID);
        let subTypeID = selected.dataset.subTypeID === "" ? null : Number(selected.dataset.subTypeID);

        state.selectedSpecialItem = null;

        if (kind === "unique" || kind === "set") {
            const unique = findUniqueById(selected.dataset.uniqueId);
            if (!unique) return;
            state.selectedSpecialItem = unique;
            subTypeID = subTypeID ?? findCompatibleSubtype(unique, findEquippableType(baseTypeID));
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

        if (kind === "unique" || kind === "set") {
            const uniqueId = selected.dataset.uniqueId;
            const wanted = [...el.itemSelect.options].find(opt =>
                opt.dataset.kind === kind &&
                String(opt.dataset.uniqueId) === String(uniqueId) &&
                (subTypeID === null || String(opt.dataset.subTypeID) === String(subTypeID))
            );
            if (wanted) wanted.selected = true;
            state.selectedSpecialItem = findUniqueById(uniqueId);
        } else if (kind === "base" && subTypeID !== null && Number.isFinite(subTypeID)) {
            const wanted = [...el.itemSelect.options].find(opt => opt.dataset.kind === "base" && String(opt.dataset.subTypeID) === String(subTypeID));
            if (wanted) wanted.selected = true;
            state.selectedSpecialItem = null;
        }

        updateUniqueControls();
        updateItemInfo();
        populateAffixes();
    };

    function handleBrowseSelection(event) {
        if (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }

        const kind = selectedKind();
        if (kind === "unique" || kind === "set") {
            state.selectedSpecialItem = findUniqueByOption();
        } else {
            state.selectedSpecialItem = null;
        }

        updateUniqueControls();
        updateItemInfo();
        populateAffixes();
    }

    function formatImplicitLine(imp) {
        return `property ${imp.property}, tags ${imp.tags}, type ${imp.type}: ${imp.implicitValue} → ${imp.implicitMaxValue}`;
    }

    updateItemInfo = function updateItemInfoUnified() {
        const type = getSelectedItemType();
        const item = getSelectedItem();
        const unique = state.selectedSpecialItem;

        if (!type || !item) {
            el.itemInfo.textContent = "No item selected.";
            return;
        }

        const classRequirement = unique?.classRequirement || item.classRequirement;
        const cls = classRequirement ? `${CLASS_NAMES[classRequirement] || "Class " + classRequirement} only` : "none / generic";
        const imps = (item.implicits || []).map(formatImplicitLine).join("\n  ");

        if (unique) {
            el.itemInfo.textContent =
`Selected item: ${preferredItemName(unique)}
Kind: ${unique.isSetItem ? "Set" : "Unique"}
uniqueId: ${unique.uniqueId}
Base type: ${preferredBaseTypeName(type)} / baseTypeID ${type.baseTypeID}
Underlying base item: ${preferredItemName(item)} / subTypeID ${item.subTypeID}
Class requirement: ${cls}
Unique level requirement: ${unique.levelRequirement}
Can drop randomly: ${unique.canDropRandomly}
Can drop as legendary: ${unique.canDropAsLegendary}
Effective LP level: ${unique.effectiveLevelForLegendaryPotential}
Mods: ${(unique.mods || []).length}
Slug: ${unique.slug || ""}

Underlying base implicits:
  ${imps || "none"}`;
            return;
        }

        const extraLines = [];
        for (const key of ["name", "effectiveDisplayName", "slug", "cannotDrop", "itemTags"]) {
            if (item[key] !== undefined) extraLines.push(`${key}: ${safeJson(item[key])}`);
        }

        el.itemInfo.textContent =
`Base type: ${preferredBaseTypeName(type)} / baseTypeID ${type.baseTypeID}
Item: ${preferredItemName(item)} / subTypeID ${item.subTypeID}
Class requirement: ${cls}
Level requirement: ${item.levelRequirement}
Max affixes: ${type.maximumAffixes}
Item affixEffectModifier: ${type.affixEffectModifier}
Attack rate: ${item.attackRate}
Added weapon range: ${item.addedWeaponRange}
${extraLines.join("\n")}
Implicits:
  ${imps || "none"}`;
    };

    function installMergedLayout() {
        const cards = [...document.querySelectorAll("main.page > section.card")];
        const searchCard = cards.find(card => card.querySelector("#globalItemSearch"));
        const baseCard = cards.find(card => card.querySelector("#itemTypeSelect"));
        if (!searchCard || !baseCard || searchCard === baseCard) return;

        const title = searchCard.querySelector("h2");
        if (title) title.textContent = "0. Select item";

        const hint = searchCard.querySelector(".hint");
        if (hint) {
            hint.textContent = "Use global search for a specific base, unique, or set item. Or choose an item type below and then select from all base/unique/set items available for that type.";
        }

        const baseTitle = baseCard.querySelector("h2");
        if (baseTitle) baseTitle.textContent = "Browse by item type";

        const browseTitle = document.createElement("h3");
        browseTitle.textContent = "Browse by item type";
        browseTitle.style.marginTop = "22px";

        searchCard.appendChild(browseTitle);

        while (baseCard.firstChild) {
            const child = baseCard.firstChild;
            if (child === baseTitle) {
                baseCard.removeChild(child);
                continue;
            }
            searchCard.appendChild(child);
        }

        baseCard.remove();
    }

    function installCaptureHandlers() {
        if (hasEl("globalItemResults")) {
            el.globalItemResults.addEventListener("change", selectGlobalItem, true);
            el.globalItemResults.addEventListener("dblclick", selectGlobalItem, true);
        }
        if (hasEl("selectGlobalItemBtn")) {
            el.selectGlobalItemBtn.addEventListener("click", selectGlobalItem, true);
        }
        if (hasEl("itemSelect")) {
            el.itemSelect.addEventListener("change", handleBrowseSelection, true);
        }
    }

    window.addEventListener("DOMContentLoaded", () => {
        installMergedLayout();
        installCaptureHandlers();

        // In case the original app finished loading before this overlay patched the functions,
        // normalize the current UI back to the intended empty state.
        setTimeout(() => {
            if (state?.db) {
                state.allItems = buildAllItemsIndex();
                populateGlobalItemResults(getValue("globalItemSearch", ""));
                if (!getValue("itemTypeSelect", "")) populateItemTypes();
                updateUniqueControls();
                updateItemInfo();
            }
        }, 0);
    });
})();
