from flask import Flask, render_template, request, redirect, session, send_from_directory
import os
from dotenv import load_dotenv

# Load .env
load_dotenv()

app = Flask(__name__)

# Secret key from .env
app.secret_key = os.getenv("SECRET_KEY")

# Login credentials from .env
USERNAME = os.getenv("VAULT_USERNAME")
PASSWORD = os.getenv("VAULT_PASSWORD")

# Private image folder
IMAGE_FOLDER = "private_image"
os.makedirs(IMAGE_FOLDER, exist_ok=True)


# =========================
# LOGIN PAGE
# =========================

@app.route("/")
def login():
    return render_template("login.html")


# =========================
# LOGIN CHECK
# =========================

@app.route("/login", methods=["POST"])
def login_check():

    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")

    if username == USERNAME and password == PASSWORD:

        session["logged_in"] = True

        return redirect("/home")

    return "Wrong Username or Password!"
# =========================
# PRIVATE GALLERY
# =========================

@app.route("/home")
def home():

    if not session.get("logged_in"):
        return redirect("/")

    photos = os.listdir(IMAGE_FOLDER)

    return render_template("index.html", photos=photos)


# =========================
# ADD PHOTO
# =========================

@app.route("/upload", methods=["POST"])
def upload():

    if not session.get("logged_in"):
        return redirect("/")

    photo = request.files.get("photo")

    if photo and photo.filename:

        photo.save(
            os.path.join(IMAGE_FOLDER, photo.filename)
        )

    return redirect("/home")


# =========================
# DELETE PHOTO
# =========================

@app.route("/delete/<filename>", methods=["POST"])
def delete_photo(filename):

    if not session.get("logged_in"):
        return redirect("/")

    file_path = os.path.join(IMAGE_FOLDER, filename)

    if os.path.exists(file_path):
        os.remove(file_path)

    return redirect("/home")

# =========================
# RENAME PHOTO
# =========================

@app.route("/rename/<filename>", methods=["POST"])
def rename_photo(filename):

    if not session.get("logged_in"):
        return redirect("/")

    new_name = request.form.get("new_name")

    if not new_name:
        return redirect("/home")

    old_path = os.path.join(IMAGE_FOLDER, filename)

    # Get original extension
    extension = os.path.splitext(filename)[1]

    # Remove extension if user accidentally enters it
    new_name = os.path.splitext(new_name)[0]

    # Keep original extension
    new_name = new_name + extension

    new_path = os.path.join(IMAGE_FOLDER, new_name)

    # Don't overwrite an existing file
    if os.path.exists(old_path) and not os.path.exists(new_path):

        os.rename(old_path, new_path)

    return redirect("/home")
# =========================
# SHOW PRIVATE IMAGE
# =========================

@app.route("/private-image/<filename>")
def private_image(filename):

    if not session.get("logged_in"):
        return redirect("/")

    return send_from_directory(IMAGE_FOLDER, filename)


# =========================
# LOGOUT
# =========================

@app.route("/logout")
def logout():

    session.clear()

    return redirect("/")


# =========================
# RUN APP
# =========================

if __name__ == "__main__":
    app.run(debug=True)
