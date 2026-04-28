// Item type filter overlay
// Hides unsupported/generated-only item categories from item type dropdown and global search.
//
// Hidden:
// - Blessing [baseTypeID 34]
// - Eos Lens [baseTypeID 38]
// - Dysis Lens [baseTypeID 39]
// - Mesembria Lens [baseTypeID 37]
// - Arctus Lens [baseTypeID 36]
// - Greater Lens [baseTypeID 35]

(function () {
    const HIDDEN_BASE_TYPE_IDS = new Set([
        34, // Blessing
        38, // Eos Lens
        39, // Dysis Lens
        37, // Mesembria Lens
        36, // Arctus Lens
        35  // Greater Lens
    ]);

    function isHiddenBaseTypeID(baseTypeID) {
        return HIDDEN_BASE_TYPE_IDS.has(Number(baseTypeID));
    }

    window.isHiddenBaseTypeID = isHiddenBaseTypeID;

    function visibleItemTypes() {
        return (state.itemTypes || []).filter(t => !isHiddenBaseTypeID(t.baseTypeID));
    }

    function visibleNonEquippableTypes() {
        return (state.nonEquippableItemTypes || []).filter(t => !isHiddenBaseTypeID(t.baseTypeID));
    }

    buildAllItemsIndex = function buildAllItemsIndexFiltered() {
        const rows = [];

        for (const type of visibleItemTypes()) {
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

        for (const type of visibleNonEquippableTypes()) {
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

        for (const u of (state.uniqueItems || [])) {
            const baseTypeID = u.baseTypeID ?? u.baseType;
            if (isHiddenBaseTypeID(baseTypeID)) continue;

            const firstSubtype = Array.isArray(u.subTypeIDs) && u.subTypeIDs.length ? u.subTypeIDs[0] : null;
            rows.push({
                kind: u.isSetItem ? "set" : "unique",
                baseTypeID,
                baseTypeName: u.baseTypeName || "",
                baseDisplayName: u.baseTypeName || "",
                subTypeID: firstSubtype,
                item: u
            });
        }

        return rows;
    };

    populateItemTypes = function populateItemTypesFiltered() {
        clear(el.itemTypeSelect);

        visibleItemTypes()
            .slice()
            .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)))
            .forEach(t => {
                el.itemTypeSelect.appendChild(option(t.baseTypeID, `${t.displayName} [baseTypeID ${t.baseTypeID}]`));
            });

        populateItems();
    };

    const originalFindEquippableType = findEquippableType;
    findEquippableType = function findEquippableTypeFiltered(baseTypeID) {
        if (isHiddenBaseTypeID(baseTypeID)) return undefined;
        return originalFindEquippableType(baseTypeID);
    };
})();
