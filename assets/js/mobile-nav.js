document.addEventListener("DOMContentLoaded", () => {
  const sidenav = document.getElementById("sidenav-main");
  const toggler = document.getElementById("iconNavbarSidenav");
  const navLinks = document.querySelectorAll("#sidenav-main .nav-link");
  const body = document.body;

  if (!sidenav || !toggler) return;

  // Création overlay
  const overlay = document.createElement("div");
  overlay.id = "sidenav-overlay";
  document.body.appendChild(overlay);

  function openSidenav() {
    body.classList.add("g-sidenav-show");
    body.classList.remove("g-sidenav-hidden");
    overlay.classList.add("active");
  }

  function closeSidenav() {
    body.classList.remove("g-sidenav-show");
    body.classList.add("g-sidenav-hidden");
    overlay.classList.remove("active");
  }

  // Toggle bouton hamburger
  toggler.addEventListener("click", () => {
    body.classList.toggle("g-sidenav-show");
    body.classList.toggle("g-sidenav-hidden");
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
      body.classList.contains("g-sidenav-show") &&
      !sidenav.contains(e.target) &&
      !toggler.contains(e.target)
    ) {
      closeSidenav();
    }
  });
});
