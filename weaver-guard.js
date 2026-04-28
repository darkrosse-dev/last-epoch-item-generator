// Weaver's Will safety overlay
// This script patches the current generator without changing the large app.js file.
// It disables LP for Weaver's Will uniques and blocks generation until their save layout is decoded.

(function () {
    function isWeaverUniqueLocal(unique) {
        if (!unique) return false;
        return unique.legendaryType === 1 || unique.effectiveLevelForLegendaryPotential === -1;
    }

    function selectedWeaver() {
        try {
            return state && state.selectedSpecialItem && isWeaverUniqueLocal(state.selectedSpecialItem)
                ? state.selectedSpecialItem
                : null;
        } catch {
            return null;
        }
    }

    function displayName(item) {
        try {
            return itemDisplayName(item);
        } catch {
            return item?.effectiveDisplayName || item?.displayName || item?.name || item?.slug || `uniqueId ${item?.uniqueId ?? "unknown"}`;
        }
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
            `Generation is intentionally blocked for Weaver's Will items.\n\n` +
            `Why:\n` +
            `- This item has legendaryType: ${unique.legendaryType}\n` +
            `- effectiveLevelForLegendaryPotential: ${unique.effectiveLevelForLegendaryPotential}\n` +
            `- Weaver's Will items cannot have Legendary Potential.\n` +
            `- They gain random affixes while worn, and their save layout likely contains a Weaver's Will / progression byte or block that is not yet decoded.\n\n` +
            `Needed to enable generation safely:\n` +
            `1. A real save-array for this exact item before it gains any Weaver affixes.\n` +
            `2. The same item with a different Weaver's Will value, if possible.\n` +
            `3. The same item after it gains one Weaver affix.\n\n` +
            `Until then, generating this item could corrupt the byte layout.`;
    }

    function applyWeaverUi() {
        const unique = selectedWeaver();
        if (!unique) return;

        if (typeof el !== "undefined") {
            if (el.uniqueLp) {
                el.uniqueLp.value = "0";
                el.uniqueLp.disabled = true;
            }

            if (el.uniqueModeNotice) {
                el.uniqueModeNotice.textContent =
                    `Weaver's Will item selected: ${displayName(unique)}\n` +
                    `Legendary Potential is disabled. Weaver's Will save layout is not confirmed yet, so generation is blocked for this item type.`;
            }

            if (el.forgingPotentialWrap) {
                el.forgingPotentialWrap.classList.add("hidden");
            }
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
        if (typeof uniqueAllowsLp === "function") {
            const originalUniqueAllowsLp = uniqueAllowsLp;
            uniqueAllowsLp = function (unique) {
                if (isWeaverUniqueLocal(unique)) return false;
                return originalUniqueAllowsLp(unique);
            };
        }

        if (typeof updateUniqueControls === "function") {
            const originalUpdateUniqueControls = updateUniqueControls;
            updateUniqueControls = function () {
                originalUpdateUniqueControls();
                applyWeaverUi();
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
                    el.globalItemResults.addEventListener("change", () => setTimeout(applyWeaverUi, 0));
                    el.globalItemResults.addEventListener("dblclick", () => setTimeout(applyWeaverUi, 0));
                }
            }
        });
    } catch (err) {
        console.error("Failed to install Weaver's Will guard", err);
    }
})();
