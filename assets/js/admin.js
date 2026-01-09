/**
 * Point d'entrée principal pour l'administration CRM
 * Utilise l'architecture modulaire des services pour une meilleure maintenabilité
 */

import { checkAuth } from './auth.js';
import { formatCFA } from './utils.js';

// Services
import { authAdminService } from './services/auth-admin.js';
import { usersService } from './services/users.service.js';
import { clientsService } from './services/clients.service.js';
import { salesService } from './services/sales.service.js';
import { dashboardService } from './services/dashboard.service.js';

/**
 * Gestion du code d'accès agent dans le dashboard admin
 * Le code est généré automatiquement par le service si nécessaire.
 * L'admin ne fait que le récupérer et le partager.
 */
function setupAccessCodeViewer() {
  const btn = document.getElementById('generate-access-code-btn');
  const displayDiv = document.getElementById('access-code-display');
  const codeInput = document.getElementById('generated-code');
  const linkInput = document.getElementById('generated-link');
  const copyCodeBtn = document.getElementById('copy-code-btn');
  const copyLinkBtn = document.getElementById('copy-link-btn');

  if (!btn) return;

  btn.addEventListener('click', async () => {
    try {
      UIUtils.showLoading("Récupération du code d'accès...");

      // 🔐 Le service décide automatiquement s'il faut générer un nouveau code
      const result = await authAdminService.getOrCreateAgentAccessCode();

      codeInput.value = result.code;
      linkInput.value = result.link;
      displayDiv.classList.remove('d-none');

      UIUtils.hideLoading();
      UIUtils.showSuccess("Code d'accès prêt à être utilisé");

    } catch (error) {
      UIUtils.hideLoading();
      UIUtils.showError(
        "Erreur lors de la récupération du code : " + error.message
      );
    }
  });

  // 📋 Copier le code
  if (copyCodeBtn && codeInput) {
    copyCodeBtn.addEventListener('click', () => {
      codeInput.select();
      document.execCommand('copy');
      UIUtils.showSuccess("Code copié dans le presse-papiers");
    });
  }

  // 🔗 Copier le lien d'inscription
  if (copyLinkBtn && linkInput) {
    copyLinkBtn.addEventListener('click', () => {
      linkInput.select();
      document.execCommand('copy');
      UIUtils.showSuccess("Lien d'inscription copié");
    });
  }
}

// Protection d'accès admin
checkAuth('admin');

// Variables globales pour la gestion d'état
let currentLoadingState = false;

/**
 * Utilitaires UI
 */
class UIUtils {
  static showLoading(message = 'Chargement...') {
    const loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.innerHTML = `
      <div class="loading-overlay">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">${message}</span>
        </div>
        <div class="mt-2">${message}</div>
      </div>
    `;
    loader.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.8);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    `;
    document.body.appendChild(loader);
    currentLoadingState = true;
  }

  static hideLoading() {
    const loader = document.getElementById('global-loader');
    if (loader) {
      loader.remove();
    }
    currentLoadingState = false;
  }

  static showError(message, duration = 5000) {
    const errorBox = document.getElementById('error-message');
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.style.display = 'block';

      // Auto-hide after duration
      setTimeout(() => {
        errorBox.style.display = 'none';
      }, duration);
    }

    // Also log to console for debugging
    console.error('UI Error:', message);
  }

  static showSuccess(message, duration = 3000) {
    // Créer ou utiliser une boîte de succès
    let successBox = document.getElementById('success-message');
    if (!successBox) {
      successBox = document.createElement('div');
      successBox.id = 'success-message';
      successBox.className = 'alert alert-success';
      successBox.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
      `;
      document.body.appendChild(successBox);
    }

    successBox.textContent = message;
    successBox.style.display = 'block';

    setTimeout(() => {
      successBox.style.display = 'none';
    }, duration);
  }

  static confirmAction(message) {
    return confirm(message);
  }
}

/**
 * Gestionnaire des utilisateurs (LECTURE UNIQUEMENT)
 */
class UserManager {
  constructor() {
    this.usersTable = null;
    this.statsUpdated = false;
    this.allUsers = []; // Stocker tous les utilisateurs pour la recherche
    this.filteredUsers = [];
  }

  async init() {
    this.usersTable = document.getElementById('users-tbody');
    if (this.usersTable) {
      await this.loadUsers();
      this.bindEvents();
      this.initSearch();
    }

    // 🔥 IMPORTANT
    window.userManager = this;
  }

  async loadUsers() {
    try {
      UIUtils.showLoading('Chargement des utilisateurs...');
      const [users, stats] = await Promise.all([
        usersService.getAllUsers(),
        usersService.getUserStats()
      ]);

      if (!this.usersTable) return;

      this.usersTable.innerHTML = '';

      users.forEach(user => {
        const row = this.createUserRow(user);
        this.usersTable.appendChild(row);
      });

      // Mettre à jour les statistiques
      this.updateStats(stats);

      // Alimenter le système de filtrage
      onUsersLoadedForFiltering(users);

      UIUtils.hideLoading();

    } catch (error) {
      UIUtils.hideLoading();
      UIUtils.showError('Erreur lors du chargement des utilisateurs: ' + error.message);
    }
  }

  updateStats(stats) {
    const totalEl = document.getElementById('total-users');
    const activeEl = document.getElementById('active-users');
    const agentEl = document.getElementById('agent-count');
    const supervisorEl = document.getElementById('supervisor-count');

    if (totalEl) totalEl.textContent = stats.total;
    if (activeEl) activeEl.textContent = stats.active;
    if (agentEl) agentEl.textContent = stats.byRole.agent || 0;
    if (supervisorEl) supervisorEl.textContent = stats.byRole.supervisor || 0;

    this.statsUpdated = true;
  }

  createUserRow(user) {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${user.firstName}</td>
      <td>${user.lastName}</td>
      <td>${user.email}</td>
      <td><span class="badge bg-${this.getRoleColor(user.role)}">${this.formatRole(user.role)}</span></td>
      <td><span class="badge bg-${user.status === 'active' ? 'success' : 'secondary'}">${this.formatStatus(user.status)}</span></td>
      <td>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary btn-toggle" data-id="${user.id}" data-status="${user.status}" title="${user.status === 'active' ? 'Désactiver' : 'Activer'}">
            <i class="fas fa-${user.status === 'active' ? 'ban' : 'check'}"></i>
          </button>
          <button class="btn btn-outline-info btn-send-credentials" data-id="${user.id}" data-email="${user.email}" data-firstname="${user.firstName}" title="Envoyer les identifiants">
            <i class="fas fa-envelope"></i>
          </button>
        </div>
      </td>
    `;

    return row;
  }

  getRoleColor(role) {
    const colors = {
      admin: 'danger',
      supervisor: 'warning',
      agent: 'info'
    };
    return colors[role] || 'secondary';
  }

  formatRole(role) {
    const labels = {
      admin: 'Administrateur',
      supervisor: 'Superviseur',
      agent: 'Agent'
    };
    return labels[role] || role;
  }

  formatStatus(status) {
    return status === 'active' ? 'Actif' : 'Inactif';
  }

  bindEvents() {
    // Toggle status buttons
    document.addEventListener('click', async (e) => {
      if (e.target.closest('.btn-toggle')) {
        const button = e.target.closest('.btn-toggle');
        const userId = button.dataset.id;
        const currentStatus = button.dataset.status;

        await this.toggleUserStatus(userId, currentStatus);
      }

      // Send credentials buttons
      if (e.target.closest('.btn-send-credentials')) {
        const button = e.target.closest('.btn-send-credentials');
        const userId = button.dataset.id;
        const email = button.dataset.email;
        const firstName = button.dataset.firstname;

        await this.sendCredentials(userId, email, firstName);
      }
    });
  }

  /**
   * Initialise la fonctionnalité de recherche
   */
  initSearch() {
    const searchInput = document.getElementById('user-search');
    const clearButton = document.getElementById('clear-search');

    if (!searchInput) return;

    // Charger tous les utilisateurs pour la recherche
    usersService.getAllUsers().then(users => {
      this.allUsers = users;
      this.filteredUsers = [...users];
    }).catch(error => {
      console.error('Erreur lors du chargement des utilisateurs pour la recherche:', error);
    });

    // Écouteur pour la recherche en temps réel
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.trim().toLowerCase();
      this.filterUsers(searchTerm);
    });

    // Bouton pour effacer la recherche
    if (clearButton) {
      clearButton.addEventListener('click', () => {
        searchInput.value = '';
        this.filterUsers('');
        searchInput.focus();
      });
    }
  }

  /**
   * Filtre les utilisateurs selon le terme de recherche
   */
  filterUsers(searchTerm) {
    if (!searchTerm) {
      this.filteredUsers = [...this.allUsers];
    } else {
      this.filteredUsers = this.allUsers.filter(user =>
        user.firstName.toLowerCase().includes(searchTerm) ||
        user.lastName.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        user.role.toLowerCase().includes(searchTerm)
      );
    }

    this.renderFilteredUsers();
  }

  /**
   * Affiche les utilisateurs filtrés
   */
  renderFilteredUsers() {
    if (!this.usersTable) return;

    this.usersTable.innerHTML = '';

    this.filteredUsers.forEach(user => {
      const row = this.createUserRow(user);
      this.usersTable.appendChild(row);
    });
  }

  async toggleUserStatus(userId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activer' : 'désactiver';

    if (!UIUtils.confirmAction(`Êtes-vous sûr de vouloir ${action} cet utilisateur ?`)) {
      return;
    }

    try {
      UIUtils.showLoading(`Modification du statut...`);
      await usersService.updateUserStatus(userId, newStatus);
      UIUtils.hideLoading();

      UIUtils.showSuccess(`Utilisateur ${action === 'activer' ? 'activé' : 'désactivé'} avec succès`);

      // Recharger la liste
      await this.loadUsers();

    } catch (error) {
      UIUtils.hideLoading();
      UIUtils.showError('Erreur lors de la modification du statut: ' + error.message);
    }
  }

  async sendCredentials(userId, email, firstName) {
    // TODO: Implémenter l'envoi d'email
    UIUtils.showError('Fonctionnalité d\'envoi d\'email à implémenter');
  }
}

/**
 * Gestionnaire du dashboard
 */
class DashboardManager {
  constructor() {
    this.statsLoaded = false;
  }

  async init() {
    await this.loadStats();
  }

  async loadStats() {
    try {
      const stats = await dashboardService.getMainStats();

      // Mettre à jour les compteurs
      this.updateCounter('clients-count', stats.clientsCount);
      this.updateCounter('agents-count', stats.agentsCount);
      this.updateCounter('sales-total', formatCFA(stats.salesTotal));
      this.updateCounter('commissions-total', formatCFA(stats.commissionsTotal));

      this.statsLoaded = true;

    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
      UIUtils.showError('Erreur lors du chargement des statistiques');
    }
  }

  updateCounter(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
    }
  }
}

/**
 * Gestionnaire des ventes
 */
class SalesManager {
  constructor() {
    this.salesTable = null;
    this.agentSelect = null;
  }

  async init() {
    this.salesTable = document.getElementById('sales-tbody');
    this.agentSelect = document.getElementById('agent-select');

    if (this.salesTable) {
      await this.loadSales();
    }

    if (this.agentSelect) {
      await this.loadAgentsForSelect();
    }

    this.bindEvents();
  }

  async loadSales() {
    try {
      UIUtils.showLoading('Chargement des ventes...');

      // Récupérer les ventes, clients et utilisateurs
      const [sales, clients, users, commissions] = await Promise.all([
        salesService.getAllSales(),
        clientsService.getAllClients(),
        usersService.getAllUsers(),
        this.getAllCommissions()
      ]);

      // Créer des maps pour un accès rapide
      const clientsMap = {};
      clients.forEach(client => {
        const clientData = client.data || {};
        const clientName = `${clientData.firstName || clientData.prenom || ''} ${clientData.lastName || clientData.nom || ''}`.trim();
        clientsMap[client.id] = clientName || 'Client inconnu';
      });

      const usersMap = {};
      users.forEach(user => {
        usersMap[user.id] = `${user.firstName} ${user.lastName}`;
      });

      const commissionsMap = {};
      commissions.forEach(commission => {
        commissionsMap[commission.saleId] = commission;
      });

      if (!this.salesTable) return;

      this.salesTable.innerHTML = '';

      sales.forEach(sale => {
        const clientName = clientsMap[sale.clientId] || 'Client inconnu';
        const agentName = usersMap[sale.agentId] || 'Agent inconnu';
        const commission = commissionsMap[sale.id];

        const row = this.createSaleRow(sale, clientName, agentName, commission);
        this.salesTable.appendChild(row);
      });

      UIUtils.hideLoading();

    } catch (error) {
      UIUtils.hideLoading();
      UIUtils.showError('Erreur lors du chargement des ventes: ' + error.message);
    }
  }

  /**
   * Récupère toutes les commissions
   */
  async getAllCommissions() {
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
    const { db } = await import('./firebase.js');

    const commissionsSnapshot = await getDocs(collection(db, 'commissions'));
    const commissions = [];

// Récupération des commissions
    commissionsSnapshot.forEach(doc => {
      commissions.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
        paidAt: doc.data().paidAt?.toDate?.() || null
      });
    });

    return commissions;
  }

  createSaleRow(sale, clientName, agentName, commission) {
    const row = document.createElement('tr');

    // Formater la date
    const saleDate = sale.createdAt?.toDate?.() ? sale.createdAt.toDate() : new Date(sale.createdAt);
    const formattedDate = this.formatDate(saleDate);

    // Déterminer le statut de la commission
    let commissionStatus = 'Non créée';
    let statusBadge = '<span class="badge bg-secondary">Non créée</span>';

    if (commission) {
      if (commission.status === 'paid') {
        commissionStatus = 'Payée';
        statusBadge = '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Payée</span>';
      } else {
        commissionStatus = 'En attente';
        statusBadge = '<span class="badge bg-warning"><i class="fas fa-clock me-1"></i>En attente</span>';
      }
    }

    row.innerHTML = `
      <td>
        <div class="d-flex align-items-center">
          <div class="avatar avatar-sm me-3">
            <i class="fas fa-user-circle fa-lg text-primary"></i>
          </div>
          <div>
            <span class="font-weight-bold">${clientName}</span>
          </div>
        </div>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <div class="avatar avatar-xs me-2">
            <i class="fas fa-user-tie text-secondary"></i>
          </div>
          <span>${agentName}</span>
        </div>
      </td>
      <td>
        <span class="badge bg-info">${formatCFA(sale.chiffreAffaires)}</span>
      </td>
      <td>
        <span class="badge bg-secondary">${formatCFA(sale.montantReel)}</span>
      </td>
      <td>
        <span class="badge bg-warning">${formatCFA(sale.benefice)}</span>
      </td>
      <td>
        <span class="badge bg-primary">${sale.tauxCommission}%</span>
      </td>
      <td>
        <span class="fw-bold text-success">${formatCFA(sale.commission)}</span>
      </td>
      <td>
        <span class="text-sm">${formattedDate}</span>
      </td>
      <td>
        ${statusBadge}
      </td>
    `;

    return row;
  }

  /**
   * Formate une date pour l'affichage
   */
  formatDate(date) {
    if (!date) return 'N/A';
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async loadAgentsForSelect() {
    try {
      const users = await usersService.getAllUsers();
      const agents = users.filter(u => u.role === 'agent' || u.role === 'supervisor');

      if (!this.agentSelect) return;

      this.agentSelect.innerHTML = '<option value="">Sélectionner un agent</option>';

      agents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        option.textContent = `${agent.firstName} ${agent.lastName}`;
        this.agentSelect.appendChild(option);
      });

    } catch (error) {
      console.error('Erreur lors du chargement des agents:', error);
    }
  }

  bindEvents() {
    // Calcul automatique des commissions
    const inputs = ['chiffre-affaires', 'montant-reel', 'taux-commission'];
    inputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', () => this.calculateCommission());
      }
    });

    // Formulaire de création de vente
    const saleForm = document.getElementById('create-sale-form');
    if (saleForm) {
      saleForm.addEventListener('submit', (e) => this.handleSaleSubmit(e));
    }
  }

  calculateCommission() {
    const ca = parseFloat(document.getElementById('chiffre-affaires')?.value) || 0;
    const mr = parseFloat(document.getElementById('montant-reel')?.value) || 0;
    const tc = parseFloat(document.getElementById('taux-commission')?.value) || 0;

    const { benefice, commission } = salesService.calculateCommission(ca, mr, tc);

    const beneficeEl = document.getElementById('benefice');
    const commissionEl = document.getElementById('commission');

    if (beneficeEl) beneficeEl.textContent = formatCFA(benefice);
    if (commissionEl) commissionEl.textContent = formatCFA(commission);
  }

  async handleSaleSubmit(e) {
    e.preventDefault();

    const formData = {
      agentId: document.getElementById('agent-select')?.value,
      chiffreAffaires: parseFloat(document.getElementById('chiffre-affaires')?.value),
      montantReel: parseFloat(document.getElementById('montant-reel')?.value),
      tauxCommission: parseFloat(document.getElementById('taux-commission')?.value)
    };

    // Validation
    if (!formData.agentId) {
      UIUtils.showError('Veuillez sélectionner un agent');
      return;
    }

    if (isNaN(formData.chiffreAffaires) || formData.chiffreAffaires < 0) {
      UIUtils.showError('Chiffre d\'affaires invalide');
      return;
    }

    try {
      UIUtils.showLoading('Création de la vente...');

      await salesService.createSale(
        formData.agentId,
        formData.chiffreAffaires,
        formData.montantReel,
        formData.tauxCommission
      );

      UIUtils.hideLoading();
      UIUtils.showSuccess('Vente créée avec succès');

      // Réinitialiser le formulaire
      e.target.reset();
      document.getElementById('benefice').textContent = '0';
      document.getElementById('commission').textContent = '0';

      // Recharger la liste
      await this.loadSales();

    } catch (error) {
      UIUtils.hideLoading();
      UIUtils.showError('Erreur lors de la création de la vente: ' + error.message);
    }
  }
}

/**
 * Gestion stable de la sidenav (mobile + desktop)
 * Remplace les comportements buggés d'Argon en mobile
 */
function initStableSidenav() {
  const body = document.body;
  const sidenav = document.getElementById("sidenav-main");
  const openBtn = document.getElementById("iconNavbarSidenav");
  const closeBtn = document.getElementById("iconSidenav");

  if (!sidenav || !openBtn) return;

  // Créer l'overlay si nécessaire
  let overlay = document.getElementById("sidenav-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "sidenav-overlay";
    document.body.appendChild(overlay);
  }

  function openSidenav() {
    // Pour mobile (< 1200px)
    if (window.innerWidth < 1200) {
      body.classList.add("g-sidenav-show");
      body.classList.remove("g-sidenav-hidden");
      overlay.classList.add("active");
    } else {
      // Pour desktop (>= 1200px)
      body.classList.add("g-sidenav-pinned");
      sidenav.classList.add("show");
    }
  }

  function closeSidenav() {
    // Pour mobile (< 1200px)
    if (window.innerWidth < 1200) {
      body.classList.remove("g-sidenav-show");
      body.classList.add("g-sidenav-hidden");
      overlay.classList.remove("active");
    } else {
      // Pour desktop (>= 1200px)
      body.classList.remove("g-sidenav-pinned");
      sidenav.classList.remove("show");
    }
  }

  // Ouvrir le menu
  openBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openSidenav();
  });

  // Fermer via l'icône X
  if (closeBtn) {
    closeBtn.addEventListener("click", closeSidenav);
  }

  // Fermer après clic sur un lien (mobile uniquement)
  sidenav.querySelectorAll("a.nav-link").forEach(link => {
    link.addEventListener("click", () => {
      if (window.innerWidth < 1200) {
        setTimeout(closeSidenav, 100); // Petit délai pour la navigation
      }
    });
  });

  // Fermer si clic sur overlay (mobile uniquement)
  overlay.addEventListener("click", () => {
    if (window.innerWidth < 1200) {
      closeSidenav();
    }
  });

  // Fermer si clic en dehors du menu (mobile uniquement)
  document.addEventListener("click", (e) => {
    if (
      window.innerWidth < 1200 &&
      body.classList.contains("g-sidenav-show") &&
      !sidenav.contains(e.target) &&
      !openBtn.contains(e.target)
    ) {
      closeSidenav();
    }
  });

  // Gestion du redimensionnement de fenêtre
  window.addEventListener("resize", () => {
    // Fermer automatiquement en mode mobile si ouvert en desktop
    if (window.innerWidth >= 1200 && body.classList.contains("g-sidenav-show")) {
      closeSidenav();
    }
  });

  // État initial : fermé sur mobile, ouvert sur desktop
  if (window.innerWidth >= 1200) {
    body.classList.add("g-sidenav-pinned");
    sidenav.classList.add("show");
  } else {
    body.classList.add("g-sidenav-hidden");
    body.classList.remove("g-sidenav-show");
  }
}

/**
 * Gestionnaire principal de l'interface admin
 */
class AdminInterface {
  constructor() {
    this.managers = {};
    this.init();
  }

  async init() {
    try {
      // Initialiser tous les gestionnaires
      this.managers.dashboard = new DashboardManager();
      this.managers.users = new UserManager();
      this.managers.sales = new SalesManager();

      // Initialiser chaque gestionnaire
      await Promise.all([
        this.managers.dashboard.init(),
        this.managers.users.init(),
        this.managers.sales.init()
      ]);

      // Initialisation de la navigation stable
      initStableSidenav();

      console.log('Interface admin initialisée avec succès');

    } catch (error) {
      console.error('Erreur lors de l\'initialisation:', error);
      UIUtils.showError('Erreur lors de l\'initialisation de l\'interface');
    }
  }
}

// Démarrage de l'application
document.addEventListener('DOMContentLoaded', () => {
  // Initialiser l'interface admin
  window.adminInterface = new AdminInterface();

  // Initialiser le visualiseur de code d'accès
  setupAccessCodeViewer();
});

// Variables globales pour le filtrage des utilisateurs
let allUsers = [];       // Tous les utilisateurs chargés
let filteredUsers = []; // Résultat du filtre courant
let currentFilter = "all";

/* ----------------------------------
   Gestion des cartes cliquables pour filtrer les utilisateurs
----------------------------------- */
document.addEventListener("DOMContentLoaded", () => {

  const cards = document.querySelectorAll(".user-filter-card");

  cards.forEach(card => {
    card.addEventListener("click", () => {

      const filter = card.dataset.filter;
      currentFilter = filter;

      // UI active
      cards.forEach(c => c.classList.remove("active"));
      card.classList.add("active");

      applyUserFilters();
    });
  });

});

/* ----------------------------------
   Chargement initial des utilisateurs pour le filtrage
----------------------------------- */
function onUsersLoadedForFiltering(users) {
  allUsers = users;
  filteredUsers = [...allUsers];
  renderFilteredUsers(filteredUsers);
  updateUserStats(allUsers);
}

/* ----------------------------------
   Application des filtres utilisateurs
----------------------------------- */
function applyUserFilters() {

  let result = [...allUsers];

  switch (currentFilter) {
    case "active":
      result = result.filter(u => u.status === "active");
      break;

    case "agent":
      result = result.filter(u => u.role === "agent");
      break;

    case "supervisor":
      result = result.filter(u => u.role === "supervisor");
      break;

    case "all":
    default:
      break;
  }

  // 🔍 Appliquer aussi la recherche texte
  const searchInput = document.getElementById("user-search");
  const term = searchInput.value.toLowerCase();

  if (term) {
    result = result.filter(u =>
      u.firstName.toLowerCase().includes(term) ||
      u.lastName.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  }

  filteredUsers = result;
  renderFilteredUsers(filteredUsers);
}

/* ----------------------------------
   Recherche en temps réel (mise à jour pour compatibilité avec filtres)
----------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("user-search");
  const clearButton = document.getElementById("clear-search");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      applyUserFilters();
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      applyUserFilters();
    });
  }
});

/* ----------------------------------
   Rendu du tableau des utilisateurs filtrés
----------------------------------- */
function renderFilteredUsers(users) {

  const tbody = document.getElementById("users-tbody");
  tbody.innerHTML = "";

  if (!users.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted">
          Aucun utilisateur trouvé
        </td>
      </tr>`;
    return;
  }

  users.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.firstName}</td>
      <td>${u.lastName}</td>
      <td>${u.email}</td>
      <td><span class="badge bg-${getRoleColor(u.role)}">${formatRole(u.role)}</span></td>
      <td><span class="badge bg-${u.status === 'active' ? 'success' : 'secondary'}">${formatStatus(u.status)}</span></td>
      <td>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary btn-toggle" data-id="${u.id}" data-status="${u.status}" title="${u.status === 'active' ? 'Désactiver' : 'Activer'}">
            <i class="fas fa-${u.status === 'active' ? 'ban' : 'check'}"></i>
          </button>
          <button class="btn btn-outline-info btn-send-credentials" data-id="${u.id}" data-email="${u.email}" data-firstname="${u.firstName}" title="Envoyer les identifiants">
            <i class="fas fa-envelope"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ----------------------------------
   Mise à jour des stats utilisateurs
----------------------------------- */
function updateUserStats(users) {

  document.getElementById("total-users").textContent = users.length;

  document.getElementById("active-users").textContent =
    users.filter(u => u.status === "active").length;

  document.getElementById("agent-count").textContent =
    users.filter(u => u.role === "agent").length;

  document.getElementById("supervisor-count").textContent =
    users.filter(u => u.role === "supervisor").length;
}

/* ----------------------------------
   Fonctions utilitaires pour le rendu
----------------------------------- */
function getRoleColor(role) {
  const colors = {
    admin: 'danger',
    supervisor: 'warning',
    agent: 'info'
  };
  return colors[role] || 'secondary';
}

function formatRole(role) {
  const labels = {
    admin: 'Administrateur',
    supervisor: 'Superviseur',
    agent: 'Agent'
  };
  return labels[role] || role;
}

function formatStatus(status) {
  return status === 'active' ? 'Actif' : 'Inactif';
}

// Export pour les tests
export { AdminInterface, UIUtils };
