/**
 * Gestionnaire des cartes cliquables du dashboard
 * Permet la navigation vers les pages correspondantes
 */

document.addEventListener("DOMContentLoaded", () => {
  // Sélectionner toutes les cartes du dashboard
  const dashboardCards = document.querySelectorAll('.dashboard-card');

  dashboardCards.forEach(card => {
    // Ajouter tabindex pour l'accessibilité
    card.setAttribute('tabindex', '0');

    // Gestionnaire de clic
    card.addEventListener('click', (e) => {
      // Lire l'attribut data-link
      const link = card.getAttribute('data-link');
      if (link) {
        // Redirection avec window.location.href
        window.location.href = link;
      }
    });

    // Gestionnaire clavier (Enter) pour l'accessibilité
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const link = card.getAttribute('data-link');
        if (link) {
          window.location.href = link;
        }
      }
    });
  });
});