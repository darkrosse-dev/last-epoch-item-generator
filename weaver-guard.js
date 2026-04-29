// Unique safety overlay
// Blocks only unique formats that are not safely decoded yet:
// 1) known Weaver's Will uniques
// 2) explicitly listed special legendary-drop uniques such as Exulis

(function () {
    const WEAVER_NAMES = new Set([
        "advent of the erased",
        "ambitions of an erased acolyte",
        "blight of lachesis",
        "clotho's needle",
        "code of an erased sentinel",
        "communion of the erased",
        "cradle of the erased",
        "dedication of an erased primalist",
        "essence weaver",
        "font of the erased",
        "gambit of an erased rogue",
        "inheritance of the erased",
        "knowledge of an erased mage",
        "nest of nightmares",
        "orb weaver's fang",
        "scissor of atropos",
        "swaddling of the erased",
        "weaver's gift"
    ]);

    const SPECIAL_LEGENDARY_NAMES = new Set([
        "exulis"
    ]);

    function cleanName(value) {
        return String(value || "")
            .replace(/[’`]/g, "'")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    function displayName(item) {
        try {
            const name = itemDisplayName(item);
            if (name) return name;
        } catch {}

        return item?.effectiveDisplayName || item?.displayName || item?.name || item?.slug || `uniqueId ${item?.uniqueId ?? "unknown"}`;
    }

    function selectedUnique() {
        try { return state?.selectedSpecialItem || null; } catch { return null; }
    }

    function isWeaver(unique) {
        return Boolean(unique) && WEAVER_NAMES.has(cleanName(displayName(unique)));
    }

    function isSpecialLegendary(unique) {
        // Important: do NOT infer this from droppableLegendaryAffixCount or canDropAsLegendary.
        // Many normal uniques have those DB fields populated but still work with the current generator.
        // For now, block only explicitly confirmed broken special-layout items.
        return Boolean(unique && !unique.isSetItem && SPECIAL_LEGENDARY_NAMES.has(cleanName(displayName(unique))));
    }

    function selectedBaseTypeName() {
        try {
            const t = getSelectedItemType();
            return t?.displayName || t?.baseTypeName || t?.name || "";
        } catch { return ""; }
    }

    function isUniqueIdol(unique) {
        const haystack = cleanName([
            displayName(unique),
            unique?.baseTypeName,
            unique?.baseDisplayName,
            unique?.itemTypeName,
            unique?.typeName,
            unique?.category,
            selectedBaseTypeName()
        ].filter(Boolean).join(" "));
        return /\bidol\b/.test(haystack);
    }

    function uniqueAllowsLegendaryPotential(unique) {
        if (!unique) return false;
        if (unique.isSetItem) return false;
        if (isWeaver(unique)) return false;
        if (isSpecialLegendary(unique)) return false;
        if (isUniqueIdol(unique)) return false;
        return true;
    }

    function baseSummary() {
        try {
            const t = getSelectedItemType();
            const item = getSelectedItem();
            return `${t?.baseTypeID ?? "unknown"}/${item?.subTypeID ?? "unknown"}`;
        } catch { return "unknown/unknown"; }
    }

    function blockedMessage(unique) {
        if (isWeaver(unique)) {
            return `WEAVER'S WILL ITEM MODE\nSelected: ${displayName(unique)}\nuniqueId: ${unique.uniqueId}\nbaseTypeID/subTypeID: ${baseSummary()}\n\nGeneration is blocked for this known Weaver's Will item.\n\nWhy:\n- Weaver's Will items cannot have Legendary Potential.\n- They gain random affixes while worn.\n- Their save layout is not decoded yet.\n\nNeeded to enable generation safely:\n1. A real save-array before it gains Weaver affixes.\n2. The same item with a different Weaver's Will value.\n3. The same item after it gains one Weaver affix.`;
        }

        return `SPECIAL LEGENDARY UNIQUE - GENERATION BLOCKED\nSelected: ${displayName(unique)}\nuniqueId: ${unique.uniqueId}\nbaseTypeID/subTypeID: ${baseSummary()}\n\nThis item appears to use a special legendary-drop layout, not the normal Unique + LP layout.\n\nWhy it is blocked:\n- This item was confirmed to generate incorrectly with the normal unique generator.\n- Generating it as a normal LP unique can make the game interpret it as the wrong unique, for example Calamity.\n\nNeeded to enable generation safely:\n1. A real save-array for this exact item.\n2. Ideally another copy with different special legendary affixes.\n3. Then we can decode where those special affix bytes are stored.`;
    }

    function blockedUnique() {
        const unique = selectedUnique();
        return unique && (isWeaver(unique) || isSpecialLegendary(unique)) ? unique : null;
    }

    function applyUniqueUi() {
        const unique = selectedUnique();
        if (!unique || typeof el === "undefined") return;

        const blocked = isWeaver(unique) || isSpecialLegendary(unique);
        const allowsLp = uniqueAllowsLegendaryPotential(unique);

        if (el.uniqueLp) {
            if (allowsLp) el.uniqueLp.disabled = false;
            else {
                el.uniqueLp.value = "0";
                el.uniqueLp.disabled = true;
            }
        }

        if (el.uniqueModeNotice) {
            if (isWeaver(unique)) {
                el.uniqueModeNotice.textContent = `Weaver's Will item selected: ${displayName(unique)}\nLegendary Potential is disabled. Generation is blocked until the Weaver's Will layout is decoded.`;
            } else if (isSpecialLegendary(unique)) {
                el.uniqueModeNotice.textContent = `Special legendary unique selected: ${displayName(unique)}\nGeneration is blocked until its special legendary-affix save layout is decoded.`;
            } else if (unique.isSetItem) {
                el.uniqueModeNotice.textContent = `Set item selected: ${displayName(unique)}\nLegendary Potential is disabled and forced to 0 for set items.`;
            } else if (isUniqueIdol(unique)) {
                el.uniqueModeNotice.textContent = `Unique idol selected: ${displayName(unique)}\nLegendary Potential is disabled and forced to 0 for unique idols.`;
            } else {
                el.uniqueModeNotice.textContent = `Unique item selected: ${displayName(unique)}\nLegendary Potential can be selected from 0 to 4.`;
            }
        }

        if (blocked && el.forgingPotentialWrap) el.forgingPotentialWrap.classList.add("hidden");
    }

    function blockIfNeeded(event) {
        const unique = blockedUnique();
        if (!unique) return false;

        if (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }

        if (typeof el !== "undefined") {
            if (el.output) el.output.value = "";
            if (el.preview) el.preview.textContent = blockedMessage(unique);
        }

        alert(`${displayName(unique)} is blocked until its save layout is decoded.`);
        return true;
    }

    try {
        if (typeof uniqueAllowsLp === "function") uniqueAllowsLp = uniqueAllowsLegendaryPotential;

        if (typeof updateUniqueControls === "function") {
            const originalUpdateUniqueControls = updateUniqueControls;
            updateUniqueControls = function () {
                originalUpdateUniqueControls();
                applyUniqueUi();
            };
        }

        if (typeof generateUnique === "function") {
            const originalGenerateUnique = generateUnique;
            generateUnique = function (t, item, unique) {
                if (unique && (isWeaver(unique) || isSpecialLegendary(unique))) {
                    if (typeof el !== "undefined") {
                        if (el.output) el.output.value = "";
                        if (el.preview) el.preview.textContent = blockedMessage(unique);
                    }
                    alert(`${displayName(unique)} is blocked until its save layout is decoded.`);
                    return;
                }
                return originalGenerateUnique(t, item, unique);
            };
        }

        window.addEventListener("DOMContentLoaded", () => {
            if (typeof el !== "undefined") {
                el.generateBtn?.addEventListener("click", blockIfNeeded, true);
                el.globalItemResults?.addEventListener("change", () => setTimeout(applyUniqueUi, 0));
                el.globalItemResults?.addEventListener("dblclick", () => setTimeout(applyUniqueUi, 0));
                el.itemSelect?.addEventListener("change", () => setTimeout(applyUniqueUi, 0));
            }
            setTimeout(applyUniqueUi, 0);
        });
    } catch (err) {
        console.error("Failed to install unique safety guard", err);
    }
})();
