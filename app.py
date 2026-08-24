from flask import Flask, render_template, request, redirect, session
import os

from dotenv import load_dotenv

import cloudinary
import cloudinary.uploader
import cloudinary.api


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
# LOGIN CREDENTIALS
# =========================================================

USERNAME = os.getenv("VAULT_USERNAME")
PASSWORD = os.getenv("VAULT_PASSWORD")


# =========================================================
# CLOUDINARY FOLDER
# =========================================================

CLOUDINARY_FOLDER = "private-vault"


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

    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")

    if username == USERNAME and password == PASSWORD:

        session["logged_in"] = True

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
        photos=photos
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

    except Exception as e:

        print("Delete error:", e)

    return redirect("/home")


# =========================================================
# RENAME PHOTO
# =========================================================

@app.route("/rename", methods=["POST"])
def rename_photo():

    if not session.get("logged_in"):
        return redirect("/home")

    old_public_id = request.form.get("old_public_id")
    new_name = request.form.get("new_name", "").strip()

    if not old_public_id or not new_name:
        return redirect("/home")

    # Remove extension if user enters one
    new_name = os.path.splitext(new_name)[0]

    # Keep the file inside our Cloudinary folder
    new_public_id = f"{CLOUDINARY_FOLDER}/{new_name}"

    try:

        result = cloudinary.uploader.rename(
            old_public_id,
            new_public_id,
            resource_type="image",
            invalidate=True
        )

        print("Rename result:", result)

    except Exception as e:

        print("Rename error:", e)

    return redirect("/home")


# =========================================================
# LOGOUT
# =========================================================

@app.route("/logout")
def logout():

    session.clear()

    return redirect("/")


# =========================================================
# LOCAL DEVELOPMENT
# =========================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=8000,
        debug=True
    )