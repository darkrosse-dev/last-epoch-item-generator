// Item image viewer overlay
// Shows selected item image from assets/items/base|unique|set.
// Uses an optional manifest when available, but can also fall back to image fields from the loaded item DB.

(function () {
    const MANIFEST_PATHS = [
        "./data/item_images.json?v=1",
        "./data/item_image_manifest/item_images.json?v=1"
    ];

    const ASSET_ROOT = "assets/items";
    let imageManifest = null;

    function installImageStyles() {
        if (document.getElementById("item-image-viewer-styles")) return;

        const style = document.createElement("style");
        style.id = "item-image-viewer-styles";
        style.textContent = `
            .itemMetaRow {
                display: grid;
                grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
                gap: 18px;
                align-items: stretch;
                margin: 14px 0;
            }

            .itemMetaRow > .itemInfo {
                margin: 0;
                min-height: 260px;
            }

            .itemImagePanel {
                min-height: 260px;
                margin: 0;
                padding: 18px;
                border: 1px solid rgba(148, 163, 184, 0.25);
                border-radius: 14px;
                background: rgba(15, 23, 42, 0.45);
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .itemImagePanel.hidden {
                display: none;
            }

            .itemMetaRow:has(.itemImagePanel.hidden) {
                grid-template-columns: 1fr;
            }

            .itemImageFrame {
                width: 100%;
                height: 100%;
                min-height: 220px;
                display: grid;
                place-items: center;
                border-radius: 12px;
                background: rgba(2, 6, 23, 0.28);
                border: 1px solid rgba(148, 163, 184, 0.16);
            }

            .itemImageFrame img {
                max-width: 240px;
                max-height: 240px;
                width: auto;
                height: auto;
                object-fit: contain;
                image-rendering: auto;
                display: block;
            }

            .itemImageText,
            .itemImagePath,
            #itemImageName,
            #itemImageKind,
            #itemImagePath {
                display: none !important;
            }

            @media (max-width: 900px) {
                .itemMetaRow {
                    grid-template-columns: 1fr;
                }

                .itemImagePanel {
                    min-height: 220px;
                }

                .itemImageFrame img {
                    max-width: 220px;
                    max-height: 220px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    async function loadImageManifest() {
        for (const url of MANIFEST_PATHS) {
            try {
                const res = await fetch(url, { cache: "no-store" });
                if (!res.ok) continue;

                const text = await res.text();
                if (!text.trim()) continue;

                imageManifest = JSON.parse(text);
                console.log(`Loaded item image manifest: ${url}`);
                return;
            } catch (err) {
                console.warn(`Skipped item image manifest ${url}:`, err);
            }
        }

        console.warn("Item image manifest not found or empty; using DB image fields when available.");
    }

    function ensureImagePanel() {
        const itemInfo = document.getElementById("itemInfo");
        if (!itemInfo || !itemInfo.parentElement) return null;

        let row = document.getElementById("itemMetaRow");
        if (!row) {
            row = document.createElement("div");
            row.id = "itemMetaRow";
            row.className = "itemMetaRow";
            itemInfo.parentElement.insertBefore(row, itemInfo);
            row.appendChild(itemInfo);
        }

        let panel = document.getElementById("itemImagePanel");
        if (!panel) {
            panel = document.createElement("div");
            panel.id = "itemImagePanel";
            panel.className = "itemImagePanel hidden";
            panel.innerHTML = `
                <div class="itemImageFrame">
                    <img id="itemImagePreview" alt="" />
                </div>
            `;
        }

        if (panel.parentElement !== row) {
            row.insertBefore(panel, itemInfo);
        }

        return panel;
    }

    function normalizeImageFile(value) {
        if (typeof value !== "string") return "";

        const trimmed = value.trim();
        if (!trimmed) return "";

        return trimmed
            .split("?")[0]
            .split("#")[0]
            .split("/")
            .pop()
            .split("\\")
            .pop();
    }

    function imageFileFromRecord(record) {
        if (!record) return "";

        const candidates = [
            record.imageFile,
            record.image,
            record.icon,
            record.iconFile,
            record.iconName,
            record.itemIcon,
            record.inventoryIcon,
            record.sprite,
            record.spriteName,
            record.texture,
            record.textureName,
            record.tooltipImage,
            record.inventoryImage
        ];

        for (const candidate of candidates) {
            const file = normalizeImageFile(candidate);
            if (file) return file;
        }

        return "";
    }

    function kindForUnique(unique) {
        return unique?.isSetItem ? "set" : "unique";
    }

    function makeLocalPath(kind, imageFile) {
        if (!imageFile) return "";
        const safeKind = ["base", "unique", "set"].includes(kind) ? kind : "base";
        return `${ASSET_ROOT}/${safeKind}/${imageFile}`;
    }

    function normalizeLocalPath(record) {
        if (!record) return "";

        let localPath = record.localPath || "";

        if (localPath.startsWith("data/item_image_manifest/items/")) {
            localPath = localPath.replace("data/item_image_manifest/items/", `${ASSET_ROOT}/`);
        }

        if (!localPath) {
            const imageFile = imageFileFromRecord(record);
            if (imageFile) {
                const kind = record.kind === "set" ? "set" : record.kind === "unique" ? "unique" : "base";
                localPath = makeLocalPath(kind, imageFile);
            }
        }

        if (!localPath) return "";

        return "./" + String(localPath).replace(/^\.?\//, "");
    }

    function resolveLookup(value) {
        if (!value) return null;
        if (typeof value === "object") return value;

        if (Number.isInteger(value) && imageManifest?.items?.[value]) {
            return imageManifest.items[value];
        }

        if (typeof value === "string") {
            if (imageManifest?.items) {
                const found = imageManifest.items.find(item =>
                    item.localPath === value ||
                    item.imageFile === value ||
                    item.slug === value
                );

                if (found) return found;
            }

            return { localPath: value };
        }

        return null;
    }

    function manifestLookup(keys) {
        const lookup = imageManifest?.lookup || {};

        for (const key of keys) {
            const record = resolveLookup(lookup[key]);
            if (record) return record;
        }

        return null;
    }

    function dbFallbackRecord() {
        try {
            const unique = state?.selectedSpecialItem;

            if (unique && unique.uniqueId !== undefined) {
                const imageFile = imageFileFromRecord(unique);
                if (!imageFile) return null;

                const kind = kindForUnique(unique);
                return {
                    kind,
                    name: itemDisplayName(unique),
                    uniqueId: unique.uniqueId,
                    imageFile,
                    localPath: makeLocalPath(kind, imageFile)
                };
            }

            const type = getSelectedItemType();
            const item = getSelectedItem();

            if (!type || !item) return null;

            const imageFile = imageFileFromRecord(item);
            if (!imageFile) return null;

            return {
                kind: "base",
                name: itemDisplayName(item),
                baseTypeID: type.baseTypeID,
                subTypeID: item.subTypeID,
                imageFile,
                localPath: makeLocalPath("base", imageFile)
            };
        } catch {
            return null;
        }
    }

    function getSelectedImageRecord() {
        try {
            const unique = state?.selectedSpecialItem;

            if (unique && unique.uniqueId !== undefined) {
                const uniqueId = Number(unique.uniqueId);
                const fromManifest = manifestLookup([
                    `unique:${uniqueId}`,
                    `set:${uniqueId}`
                ]);

                return fromManifest || dbFallbackRecord();
            }

            const type = getSelectedItemType();
            const item = getSelectedItem();

            if (type && item) {
                const fromManifest = manifestLookup([
                    `base:${type.baseTypeID}:${item.subTypeID}`
                ]);

                return fromManifest || dbFallbackRecord();
            }

            return dbFallbackRecord();
        } catch {
            return null;
        }
    }

    function renderSelectedItemImage() {
        const panel = ensureImagePanel();
        if (!panel) return;

        const img = document.getElementById("itemImagePreview");
        const record = getSelectedImageRecord();
        const src = normalizeLocalPath(record);

        if (!record || !src || !img) {
            panel.classList.add("hidden");
            return;
        }

        img.onload = () => {
            panel.classList.remove("hidden");
        };

        img.onerror = () => {
            panel.classList.add("hidden");
            console.warn("Item image failed to load:", src);
        };

        img.src = src;
        img.alt = record.name || "Item image";
    }

    function patchUiRefresh() {
        if (typeof updateItemInfo === "function") {
            const originalUpdateItemInfo = updateItemInfo;
            updateItemInfo = function () {
                originalUpdateItemInfo();
                setTimeout(renderSelectedItemImage, 0);
            };
        }

        if (typeof updateUniqueControls === "function") {
            const originalUpdateUniqueControls = updateUniqueControls;
            updateUniqueControls = function () {
                originalUpdateUniqueControls();
                setTimeout(renderSelectedItemImage, 0);
            };
        }
    }

    window.addEventListener("DOMContentLoaded", async () => {
        installImageStyles();
        patchUiRefresh();

        await loadImageManifest();

        const watched = [
            "itemTypeSelect",
            "itemSelect",
            "globalItemResults",
            "selectGlobalItemBtn",
            "clearGlobalSearchBtn"
        ];

        for (const id of watched) {
            const node = document.getElementById(id);
            if (!node) continue;

            node.addEventListener("change", () => setTimeout(renderSelectedItemImage, 0));
            node.addEventListener("click", () => setTimeout(renderSelectedItemImage, 0));
            node.addEventListener("dblclick", () => setTimeout(renderSelectedItemImage, 0));
        }

        setTimeout(renderSelectedItemImage, 100);
    });
})();
