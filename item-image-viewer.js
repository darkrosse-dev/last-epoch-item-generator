// Item image viewer overlay
// Uses data/item_images.json or data/item_image_manifest/item_images.json,
// then displays selected item image from assets/items/base|unique|set.

(function () {
    const MANIFEST_PATHS = [
        "./data/item_images.json?v=1",
        "./data/item_image_manifest/item_images.json?v=1"
    ];

    let imageManifest = null;

    function installImageStyles() {
        if (document.getElementById("item-image-viewer-styles")) return;

        const style = document.createElement("style");
        style.id = "item-image-viewer-styles";
        style.textContent = `
            .itemImagePanel {
                display: flex;
                align-items: center;
                gap: 14px;
                margin: 14px 0;
                padding: 12px 14px;
                border: 1px solid rgba(148, 163, 184, 0.25);
                border-radius: 14px;
                background: rgba(15, 23, 42, 0.45);
            }

            .itemImagePanel.hidden {
                display: none;
            }

            .itemImageFrame {
                width: 74px;
                height: 74px;
                flex: 0 0 74px;
                display: grid;
                place-items: center;
                border-radius: 12px;
                background: rgba(2, 6, 23, 0.45);
                border: 1px solid rgba(148, 163, 184, 0.2);
            }

            .itemImageFrame img {
                max-width: 64px;
                max-height: 64px;
                object-fit: contain;
            }

            .itemImageText {
                display: flex;
                flex-direction: column;
                gap: 4px;
                color: #cbd5e1;
                font-size: 13px;
                line-height: 1.35;
            }

            .itemImageText strong {
                color: #f8fafc;
                font-size: 15px;
            }

            .itemImagePath {
                color: #94a3b8;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 12px;
                word-break: break-all;
            }
        `;

        document.head.appendChild(style);
    }

    async function loadImageManifest() {
        for (const url of MANIFEST_PATHS) {
            try {
                const res = await fetch(url, { cache: "no-store" });
                if (!res.ok) continue;

                imageManifest = await res.json();
                console.log(`Loaded item image manifest: ${url}`);
                return;
            } catch {
                // Try next path.
            }
        }

        console.warn("Item image manifest not found.");
    }

    function ensureImagePanel() {
        let panel = document.getElementById("itemImagePanel");
        if (panel) return panel;

        const itemInfo = document.getElementById("itemInfo");
        if (!itemInfo || !itemInfo.parentElement) return null;

        panel = document.createElement("div");
        panel.id = "itemImagePanel";
        panel.className = "itemImagePanel hidden";
        panel.innerHTML = `
            <div class="itemImageFrame">
                <img id="itemImagePreview" alt="" />
            </div>
            <div class="itemImageText">
                <strong id="itemImageName">No image selected</strong>
                <span id="itemImageKind"></span>
                <span id="itemImagePath" class="itemImagePath"></span>
            </div>
        `;

        itemInfo.parentElement.insertBefore(panel, itemInfo);
        return panel;
    }

    function normalizeLocalPath(record) {
        if (!record) return "";

        let localPath = record.localPath || "";

        // Support the newer manifest structure too, even though your actual files
        // are currently under assets/items.
        if (localPath.startsWith("data/item_image_manifest/items/")) {
            localPath = localPath.replace("data/item_image_manifest/items/", "assets/items/");
        }

        if (!localPath && record.imageFile) {
            const kind = record.kind === "set" ? "set" : record.kind === "unique" ? "unique" : "base";
            localPath = `assets/items/${kind}/${record.imageFile}`;
        }

        if (!localPath) return "";

        return "./" + localPath.replace(/^\.?\//, "");
    }

    function getSelectedImageRecord() {
        if (!imageManifest) return null;

        const lookup = imageManifest.lookup || {};

        try {
            const unique = state?.selectedSpecialItem;

            if (unique && unique.uniqueId !== undefined) {
                const uniqueId = Number(unique.uniqueId);

                return (
                    lookup[`unique:${uniqueId}`] ||
                    lookup[`set:${uniqueId}`] ||
                    null
                );
            }

            const type = getSelectedItemType();
            const item = getSelectedItem();

            if (!type || !item) return null;

            return lookup[`base:${type.baseTypeID}:${item.subTypeID}`] || null;
        } catch {
            return null;
        }
    }

    function renderSelectedItemImage() {
        const panel = ensureImagePanel();
        if (!panel) return;

        const img = document.getElementById("itemImagePreview");
        const name = document.getElementById("itemImageName");
        const kind = document.getElementById("itemImageKind");
        const pathText = document.getElementById("itemImagePath");

        const record = getSelectedImageRecord();
        const src = normalizeLocalPath(record);

        if (!record || !src) {
            panel.classList.add("hidden");
            return;
        }

        panel.classList.remove("hidden");

        img.onload = () => {
            panel.classList.remove("hidden");
        };

        img.onerror = () => {
            panel.classList.add("hidden");
            console.warn("Item image failed to load:", src);
        };

        img.src = src;
        img.alt = record.name || "Item image";

        name.textContent = record.name || "Selected item";
        kind.textContent = `${record.kind || "item"} image`;
        pathText.textContent = src;
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