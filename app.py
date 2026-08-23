from flask import Flask, render_template, request, redirect, session, send_from_directory
import os
from dotenv import load_dotenv

app = Flask(__name__)

app.secret_key = "my-secret-key"

# Load .env file
load_dotenv()

# Login credentials from .env
USERNAME = os.getenv("VAULT_USERNAME")
PASSWORD = os.getenv("VAULT_PASSWORD")

IMAGE_FOLDER = "private_image"

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

    username = request.form.get("username")
    password = request.form.get("password")

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