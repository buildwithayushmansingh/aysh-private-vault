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