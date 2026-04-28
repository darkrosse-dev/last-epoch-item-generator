// Weaver's Will safety overlay
// This script patches the current generator without changing the large app.js file.
// It blocks generation ONLY for the known Weaver's Will uniques listed below.

(function () {
    const WEAVERS_WILL_NAMES = new Set([
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

    function normalizeName(value) {
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
        } catch {
            // Fall through to raw fields.
        }

        return item?.effectiveDisplayName ||
            item?.displayName ||
            item?.name ||
            item?.slug ||
            `uniqueId ${item?.uniqueId ?? "unknown"}`;
    }

    function isWeaverUniqueLocal(unique) {
        // Important: do NOT classify by effectiveLevelForLegendaryPotential === -1.
        // Several normal uniques, for example Fractured Crown, use that value but are not Weaver's Will items.
        return Boolean(unique) && WEAVERS_WILL_NAMES.has(normalizeName(displayName(unique)));
    }

    function selectedUnique() {
        try {
            return state?.selectedSpecialItem || null;
        } catch {
            return null;
        }
    }

    function selectedWeaver() {
        const unique = selectedUnique();
        return isWeaverUniqueLocal(unique) ? unique : null;
    }

    function selectedBaseTypeName() {
        try {
            const t = getSelectedItemType();
            return t?.displayName || t?.baseTypeName || t?.name || "";
        } catch {
            return "";
        }
    }

    function isUniqueIdol(unique) {
        const haystack = normalizeName([
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
        if (isWeaverUniqueLocal(unique)) return false;
        if (isUniqueIdol(unique)) return false;

        // Normal uniques should be usable even when the parsed DB has
        // effectiveLevelForLegendaryPotential: -1 or canHaveLegendaryPotential: false.
        return true;
    }

    function selectedBaseSummary() {
        try {
            const t = getSelectedItemType();
            const item = getSelectedItem();
            return {
                baseTypeID: t?.baseTypeID ?? "unknown",
                subTypeID: item?.subTypeID ?? "unknown"
            };
        } catch {
            return { baseTypeID: "unknown", subTypeID: "unknown" };
        }
    }

    function weaverMessage(unique) {
        const base = selectedBaseSummary();
        return `WEAVER'S WILL ITEM MODE\n` +
            `Selected: ${displayName(unique)}\n` +
            `uniqueId: ${unique.uniqueId}\n` +
            `baseTypeID/subTypeID: ${base.baseTypeID}/${base.subTypeID}\n\n` +
            `Generation is intentionally blocked for this known Weaver's Will item.\n\n` +
            `Why:\n` +
            `- Weaver's Will items cannot have Legendary Potential.\n` +
            `- They gain random affixes while worn, and their save layout likely contains a Weaver's Will / progression byte or block that is not yet decoded.\n\n` +
            `Needed to enable generation safely:\n` +
            `1. A real save-array for this exact item before it gains any Weaver affixes.\n` +
            `2. The same item with a different Weaver's Will value, if possible.\n` +
            `3. The same item after it gains one Weaver affix.\n\n` +
            `Until then, generating this item could corrupt the byte layout.`;
    }

    function applyUniqueUi() {
        const unique = selectedUnique();
        if (!unique || typeof el === "undefined") return;

        const isWeaver = isWeaverUniqueLocal(unique);
        const allowsLp = uniqueAllowsLegendaryPotential(unique);

        if (el.uniqueLp) {
            if (allowsLp) {
                el.uniqueLp.disabled = false;
            } else {
                el.uniqueLp.value = "0";
                el.uniqueLp.disabled = true;
            }
        }

        if (el.uniqueModeNotice) {
            if (isWeaver) {
                el.uniqueModeNotice.textContent =
                    `Weaver's Will item selected: ${displayName(unique)}\n` +
                    `Legendary Potential is disabled. Weaver's Will save layout is not confirmed yet, so generation is blocked for this item type.`;
            } else if (unique.isSetItem) {
                el.uniqueModeNotice.textContent =
                    `Set item selected: ${displayName(unique)}\n` +
                    `Legendary Potential is disabled and forced to 0 for set items.`;
            } else if (isUniqueIdol(unique)) {
                el.uniqueModeNotice.textContent =
                    `Unique idol selected: ${displayName(unique)}\n` +
                    `Legendary Potential is disabled and forced to 0 for unique idols.`;
            } else {
                el.uniqueModeNotice.textContent =
                    `Unique item selected: ${displayName(unique)}\n` +
                    `Legendary Potential can be selected from 0 to 4.`;
            }
        }

        if (el.forgingPotentialWrap) {
            el.forgingPotentialWrap.classList.add("hidden");
        }
    }

    function blockIfWeaver(event) {
        const unique = selectedWeaver();
        if (!unique) return false;

        if (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }

        if (typeof el !== "undefined") {
            if (el.output) el.output.value = "";
            if (el.preview) el.preview.textContent = weaverMessage(unique);
        }

        alert("Weaver's Will item generation is blocked until its save layout is decoded.");
        return true;
    }

    try {
        // Replace the broad DB-driven LP check with explicit rules:
        // set items: no LP, known Weaver's Will: no LP, unique idols: no LP, other uniques: LP allowed.
        if (typeof uniqueAllowsLp === "function") {
            uniqueAllowsLp = uniqueAllowsLegendaryPotential;
        }

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
                if (isWeaverUniqueLocal(unique)) {
                    if (typeof el !== "undefined") {
                        if (el.output) el.output.value = "";
                        if (el.preview) el.preview.textContent = weaverMessage(unique);
                    }
                    alert("Weaver's Will item generation is blocked until its save layout is decoded.");
                    return;
                }
                return originalGenerateUnique(t, item, unique);
            };
        }

        window.addEventListener("DOMContentLoaded", () => {
            if (typeof el !== "undefined") {
                if (el.generateBtn) {
                    el.generateBtn.addEventListener("click", blockIfWeaver, true);
                }

                if (el.globalItemResults) {
                    el.globalItemResults.addEventListener("change", () => setTimeout(applyUniqueUi, 0));
                    el.globalItemResults.addEventListener("dblclick", () => setTimeout(applyUniqueUi, 0));
                }
            }

            setTimeout(applyUniqueUi, 0);
        });
    } catch (err) {
        console.error("Failed to install Weaver's Will guard", err);
    }
})();
