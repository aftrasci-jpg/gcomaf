// Sélecteurs obligatoires
const sidenav = document.getElementById("sidenav-main");
const toggler = document.getElementById("iconNavbarSidenav");
const navLinks = document.querySelectorAll("#sidenav-main .nav-link");

// Fonction centrale de fermeture
function closeSidenav() {
  document.body.classList.remove("g-sidenav-pinned");
  sidenav.classList.remove("show");
}

// Toggle menu
toggler.addEventListener("click", () => {
  document.body.classList.toggle("g-sidenav-pinned");
  sidenav.classList.toggle("show");
});

// Fermeture après clic sur lien
navLinks.forEach(link => {
  link.addEventListener("click", () => closeSidenav());
});

// Fermeture au clic extérieur
document.addEventListener("click", (e) => {
  if (!sidenav.contains(e.target) && !toggler.contains(e.target)) {
    closeSidenav();
  }
});
