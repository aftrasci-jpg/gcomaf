document.addEventListener("DOMContentLoaded", () => {

  const sidenav = document.getElementById("sidenav-main");
  const toggleBtn = document.getElementById("iconNavbarSidenav");
  const closeBtn = document.getElementById("iconSidenav");
  const overlay = document.getElementById("sidenav-overlay");

  if (!sidenav) return;

  // -----------------------------
  // Fonctions
  // -----------------------------
  function openMenu() {
    document.body.classList.add("g-sidenav-show");
    document.body.classList.remove("g-sidenav-hidden");
    overlay.classList.add("show");
  }

  function closeMenu() {
    document.body.classList.remove("g-sidenav-show");
    document.body.classList.add("g-sidenav-hidden");
    overlay.classList.remove("show");
  }

  function toggleMenu() {
    if (document.body.classList.contains("g-sidenav-show")) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  // -----------------------------
  // Boutons
  // -----------------------------
  if (toggleBtn) {
    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      toggleMenu();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeMenu();
    });
  }

  // -----------------------------
  // Clic sur un lien du menu
  // -----------------------------
  const menuLinks = sidenav.querySelectorAll(".nav-link");
  menuLinks.forEach(link => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });

  // -----------------------------
  // Clic sur l’overlay
  // -----------------------------
  if (overlay) {
    overlay.addEventListener("click", () => {
      closeMenu();
    });
  }

  // -----------------------------
  // Sécurité : bloquer redirections Argon démo
  // -----------------------------
  (function blockDemoRedirect() {
    const forbidden = ["demos.creative-tim.com","argon-dashboard"];
    const originalAssign = window.location.assign;
    const originalReplace = window.location.replace;

    function isForbidden(url) {
      return forbidden.some(f => url && url.includes(f));
    }

    window.location.assign = function (url) {
      if (isForbidden(url)) {
        console.warn("Redirection Argon bloquée :", url);
        return;
      }
      return originalAssign.call(window.location, url);
    };

    window.location.replace = function (url) {
      if (isForbidden(url)) {
        console.warn("Redirection Argon bloquée :", url);
        return;
      }
      return originalReplace.call(window.location, url);
    };
  })();

  // Bloquer redirection logo
  const navbarBrand = document.querySelector('.navbar-brand');
  if (navbarBrand) {
    navbarBrand.addEventListener('click', (e) => {
      const forbidden = ["demos.creative-tim.com","argon-dashboard"];
      const isForbidden = forbidden.some(f => navbarBrand.href && navbarBrand.href.includes(f));
      if (isForbidden) {
        e.preventDefault();
        console.warn("Redirection logo bloquée :", navbarBrand.href);
      }
    });
  }

});