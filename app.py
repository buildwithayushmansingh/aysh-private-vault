from flask import Flask, render_template, request, redirect, session, jsonify
import os
import secrets
import json
from datetime import datetime

from dotenv import load_dotenv

import cloudinary
import cloudinary.uploader
import cloudinary.api
import cloudinary.utils


# =========================================================
# LOAD ENVIRONMENT VARIABLES
# =========================================================

load_dotenv()


# =========================================================
# CLOUDINARY CONFIGURATION
# =========================================================

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)


# =========================================================
# FLASK
# =========================================================

app = Flask(__name__)

app.secret_key = os.getenv("SECRET_KEY")


# =========================================================
# SESSION GENERATION
# =========================================================
# Every time this value changes, all old login sessions
# become invalid.
#
# No database required.
# =========================================================

SESSION_GENERATION = secrets.token_hex(32)


# =========================================================
# LOGIN CREDENTIALS
# =========================================================
# Two usernames, one shared password. Whichever username
# is used to log in becomes that person's identity for the
# session - this is what powers the Welcome banner and
# chat sender name reliably (unlike the free-text display
# name box, which is just a casual label for activity logs).
# =========================================================

PASSWORD = os.getenv("VAULT_PASSWORD")

USERS = {
    (os.getenv("VAULT_USERNAME_1") or "").strip().lower(): os.getenv("VAULT_LABEL_1", "Person 1"),
    (os.getenv("VAULT_USERNAME_2") or "").strip().lower(): os.getenv("VAULT_LABEL_2", "Person 2"),
}


# =========================================================
# CLOUDINARY FOLDER
# =========================================================

CLOUDINARY_FOLDER = "private-vault"

ACTIVITY_LOG_PUBLIC_ID = "private-vault-meta/activity_log"

CHAT_LOG_PUBLIC_ID = "private-vault-meta/chat_log"


# =========================================================
# ACTIVE SESSIONS (IN-MEMORY)
# =========================================================
# Resets if the server restarts. Fine for a small shared
# vault - not meant to be a permanent session database.
# =========================================================

ACTIVE_SESSIONS = {}


# =========================================================
# GENERIC CLOUDINARY JSON STORE HELPERS
# =========================================================
# Used for both the activity log and the chat log - each
# is just a JSON file living in Cloudinary, so both survive
# Render restarts permanently, same as your photos.
# =========================================================

def load_json_store(public_id):

    try:

        import time

        url = cloudinary.utils.cloudinary_url(
            public_id,
            resource_type="raw"
        )[0]

        # Cache-bust so we always get the freshest version,
        # since Cloudinary's CDN can serve stale cached copies.
        url = f"{url}?t={int(time.time())}"

        import urllib.request

        with urllib.request.urlopen(url, timeout=5) as response:
            data = response.read().decode("utf-8")

        return json.loads(data)

    except Exception as e:

        print(f"JSON store load error for {public_id} (probably doesn't exist yet):", e)

        return []


def save_json_store(public_id, entries):

    try:

        import io

        json_bytes = json.dumps(entries).encode("utf-8")

        cloudinary.uploader.upload(
            io.BytesIO(json_bytes),
            public_id=public_id,
            resource_type="raw",
            overwrite=True,
            invalidate=True
        )

    except Exception as e:

        print(f"JSON store save error for {public_id}:", e)


# =========================================================
# ACTIVITY LOG HELPERS
# =========================================================

def load_activity_log():
    return load_json_store(ACTIVITY_LOG_PUBLIC_ID)


def save_activity_log(entries):

    # Keep only the most recent 100 entries
    entries = entries[-100:]

    save_json_store(ACTIVITY_LOG_PUBLIC_ID, entries)


def add_activity(action, filename, actor, action_type, device=None):

    entries = load_activity_log()

    entries.append({
        "action": action,
        "action_type": action_type,
        "filename": filename,
        "actor": actor,
        "device": device,
        "timestamp": datetime.now().strftime("%d %b, %I:%M %p")
    })

    save_activity_log(entries)


# =========================================================
# CHAT LOG HELPERS
# =========================================================
# Kept permanently - no trimming - per your request.
# Worth knowing: Cloudinary's free plan has file size
# limits, so an extremely long chat history (thousands of
# messages) could eventually need trimming. Not a concern
# for normal day-to-day use.
# =========================================================

def load_chat_log():
    return load_json_store(CHAT_LOG_PUBLIC_ID)


def save_chat_log(messages):
    save_json_store(CHAT_LOG_PUBLIC_ID, messages)


def add_message(sender, text):

    messages = load_chat_log()

    messages.append({
        "id": secrets.token_hex(6),
        "sender": sender,
        "text": text,
        "timestamp": datetime.now().strftime("%d %b, %I:%M %p")
    })

    save_chat_log(messages)

    return messages
# =========================================================
# DEVICE LABEL FROM USER-AGENT
# =========================================================

def get_device_label(user_agent_string):

    ua = (user_agent_string or "").lower()

    if "iphone" in ua or "ipad" in ua:
        return "iPhone / iPad"

    if "android" in ua:
        return "Android Device"

    if "windows" in ua:
        return "Windows PC"

    if "macintosh" in ua or "mac os" in ua:
        return "Mac"

    return "Unknown Device"


# =========================================================
# CHECK LOGIN SESSION
# =========================================================

@app.before_request
def check_session():

    # These routes should work without login
    allowed_endpoints = [
        "login",
        "login_check",
        "static"
    ]

    if request.endpoint in allowed_endpoints:
        return

    # If user is logged in, check whether the session
    # belongs to the current session generation.
    if session.get("logged_in"):

        if session.get("session_generation") != SESSION_GENERATION:

            # Old session -> logout
            session.clear()

            return redirect("/")


# =========================================================
# LOGIN PAGE
# =========================================================

@app.route("/")
def login():

    if session.get("logged_in"):
        return redirect("/home")

    return render_template("login.html")


# =========================================================
# LOGIN
# =========================================================

@app.route("/login", methods=["POST"])
def login_check():

    username = request.form.get("username", "").strip().lower()
    password = request.form.get("password", "")
    display_name = request.form.get("display_name", "").strip()

    if username in USERS and password == PASSWORD:

        identity_name = USERS[username]

        session.clear()

        session["logged_in"] = True

        # Store current session generation
        session["session_generation"] = SESSION_GENERATION

        # Reliable identity, based on which username logged in.
        # Powers the Welcome banner and chat sender name.
        session["identity_name"] = identity_name

        # Free-text label, kept separately for the activity log
        # (defaults to identity_name if left blank).
        session["display_name"] = display_name if display_name else identity_name

        # Track this session as an active device.
        # Keyed by device type + IP, so re-logging in from the
        # same device updates its entry instead of duplicating it.
        device_label = get_device_label(request.headers.get("User-Agent"))

        sid = f"{device_label}_{request.remote_addr}"

        session["sid"] = sid

        ACTIVE_SESSIONS[sid] = {
            "name": session["display_name"],
            "device": device_label,
            "login_time": datetime.now().strftime("%d %b, %I:%M %p")
        }

        add_activity("logged in", None, session["display_name"], "login", device=device_label)

        return redirect("/home")

    return "Wrong Username or Password!"


# =========================================================
# HOME / GALLERY
# =========================================================

@app.route("/home")
def home():

    if not session.get("logged_in"):
        return redirect("/")

    try:

        result = cloudinary.api.resources(
            type="upload",
            resource_type="image",
            prefix=CLOUDINARY_FOLDER,
            max_results=100
        )

        photos = []

        for resource in result.get("resources", []):

            photos.append({
                "url": resource["secure_url"],
                "public_id": resource["public_id"],
                "filename": resource["public_id"].split("/")[-1]
            })

    except Exception as e:

        print("Cloudinary error:", e)

        photos = []

    return render_template(
        "index.html",
        photos=photos,
        display_name=session.get("display_name", ""),
        identity_name=session.get("identity_name", "")
    )


# =========================================================
# UPLOAD PHOTO
# =========================================================

@app.route("/upload", methods=["POST"])
def upload():

    if not session.get("logged_in"):
        return redirect("/")

    photo = request.files.get("photo")

    if photo and photo.filename:

        try:

            result = cloudinary.uploader.upload(
                photo,
                folder=CLOUDINARY_FOLDER,
                resource_type="image"
            )

            print("Uploaded:", result.get("secure_url"))

            filename = result.get("public_id", "").split("/")[-1]

            add_activity("uploaded", filename, session.get("display_name", "Someone"), "upload")

        except Exception as e:

            print("Upload error:", e)

            return f"Upload failed: {e}"

    return redirect("/home")


# =========================================================
# DELETE PHOTO
# =========================================================

@app.route("/delete", methods=["POST"])
def delete_photo():

    if not session.get("logged_in"):
        return redirect("/")

    public_id = request.form.get("public_id")

    if not public_id:
        return redirect("/home")

    try:

        result = cloudinary.uploader.destroy(
            public_id,
            resource_type="image",
            invalidate=True
        )

        print("Delete result:", result)

        filename = public_id.split("/")[-1]

        add_activity("deleted", filename, session.get("display_name", "Someone"), "delete")

    except Exception as e:

        print("Delete error:", e)

    return redirect("/home")


# =========================================================
# RENAME PHOTO
# =========================================================

@app.route("/rename", methods=["POST"])
def rename_photo():

    if not session.get("logged_in"):
        return redirect("/")

    old_public_id = request.form.get("old_public_id")
    new_name = request.form.get("new_name", "").strip()

    if not old_public_id or not new_name:
        return redirect("/home")

    # Remove extension if user enters one
    new_name = os.path.splitext(new_name)[0]

    # Keep photo inside private-vault folder
    new_public_id = f"{CLOUDINARY_FOLDER}/{new_name}"

    try:

        result = cloudinary.uploader.rename(
            old_public_id,
            new_public_id,
            resource_type="image",
            invalidate=True
        )

        print("Rename result:", result)

        add_activity("renamed", new_name, session.get("display_name", "Someone"), "rename")

    except Exception as e:

        print("Rename error:", e)

    return redirect("/home")


# =========================================================
# SECURITY DASHBOARD
# =========================================================

@app.route("/security")
def security():

    if not session.get("logged_in"):
        return redirect("/")

    entries = load_activity_log()

    last_login = "N/A"

    for entry in reversed(entries):
        if entry["action"] == "logged in":
            last_login = entry["timestamp"]
            break

    return render_template(
        "security.html",
        active_session_count=len(ACTIVE_SESSIONS),
        last_login=last_login,
        display_name=session.get("display_name", ""),
        identity_name=session.get("identity_name", "")
    )


# =========================================================
# ACTIVITY LOG PAGE
# =========================================================

@app.route("/activity")
def activity_page():

    if not session.get("logged_in"):
        return redirect("/")

    entries = load_activity_log()

    entries = list(reversed(entries))[:30]

    return render_template(
        "activity.html",
        entries=entries,
        display_name=session.get("display_name", ""),
        identity_name=session.get("identity_name", "")
    )


# =========================================================
# STORAGE DASHBOARD
# =========================================================

@app.route("/storage")
def storage_page():

    if not session.get("logged_in"):
        return redirect("/")

    try:

        usage = cloudinary.api.usage()

        storage_bytes = usage.get("storage", {}).get("usage", 0)
        storage_limit = usage.get("storage", {}).get("limit", 0)

        storage_mb = round(storage_bytes / (1024 * 1024), 1)
        storage_limit_mb = round(storage_limit / (1024 * 1024), 1) if storage_limit else 0

        percent_used = round((storage_bytes / storage_limit) * 100) if storage_limit else 0

        resources = cloudinary.api.resources(
            type="upload",
            resource_type="image",
            prefix=CLOUDINARY_FOLDER,
            max_results=100
        )

        photo_count = len(resources.get("resources", []))

    except Exception as e:

        print("Storage usage error:", e)

        storage_mb = 0
        storage_limit_mb = 0
        percent_used = 0
        photo_count = 0

    return render_template(
        "storage.html",
        photo_count=photo_count,
        storage_mb=storage_mb,
        storage_limit_mb=storage_limit_mb,
        percent_used=percent_used,
        display_name=session.get("display_name", ""),
        identity_name=session.get("identity_name", "")
    )


# =========================================================
# CHAT PAGE
# =========================================================

@app.route("/chat")
def chat_page():

    if not session.get("logged_in"):
        return redirect("/")

    messages = load_chat_log()

    return render_template(
        "chat.html",
        messages=messages,
        display_name=session.get("display_name", ""),
        identity_name=session.get("identity_name", "")
    )


# =========================================================
# CHAT - GET MESSAGES (POLLED BY FRONTEND)
# =========================================================

@app.route("/api/messages")
def get_messages():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    messages = load_chat_log()

    return jsonify({"messages": messages})


# =========================================================
# CHAT - SEND MESSAGE
# =========================================================

@app.route("/api/send-message", methods=["POST"])
def send_message():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json(silent=True) or {}

    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({"error": "Empty message"}), 400

    sender = session.get("identity_name", "Someone")

    messages = add_message(sender, text)

    return jsonify({"messages": messages})

# =========================================================
# CHAT - DELETE ONE MESSAGE
# =========================================================

@app.route("/api/delete-message", methods=["POST"])
def delete_message():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json(silent=True) or {}

    msg_id = data.get("id")

    messages = load_chat_log()

    messages = [m for m in messages if m.get("id") != msg_id]

    save_chat_log(messages)

    return jsonify({"messages": messages})


# =========================================================
# CHAT - CLEAR ALL MESSAGES
# =========================================================

@app.route("/api/clear-chat", methods=["POST"])
def clear_chat():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    save_chat_log([])

    return jsonify({"messages": []})
# =========================================================
# LOGOUT CURRENT DEVICE
# =========================================================

@app.route("/logout")
def logout():

    sid = session.get("sid")

    if sid and sid in ACTIVE_SESSIONS:
        del ACTIVE_SESSIONS[sid]

    session.clear()

    return redirect("/")


# =========================================================
# LOGOUT ALL DEVICES
# =========================================================

@app.route("/logout-all", methods=["POST"])
def logout_all():

    global SESSION_GENERATION

    # Generate a completely new session generation.
    #
    # All previously logged-in devices have the OLD generation.
    # Therefore, they will automatically become invalid.
    SESSION_GENERATION = secrets.token_hex(32)

    # Clear all tracked active sessions
    ACTIVE_SESSIONS.clear()

    # Logout current device too
    session.clear()

    return redirect("/")


# =========================================================
# LOCAL DEVELOPMENT
# =========================================================

if __name__ == "__main__":

    port = int(os.environ.get("PORT", 8000))

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False,
        threaded=True
    )