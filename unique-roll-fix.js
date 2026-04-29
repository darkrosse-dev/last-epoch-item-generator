// Unique roll-byte allocation fix
// Some uniques, such as Wrongwarp, have fewer than four explicit roll slots in the DB.
// The save layout still appears to reserve at least 8 roll bytes before LP.
// Without those padding bytes, LP/remaining data shifts and the game may misread the unique.

(function () {
    function getUniqueRollSlotCount(unique) {
        let maxRollID = -1;

        for (const mod of (unique?.mods || [])) {
            const rollID = Number(mod.rollID);
            if (!Number.isFinite(rollID) || rollID < 0) continue;

            // Count regular rollable mods and also fixed-looking mods that still
            // have a roll range in the DB, such as Wrongwarp's movement-speed scaling mod.
            const hasStoredRange = Number(mod.maxValue || 0) !== 0 && Number(mod.maxValue) !== Number(mod.value || 0);
            if (mod.canRoll || hasStoredRange) {
                maxRollID = Math.max(maxRollID, rollID);
            }
        }

        const detectedSlots = maxRollID >= 0 ? maxRollID + 1 : 0;

        // Observed working uniques reserve at least 4 roll slots = 8 bytes.
        // Examples: The Fang 0 LP, Whetstone Gavel, Wall of Nothing.
        return Math.max(4, detectedSlots);
    }

    function buildFixedUniqueRollBytes(unique) {
        const slotCount = getUniqueRollSlotCount(unique);
        const mode = typeof getValue === "function" ? getValue("uniqueRollMode", "random") : "random";
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

    function installUniqueRollFix() {
        window.uniqueVariableRollCount = getUniqueRollSlotCount;
        window.buildUniqueRollBytes = buildFixedUniqueRollBytes;
    }

    installUniqueRollFix();
    window.addEventListener("DOMContentLoaded", () => {
        installUniqueRollFix();
        setTimeout(installUniqueRollFix, 0);
        setTimeout(installUniqueRollFix, 300);
    });
})();
