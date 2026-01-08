document.addEventListener("DOMContentLoaded", () => {
  const sidenav = document.getElementById("sidenav-main");
  const toggler = document.getElementById("iconNavbarSidenav");
  const navLinks = document.querySelectorAll("#sidenav-main .nav-link");

  if (!sidenav || !toggler) return;

  // Création overlay
  const overlay = document.createElement("div");
  overlay.id = "sidenav-overlay";
  document.body.appendChild(overlay);

  function openSidenav() {
    sidenav.classList.add("show");
    document.body.classList.add("g-sidenav-pinned");
    overlay.classList.add("active");
  }

  function closeSidenav() {
    sidenav.classList.remove("show");
    document.body.classList.remove("g-sidenav-pinned");
    overlay.classList.remove("active");
  }

  // Toggle bouton hamburger
  toggler.addEventListener("click", (e) => {
    e.stopPropagation();
    if (sidenav.classList.contains("show")) {
      closeSidenav();
    } else {
      openSidenav();
    }
  });

  // Clic sur un lien => ferme
  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      closeSidenav();
    });
  });

  // Clic sur overlay => ferme
  overlay.addEventListener("click", closeSidenav);

  // Sécurité : clic extérieur
  document.addEventListener("click", (e) => {
    if (
      sidenav.classList.contains("show") &&
      !sidenav.contains(e.target) &&
      !toggler.contains(e.target)
    ) {
      closeSidenav();
    }
  });
});
