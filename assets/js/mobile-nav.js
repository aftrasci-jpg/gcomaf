/**
 * Gestionnaire de navigation mobile pour Argon Dashboard
 * JavaScript vanilla pour une UX mobile fluide
 */

class MobileNavManager {
  constructor() {
    this.sidenav = null;
    this.toggler = null;
    this.overlay = null;
    this.isOpen = false;
    this.init();
  }

  init() {
    // Sélectionner les éléments
    this.sidenav = document.getElementById('sidenav-main');
    this.toggler = document.getElementById('iconNavbarSidenav');

    if (!this.sidenav || !this.toggler) {
      console.warn('Mobile navigation elements not found');
      return;
    }

    // Vérifier si on est sur mobile
    this.checkMobileState();

    // Écouter les changements de taille d'écran
    window.addEventListener('resize', () => this.checkMobileState());

    // Attacher les événements
    this.attachEvents();
  }

  checkMobileState() {
    const isMobile = window.innerWidth < 1200;

    if (isMobile) {
      this.enableMobileNav();
    } else {
      this.disableMobileNav();
    }
  }

  enableMobileNav() {
    // Ajouter l'overlay si nécessaire
    this.createOverlay();

    // Attacher les événements pour mobile
    this.toggler.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleMenu();
    });

    // Fermer le menu quand on clique sur un lien
    const navLinks = this.sidenav.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => this.closeMenu());
    });

    // Fermer le menu quand on clique sur l'overlay
    if (this.overlay) {
      this.overlay.addEventListener('click', () => this.closeMenu());
    }

    // Fermer le menu avec la touche Échap
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeMenu();
      }
    });
  }

  disableMobileNav() {
    // Supprimer l'overlay
    this.removeOverlay();

    // S'assurer que le menu est visible sur desktop
    document.body.classList.remove('g-sidenav-hidden');
    document.body.classList.add('g-sidenav-show');
  }

  createOverlay() {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.id = 'mobile-nav-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1030;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    `;

    document.body.appendChild(this.overlay);
  }

  removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  toggleMenu() {
    if (this.isOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  openMenu() {
    if (this.isOpen) return;

    this.isOpen = true;

    // Cacher le menu latéral
    document.body.classList.remove('g-sidenav-show');
    document.body.classList.add('g-sidenav-hidden');

    // Afficher l'overlay
    if (this.overlay) {
      this.overlay.style.opacity = '1';
      this.overlay.style.visibility = 'visible';
    }

    // Changer l'icône du bouton (optionnel, si on veut animer)
    this.updateTogglerIcon();
  }

  closeMenu() {
    if (!this.isOpen) return;

    this.isOpen = false;

    // Montrer le menu latéral
    document.body.classList.remove('g-sidenav-hidden');
    document.body.classList.add('g-sidenav-show');

    // Cacher l'overlay
    if (this.overlay) {
      this.overlay.style.opacity = '0';
      this.overlay.style.visibility = 'hidden';
    }

    // Remettre l'icône du bouton
    this.updateTogglerIcon();
  }

  updateTogglerIcon() {
    // Animation optionnelle de l'icône hamburger
    // Pour l'instant, on garde simple
  }

  attachEvents() {
    // Événements supplémentaires si nécessaire
    // Prévention du scroll quand le menu est ouvert
    this.preventScrollWhenOpen();
  }

  preventScrollWhenOpen() {
    // Empêcher le scroll du body quand le menu mobile est ouvert
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const body = document.body;
          if (body.classList.contains('g-sidenav-hidden') && this.isOpen) {
            body.style.overflow = 'hidden';
          } else {
            body.style.overflow = '';
          }
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  // Initialiser le gestionnaire de navigation mobile
  window.mobileNavManager = new MobileNavManager();

  // Fix pour les pages où le menu doit être caché par défaut sur mobile
  if (window.innerWidth < 1200) {
    document.body.classList.remove('g-sidenav-show');
    document.body.classList.add('g-sidenav-hidden');
  }
});