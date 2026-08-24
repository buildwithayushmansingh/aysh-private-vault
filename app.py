from flask import Flask, render_template, request, redirect, session
import os

from dotenv import load_dotenv

import cloudinary
import cloudinary.uploader
import cloudinary.api


# =========================
# LOAD ENVIRONMENT VARIABLES
# =========================

load_dotenv()


# =========================
# FLASK APP
# =========================

app = Flask(__name__)

app.secret_key = os.getenv("SECRET_KEY")


# =========================
# LOGIN CREDENTIALS
# =========================

USERNAME = os.getenv("VAULT_USERNAME")
PASSWORD = os.getenv("VAULT_PASSWORD")


# =========================
# CLOUDINARY CONFIGURATION
# =========================

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)


# Cloudinary folder
CLOUDINARY_FOLDER = "private-vault"


# =========================
# LOGIN PAGE
# =========================

@app.route("/")
def login():

    if session.get("logged_in"):
        return redirect("/home")

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

    try:

        result = cloudinary.api.resources(
            type="upload",
            resource_type="image",
            prefix=CLOUDINARY_FOLDER,
            max_results=500
        )

        photos = result.get("resources", [])

    except Exception as e:

        print("Cloudinary error:", e)

        photos = []

    return render_template(
        "index.html",
        photos=photos
    )


# =========================
# UPLOAD PHOTO
# =========================

@app.route("/upload", methods=["POST"])
def upload():

    if not session.get("logged_in"):
        return redirect("/")

    photo = request.files.get("photo")

    if not photo or not photo.filename:
        return redirect("/home")

    try:

        result = cloudinary.uploader.upload(
            photo,
            folder=CLOUDINARY_FOLDER,
            resource_type="image",
            use_filename=True,
            unique_filename=True
        )

        print("Uploaded:", result.get("secure_url"))

    except Exception as e:

        print("Upload error:", e)

    return redirect("/home")


# =========================
# DELETE PHOTO
# =========================

@app.route("/delete/<path:public_id>", methods=["POST"])
def delete_photo(public_id):

    if not session.get("logged_in"):
        return redirect("/")

    try:

        cloudinary.uploader.destroy(
            public_id,
            resource_type="image"
        )

        print("Deleted:", public_id)

    except Exception as e:

        print("Delete error:", e)

    return redirect("/home")


# =========================
# RENAME PHOTO
# =========================

@app.route("/rename/<path:public_id>", methods=["POST"])
def rename_photo(public_id):

    if not session.get("logged_in"):
        return redirect("/")

    new_name = request.form.get("new_name", "").strip()

    if not new_name:
        return redirect("/home")

    try:

        # Remove extension if user enters one
        new_name = os.path.splitext(new_name)[0]

        # Keep photo inside private-vault folder
        new_public_id = f"{CLOUDINARY_FOLDER}/{new_name}"

        cloudinary.uploader.rename(
            public_id,
            new_public_id,
            resource_type="image",
            overwrite=False
        )

        print("Renamed:", public_id, "→", new_public_id)

    except Exception as e:

        print("Rename error:", e)

    return redirect("/home")


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

    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=True
    )