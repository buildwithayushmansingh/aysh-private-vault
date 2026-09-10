from flask import Flask, render_template, request, redirect, session, jsonify
import os
import secrets
import json
import threading
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

SESSION_GENERATION = secrets.token_hex(32)


# =========================================================
# LOGIN CREDENTIALS
# =========================================================

PASSWORD = os.getenv("VAULT_PASSWORD")

USERS = {
    (os.getenv("VAULT_USERNAME_1") or "").strip().lower(): os.getenv("VAULT_LABEL_1", "Person 1"),
    (os.getenv("VAULT_USERNAME_2") or "").strip().lower(): os.getenv("VAULT_LABEL_2", "Person 2"),
}


# =========================================================
# CLOUDINARY FOLDERS
# =========================================================

CLOUDINARY_FOLDER = "private-vault"

CHAT_ATTACHMENTS_FOLDER = "private-vault-chat"

ACTIVITY_LOG_PUBLIC_ID = "private-vault-meta/activity_log"

CHAT_LOG_PUBLIC_ID = "private-vault-meta/chat_log"

FAVORITES_PUBLIC_ID = "private-vault-meta/favorites"

AVATARS_PUBLIC_ID = "private-vault-meta/avatars"

# =========================================================
# NOTES CONSTANTS (add near your other Cloudinary constants)
# =========================================================

NOTES_PUBLIC_ID = "private-vault-meta/notes"
JOURNAL_PUBLIC_ID = "private-vault-meta/journal"
NOTES_ATTACHMENTS_FOLDER = "private-vault-notes"
LETTERS_PUBLIC_ID = "private-vault-meta/letters"
DATES_PUBLIC_ID = "private-vault-meta/important_dates"

JOURNAL_CACHE = None
JOURNAL_LOCK = threading.Lock()


def load_journal():

    global JOURNAL_CACHE

    with JOURNAL_LOCK:

        if JOURNAL_CACHE is None:
            JOURNAL_CACHE = load_json_store(JOURNAL_PUBLIC_ID)

        return list(JOURNAL_CACHE)


def save_journal(entries):

    global JOURNAL_CACHE

    with JOURNAL_LOCK:
        JOURNAL_CACHE = list(entries)

    threading.Thread(target=save_json_store, args=(JOURNAL_PUBLIC_ID, entries)).start()


def get_visible_journal(identity_name):

    entries = load_journal()

    return [
        e for e in entries
        if e.get("visibility") == "shared" or e.get("owner") == identity_name
    ]


def can_modify_journal(entry, identity_name):

    if entry.get("visibility") == "shared":
        return True

    return entry.get("owner") == identity_name


def add_journal_entry(entry_date, mood, text, tags, visibility, owner, attachment=None):

    entries = load_journal()

    now = datetime.now().strftime("%d %b, %I:%M %p")

    entry = {
        "id": secrets.token_hex(6),
        "date": entry_date,
        "mood": mood,
        "text": text,
        "tags": tags,
        "visibility": visibility,
        "owner": owner,
        "favorite": False,
        "attachment": attachment,
        "created_at": now,
        "updated_at": now
    }

    entries.append(entry)

    save_journal(entries)

    return entry


def find_journal_entry(entries, entry_id):

    for e in entries:
        if e.get("id") == entry_id:
            return e

    return None
LETTERS_CACHE = None
LETTERS_LOCK = threading.Lock()


def load_letters():

    global LETTERS_CACHE

    with LETTERS_LOCK:

        if LETTERS_CACHE is None:
            LETTERS_CACHE = load_json_store(LETTERS_PUBLIC_ID)

        return list(LETTERS_CACHE)


def save_letters(letters):

    global LETTERS_CACHE

    with LETTERS_LOCK:
        LETTERS_CACHE = list(letters)

    threading.Thread(target=save_json_store, args=(LETTERS_PUBLIC_ID, letters)).start()


def get_visible_letters(identity_name):

    letters = load_letters()

    return [
        l for l in letters
        if l.get("visibility") == "shared" or l.get("owner") == identity_name
    ]


def can_modify_letter(letter, identity_name):

    if letter.get("visibility") == "shared":
        return True

    return letter.get("owner") == identity_name


def is_letter_unlocked(letter):

    open_date = letter.get("open_date")

    if not open_date:
        return True

    try:
        target = datetime.strptime(open_date, "%Y-%m-%d").date()
    except Exception:
        return True

    return datetime.now().date() >= target


def strip_letter_content(letter):
    # Real server-side gating: locked letters never send their
    # actual content/attachment to the browser at all.

    safe = dict(letter)
    safe["content"] = None
    safe["attachment"] = None
    safe["unlocked"] = False

    return safe


def find_letter(letters, letter_id):

    for l in letters:
        if l.get("id") == letter_id:
            return l

    return None
@app.route("/api/letters")
def api_get_letters():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    identity_name = session.get("identity_name", "")

    letters = get_visible_letters(identity_name)

    result = []

    for letter in letters:

        if is_letter_unlocked(letter):
            l = dict(letter)
            l["unlocked"] = True
            result.append(l)
        else:
            result.append(strip_letter_content(letter))

    return jsonify({"letters": result})

DATES_CACHE = None
DATES_LOCK = threading.Lock()


def load_dates():

    global DATES_CACHE

    with DATES_LOCK:

        if DATES_CACHE is None:
            DATES_CACHE = load_json_store(DATES_PUBLIC_ID)

        return list(DATES_CACHE)


def save_dates(dates):

    global DATES_CACHE

    with DATES_LOCK:
        DATES_CACHE = list(dates)

    threading.Thread(target=save_json_store, args=(DATES_PUBLIC_ID, dates)).start()


def get_visible_dates(identity_name):

    dates = load_dates()

    return [
        d for d in dates
        if d.get("visibility") == "shared" or d.get("owner") == identity_name
    ]


def can_modify_date(entry, identity_name):

    if entry.get("visibility") == "shared":
        return True

    return entry.get("owner") == identity_name


def find_date_entry(dates, entry_id):

    for d in dates:
        if d.get("id") == entry_id:
            return d

    return None
@app.route("/api/letters", methods=["POST"])
def api_create_letter():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()
    content = (data.get("content") or "").strip()
    open_date = (data.get("open_date") or "").strip() or None
    visibility = data.get("visibility", "shared")
    attachment = data.get("attachment")

    if not title and not content:
        return jsonify({"error": "Write something first"}), 400

    if visibility not in ("shared", "only-me"):
        visibility = "shared"

    owner = session.get("identity_name", "Someone")

    letters = load_letters()

    now = datetime.now().strftime("%d %b, %I:%M %p")

    letter = {
        "id": secrets.token_hex(6),
        "title": title,
        "content": content,
        "attachment": attachment,
        "open_date": open_date,
        "visibility": visibility,
        "owner": owner,
        "favorite": False,
        "read": False,
        "created_at": now,
        "updated_at": now
    }

    letters.append(letter)

    save_letters(letters)

    return jsonify({"letter": letter})


@app.route("/api/letters/<letter_id>")
def api_open_letter(letter_id):
    # Fetching a single letter is the real "unlock" moment -
    # date is checked again here, server-side, and read gets
    # marked true only once it's actually opened.

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    identity_name = session.get("identity_name", "")

    letters = load_letters()

    letter = find_letter(letters, letter_id)

    if not letter:
        return jsonify({"error": "Letter not found"}), 404

    if letter.get("visibility") == "only-me" and letter.get("owner") != identity_name:
        return jsonify({"error": "Not allowed"}), 403

    if not is_letter_unlocked(letter):
        return jsonify({"letter": strip_letter_content(letter)})

    if not letter.get("read"):
        letter["read"] = True
        save_letters(letters)

    result = dict(letter)
    result["unlocked"] = True

    return jsonify({"letter": result})


@app.route("/api/letters/<letter_id>/toggle", methods=["POST"])
def api_toggle_letter(letter_id):

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    identity_name = session.get("identity_name", "")

    data = request.get_json(silent=True) or {}

    field = data.get("field")

    if field not in ("favorite",):
        return jsonify({"error": "Invalid field"}), 400

    letters = load_letters()

    letter = find_letter(letters, letter_id)

    if not letter:
        return jsonify({"error": "Letter not found"}), 404

    if not can_modify_letter(letter, identity_name):
        return jsonify({"error": "Not allowed"}), 403

    letter[field] = not letter.get(field, False)

    save_letters(letters)

    return jsonify({"letter": letter})


@app.route("/api/letters/<letter_id>", methods=["DELETE"])
def api_delete_letter(letter_id):

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    identity_name = session.get("identity_name", "")

    letters = load_letters()

    letter = find_letter(letters, letter_id)

    if not letter:
        return jsonify({"error": "Letter not found"}), 404

    if not can_modify_letter(letter, identity_name):
        return jsonify({"error": "Not allowed"}), 403

    letters = [l for l in letters if l.get("id") != letter_id]

    save_letters(letters)

    return jsonify({"success": True})
# =========================================================
# NOTES STORAGE (add near your CHAT_CACHE section)
# =========================================================

NOTES_CACHE = None
NOTES_LOCK = threading.Lock()


def load_notes():

    global NOTES_CACHE

    with NOTES_LOCK:

        if NOTES_CACHE is None:
            NOTES_CACHE = load_json_store(NOTES_PUBLIC_ID)

        return list(NOTES_CACHE)


def save_notes(notes):

    global NOTES_CACHE

    with NOTES_LOCK:
        NOTES_CACHE = list(notes)

    threading.Thread(target=save_json_store, args=(NOTES_PUBLIC_ID, notes)).start()


def get_visible_notes(identity_name):

    notes = load_notes()

    return [
        n for n in notes
        if n.get("visibility") == "shared" or n.get("owner") == identity_name
    ]


def can_modify_note(note, identity_name):

    if note.get("visibility") == "shared":
        return True

    return note.get("owner") == identity_name


def add_note(title, content, category, tags, visibility, owner, attachment=None):

    notes = load_notes()

    now = datetime.now().strftime("%d %b, %I:%M %p")

    note = {
        "id": secrets.token_hex(6),
        "title": title,
        "content": content,
        "category": category,
        "tags": tags,
        "visibility": visibility,
        "owner": owner,
        "pinned": False,
        "favorite": False,
        "locked": False,
        "attachment": attachment,
        "created_at": now,
        "updated_at": now
    }

    notes.append(note)

    save_notes(notes)

    return note


def find_note(notes, note_id):

    for n in notes:
        if n.get("id") == note_id:
            return n

    return None


# =========================================================
# NOTES PAGE
# =========================================================

@app.route("/notes")
def notes_page():

    if not session.get("logged_in"):
        return redirect("/")

    current_avatar = get_current_avatar()

    return render_template(
        "notes.html",
        display_name=session.get("display_name", ""),
        identity_name=session.get("identity_name", ""),
        current_avatar=current_avatar
    )

@app.route("/api/journal")
def api_get_journal():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    identity_name = session.get("identity_name", "")

    entries = get_visible_journal(identity_name)

    return jsonify({"entries": entries})


@app.route("/api/journal", methods=["POST"])
def api_create_journal():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json(silent=True) or {}

    entry_date = (data.get("date") or "").strip()
    mood = data.get("mood", "🙂")
    text = (data.get("text") or "").strip()
    tags = data.get("tags", [])
    visibility = data.get("visibility", "shared")
    attachment = data.get("attachment")

    if not entry_date:
        entry_date = datetime.now().strftime("%Y-%m-%d")

    if not text:
        return jsonify({"error": "Write something first"}), 400

    if visibility not in ("shared", "only-me"):
        visibility = "shared"

    owner = session.get("identity_name", "Someone")

    entry = add_journal_entry(entry_date, mood, text, tags, visibility, owner, attachment)

    return jsonify({"entry": entry})


@app.route("/api/journal/<entry_id>", methods=["PUT"])
def api_update_journal(entry_id):

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    identity_name = session.get("identity_name", "")

    entries = load_journal()

    entry = find_journal_entry(entries, entry_id)

    if not entry:
        return jsonify({"error": "Entry not found"}), 404

    if not can_modify_journal(entry, identity_name):
        return jsonify({"error": "Not allowed"}), 403

    data = request.get_json(silent=True) or {}

    if "text" in data:
        entry["text"] = (data.get("text") or "").strip()

    if "mood" in data:
        entry["mood"] = data.get("mood")

    if "tags" in data:
        entry["tags"] = data.get("tags") or []

    if "date" in data and data["date"]:
        entry["date"] = data["date"]

    if "visibility" in data and data["visibility"] in ("shared", "only-me"):
        entry["visibility"] = data["visibility"]

    entry["updated_at"] = datetime.now().strftime("%d %b, %I:%M %p")

    save_journal(entries)

    return jsonify({"entry": entry})


@app.route("/api/journal/<entry_id>/toggle", methods=["POST"])
def api_toggle_journal(entry_id):

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    identity_name = session.get("identity_name", "")

    entries = load_journal()

    entry = find_journal_entry(entries, entry_id)

    if not entry:
        return jsonify({"error": "Entry not found"}), 404

    if not can_modify_journal(entry, identity_name):
        return jsonify({"error": "Not allowed"}), 403

    entry["favorite"] = not entry.get("favorite", False)

    save_journal(entries)

    return jsonify({"entry": entry})


@app.route("/api/journal/<entry_id>", methods=["DELETE"])
def api_delete_journal(entry_id):

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    identity_name = session.get("identity_name", "")

    entries = load_journal()

    entry = find_journal_entry(entries, entry_id)

    if not entry:
        return jsonify({"error": "Entry not found"}), 404

    if not can_modify_journal(entry, identity_name):
        return jsonify({"error": "Not allowed"}), 403

    entries = [e for e in entries if e.get("id") != entry_id]

    save_journal(entries)

    return jsonify({"success": True})
# =========================================================
# NOTES API - LIST
# =========================================================

@app.route("/api/notes")
def api_get_notes():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    identity_name = session.get("identity_name", "")

    notes = get_visible_notes(identity_name)

    return jsonify({"notes": notes})


# =========================================================
# NOTES API - CREATE
# =========================================================

@app.route("/api/notes", methods=["POST"])
def api_create_note():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()
    content = (data.get("content") or "").strip()
    category = data.get("category", "us-and-me")
    tags = data.get("tags", [])
    visibility = data.get("visibility", "shared")
    attachment = data.get("attachment")

    if not title and not content:
        return jsonify({"error": "Note needs a title or content"}), 400

    if visibility not in ("shared", "only-me"):
        visibility = "shared"

    owner = session.get("identity_name", "Someone")

    note = add_note(title, content, category, tags, visibility, owner, attachment)

    return jsonify({"note": note})


# =========================================================
# NOTES API - UPDATE
# =========================================================

@app.route("/api/notes/<note_id>", methods=["PUT"])
def api_update_note(note_id):

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    identity_name = session.get("identity_name", "")

    notes = load_notes()

    note = find_note(notes, note_id)

    if not note:
        return jsonify({"error": "Note not found"}), 404

    if not can_modify_note(note, identity_name):
        return jsonify({"error": "Not allowed"}), 403

    data = request.get_json(silent=True) or {}

    if "title" in data:
        note["title"] = (data.get("title") or "").strip()

    if "content" in data:
        note["content"] = (data.get("content") or "").strip()

    if "tags" in data:
        note["tags"] = data.get("tags") or []

    if "visibility" in data and data["visibility"] in ("shared", "only-me"):
        note["visibility"] = data["visibility"]

    note["updated_at"] = datetime.now().strftime("%d %b, %I:%M %p")

    save_notes(notes)

    return jsonify({"note": note})


# =========================================================
# NOTES API - TOGGLE (pinned / favorite / locked)
# =========================================================

@app.route("/api/notes/<note_id>/toggle", methods=["POST"])
def api_toggle_note(note_id):

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    identity_name = session.get("identity_name", "")

    data = request.get_json(silent=True) or {}

    field = data.get("field")

    if field not in ("pinned", "favorite", "locked"):
        return jsonify({"error": "Invalid field"}), 400

    notes = load_notes()

    note = find_note(notes, note_id)

    if not note:
        return jsonify({"error": "Note not found"}), 404

    if not can_modify_note(note, identity_name):
        return jsonify({"error": "Not allowed"}), 403

    note[field] = not note.get(field, False)

    save_notes(notes)

    return jsonify({"note": note})


# =========================================================
# NOTES API - DELETE
# =========================================================

@app.route("/api/notes/<note_id>", methods=["DELETE"])
def api_delete_note(note_id):

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    identity_name = session.get("identity_name", "")

    notes = load_notes()

    note = find_note(notes, note_id)

    if not note:
        return jsonify({"error": "Note not found"}), 404

    if not can_modify_note(note, identity_name):
        return jsonify({"error": "Not allowed"}), 403

    notes = [n for n in notes if n.get("id") != note_id]

    save_notes(notes)

    return jsonify({"success": True})


# =========================================================
# NOTES API - UPLOAD ATTACHMENT
# =========================================================

@app.route("/api/notes/upload-attachment", methods=["POST"])
def api_notes_upload_attachment():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    uploaded_file = request.files.get("file")

    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "No file provided"}), 400

    is_image = uploaded_file.mimetype.startswith("image/")

    try:

        result = cloudinary.uploader.upload(
            uploaded_file,
            folder=NOTES_ATTACHMENTS_FOLDER,
            resource_type="image" if is_image else "raw"
        )

        attachment = {
            "url": result.get("secure_url"),
            "type": "image" if is_image else "file",
            "filename": uploaded_file.filename
        }

        return jsonify({"attachment": attachment})

    except Exception as e:

        return jsonify({"error": f"Upload failed: {e}"}), 500
# =========================================================
# ACTIVE SESSIONS (IN-MEMORY)
# =========================================================

ACTIVE_SESSIONS = {}


# =========================================================
# GENERIC CLOUDINARY JSON STORE HELPERS
# =========================================================

def load_json_store(public_id):

    try:

        import time

        url = cloudinary.utils.cloudinary_url(
            public_id,
            resource_type="raw"
        )[0]

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
# FAVORITES HELPERS
# =========================================================

def load_favorites():
    return load_json_store(FAVORITES_PUBLIC_ID)


def save_favorites(favorites):
    save_json_store(FAVORITES_PUBLIC_ID, favorites)

def load_avatars():

    data = load_json_store(AVATARS_PUBLIC_ID)

    if isinstance(data, dict):
        return data

    return {}


def save_avatars(avatars):
    save_json_store(AVATARS_PUBLIC_ID, avatars)


def get_current_avatar():

    avatars = load_avatars()

    return avatars.get(session.get("identity_name", ""), "")
# =========================================================
# ACTIVITY LOG HELPERS
# =========================================================

def load_activity_log():
    return load_json_store(ACTIVITY_LOG_PUBLIC_ID)


def save_activity_log(entries):

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
# Kept permanently - no trimming.
# Each message may optionally include an "attachment" dict:
# { "url": ..., "type": "image" | "file", "filename": ... }
# =========================================================

CHAT_CACHE = None
CHAT_LOCK = threading.Lock()


def load_chat_log():

    global CHAT_CACHE

    with CHAT_LOCK:

        if CHAT_CACHE is None:
            CHAT_CACHE = load_json_store(CHAT_LOG_PUBLIC_ID)

        return list(CHAT_CACHE)


def save_chat_log(messages):

    global CHAT_CACHE

    with CHAT_LOCK:
        CHAT_CACHE = list(messages)

    # Persist to Cloudinary in the background so it doesn't
    # block the request, and so it never races with the
    # in-memory cache above (which is now the source of truth).
    threading.Thread(target=save_json_store, args=(CHAT_LOG_PUBLIC_ID, messages)).start()


def add_message(sender, text, attachment=None, reply_to=None):

    global CHAT_CACHE

    with CHAT_LOCK:

        if CHAT_CACHE is None:
            CHAT_CACHE = load_json_store(CHAT_LOG_PUBLIC_ID)

        CHAT_CACHE.append({
            "id": secrets.token_hex(6),
            "sender": sender,
            "text": text,
            "attachment": attachment,
            "reply_to": reply_to,
            "timestamp": datetime.now().strftime("%d %b, %I:%M %p")
        })

        messages = list(CHAT_CACHE)

    threading.Thread(target=save_json_store, args=(CHAT_LOG_PUBLIC_ID, messages)).start()

    return messages
def get_shared_files():

    messages = load_chat_log()

    files = [m["attachment"] for m in messages if m.get("attachment")]

    return list(reversed(files))


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

    allowed_endpoints = [
        "login",
        "login_check",
        "static"
    ]

    if request.endpoint in allowed_endpoints:
        return

    if session.get("logged_in"):

        if session.get("session_generation") != SESSION_GENERATION:

            session.clear()

            return redirect("/")


# =========================================================
# LOGIN PAGE
# =========================================================

@app.route("/")
def login():

    if session.get("logged_in"):
        return redirect("/dashboard")

    return render_template("login.html")


# =========================================================
# LOGIN LOGIC (plain helper - NOT a route)
# =========================================================

def perform_login(username, password, display_name, request):

    username = username.strip().lower()

    if username in USERS and password == PASSWORD:

        identity_name = USERS[username]

        session.clear()

        session["logged_in"] = True
        session["session_generation"] = SESSION_GENERATION
        session["identity_name"] = identity_name
        session["display_name"] = display_name if display_name else identity_name

        device_label = get_device_label(request.headers.get("User-Agent"))

        sid = f"{device_label}_{request.remote_addr}"

        session["sid"] = sid

        ACTIVE_SESSIONS[sid] = {
            "name": session["display_name"],
            "device": device_label,
            "login_time": datetime.now().strftime("%d %b, %I:%M %p")
        }

        threading.Thread(
            target=add_activity,
            args=("logged in", None, session["display_name"], "login"),
            kwargs={"device": device_label}
        ).start()

        return True

    return False


@app.route("/login", methods=["POST"])
def login_check():

    username = request.form.get("username", "")
    password = request.form.get("password", "")
    display_name = request.form.get("display_name", "").strip()

    if perform_login(username, password, display_name, request):
        return redirect("/dashboard")

    return "Wrong Username or Password!"


@app.route("/api/login", methods=["POST"])
def api_login():

    data = request.get_json(silent=True) or {}

    username = data.get("username", "")
    password = data.get("password", "")
    display_name = (data.get("display_name") or "").strip()

    if perform_login(username, password, display_name, request):
        return jsonify({"success": True})

    return jsonify({"success": False, "error": "Wrong username or password"}), 401

# =========================================================
# DASHBOARD (LANDING PAGE AFTER LOGIN)
# =========================================================

@app.route("/dashboard")
def dashboard():

    if not session.get("logged_in"):
        return redirect("/")

    entries = load_activity_log()

    recent_activity = list(reversed(entries))[:5]

    current_avatar = get_current_avatar()

    return render_template(
        "dashboard.html",
        recent_activity=recent_activity,
        display_name=session.get("display_name", ""),
        identity_name=session.get("identity_name", ""),
        current_avatar=current_avatar
    )
# =========================================================
# HOME / GALLERY
# =========================================================

@app.route("/home")
def home():

    if not session.get("logged_in"):
        return redirect("/")

    result_holder = {}

    def fetch_photos():
        try:
            result = cloudinary.api.resources(
                type="upload",
                resource_type="image",
                prefix=CLOUDINARY_FOLDER,
                max_results=100
            )

            result_holder["photos"] = [
                {
                    "url": r["secure_url"],
                    "public_id": r["public_id"],
                    "filename": r["public_id"].split("/")[-1]
                }
                for r in result.get("resources", [])
            ]

        except Exception as e:
            print("Cloudinary error:", e)
            result_holder["photos"] = []

    def fetch_favorites():
        result_holder["favorites"] = load_favorites()
    t1 = threading.Thread(target=fetch_photos)
    t2 = threading.Thread(target=fetch_favorites)

    t1.start()
    t2.start()

    t1.join()
    t2.join()

    current_avatar = get_current_avatar()

    return render_template(
        "index.html",
        photos=result_holder["photos"],
        favorites=result_holder["favorites"],
        display_name=session.get("display_name", ""),
        identity_name=session.get("identity_name", ""),
        current_avatar=current_avatar
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

    new_name = os.path.splitext(new_name)[0]

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

    shared_files = get_shared_files()

    return render_template(
        "chat.html",
        messages=messages,
        shared_files=shared_files,
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

    return jsonify({
        "messages": messages,
        "shared_files": get_shared_files()
    })


# =========================================================
# CHAT - SEND TEXT MESSAGE
# =========================================================
@app.route("/api/avatars")
def api_avatars():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    return jsonify({"avatars": load_avatars()})
@app.route("/api/send-message", methods=["POST"])
def send_message():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json(silent=True) or {}

    text = (data.get("text") or "").strip()

    reply_to = data.get("reply_to")

    if not text:
        return jsonify({"error": "Empty message"}), 400

    sender = session.get("identity_name", "Someone")

    messages = add_message(sender, text, reply_to=reply_to)

    return jsonify({"messages": messages, "shared_files": get_shared_files()})
# =========================================================
# FAVORITES - TOGGLE
# =========================================================

@app.route("/api/toggle-favorite", methods=["POST"])
def toggle_favorite():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json(silent=True) or {}

    public_id = data.get("public_id")

    if not public_id:
        return jsonify({"error": "Missing public_id"}), 400

    favorites = load_favorites()

    if public_id in favorites:
        favorites.remove(public_id)
        is_favorite = False
    else:
        favorites.append(public_id)
        is_favorite = True

    save_favorites(favorites)

    return jsonify({"is_favorite": is_favorite, "favorites": favorites})

@app.route("/api/set-avatar", methods=["POST"])
def set_avatar():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json(silent=True) or {}

    avatar_url = data.get("avatar_url")

    if not avatar_url:
        return jsonify({"error": "Missing avatar_url"}), 400

    avatars = load_avatars()

    avatars[session["identity_name"]] = avatar_url

    save_avatars(avatars)

    return jsonify({"avatar_url": avatar_url})
# =========================================================
# CHAT - SEND FILE / IMAGE ATTACHMENT
# =========================================================

@app.route("/api/send-file", methods=["POST"])
def send_file():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    uploaded_file = request.files.get("file")

    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "No file provided"}), 400

    sender = session.get("identity_name", "Someone")

    filename = uploaded_file.filename

    is_image = uploaded_file.mimetype.startswith("image/")

    try:

        result = cloudinary.uploader.upload(
            uploaded_file,
            folder=CHAT_ATTACHMENTS_FOLDER,
            resource_type="image" if is_image else "raw"
        )

        attachment = {
            "url": result.get("secure_url"),
            "type": "image" if is_image else "file",
            "filename": filename
        }

        messages = add_message(sender, "", attachment=attachment)

        return jsonify({"messages": messages, "shared_files": get_shared_files()})

    except Exception as e:

        print("Chat file upload error:", e)

        return jsonify({"error": f"Upload failed: {e}"}), 500


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

    return jsonify({"messages": messages, "shared_files": get_shared_files()})


# =========================================================
# CHAT - CLEAR ALL MESSAGES
# =========================================================

@app.route("/api/clear-chat", methods=["POST"])
def clear_chat():

    if not session.get("logged_in"):
        return jsonify({"error": "Not logged in"}), 401

    save_chat_log([])

    return jsonify({"messages": [], "shared_files": []})


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

    SESSION_GENERATION = secrets.token_hex(32)

    ACTIVE_SESSIONS.clear()

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