// LOGOUT CONFIRMATION
const logoutButton = document.querySelector(".logout");

if (logoutButton) {
    logoutButton.addEventListener("click", function (event) {

        const confirmLogout = confirm("Are you sure you want to logout?");

        if (!confirmLogout) {
            event.preventDefault();
        }

    });
}
// PHOTO CARD CLICK
const photoCards = document.querySelectorAll(".photo-card");

photoCards.forEach(function (card) {

    card.addEventListener("click", function () {

        const image = card.querySelector("img");

        if (image) {
            console.log("Photo clicked:", image.alt);
        }

    });

});
// =========================
// OPEN IMAGE
// =========================

function openImage(image) {

    const modal = document.getElementById("imageModal");
    const bigImage = document.getElementById("bigImage");

    bigImage.src = image.src;

    modal.classList.add("show");
}


// =========================
// CLOSE IMAGE
// =========================

function closeImage() {

    const modal = document.getElementById("imageModal");

    modal.classList.remove("show");
}
// =========================
// THREE DOT MENU
// =========================

function toggleMenu(button) {

    const menu = button.nextElementSibling;

    // Close all other menus
    document.querySelectorAll(".menu-dropdown").forEach(function (item) {

        if (item !== menu) {
            item.classList.remove("show");
        }

    });

    // Toggle current menu
    menu.classList.toggle("show");
}


// =========================
// CLOSE MENU WHEN CLICKING OUTSIDE
// =========================

document.addEventListener("click", function (event) {

    if (!event.target.closest(".photo-menu")) {

        document.querySelectorAll(".menu-dropdown").forEach(function (menu) {

            menu.classList.remove("show");

        });

    }

});


// =========================
// RENAME PHOTO
// =========================

function renamePhoto(filename, button) {

    const newName = prompt(
        "Enter new name:",
        filename.substring(0, filename.lastIndexOf(".")) || filename
    );

    if (!newName || newName.trim() === "") {
        return;
    }

    const form = document.createElement("form");

    form.method = "POST";

    form.action =
        "/rename/" + encodeURIComponent(filename);


    const input = document.createElement("input");

    input.type = "hidden";

    input.name = "new_name";

    input.value = newName.trim();


    form.appendChild(input);

    document.body.appendChild(form);

    form.submit();
}
// =========================
// THEME TOGGLE
// =========================

function applyTheme(theme) {

    if (theme === "terminal") {
        document.body.setAttribute("data-theme", "terminal");
    } else {
        document.body.removeAttribute("data-theme");
    }

    const btn = document.getElementById("themeToggleBtn");

    if (btn) {
        btn.textContent = theme === "terminal" ? "🌌 " : "🖥️ ";
    }
}

function toggleTheme() {

    const current = document.body.getAttribute("data-theme");

    const next = current === "terminal" ? "normal" : "terminal";

    localStorage.setItem("vaultTheme", next);

    applyTheme(next);
}

// Apply saved theme on page load
const savedTheme = localStorage.getItem("vaultTheme") || "normal";

applyTheme(savedTheme);


// =========================
// CHAT
// =========================
// Only runs on the chat page (chatWindow only exists there),
// so this is safe to include in the shared script.js file.
// =========================

const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

if (chatWindow && chatForm && chatInput) {

    let lastMessageCount = 0;

    let avatarUrls = {};
    let avatarThumbCache = {};

    async function loadAvatarUrls() {
        try {
            const res = await fetch("/api/avatars");
            const data = await res.json();
            avatarUrls = data.avatars || {};
            console.log("Loaded avatarUrls:", avatarUrls);
            fillAvatarThumbs();
        } catch (e) {
            console.log("Avatar list fetch error:", e);
        }
    }

    function generateAvatarThumb(identityName, callback) {

        if (avatarThumbCache[identityName]) {
            callback(avatarThumbCache[identityName]);
            return;
        }

        const url = avatarUrls[identityName];

        if (!url) {
            callback(null);
            return;
        }

        const size = 60;
        const canvas = document.createElement("canvas");

        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true
        });
        renderer.setSize(size, size);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
        camera.position.set(0, 1.6, 2.2);

        const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
        scene.add(light);

        const loader = new THREE.GLTFLoader();

        loader.load(url, function (gltf) {

            const model = gltf.scene;
            model.position.y = -1.6;
            scene.add(model);

            renderer.render(scene, camera);

            const dataUrl = canvas.toDataURL("image/png");

            avatarThumbCache[identityName] = dataUrl;

            callback(dataUrl);

        }, undefined, function () {
            callback(null);
        });
    }

    function fillAvatarThumbs() {

        const uniqueSenders = new Set();

        document.querySelectorAll(".chat-avatar[data-sender]").forEach(function (el) {
            uniqueSenders.add(el.getAttribute("data-sender"));
        });

        console.log("Unique senders found in chat:", Array.from(uniqueSenders));
        console.log("Current avatarUrls map:", avatarUrls);

        uniqueSenders.forEach(function (sender) {

            console.log("Looking up avatar for sender:", JSON.stringify(sender), "-> found:", avatarUrls[sender]);

            generateAvatarThumb(sender, function (dataUrl) {

                console.log("generateAvatarThumb callback for", sender, "-> dataUrl is", dataUrl ? "SET" : "NULL");

                if (!dataUrl) return;

                document.querySelectorAll(`.chat-avatar[data-sender="${sender}"]`).forEach(function (el) {
                    el.style.backgroundImage = `url(${dataUrl})`;
                    el.classList.add("has-avatar");
                });
            });
        });
    }
    loadAvatarUrls();

    const scrollBtn = document.getElementById("scrollToBottomBtn");

    function isNearBottom() {
        return chatWindow.scrollHeight - chatWindow.scrollTop - chatWindow.clientHeight < 120;
    }

    function scrollChatToBottom(force) {

        if (force || isNearBottom()) {
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }

        if (scrollBtn) scrollBtn.classList.remove("show");
    }

    chatWindow.addEventListener("scroll", function () {

        if (scrollBtn) {
            scrollBtn.classList.toggle("show", !isNearBottom());
        }

    });

    function buildAttachmentHtml(attachment) {

        if (!attachment) return "";

        if (attachment.type === "image") {
            return `<img src="${attachment.url}" class="chat-attachment-image" alt="${attachment.filename}" onclick="window.open('${attachment.url}', '_blank')">`;
        }

        return `
            <a href="${attachment.url}" target="_blank" class="chat-attachment-file">
                <span class="chat-attachment-file-icon">📄</span>
                <span class="chat-attachment-file-name">${attachment.filename}</span>
            </a>
        `;
    }

    let renderedMessageIds = new Set();
    let lastRenderedDateLabel = null;

    function buildBubbleHtml(msg, forceDateLabel) {

        const rowClass = msg.sender === CURRENT_IDENTITY ? "mine" : "theirs";

        const initial = (msg.sender || "?").charAt(0).toUpperCase();

        const safeText = (msg.text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        const deleteButton = msg.sender === CURRENT_IDENTITY
            ? `<button type="button" class="chat-delete-button" onclick="deleteMessage('${msg.id}')">🗑</button>`
            : "";

        const attachmentHtml = buildAttachmentHtml(msg.attachment);

        const textHtml = safeText
            ? `<div class="chat-bubble-text">${safeText}</div>`
            : "";

        const dateLabel = (msg.timestamp || "").split(",")[0];

        let divider = "";

        if (forceDateLabel || dateLabel !== lastRenderedDateLabel) {
            divider = `<div class="chat-date-divider">${dateLabel}</div>`;
            lastRenderedDateLabel = dateLabel;
        }

        return `
            ${divider}
            <div class="chat-bubble-row ${rowClass}" data-message-id="${msg.id}">
                <div class="chat-avatar" data-sender="${msg.sender}"><span class="chat-avatar-fallback">${initial}</span></div>
                <div class="chat-bubble">
                    <div class="chat-bubble-sender">${msg.sender}</div>
                    ${attachmentHtml}
                    ${textHtml}
                    <div class="chat-bubble-time">${msg.timestamp}</div>
                    ${deleteButton}
                </div>
            </div>
        `;
    }

    function renderMessages(messages, forceFull) {

        const scrollBtnHtml = '<button class="chat-scroll-btn" id="scrollToBottomBtn" onclick="scrollChatToBottom(true)" type="button">↓</button>';

        if (!messages || messages.length === 0) {

            chatWindow.innerHTML = '<div class="chat-empty">No messages yet. Say hi 👋</div>' + scrollBtnHtml;

            renderedMessageIds = new Set();
            lastRenderedDateLabel = null;
            lastMessageCount = 0;

            return;
        }

        const newIds = messages.map(function (m) { return m.id; });

        const hasRemoval = Array.from(renderedMessageIds).some(function (id) {
            return newIds.indexOf(id) === -1;
        });

        if (forceFull || hasRemoval || renderedMessageIds.size === 0) {

            lastRenderedDateLabel = null;

            const bubblesHtml = messages.map(function (msg) {
                return buildBubbleHtml(msg, false);
            }).join("");

            chatWindow.innerHTML = bubblesHtml + scrollBtnHtml;

            renderedMessageIds = new Set(newIds);

            fillAvatarThumbs();

        } else {

            const newMessages = messages.filter(function (msg) {
                return !renderedMessageIds.has(msg.id);
            });

            if (newMessages.length === 0) {
                lastMessageCount = messages.length;
                return; // nothing changed - skip touching the DOM entirely, no blink
            }

            const oldBtn = document.getElementById("scrollToBottomBtn");
            if (oldBtn) oldBtn.remove();

            const appendHtml = newMessages.map(function (msg) {
                return buildBubbleHtml(msg, false);
            }).join("");

            chatWindow.insertAdjacentHTML("beforeend", appendHtml + scrollBtnHtml);

            newMessages.forEach(function (msg) {
                renderedMessageIds.add(msg.id);
            });

            fillAvatarThumbs();
        }

        lastMessageCount = messages.length;
    }



    function renderSharedFiles(files) {

        const list = document.getElementById("sharedFilesList");

        if (!list) return;

        if (!files || files.length === 0) {
            list.innerHTML = '<div class="shared-files-empty">No files shared yet.</div>';
            return;
        }

        list.innerHTML = files.map(function (file) {

            const thumb = file.type === "image"
                ? `<img src="${file.url}" class="shared-file-thumb" alt="">`
                : `<span class="shared-file-icon">📄</span>`;

            return `
                <a href="${file.url}" target="_blank" class="shared-file-item">
                    ${thumb}
                    <span class="shared-file-name">${file.filename}</span>
                </a>
            `;

        }).join("");
    }

    async function fetchMessages() {

        try {

            const response = await fetch("/api/messages");

            if (!response.ok) return;

            const data = await response.json();

            // Ignore stale reads: Cloudinary can briefly return an
            // older version right after a save. Never let a poll
            // shrink the chat - only grow or stay the same.
            if (data.messages.length < lastMessageCount) {
                console.log("Ignored stale chat read");
                return;
            }

            renderMessages(data.messages);
            renderSharedFiles(data.shared_files);

            scrollChatToBottom();

        } catch (error) {

            console.log("Chat fetch error:", error);

        }
    }

    chatForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const text = chatInput.value.trim();

        if (!text) return;

        chatInput.value = "";

        try {

            const response = await fetch("/api/send-message", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ text: text })
            });

            const data = await response.json();

            if (data.messages) {
                renderMessages(data.messages);
                renderSharedFiles(data.shared_files);
                scrollChatToBottom(true);
            }

        } catch (error) {

            console.log("Chat send error:", error);

        }
    });

    // =========================
    // UPLOAD FILE / IMAGE ATTACHMENT
    // =========================

    async function uploadChatFile(file) {

        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {

            const response = await fetch("/api/send-file", {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (data.messages) {
                renderMessages(data.messages);
                renderSharedFiles(data.shared_files);
                scrollChatToBottom(true);
            } else if (data.error) {
                alert(data.error);
            }

        } catch (error) {

            console.log("File upload error:", error);
            alert("Upload failed. Please try again.");

        }
    }

    window.uploadChatFile = uploadChatFile;
    window.scrollChatToBottom = scrollChatToBottom;

    // Initial scroll to bottom on page load
    scrollChatToBottom(true);

    // Auto-refresh every 1.5 seconds
    setInterval(fetchMessages, 1500);

    // Also refresh immediately whenever the tab becomes active again
    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) {
            fetchMessages();
        }
    });

    // =========================
    // DELETE ONE MESSAGE
    // =========================

    async function deleteMessage(id) {

        try {

            const response = await fetch("/api/delete-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: id })
            });

            const data = await response.json();

            if (data.messages) {
                renderMessages(data.messages);
                renderSharedFiles(data.shared_files);
            }

        } catch (error) {

            console.log("Delete message error:", error);

        }
    }

    window.deleteMessage = deleteMessage;


    // =========================
    // CLEAR ENTIRE CHAT
    // =========================

    async function clearChat() {

        const confirmClear = confirm("Clear the entire chat? This cannot be undone.");

        if (!confirmClear) return;

        try {

            const response = await fetch("/api/clear-chat", {
                method: "POST"
            });

            const data = await response.json();

            renderMessages(data.messages);
            renderSharedFiles(data.shared_files);

        } catch (error) {

            console.log("Clear chat error:", error);

        }
    }

    window.clearChat = clearChat;

}

// =========================================================
// PRIVATE VAULT — EDITORIAL GALLERY
// =========================================================

// Also confirm logout on the new vault-page logout link,
// since it uses a different class name than other pages.
const vaultLogoutButton = document.querySelector(".vault-logout");

if (vaultLogoutButton) {
    vaultLogoutButton.addEventListener("click", function (event) {

        const confirmLogout = confirm("Are you sure you want to logout?");

        if (!confirmLogout) {
            event.preventDefault();
        }

    });
}


// =========================
// THREE DOT MENU (VAULT GALLERY)
// =========================

function toggleVaultMenu(button) {

    const menu = button.nextElementSibling;

    document.querySelectorAll(".vault-menu-dropdown").forEach(function (item) {
        if (item !== menu) {
            item.classList.remove("show");
        }
    });

    menu.classList.toggle("show");
}

document.addEventListener("click", function (event) {

    if (!event.target.closest(".vault-menu")) {

        document.querySelectorAll(".vault-menu-dropdown").forEach(function (menu) {
            menu.classList.remove("show");
        });

    }

});


// =========================
// GALLERY FILTER TABS
// =========================
// "Recent" shows the last 12 items in whatever order the
// backend returned them. "Favorites" has no backend data
// yet, so it shows an empty state for now.
// =========================

function setGalleryFilter(filter, tabButton) {

    document.querySelectorAll(".filter-tab").forEach(function (tab) {
        tab.classList.remove("active");
    });

    tabButton.classList.add("active");

    const items = document.querySelectorAll(".vault-item");
    const total = items.length;

    items.forEach(function (item, i) {

        const index = parseInt(item.dataset.index, 10);

        if (filter === "all") {
            item.style.display = "";
        } else if (filter === "recent") {
            item.style.display = (total - index) <= 12 ? "" : "none";
        } else if (filter === "favorites") {
            const isFav = item.querySelector(".vault-favorite-btn")?.classList.contains("active");
            item.style.display = isFav ? "" : "none";
        }

    });

    const gallery = document.getElementById("vaultGallery");

    const visibleCount = Array.from(items).filter(i => i.style.display !== "none").length;

    if (gallery && filter === "favorites" && visibleCount === 0) {

        if (!document.getElementById("favEmptyMsg")) {

            const msg = document.createElement("div");
            msg.id = "favEmptyMsg";
            msg.className = "vault-empty";
            msg.textContent = "No favorites yet.";
            gallery.parentElement.appendChild(msg);
        }

    } else {

        const existingMsg = document.getElementById("favEmptyMsg");

        if (existingMsg) existingMsg.remove();

    }
}


// =========================
// FULL SCREEN VIEWER
// =========================

let currentViewerIndex = 0;

function openViewer(index) {

    if (typeof VAULT_PHOTOS === "undefined" || !VAULT_PHOTOS.length) return;

    currentViewerIndex = index;

    updateViewerImage();

    document.getElementById("vaultViewer").classList.add("show");

    document.body.style.overflow = "hidden";
}

function closeViewer() {

    document.getElementById("vaultViewer").classList.remove("show");

    document.body.style.overflow = "";
}

function viewerNav(direction) {

    const total = VAULT_PHOTOS.length;

    currentViewerIndex = (currentViewerIndex + direction + total) % total;

    updateViewerImage();
}

function updateViewerImage() {

    const photo = VAULT_PHOTOS[currentViewerIndex];

    if (!photo) return;

    document.getElementById("viewerImage").src = photo.url;
    document.getElementById("viewerFilename").textContent = photo.filename;

    const counter = String(currentViewerIndex + 1).padStart(2, "0") +
        " / " +
        String(VAULT_PHOTOS.length).padStart(2, "0");

    document.getElementById("viewerCounter").textContent = counter;
}

// Close viewer when clicking the dark background (not the image itself)
const vaultViewerEl = document.getElementById("vaultViewer");

if (vaultViewerEl) {

    vaultViewerEl.addEventListener("click", function (event) {

        if (event.target === vaultViewerEl) {
            closeViewer();
        }

    });
}

// Keyboard controls: ESC to close, arrows to navigate
document.addEventListener("keydown", function (event) {

    const viewer = document.getElementById("vaultViewer");

    if (!viewer || !viewer.classList.contains("show")) return;

    if (event.key === "Escape") {
        closeViewer();
    } else if (event.key === "ArrowLeft") {
        viewerNav(-1);
    } else if (event.key === "ArrowRight") {
        viewerNav(1);
    }

});
// =========================
// VAULT DOCK — SLIDING PILL INDICATOR
// =========================

(function () {

    const dockNav = document.getElementById("dockNav");
    const dockPill = document.getElementById("dockPill");

    if (!dockNav || !dockPill) return;

    function positionPill() {

        const activeItem = dockNav.querySelector(".dock-item.active");

        if (!activeItem) return;

        dockPill.style.width = activeItem.offsetWidth + "px";
        dockPill.style.transform = `translateX(${activeItem.offsetLeft - 4}px)`;
    }

    window.addEventListener("load", positionPill);
    window.addEventListener("resize", positionPill);

})();
// =========================
// TOGGLE FAVORITE
// =========================

async function toggleFavorite(button, publicId) {

    button.classList.add("pulse");
    setTimeout(() => button.classList.remove("pulse"), 350);

    try {

        const response = await fetch("/api/toggle-favorite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ public_id: publicId })
        });

        const data = await response.json();

        button.classList.toggle("active", data.is_favorite);

    } catch (error) {

        console.log("Toggle favorite error:", error);

    }
}
// =========================
// AVATAR PICKER
// =========================

// =========================
// READY PLAYER ME — 3D AVATAR CREATOR
// =========================

// =========================
// AVATURN — 3D AVATAR CREATOR
// =========================

const AVATURN_SUBDOMAIN = "privatevault";

let avaturnSdk = null;
let avaturnInitialized = false;

function openAvatarPicker() {

    const modal = document.getElementById("avatarModal");
    const container = document.getElementById("avaturn-sdk-container");

    modal.classList.add("show");

    if (avaturnInitialized) return; // already loaded once, don't re-init

    avaturnSdk = new window.AvaturnSDK();

    avaturnSdk.init(container, {
        url: `https://${AVATURN_SUBDOMAIN}.avaturn.dev`
    }).then(function () {

        avaturnInitialized = true;

        avaturnSdk.on("export", async function (data) {

            console.log("AVATURN EXPORT EVENT FIRED:", data);

            const avatarUrl = data.url || (data.data && data.data.url);

            console.log("Resolved avatar URL:", avatarUrl);

            if (!avatarUrl) {
                alert("Avatar export succeeded but no URL was found - check console for the data shape.");
                return;
            }

            try {

                const response = await fetch("/api/set-avatar", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ avatar_url: avatarUrl })
                });

                const result = await response.json();

                if (result.avatar_url) {
                    loadAvatarIntoButton(result.avatar_url);
                    closeAvatarPicker();
                }

            } catch (error) {
                console.log("Set avatar error:", error);
            }
        });

    });
}

function closeAvatarPicker() {
    document.getElementById("avatarModal").classList.remove("show");
}
// =========================
// 3D AVATAR VIEWER (renders in the header button)
// =========================

function loadAvatarIntoButton(glbUrl) {

    const canvas = document.getElementById("avatarBtnCanvas");
    const defaultIcon = document.getElementById("avatarBtnDefault");

    if (!canvas || !glbUrl) return;

    if (defaultIcon) defaultIcon.style.display = "none";

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(38, 38);
    renderer.setPixelRatio(window.devicePixelRatio);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.4);
    scene.add(light);

    const loader = new THREE.GLTFLoader();

    loader.load(glbUrl, function (gltf) {

        const model = gltf.scene;
        scene.add(model);

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Frame a head-and-shoulders crop, like a real profile icon,
        // instead of trying to fit the whole body into a tiny circle.
        const headY = box.max.y - size.y * 0.12;

        camera.position.set(center.x, headY, center.z + size.z * 2.2 + 0.35);
        camera.lookAt(center.x, headY, center.z);

        function animate() {
            model.rotation.y += 0.01;
            renderer.render(scene, camera);
            requestAnimationFrame(animate);
        }

        animate();

    }, undefined, function (error) {
        console.log("Avatar load ERROR:", error);
    });
}

// Load the saved avatar on page load, if one exists
document.addEventListener("DOMContentLoaded", function () {

    const btn = document.getElementById("avatarBtn");

    if (btn) {

        const savedUrl = btn.getAttribute("data-avatar-url");

        if (savedUrl) {
            loadAvatarIntoButton(savedUrl);
        }
    }

});

document.addEventListener("click", function (event) {

    const modal = document.getElementById("avatarModal");

    if (modal && event.target === modal) {
        closeAvatarPicker();
    }

});