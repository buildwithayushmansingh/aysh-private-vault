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

        const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.4);
        scene.add(light);

        const loader = new THREE.GLTFLoader();

        loader.load(url, function (gltf) {

            const model = gltf.scene;
            scene.add(model);

            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            const headY = box.max.y - size.y * 0.12;

            camera.position.set(center.x, headY, center.z + size.z * 2.2 + 0.35);
            camera.lookAt(center.x, headY, center.z);

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
    let messageMap = {};
    let currentReply = null;

    function updateMessageMap(messages) {
        messages.forEach(function (m) {
            messageMap[m.id] = m;
        });
    }

    function startReply(id) {

        const msg = messageMap[id];

        if (!msg) return;

        currentReply = { id: msg.id, sender: msg.sender, text: msg.text || (msg.attachment ? "📎 Attachment" : "") };

        document.getElementById("replyPreviewSender").textContent = msg.sender;
        document.getElementById("replyPreviewSnippet").textContent = currentReply.text.slice(0, 60);
        document.getElementById("replyPreview").style.display = "flex";

        chatInput.focus();
    }

    function cancelReply() {
        currentReply = null;
        document.getElementById("replyPreview").style.display = "none";
    }

    window.startReply = startReply;
    window.cancelReply = cancelReply;

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

        const replyButton = `<button type="button" class="chat-reply-button" onclick="startReply('${msg.id}')">↩</button>`;

        const attachmentHtml = buildAttachmentHtml(msg.attachment);

        const textHtml = safeText
            ? `<div class="chat-bubble-text">${safeText}</div>`
            : "";

        let quoteHtml = "";

        if (msg.reply_to && messageMap[msg.reply_to]) {

            const quoted = messageMap[msg.reply_to];

            const quotedSnippet = (quoted.text || (quoted.attachment ? "📎 Attachment" : ""))
                .slice(0, 60)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

            quoteHtml = `<div class="reply-quote"><span class="reply-quote-sender">${quoted.sender}</span>${quotedSnippet}</div>`;
        }

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
                    ${quoteHtml}
                    ${attachmentHtml}
                    ${textHtml}
                    <div class="chat-bubble-time">${msg.timestamp}</div>
                    ${replyButton}
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

            updateMessageMap(data.messages);
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

        const replyId = currentReply ? currentReply.id : null;

        cancelReply();

        try {

            const response = await fetch("/api/send-message", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ text: text, reply_to: replyId })
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

    if (event.key === "Escape") {
        closeNewNoteModal();
        closeNoteViewer();
        closeNewJournalModal();
        closeNewLetterModal();
        closeNewDateModal();
        closeNewPlanModal();
        closeNewWishlistModal();
    }
});

document.addEventListener("click", function (event) {

    if (event.target.id === "newNoteModal") closeNewNoteModal();
    if (event.target.id === "noteViewerModal") closeNoteViewer();
    if (event.target.id === "newJournalModal") closeNewJournalModal();
    if (event.target.id === "newLetterModal") closeNewLetterModal();
    if (event.target.id === "newDateModal") closeNewDateModal();
    if (event.target.id === "newPlanModal") closeNewPlanModal();
    if (event.target.id === "newWishlistModal") closeNewWishlistModal();
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
// =========================================================
// NOTES SECTION
// =========================================================

let allNotes = [];
let currentNotesFilter = "all";
let currentNoteAttachment = null;
let currentViewerNoteId = null;

async function loadNotes() {

    try {

        const response = await fetch("/api/notes");
        const data = await response.json();

        allNotes = data.notes || [];

        renderNotes();

    } catch (error) {
        console.log("Load notes error:", error);
    }
}

function setNotesCategory(category, cardEl) {

    document.querySelectorAll(".notes-category-card").forEach(function (c) {
        c.classList.remove("active");
    });

    cardEl.classList.add("active");

    currentJournalCategory = category;

    const notesGrid = document.getElementById("notesGrid");
    const journalTimeline = document.getElementById("journalTimeline");
    const lettersGrid = document.getElementById("lettersGrid");
    const datesGrid = document.getElementById("datesGrid");
    const plansGrid = document.getElementById("plansGrid");
    const wishlistGrid = document.getElementById("wishlistGrid");
    const filterRow = document.querySelector(".notes-filter-row");

    notesGrid.style.display = "none";
    journalTimeline.style.display = "none";
    lettersGrid.style.display = "none";
    datesGrid.style.display = "none";
    plansGrid.style.display = "none";
    wishlistGrid.style.display = "none";
    if (filterRow) filterRow.style.display = "none";

    if (category === "journal") {

        journalTimeline.style.display = "flex";
        loadJournal();

    } else if (category === "letters") {

        lettersGrid.style.display = "grid";
        loadLetters();

    } else if (category === "dates") {

        datesGrid.style.display = "grid";
        loadDates();

    } else if (category === "plans") {

        plansGrid.style.display = "grid";
        loadPlans();

    } else if (category === "wishlist") {

        wishlistGrid.style.display = "grid";
        loadWishlist();

    } else {

        notesGrid.style.display = "grid";
        if (filterRow) filterRow.style.display = "flex";
        renderNotes();
    }
}
function renderNotes() {

    const grid = document.getElementById("notesGrid");

    if (!grid) return;

    const searchTerm = (document.getElementById("notesSearchInput").value || "").toLowerCase();

    let filtered = allNotes.filter(function (n) {

        if (currentNotesFilter === "shared" && n.visibility !== "shared") return false;
        if (currentNotesFilter === "only-me" && n.visibility !== "only-me") return false;
        if (currentNotesFilter === "pinned" && !n.pinned) return false;
        if (currentNotesFilter === "favorite" && !n.favorite) return false;
        if (currentNotesFilter === "locked" && !n.locked) return false;

        if (searchTerm) {

            const haystack = [
                n.title || "",
                n.content || "",
                (n.tags || []).join(" "),
                n.category || ""
            ].join(" ").toLowerCase();

            if (!haystack.includes(searchTerm)) return false;
        }

        return true;
    });

    filtered.sort(function (a, b) {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.updated_at || "").localeCompare(a.updated_at || "");
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="notes-empty">
                No memories here yet.<br><br>
                <button class="notes-new-btn" onclick="openNewNoteModal()">+ Create Note</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(function (n) {

        const preview = n.locked
            ? "🔒 This note is locked."
            : (n.content || "").slice(0, 120);

        const badges = [
            n.pinned ? "📌" : "",
            n.favorite ? "❤️" : "",
            n.locked ? "🔒" : "",
            n.visibility === "only-me" ? "👤" : "👥"
        ].filter(Boolean).join(" ");

        return `
            <div class="notes-card" onclick="openNoteViewer('${n.id}')">
                <div class="notes-card-badges">${badges}</div>
                <div class="notes-card-title">${escapeHtml(n.title || "Untitled")}</div>
                <div class="notes-card-preview">${escapeHtml(preview)}</div>
                <div class="notes-card-meta">
                    <span>${escapeHtml(n.owner || "")}</span>
                    <span>${escapeHtml(n.updated_at || "")}</span>
                </div>
            </div>
        `;

    }).join("");
}

function escapeHtml(str) {
    return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}


// =========================
// NEW NOTE MODAL
// =========================

function openNewNoteModal() {
    document.getElementById("newNoteModal").classList.add("show");
}

function closeNewNoteModal() {
    document.getElementById("newNoteModal").classList.remove("show");
    document.getElementById("noteTitleInput").value = "";
    document.getElementById("noteContentInput").value = "";
    document.getElementById("noteTagsInput").value = "";
    document.getElementById("noteAttachStatus").textContent = "";
    currentNoteAttachment = null;
}

async function handleNoteAttachment(file) {

    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    document.getElementById("noteAttachStatus").textContent = "Uploading...";

    try {

        const response = await fetch("/api/notes/upload-attachment", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.attachment) {
            currentNoteAttachment = data.attachment;
            document.getElementById("noteAttachStatus").textContent = "✓ " + data.attachment.filename;
        } else {
            document.getElementById("noteAttachStatus").textContent = "Upload failed";
        }

    } catch (error) {
        document.getElementById("noteAttachStatus").textContent = "Upload failed";
    }
}

async function submitNewNote() {

    const title = document.getElementById("noteTitleInput").value.trim();
    const content = document.getElementById("noteContentInput").value.trim();
    const tagsRaw = document.getElementById("noteTagsInput").value.trim();
    const visibility = document.querySelector('input[name="noteVisibility"]:checked').value;

    if (!title && !content) {
        alert("Write something first!");
        return;
    }

    const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];

    try {

        const response = await fetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: title,
                content: content,
                category: "us-and-me",
                tags: tags,
                visibility: visibility,
                attachment: currentNoteAttachment
            })
        });

        const data = await response.json();

        if (data.note) {
            allNotes.push(data.note);
            renderNotes();
            closeNewNoteModal();
        }

    } catch (error) {
        console.log("Create note error:", error);
    }
}


// =========================
// NOTE VIEWER
// =========================

function openNoteViewer(noteId) {

    const note = allNotes.find(n => n.id === noteId);

    if (!note) return;

    currentViewerNoteId = noteId;

    document.getElementById("viewerPinBtn").classList.toggle("active", note.pinned);
    document.getElementById("viewerFavBtn").classList.toggle("active", note.favorite);
    document.getElementById("viewerLockBtn").classList.toggle("active", note.locked);

    const body = document.getElementById("noteViewerBody");

    const canSeeContent = !note.locked || note.owner === CURRENT_IDENTITY;

    if (note.locked && !canSeeContent) {

        body.innerHTML = `
            <div class="notes-locked-banner">
                🔒 Protected Note<br><br>
                This content is protected.
            </div>
        `;

    } else if (note.locked) {

        body.innerHTML = `
            <div class="notes-locked-banner">
                🔒 Protected Note<br><br>
                This content is protected.
                <br><br>
                <button class="notes-modal-save" onclick="revealLockedNote()">Unlock</button>
            </div>
        `;

    } else {

        renderNoteViewerContent(note);
    }

    document.getElementById("noteViewerModal").classList.add("show");
}

function revealLockedNote() {

    const note = allNotes.find(n => n.id === currentViewerNoteId);

    if (note) renderNoteViewerContent(note);
}

function renderNoteViewerContent(note) {

    const body = document.getElementById("noteViewerBody");

    const attachmentHtml = note.attachment
        ? (note.attachment.type === "image"
            ? `<img src="${note.attachment.url}" style="max-width:100%; border-radius:10px; margin-bottom:14px;">`
            : `<a href="${note.attachment.url}" target="_blank">📄 ${escapeHtml(note.attachment.filename)}</a><br><br>`)
        : "";

    body.innerHTML = `
        <div class="notes-viewer-title">${escapeHtml(note.title || "Untitled")}</div>
        ${attachmentHtml}
        <div class="notes-viewer-content">${escapeHtml(note.content || "")}</div>
        <div class="notes-viewer-tags">${(note.tags || []).map(t => "#" + escapeHtml(t)).join(" ")}</div>
        <div class="notes-viewer-meta">
            Created by: ${escapeHtml(note.owner || "")} · ${note.visibility === "shared" ? "Shared" : "Only Me"}<br>
            Updated: ${escapeHtml(note.updated_at || "")}
        </div>
        <div class="notes-viewer-actions">
            <button class="notes-modal-cancel" onclick="deleteCurrentNote()">Delete</button>
        </div>
    `;
}

function closeNoteViewer() {
    document.getElementById("noteViewerModal").classList.remove("show");
    currentViewerNoteId = null;
}

async function toggleViewerNoteField(field) {

    if (!currentViewerNoteId) return;

    try {

        const response = await fetch(`/api/notes/${currentViewerNoteId}/toggle`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ field: field })
        });

        const data = await response.json();

        if (data.note) {

            const idx = allNotes.findIndex(n => n.id === data.note.id);
            if (idx !== -1) allNotes[idx] = data.note;

            renderNotes();
            openNoteViewer(data.note.id);
        }

    } catch (error) {
        console.log("Toggle note error:", error);
    }
}

async function deleteCurrentNote() {

    if (!currentViewerNoteId) return;

    const confirmDelete = confirm("Delete this note? This cannot be undone.");

    if (!confirmDelete) return;

    try {

        await fetch(`/api/notes/${currentViewerNoteId}`, { method: "DELETE" });

        allNotes = allNotes.filter(n => n.id !== currentViewerNoteId);

        renderNotes();
        closeNoteViewer();

    } catch (error) {
        console.log("Delete note error:", error);
    }
}


// Init on the notes page only
const notesGridEl = document.getElementById("notesGrid");

if (notesGridEl) {

    loadNotes();

    document.getElementById("notesSearchInput").addEventListener("input", renderNotes);

    document.addEventListener("keydown", function (event) {

        if (event.key === "Escape") {
            closeNewNoteModal();
            closeNoteViewer();
            closeNewJournalModal();
            closeNewLetterModal();
            closeNewDateModal();
        }
    });

    document.addEventListener("click", function (event) {

        if (event.target.id === "newNoteModal") closeNewNoteModal();
        if (event.target.id === "noteViewerModal") closeNoteViewer();
        if (event.target.id === "newJournalModal") closeNewJournalModal();
        if (event.target.id === "newLetterModal") closeNewLetterModal();
        if (event.target.id === "newDateModal") closeNewDateModal();
    });
}
// =========================================================
// OUR JOURNAL
// =========================================================

let allJournalEntries = [];
let selectedJournalMood = "🙂";
let currentJournalAttachment = null;
let currentJournalCategory = "us-and-me"; // tracks which section is active

async function loadJournal() {

    try {

        const response = await fetch("/api/journal");
        const data = await response.json();

        allJournalEntries = data.entries || [];

        renderJournalTimeline();

    } catch (error) {
        console.log("Load journal error:", error);
    }
}

function renderJournalTimeline() {

    const container = document.getElementById("journalTimeline");

    if (!container) return;

    if (allJournalEntries.length === 0) {

        container.innerHTML = `
            <div class="notes-empty">
                No memories here yet.<br><br>
                <button class="notes-new-btn" onclick="openNewJournalModal()">+ Create Entry</button>
            </div>
        `;
        return;
    }

    const sorted = [...allJournalEntries].sort(function (a, b) {
        return (b.date || "").localeCompare(a.date || "");
    });

    let html = "";
    let lastMonth = null;

    sorted.forEach(function (entry) {

        const dateObj = new Date(entry.date + "T00:00:00");

        const monthLabel = dateObj.toLocaleDateString(undefined, { month: "long", year: "numeric" });

        if (monthLabel !== lastMonth) {
            html += `<div class="journal-month-heading">${monthLabel}</div>`;
            lastMonth = monthLabel;
        }

        const day = dateObj.getDate();
        const weekday = dateObj.toLocaleDateString(undefined, { weekday: "short" });

        html += `
            <div class="journal-entry" onclick="openJournalViewer('${entry.id}')">
                <div class="journal-entry-date">
                    <div class="journal-entry-day">${day}</div>
                    <div class="journal-entry-weekday">${weekday}</div>
                    <div class="journal-entry-mood">${entry.mood || "🙂"}</div>
                </div>
                <div class="journal-entry-body">
                    <div class="journal-entry-text">${escapeHtml(entry.text || "")}</div>
                    <div class="journal-entry-meta">${escapeHtml(entry.owner || "")} · ${entry.visibility === "shared" ? "Shared" : "Only Me"} ${entry.favorite ? "· ❤️" : ""}</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}


// =========================
// NEW JOURNAL MODAL
// =========================

function openNewJournalModal() {

    document.getElementById("journalDateInput").value = new Date().toISOString().split("T")[0];

    document.getElementById("newJournalModal").classList.add("show");
}

function closeNewJournalModal() {

    document.getElementById("newJournalModal").classList.remove("show");
    document.getElementById("journalTextInput").value = "";
    document.getElementById("journalTagsInput").value = "";
    document.getElementById("journalAttachStatus").textContent = "";
    currentJournalAttachment = null;

    document.querySelectorAll(".journal-mood-option").forEach(function (el) {
        el.classList.remove("selected");
    });

    selectedJournalMood = "🙂";
}

function selectJournalMood(mood, el) {

    selectedJournalMood = mood;

    document.querySelectorAll(".journal-mood-option").forEach(function (o) {
        o.classList.remove("selected");
    });

    el.classList.add("selected");
}

async function handleJournalAttachment(file) {

    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    document.getElementById("journalAttachStatus").textContent = "Uploading...";

    try {

        const response = await fetch("/api/notes/upload-attachment", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.attachment) {
            currentJournalAttachment = data.attachment;
            document.getElementById("journalAttachStatus").textContent = "✓ " + data.attachment.filename;
        }

    } catch (error) {
        document.getElementById("journalAttachStatus").textContent = "Upload failed";
    }
}

async function submitNewJournalEntry() {

    const entryDate = document.getElementById("journalDateInput").value;
    const text = document.getElementById("journalTextInput").value.trim();
    const tagsRaw = document.getElementById("journalTagsInput").value.trim();
    const visibility = document.querySelector('input[name="journalVisibility"]:checked').value;

    if (!text) {
        alert("Write something first!");
        return;
    }

    const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];

    try {

        const response = await fetch("/api/journal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                date: entryDate,
                mood: selectedJournalMood,
                text: text,
                tags: tags,
                visibility: visibility,
                attachment: currentJournalAttachment
            })
        });

        const data = await response.json();

        if (data.entry) {
            allJournalEntries.push(data.entry);
            renderJournalTimeline();
            closeNewJournalModal();
        }

    } catch (error) {
        console.log("Create journal entry error:", error);
    }
}


// =========================
// JOURNAL VIEWER (reuses the note viewer modal)
// =========================

let currentViewerJournalId = null;

function openJournalViewer(entryId) {

    const entry = allJournalEntries.find(e => e.id === entryId);

    if (!entry) return;

    currentViewerJournalId = entryId;
    currentViewerNoteId = null; // make sure note-delete doesn't get confused

    document.getElementById("viewerPinBtn").style.display = "none";
    document.getElementById("viewerLockBtn").style.display = "none";
    document.getElementById("viewerFavBtn").style.display = "inline-flex";
    document.getElementById("viewerFavBtn").classList.toggle("active", entry.favorite);
    document.getElementById("viewerFavBtn").setAttribute("onclick", "toggleJournalFavorite()");

    const attachmentHtml = entry.attachment
        ? (entry.attachment.type === "image"
            ? `<img src="${entry.attachment.url}" style="max-width:100%; border-radius:10px; margin-bottom:14px;">`
            : `<a href="${entry.attachment.url}" target="_blank">📄 ${escapeHtml(entry.attachment.filename)}</a><br><br>`)
        : "";

    document.getElementById("noteViewerBody").innerHTML = `
        <div class="notes-viewer-title">${entry.mood || "🙂"} ${escapeHtml(entry.date || "")}</div>
        ${attachmentHtml}
        <div class="notes-viewer-content">${escapeHtml(entry.text || "")}</div>
        <div class="notes-viewer-tags">${(entry.tags || []).map(t => "#" + escapeHtml(t)).join(" ")}</div>
        <div class="notes-viewer-meta">
            Written by: ${escapeHtml(entry.owner || "")} · ${entry.visibility === "shared" ? "Shared" : "Only Me"}
        </div>
        <div class="notes-viewer-actions">
            <button class="notes-modal-cancel" onclick="deleteCurrentJournalEntry()">Delete</button>
        </div>
    `;

    document.getElementById("noteViewerModal").classList.add("show");
}

async function toggleJournalFavorite() {

    if (!currentViewerJournalId) return;

    try {

        const response = await fetch(`/api/journal/${currentViewerJournalId}/toggle`, {
            method: "POST"
        });

        const data = await response.json();

        if (data.entry) {

            const idx = allJournalEntries.findIndex(e => e.id === data.entry.id);
            if (idx !== -1) allJournalEntries[idx] = data.entry;

            renderJournalTimeline();
            openJournalViewer(data.entry.id);
        }

    } catch (error) {
        console.log("Toggle journal favorite error:", error);
    }
}

async function deleteCurrentJournalEntry() {

    if (!currentViewerJournalId) return;

    const confirmDelete = confirm("Delete this journal entry? This cannot be undone.");

    if (!confirmDelete) return;

    try {

        await fetch(`/api/journal/${currentViewerJournalId}`, { method: "DELETE" });

        allJournalEntries = allJournalEntries.filter(e => e.id !== currentViewerJournalId);

        renderJournalTimeline();
        closeNoteViewer();

        currentViewerJournalId = null;

        // restore normal note-viewer buttons for next time it's used
        document.getElementById("viewerPinBtn").style.display = "inline-flex";
        document.getElementById("viewerLockBtn").style.display = "inline-flex";
        document.getElementById("viewerFavBtn").setAttribute("onclick", "toggleViewerNoteField('favorite')");

    } catch (error) {
        console.log("Delete journal entry error:", error);
    }
}
function openCorrectNewModal() {

    if (currentJournalCategory === "journal") {
        openNewJournalModal();
    } else if (currentJournalCategory === "letters") {
        openNewLetterModal();
    } else if (currentJournalCategory === "dates") {
        openNewDateModal();
    } else if (currentJournalCategory === "plans") {
        openNewPlanModal();
    } else if (currentJournalCategory === "wishlist") {
        openNewWishlistModal();
    } else {
        openNewNoteModal();
    }
}
// =========================================================
// LETTERS
// =========================================================

let allLetters = [];
let currentLetterAttachment = null;

async function loadLetters() {

    try {

        const response = await fetch("/api/letters");
        const data = await response.json();

        allLetters = data.letters || [];

        renderLettersGrid();

    } catch (error) {
        console.log("Load letters error:", error);
    }
}

function daysUntil(dateStr) {

    const target = new Date(dateStr + "T00:00:00");
    const now = new Date();

    const diffMs = target - now;

    return Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)), 0);
}

function renderLettersGrid() {

    const grid = document.getElementById("lettersGrid");

    if (!grid) return;

    if (allLetters.length === 0) {

        grid.innerHTML = `
            <div class="notes-empty">
                No letters yet.<br><br>
                <button class="notes-new-btn" onclick="openNewLetterModal()">+ Write a Letter</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = allLetters.map(function (letter) {

        if (!letter.unlocked) {

            return `
                <div class="notes-card letters-card-locked" onclick="openLetterViewer('${letter.id}')">
                    <div class="notes-card-title">🔒 ${escapeHtml(letter.title || "Untitled")}</div>
                    <div>This letter is waiting to be opened.</div>
                    <div class="letters-countdown">${daysUntil(letter.open_date)} day(s) remaining</div>
                </div>
            `;
        }

        const badges = [
            letter.favorite ? "❤️" : "",
            !letter.read ? "🆕" : "",
            letter.visibility === "only-me" ? "👤" : "👥"
        ].filter(Boolean).join(" ");

        return `
            <div class="notes-card" onclick="openLetterViewer('${letter.id}')">
                <div class="notes-card-badges">${badges}</div>
                <div class="notes-card-title">💌 ${escapeHtml(letter.title || "Untitled")}</div>
                <div class="notes-card-preview">${escapeHtml((letter.content || "").slice(0, 120))}</div>
                <div class="notes-card-meta">
                    <span>${escapeHtml(letter.owner || "")}</span>
                    <span>${escapeHtml(letter.created_at || "")}</span>
                </div>
            </div>
        `;

    }).join("");
}


// =========================
// NEW LETTER MODAL
// =========================

function openNewLetterModal() {
    document.getElementById("newLetterModal").classList.add("show");
}

function closeNewLetterModal() {
    document.getElementById("newLetterModal").classList.remove("show");
    document.getElementById("letterTitleInput").value = "";
    document.getElementById("letterContentInput").value = "";
    document.getElementById("letterOpenDateInput").value = "";
    document.getElementById("letterAttachStatus").textContent = "";
    currentLetterAttachment = null;
}

async function handleLetterAttachment(file) {

    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    document.getElementById("letterAttachStatus").textContent = "Uploading...";

    try {

        const response = await fetch("/api/notes/upload-attachment", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.attachment) {
            currentLetterAttachment = data.attachment;
            document.getElementById("letterAttachStatus").textContent = "✓ " + data.attachment.filename;
        }

    } catch (error) {
        document.getElementById("letterAttachStatus").textContent = "Upload failed";
    }
}

async function submitNewLetter() {

    const title = document.getElementById("letterTitleInput").value.trim();
    const content = document.getElementById("letterContentInput").value.trim();
    const openDate = document.getElementById("letterOpenDateInput").value;
    const visibility = document.querySelector('input[name="letterVisibility"]:checked').value;

    if (!title && !content) {
        alert("Write something first!");
        return;
    }

    try {

        const response = await fetch("/api/letters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: title,
                content: content,
                open_date: openDate || null,
                visibility: visibility,
                attachment: currentLetterAttachment
            })
        });

        const data = await response.json();

        if (data.letter) {
            allLetters.push({ ...data.letter, unlocked: true });
            renderLettersGrid();
            closeNewLetterModal();
        }

    } catch (error) {
        console.log("Create letter error:", error);
    }
}


// =========================
// LETTER VIEWER (reuses note viewer modal)
// =========================

let currentViewerLetterId = null;

async function openLetterViewer(letterId) {

    currentViewerLetterId = letterId;
    currentViewerNoteId = null;
    currentViewerJournalId = null;

    try {

        const response = await fetch(`/api/letters/${letterId}`);
        const data = await response.json();

        if (!data.letter) return;

        const letter = data.letter;

        const idx = allLetters.findIndex(l => l.id === letterId);
        if (idx !== -1) allLetters[idx] = letter;

        document.getElementById("viewerPinBtn").style.display = "none";
        document.getElementById("viewerLockBtn").style.display = "none";
        document.getElementById("viewerFavBtn").style.display = letter.unlocked ? "inline-flex" : "none";
        document.getElementById("viewerFavBtn").classList.toggle("active", letter.favorite);
        document.getElementById("viewerFavBtn").setAttribute("onclick", "toggleLetterFavorite()");

        const body = document.getElementById("noteViewerBody");

        if (!letter.unlocked) {

            body.innerHTML = `
                <div class="notes-locked-banner">
                    🔒 This letter is waiting to be opened.<br><br>
                    ${daysUntil(letter.open_date)} day(s) remaining
                </div>
            `;

        } else {

            const attachmentHtml = letter.attachment
                ? (letter.attachment.type === "image"
                    ? `<img src="${letter.attachment.url}" style="max-width:100%; border-radius:10px; margin-bottom:14px;">`
                    : `<a href="${letter.attachment.url}" target="_blank">📄 ${escapeHtml(letter.attachment.filename)}</a><br><br>`)
                : "";

            body.innerHTML = `
                <div class="notes-viewer-title">💌 ${escapeHtml(letter.title || "Untitled")}</div>
                ${attachmentHtml}
                <div class="notes-viewer-content">${escapeHtml(letter.content || "")}</div>
                <div class="notes-viewer-meta">
                    From: ${escapeHtml(letter.owner || "")} · ${letter.visibility === "shared" ? "Shared" : "Only Me"} · ${escapeHtml(letter.created_at || "")}
                </div>
                <div class="notes-viewer-actions">
                    <button class="notes-modal-cancel" onclick="deleteCurrentLetter()">Delete</button>
                </div>
            `;
        }

        document.getElementById("noteViewerModal").classList.add("show");

        renderLettersGrid();

    } catch (error) {
        console.log("Open letter error:", error);
    }
}

async function toggleLetterFavorite() {

    if (!currentViewerLetterId) return;

    try {

        const response = await fetch(`/api/letters/${currentViewerLetterId}/toggle`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ field: "favorite" })
        });

        const data = await response.json();

        if (data.letter) {

            const idx = allLetters.findIndex(l => l.id === data.letter.id);
            if (idx !== -1) allLetters[idx] = { ...allLetters[idx], favorite: data.letter.favorite };

            renderLettersGrid();
            openLetterViewer(data.letter.id);
        }

    } catch (error) {
        console.log("Toggle letter favorite error:", error);
    }
}

async function deleteCurrentLetter() {

    if (!currentViewerLetterId) return;

    const confirmDelete = confirm("Delete this letter? This cannot be undone.");

    if (!confirmDelete) return;

    try {

        await fetch(`/api/letters/${currentViewerLetterId}`, { method: "DELETE" });

        allLetters = allLetters.filter(l => l.id !== currentViewerLetterId);

        renderLettersGrid();
        closeNoteViewer();

        currentViewerLetterId = null;

        document.getElementById("viewerPinBtn").style.display = "inline-flex";
        document.getElementById("viewerLockBtn").style.display = "inline-flex";
        document.getElementById("viewerFavBtn").setAttribute("onclick", "toggleViewerNoteField('favorite')");

    } catch (error) {
        console.log("Delete letter error:", error);
    }
}
// =========================================================
// IMPORTANT DATES
// =========================================================

let allDates = [];
let currentDateAttachment = null;
let currentViewerDateId = null;

async function loadDates() {

    try {

        const response = await fetch("/api/dates");
        const data = await response.json();

        allDates = data.dates || [];

        renderDatesGrid();

    } catch (error) {
        console.log("Load dates error:", error);
    }
}

function getNextOccurrence(dateStr, repeatYearly) {

    const original = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!repeatYearly) {
        return original;
    }

    const next = new Date(today.getFullYear(), original.getMonth(), original.getDate());

    if (next < today) {
        next.setFullYear(next.getFullYear() + 1);
    }

    return next;
}

function daysUntilDate(dateStr, repeatYearly) {

    const target = getNextOccurrence(dateStr, repeatYearly);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffMs = target - today;

    return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function renderDatesGrid() {

    const grid = document.getElementById("datesGrid");

    if (!grid) return;

    if (allDates.length === 0) {

        grid.innerHTML = `
            <div class="notes-empty">
                No important dates yet.<br><br>
                <button class="notes-new-btn" onclick="openNewDateModal()">+ Add Date</button>
            </div>
        `;
        return;
    }

    const sorted = [...allDates].sort(function (a, b) {
        return daysUntilDate(a.date, a.repeat_yearly) - daysUntilDate(b.date, b.repeat_yearly);
    });

    grid.innerHTML = sorted.map(function (entry) {

        const daysLeft = daysUntilDate(entry.date, entry.repeat_yearly);

        const todayBadge = daysLeft === 0 ? `<div class="dates-today-badge">🎉 Today!</div>` : "";

        const daysLabel = daysLeft < 0
            ? `${Math.abs(daysLeft)} day(s) ago`
            : `${daysLeft} day(s) remaining`;

        return `
            <div class="notes-card dates-countdown-card" onclick="openDateViewer('${entry.id}')">
                <div class="dates-countdown-icon">📅</div>
                <div class="notes-card-title">${escapeHtml(entry.title || "Untitled")}</div>
                <div class="dates-countdown-number">${daysLeft >= 0 ? daysLeft : Math.abs(daysLeft)}</div>
                <div class="dates-countdown-label">${daysLabel}</div>
                ${todayBadge}
            </div>
        `;

    }).join("");
}


// =========================
// NEW DATE MODAL
// =========================

function openNewDateModal() {
    document.getElementById("newDateModal").classList.add("show");
}

function closeNewDateModal() {
    document.getElementById("newDateModal").classList.remove("show");
    document.getElementById("dateTitleInput").value = "";
    document.getElementById("dateValueInput").value = "";
    document.getElementById("dateDescriptionInput").value = "";
    document.getElementById("dateRepeatInput").checked = false;
    document.getElementById("dateAttachStatus").textContent = "";
    currentDateAttachment = null;
}

async function handleDateAttachment(file) {

    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    document.getElementById("dateAttachStatus").textContent = "Uploading...";

    try {

        const response = await fetch("/api/notes/upload-attachment", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.attachment) {
            currentDateAttachment = data.attachment;
            document.getElementById("dateAttachStatus").textContent = "✓ " + data.attachment.filename;
        }

    } catch (error) {
        document.getElementById("dateAttachStatus").textContent = "Upload failed";
    }
}

async function submitNewDate() {

    const title = document.getElementById("dateTitleInput").value.trim();
    const dateValue = document.getElementById("dateValueInput").value;
    const description = document.getElementById("dateDescriptionInput").value.trim();
    const repeatYearly = document.getElementById("dateRepeatInput").checked;
    const visibility = document.querySelector('input[name="dateVisibility"]:checked').value;

    if (!title || !dateValue) {
        alert("Please enter a title and a date.");
        return;
    }

    try {

        const response = await fetch("/api/dates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: title,
                date: dateValue,
                description: description,
                repeat_yearly: repeatYearly,
                visibility: visibility,
                attachment: currentDateAttachment
            })
        });

        const data = await response.json();

        if (data.date) {
            allDates.push(data.date);
            renderDatesGrid();
            closeNewDateModal();
        }

    } catch (error) {
        console.log("Create date error:", error);
    }
}


// =========================
// DATE VIEWER (reuses note viewer modal)
// =========================

function openDateViewer(entryId) {

    const entry = allDates.find(d => d.id === entryId);

    if (!entry) return;

    currentViewerDateId = entryId;
    currentViewerNoteId = null;
    currentViewerJournalId = null;
    currentViewerLetterId = null;

    document.getElementById("viewerPinBtn").style.display = "none";
    document.getElementById("viewerFavBtn").style.display = "none";
    document.getElementById("viewerLockBtn").style.display = "none";

    const daysLeft = daysUntilDate(entry.date, entry.repeat_yearly);

    const attachmentHtml = entry.attachment
        ? (entry.attachment.type === "image"
            ? `<img src="${entry.attachment.url}" style="max-width:100%; border-radius:10px; margin-bottom:14px;">`
            : `<a href="${entry.attachment.url}" target="_blank">📄 ${escapeHtml(entry.attachment.filename)}</a><br><br>`)
        : "";

    document.getElementById("noteViewerBody").innerHTML = `
        <div class="notes-viewer-title">📅 ${escapeHtml(entry.title || "Untitled")}</div>
        ${attachmentHtml}
        <div class="notes-viewer-content">${escapeHtml(entry.description || "")}</div>
        <div class="notes-viewer-meta">
            ${escapeHtml(entry.date || "")} ${entry.repeat_yearly ? "· Repeats yearly" : ""} · ${daysLeft >= 0 ? daysLeft + " day(s) remaining" : Math.abs(daysLeft) + " day(s) ago"}<br>
            Added by: ${escapeHtml(entry.owner || "")} · ${entry.visibility === "shared" ? "Shared" : "Only Me"}
        </div>
        <div class="notes-viewer-actions">
            <button class="notes-modal-cancel" onclick="deleteCurrentDate()">Delete</button>
        </div>
    `;

    document.getElementById("noteViewerModal").classList.add("show");
}

async function deleteCurrentDate() {

    if (!currentViewerDateId) return;

    const confirmDelete = confirm("Delete this date? This cannot be undone.");

    if (!confirmDelete) return;

    try {

        await fetch(`/api/dates/${currentViewerDateId}`, { method: "DELETE" });

        allDates = allDates.filter(d => d.id !== currentViewerDateId);

        renderDatesGrid();
        closeNoteViewer();

        currentViewerDateId = null;

        document.getElementById("viewerPinBtn").style.display = "inline-flex";
        document.getElementById("viewerFavBtn").style.display = "inline-flex";
        document.getElementById("viewerLockBtn").style.display = "inline-flex";
        document.getElementById("viewerFavBtn").setAttribute("onclick", "toggleViewerNoteField('favorite')");

    } catch (error) {
        console.log("Delete date error:", error);
    }
}
// =========================================================
// OUR PLANS
// =========================================================

let allPlans = [];
let currentViewerPlanId = null;

async function loadPlans() {

    try {

        const response = await fetch("/api/plans");
        const data = await response.json();

        allPlans = data.plans || [];

        renderPlansGrid();

    } catch (error) {
        console.log("Load plans error:", error);
    }
}

function renderPlansGrid() {

    const grid = document.getElementById("plansGrid");

    if (!grid) return;

    if (allPlans.length === 0) {

        grid.innerHTML = `
            <div class="notes-empty">
                No plans yet.<br><br>
                <button class="notes-new-btn" onclick="openNewPlanModal()">+ Create Plan</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = allPlans.map(function (plan) {

        const total = (plan.items || []).length;
        const done = (plan.items || []).filter(i => i.completed).length;

        return `
            <div class="notes-card" onclick="openPlanViewer('${plan.id}')">
                <div class="notes-card-badges">
                    <span class="plan-priority-badge plan-priority-${plan.priority}">${plan.priority}</span>
                </div>
                <div class="notes-card-title">🎯 ${escapeHtml(plan.title || "Untitled")}</div>
                <div class="notes-card-preview">${done}/${total} completed${plan.due_date ? " · Due " + escapeHtml(plan.due_date) : ""}</div>
                <div class="plan-progress-bar-outer">
                    <div class="plan-progress-bar-inner" style="width:${plan.progress || 0}%;"></div>
                </div>
                <div class="notes-card-meta">
                    <span>${escapeHtml(plan.owner || "")}</span>
                    <span>${plan.progress || 0}%</span>
                </div>
            </div>
        `;

    }).join("");
}


// =========================
// NEW PLAN MODAL
// =========================

function openNewPlanModal() {
    document.getElementById("newPlanModal").classList.add("show");
}

function closeNewPlanModal() {
    document.getElementById("newPlanModal").classList.remove("show");
    document.getElementById("planTitleInput").value = "";
    document.getElementById("planDueDateInput").value = "";
    document.getElementById("planItemsInput").value = "";
    document.getElementById("planPriorityInput").value = "normal";
}

async function submitNewPlan() {

    const title = document.getElementById("planTitleInput").value.trim();
    const priority = document.getElementById("planPriorityInput").value;
    const dueDate = document.getElementById("planDueDateInput").value;
    const itemsRaw = document.getElementById("planItemsInput").value;
    const visibility = document.querySelector('input[name="planVisibility"]:checked').value;

    if (!title) {
        alert("Please enter a plan title.");
        return;
    }

    const items = itemsRaw.split("\n").map(t => t.trim()).filter(Boolean);

    try {

        const response = await fetch("/api/plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: title,
                priority: priority,
                due_date: dueDate || null,
                items: items,
                visibility: visibility
            })
        });

        const data = await response.json();

        if (data.plan) {
            allPlans.push(data.plan);
            renderPlansGrid();
            closeNewPlanModal();
        }

    } catch (error) {
        console.log("Create plan error:", error);
    }
}


// =========================
// PLAN VIEWER (reuses note viewer modal)
// =========================

function openPlanViewer(planId) {

    const plan = allPlans.find(p => p.id === planId);

    if (!plan) return;

    currentViewerPlanId = planId;
    currentViewerNoteId = null;
    currentViewerJournalId = null;
    currentViewerLetterId = null;
    currentViewerDateId = null;

    document.getElementById("viewerPinBtn").style.display = "none";
    document.getElementById("viewerFavBtn").style.display = "none";
    document.getElementById("viewerLockBtn").style.display = "none";

    renderPlanViewerBody(plan);

    document.getElementById("noteViewerModal").classList.add("show");
}

function renderPlanViewerBody(plan) {

    const itemsHtml = (plan.items || []).map(function (item) {

        return `
            <div class="plan-checklist-item ${item.completed ? "completed" : ""}">
                <input type="checkbox" ${item.completed ? "checked" : ""} onchange="togglePlanItem('${item.id}')">
                <span class="plan-checklist-text">${escapeHtml(item.text)}</span>
                <button class="plan-checklist-delete" onclick="deletePlanItem('${item.id}')">✕</button>
            </div>
        `;

    }).join("");

    document.getElementById("noteViewerBody").innerHTML = `
        <div class="notes-viewer-title">🎯 ${escapeHtml(plan.title || "Untitled")}</div>
        <div class="notes-viewer-meta">
            <span class="plan-priority-badge plan-priority-${plan.priority}">${plan.priority}</span>
            ${plan.due_date ? " · Due " + escapeHtml(plan.due_date) : ""}
        </div>
        <div class="plan-progress-bar-outer">
            <div class="plan-progress-bar-inner" style="width:${plan.progress || 0}%;"></div>
        </div>
        <div class="plan-checklist">${itemsHtml}</div>
        <div class="plan-add-item-row">
            <input type="text" id="newPlanItemInput" class="notes-form-input" placeholder="Add an item..." style="margin-bottom:0;">
            <button class="plan-add-item-btn" onclick="addPlanItem()">Add</button>
        </div>
        <div class="notes-viewer-meta" style="margin-top:16px;">
            Created by: ${escapeHtml(plan.owner || "")} · ${plan.visibility === "shared" ? "Shared" : "Only Me"}
        </div>
        <div class="notes-viewer-actions">
            <button class="notes-modal-cancel" onclick="deleteCurrentPlan()">Delete Plan</button>
        </div>
    `;
}

async function togglePlanItem(itemId) {

    if (!currentViewerPlanId) return;

    try {

        const response = await fetch(`/api/plans/${currentViewerPlanId}/items/${itemId}/toggle`, {
            method: "POST"
        });

        const data = await response.json();

        if (data.plan) {

            const idx = allPlans.findIndex(p => p.id === data.plan.id);
            if (idx !== -1) allPlans[idx] = data.plan;

            renderPlansGrid();
            renderPlanViewerBody(data.plan);
        }

    } catch (error) {
        console.log("Toggle plan item error:", error);
    }
}

async function deletePlanItem(itemId) {

    if (!currentViewerPlanId) return;

    try {

        const response = await fetch(`/api/plans/${currentViewerPlanId}/items/${itemId}`, {
            method: "DELETE"
        });

        const data = await response.json();

        if (data.plan) {

            const idx = allPlans.findIndex(p => p.id === data.plan.id);
            if (idx !== -1) allPlans[idx] = data.plan;

            renderPlansGrid();
            renderPlanViewerBody(data.plan);
        }

    } catch (error) {
        console.log("Delete plan item error:", error);
    }
}

async function addPlanItem() {

    if (!currentViewerPlanId) return;

    const input = document.getElementById("newPlanItemInput");
    const text = input.value.trim();

    if (!text) return;

    try {

        const response = await fetch(`/api/plans/${currentViewerPlanId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text })
        });

        const data = await response.json();

        if (data.plan) {

            const idx = allPlans.findIndex(p => p.id === data.plan.id);
            if (idx !== -1) allPlans[idx] = data.plan;

            renderPlansGrid();
            renderPlanViewerBody(data.plan);
        }

    } catch (error) {
        console.log("Add plan item error:", error);
    }
}

async function deleteCurrentPlan() {

    if (!currentViewerPlanId) return;

    const confirmDelete = confirm("Delete this entire plan? This cannot be undone.");

    if (!confirmDelete) return;

    try {

        await fetch(`/api/plans/${currentViewerPlanId}`, { method: "DELETE" });

        allPlans = allPlans.filter(p => p.id !== currentViewerPlanId);

        renderPlansGrid();
        closeNoteViewer();

        currentViewerPlanId = null;

        document.getElementById("viewerPinBtn").style.display = "inline-flex";
        document.getElementById("viewerFavBtn").style.display = "inline-flex";
        document.getElementById("viewerLockBtn").style.display = "inline-flex";
        document.getElementById("viewerFavBtn").setAttribute("onclick", "toggleViewerNoteField('favorite')");

    } catch (error) {
        console.log("Delete plan error:", error);
    }
}
// =========================================================
// WISHLIST
// =========================================================

let allWishlistItems = [];
let currentWishlistAttachment = null;
let currentViewerWishlistId = null;

async function loadWishlist() {

    try {

        const response = await fetch("/api/wishlist");
        const data = await response.json();

        allWishlistItems = data.items || [];

        renderWishlistGrid();

    } catch (error) {
        console.log("Load wishlist error:", error);
    }
}

function renderWishlistGrid() {

    const grid = document.getElementById("wishlistGrid");

    if (!grid) return;

    if (allWishlistItems.length === 0) {

        grid.innerHTML = `
            <div class="notes-empty">
                Nothing on the wishlist yet.<br><br>
                <button class="notes-new-btn" onclick="openNewWishlistModal()">+ Add Item</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = allWishlistItems.map(function (item) {

        const badges = [
            item.favorite ? "❤️" : "",
            item.completed ? "✅" : "",
            item.visibility === "only-me" ? "👤" : "👥"
        ].filter(Boolean).join(" ");

        return `
            <div class="notes-card ${item.completed ? "wishlist-completed" : ""}" onclick="openWishlistViewer('${item.id}')">
                <div class="notes-card-badges">${badges}</div>
                <div class="wishlist-category-tag">${escapeHtml(item.category || "Other")}</div>
                <div class="notes-card-title">🎁 ${escapeHtml(item.title || "Untitled")}</div>
                <div class="notes-card-preview">${escapeHtml((item.description || "").slice(0, 100))}</div>
                <div class="notes-card-meta">
                    <span>${escapeHtml(item.owner || "")}</span>
                    <span>${escapeHtml(item.created_at || "")}</span>
                </div>
            </div>
        `;

    }).join("");
}


// =========================
// NEW WISHLIST MODAL
// =========================

function openNewWishlistModal() {
    document.getElementById("newWishlistModal").classList.add("show");
}

function closeNewWishlistModal() {
    document.getElementById("newWishlistModal").classList.remove("show");
    document.getElementById("wishlistTitleInput").value = "";
    document.getElementById("wishlistDescriptionInput").value = "";
    document.getElementById("wishlistLinkInput").value = "";
    document.getElementById("wishlistAttachStatus").textContent = "";
    currentWishlistAttachment = null;
}

async function handleWishlistAttachment(file) {

    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    document.getElementById("wishlistAttachStatus").textContent = "Uploading...";

    try {

        const response = await fetch("/api/notes/upload-attachment", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.attachment) {
            currentWishlistAttachment = data.attachment;
            document.getElementById("wishlistAttachStatus").textContent = "✓ " + data.attachment.filename;
        }

    } catch (error) {
        document.getElementById("wishlistAttachStatus").textContent = "Upload failed";
    }
}

async function submitNewWishlistItem() {

    const title = document.getElementById("wishlistTitleInput").value.trim();
    const category = document.getElementById("wishlistCategoryInput").value;
    const description = document.getElementById("wishlistDescriptionInput").value.trim();
    const link = document.getElementById("wishlistLinkInput").value.trim();
    const visibility = document.querySelector('input[name="wishlistVisibility"]:checked').value;

    if (!title) {
        alert("Please enter a title.");
        return;
    }

    try {

        const response = await fetch("/api/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: title,
                category: category,
                description: description,
                link: link,
                visibility: visibility,
                attachment: currentWishlistAttachment
            })
        });

        const data = await response.json();

        if (data.item) {
            allWishlistItems.push(data.item);
            renderWishlistGrid();
            closeNewWishlistModal();
        }

    } catch (error) {
        console.log("Create wishlist item error:", error);
    }
}


// =========================
// WISHLIST VIEWER (reuses note viewer modal)
// =========================

function openWishlistViewer(itemId) {

    const item = allWishlistItems.find(w => w.id === itemId);

    if (!item) return;

    currentViewerWishlistId = itemId;
    currentViewerNoteId = null;
    currentViewerJournalId = null;
    currentViewerLetterId = null;
    currentViewerDateId = null;
    currentViewerPlanId = null;

    document.getElementById("viewerPinBtn").style.display = "none";
    document.getElementById("viewerLockBtn").style.display = "none";
    document.getElementById("viewerFavBtn").style.display = "inline-flex";
    document.getElementById("viewerFavBtn").classList.toggle("active", item.favorite);
    document.getElementById("viewerFavBtn").setAttribute("onclick", "toggleWishlistField('favorite')");

    const attachmentHtml = item.attachment
        ? (item.attachment.type === "image"
            ? `<img src="${item.attachment.url}" style="max-width:100%; border-radius:10px; margin-bottom:14px;">`
            : `<a href="${item.attachment.url}" target="_blank">📄 ${escapeHtml(item.attachment.filename)}</a><br><br>`)
        : "";

    const linkHtml = item.link
        ? `<div class="wishlist-link"><a href="${escapeHtml(item.link)}" target="_blank">${escapeHtml(item.link)}</a></div>`
        : "";

    document.getElementById("noteViewerBody").innerHTML = `
        <div class="notes-viewer-title">🎁 ${escapeHtml(item.title || "Untitled")}</div>
        <div class="wishlist-category-tag">${escapeHtml(item.category || "Other")}</div>
        ${attachmentHtml}
        <div class="notes-viewer-content">${escapeHtml(item.description || "")}</div>
        ${linkHtml}
        <div class="notes-viewer-meta">
            Added by: ${escapeHtml(item.owner || "")} · ${item.visibility === "shared" ? "Shared" : "Only Me"}
        </div>
        <div class="notes-viewer-actions">
            <button class="notes-modal-cancel" onclick="toggleWishlistField('completed')">
                ${item.completed ? "Mark as not done" : "Mark as done"}
            </button>
            <button class="notes-modal-cancel" onclick="deleteCurrentWishlistItem()">Delete</button>
        </div>
    `;

    document.getElementById("noteViewerModal").classList.add("show");
}

async function toggleWishlistField(field) {

    if (!currentViewerWishlistId) return;

    try {

        const response = await fetch(`/api/wishlist/${currentViewerWishlistId}/toggle`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ field: field })
        });

        const data = await response.json();

        if (data.item) {

            const idx = allWishlistItems.findIndex(w => w.id === data.item.id);
            if (idx !== -1) allWishlistItems[idx] = data.item;

            renderWishlistGrid();
            openWishlistViewer(data.item.id);
        }

    } catch (error) {
        console.log("Toggle wishlist item error:", error);
    }
}

async function deleteCurrentWishlistItem() {

    if (!currentViewerWishlistId) return;

    const confirmDelete = confirm("Delete this wishlist item? This cannot be undone.");

    if (!confirmDelete) return;

    try {

        await fetch(`/api/wishlist/${currentViewerWishlistId}`, { method: "DELETE" });

        allWishlistItems = allWishlistItems.filter(w => w.id !== currentViewerWishlistId);

        renderWishlistGrid();
        closeNoteViewer();

        currentViewerWishlistId = null;

        document.getElementById("viewerPinBtn").style.display = "inline-flex";
        document.getElementById("viewerLockBtn").style.display = "inline-flex";
        document.getElementById("viewerFavBtn").setAttribute("onclick", "toggleViewerNoteField('favorite')");

    } catch (error) {
        console.log("Delete wishlist item error:", error);
    }
}