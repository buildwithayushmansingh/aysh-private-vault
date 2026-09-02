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
        btn.textContent = theme === "terminal" ? "🌌 Normal Mode" : "🖥️ Terminal Mode";
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

    function scrollChatToBottom() {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function renderMessages(messages) {

        if (!messages || messages.length === 0) {

            chatWindow.innerHTML = '<div class="chat-empty">No messages yet. Say hi 👋</div>';

            return;
        }

        chatWindow.innerHTML = messages.map(function (msg) {

            const rowClass = msg.sender === CURRENT_IDENTITY ? "mine" : "theirs";

            // Basic escaping so someone typing HTML doesn't break the page
            const safeText = msg.text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

            const deleteButton = msg.sender === CURRENT_IDENTITY
                ? `<button type="button" class="chat-delete-button" onclick="deleteMessage('${msg.id}')">🗑</button>`
                : "";

            return `
                <div class="chat-bubble-row ${rowClass}">
                    <div class="chat-bubble">
                        <div class="chat-bubble-sender">${msg.sender}</div>
                        <div class="chat-bubble-text">${safeText}</div>
                        <div class="chat-bubble-time">${msg.timestamp}</div>
                        ${deleteButton}
                    </div>
                </div>
            `;

        }).join("");

        lastMessageCount = messages.length;
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
                scrollChatToBottom();
            }

        } catch (error) {

            console.log("Chat send error:", error);

        }
    });

    // Initial scroll to bottom on page load
    scrollChatToBottom();

    // Auto-refresh every 1.5 seconds
    setInterval(fetchMessages, 1500);

    // Also refresh immediately whenever the tab becomes active again,
    // so reopening the chat doesn't wait for the next timer tick
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
            item.style.display = "none";
        }

    });

    const gallery = document.getElementById("vaultGallery");

    if (gallery && filter === "favorites") {

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