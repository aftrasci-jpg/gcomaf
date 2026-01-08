import { db } from './firebase.js';
import { collection, getDocs, doc, updateDoc, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { checkAuth } from './auth.js';

// Protection d'accès admin
checkAuth('admin');

/**
 * Gestionnaire de la page Commissions
 * Gère l'affichage, la recherche et la gestion des statuts de paiement des commissions
 */

class CommissionsManager {
  constructor() {
    this.commissionsTable = null;
    this.allCommissions = [];
    this.filteredCommissions = [];
    this.currentCommissionId = null;
    this.init();
  }

  async init() {
    this.commissionsTable = document.getElementById('commissions-tbody');
    if (this.commissionsTable) {
      await this.loadCommissions();
      this.initSearch();
      this.bindEvents();
    }
  }

  /**
   * Charge toutes les commissions
   */
  async loadCommissions() {
    try {
      this.showLoading('Chargement des commissions...');

      // Récupérer les utilisateurs pour les noms d'agents
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersMap = {};
      usersSnapshot.forEach(doc => {
        const user = doc.data();
        usersMap[doc.id] = `${user.firstName} ${user.lastName}`;
      });

      // Récupérer les clients pour les noms de clients
      const clientsSnapshot = await getDocs(collection(db, 'clients'));
      const clientsMap = {};
      clientsSnapshot.forEach(doc => {
        const client = doc.data();
        const clientData = client.data || {};
        const clientName = `${clientData.firstName || clientData.prenom || ''} ${clientData.lastName || clientData.nom || ''}`.trim();
        clientsMap[doc.id] = clientName || 'Client inconnu';
      });

      // Récupérer les commissions
      const commissionsQuery = query(
        collection(db, 'commissions'),
        orderBy('createdAt', 'desc')
      );
      const commissionsSnapshot = await getDocs(commissionsQuery);

      this.allCommissions = [];
      commissionsSnapshot.forEach((docSnap) => {
        const commissionData = docSnap.data();
        const agentName = usersMap[commissionData.agentId] || 'Agent inconnu';
        const clientName = clientsMap[commissionData.clientId] || 'Client inconnu';

        const commission = {
          id: docSnap.id,
          ...commissionData,
          agentName,
          clientName,
          // Conversion des timestamps Firestore
          createdAt: commissionData.createdAt?.toDate?.() || new Date(commissionData.createdAt),
          paidAt: commissionData.paidAt?.toDate?.() || null
        };

        this.allCommissions.push(commission);
      });

      this.filteredCommissions = [...this.allCommissions];
      this.renderCommissions();
      this.updateStatistics();

      this.hideLoading();

    } catch (error) {
      this.hideLoading();
      this.showError('Erreur lors du chargement des commissions: ' + error.message);
      console.error('Erreur chargement commissions:', error);
    }
  }

  /**
   * Affiche les commissions dans le tableau
   */
  renderCommissions() {
    if (!this.commissionsTable) return;

    this.commissionsTable.innerHTML = '';

    if (this.filteredCommissions.length === 0) {
      // Message pour aucun résultat
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="9" class="text-center py-4">
          <div class="text-muted">
            <i class="fas fa-gem fa-2x mb-3"></i>
            <p class="mb-0">Aucune commission trouvée</p>
          </div>
        </td>
      `;
      this.commissionsTable.appendChild(emptyRow);
      return;
    }

    this.filteredCommissions.forEach(commission => {
      const row = this.createCommissionRow(commission);
      this.commissionsTable.appendChild(row);
    });
  }

  /**
   * Crée une ligne de tableau pour une commission
   */
  createCommissionRow(commission) {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>
        <div class="d-flex align-items-center">
          <div class="avatar avatar-sm me-3">
            <i class="fas fa-user-circle fa-lg text-primary"></i>
          </div>
          <div>
            <span class="font-weight-bold">${commission.clientName}</span>
          </div>
        </div>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <div class="avatar avatar-xs me-2">
            <i class="fas fa-user-tie text-secondary"></i>
          </div>
          <span>${commission.agentName}</span>
        </div>
      </td>
      <td>
        <span class="badge bg-info">${this.formatCurrency(commission.benefice)}</span>
      </td>
      <td>
        <span class="badge bg-secondary">${commission.taux}%</span>
      </td>
      <td>
        <span class="fw-bold text-primary">${this.formatCurrency(commission.amount)}</span>
      </td>
      <td>
        ${this.createStatusBadge(commission.status)}
      </td>
      <td>
        <span class="text-sm">${this.formatDate(commission.createdAt)}</span>
      </td>
      <td>
        ${commission.paidAt ? `<span class="text-sm">${this.formatDate(commission.paidAt)}</span>` : '<span class="text-muted">-</span>'}
      </td>
      <td>
        ${commission.status === 'pending' ? `
          <button class="btn btn-sm btn-success btn-mark-paid"
                  data-commission-id="${commission.id}"
                  data-amount="${commission.amount}"
                  data-agent="${commission.agentName}"
                  title="Marquer comme payée">
            <i class="fas fa-check"></i> Payer
          </button>
        ` : `
          <span class="badge bg-success">
            <i class="fas fa-check me-1"></i>Payée
          </span>
        `}
      </td>
    `;

    return row;
  }

  /**
   * Crée un badge pour le statut
   */
  createStatusBadge(status) {
    const statusConfig = {
      pending: {
        class: 'bg-warning',
        text: 'En attente',
        icon: 'fas fa-clock'
      },
      paid: {
        class: 'bg-success',
        text: 'Payée',
        icon: 'fas fa-check-circle'
      }
    };

    const config = statusConfig[status] || statusConfig.pending;

    return `
      <span class="badge ${config.class}">
        <i class="${config.icon} me-1"></i>${config.text}
      </span>
    `;
  }

  /**
   * Initialise la fonctionnalité de recherche
   */
  initSearch() {
    const searchInput = document.getElementById('commission-search');
    const clearButton = document.getElementById('clear-commission-search');

    if (!searchInput) return;

    // Recherche en temps réel
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.trim().toLowerCase();
      this.filterCommissions(searchTerm);
    });

    // Bouton effacer
    if (clearButton) {
      clearButton.addEventListener('click', () => {
        searchInput.value = '';
        this.filterCommissions('');
        searchInput.focus();
      });
    }
  }

  /**
   * Filtre les commissions selon le terme de recherche
   */
  filterCommissions(searchTerm) {
    if (!searchTerm) {
      this.filteredCommissions = [...this.allCommissions];
    } else {
      this.filteredCommissions = this.allCommissions.filter(commission =>
        commission.agentName.toLowerCase().includes(searchTerm) ||
        commission.clientName.toLowerCase().includes(searchTerm)
      );
    }

    this.renderCommissions();
    this.updateCommissionCount();
  }

  /**
   * Met à jour le compteur de commissions
   */
  updateCommissionCount() {
    const countEl = document.getElementById('commission-count');
    const badgeEl = document.getElementById('total-commissions-badge');

    if (countEl) {
      countEl.textContent = this.filteredCommissions.length;
    }

    if (badgeEl) {
      badgeEl.textContent = `${this.filteredCommissions.length} commission${this.filteredCommissions.length > 1 ? 's' : ''}`;
    }
  }

  /**
   * Met à jour les statistiques
   */
  updateStatistics() {
    const stats = this.calculateStatistics();

    // Mettre à jour les éléments du DOM
    this.updateStatElement('total-commissions', this.formatCurrency(stats.totalAmount));
    this.updateStatElement('total-paid', this.formatCurrency(stats.paidAmount));
    this.updateStatElement('total-pending', this.formatCurrency(stats.pendingAmount));
    this.updateStatElement('total-count', stats.totalCount);

    // Résumé par statut
    const pendingSummary = document.getElementById('pending-summary');
    const paidSummary = document.getElementById('paid-summary');

    if (pendingSummary) {
      pendingSummary.textContent = `${stats.pendingCount} commission${stats.pendingCount > 1 ? 's' : ''} — ${this.formatCurrency(stats.pendingAmount)}`;
    }

    if (paidSummary) {
      paidSummary.textContent = `${stats.paidCount} commission${stats.paidCount > 1 ? 's' : ''} — ${this.formatCurrency(stats.paidAmount)}`;
    }
  }

  /**
   * Calcule les statistiques des commissions
   */
  calculateStatistics() {
    let totalAmount = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    let paidCount = 0;
    let pendingCount = 0;

    this.allCommissions.forEach(commission => {
      totalAmount += commission.amount;

      if (commission.status === 'paid') {
        paidAmount += commission.amount;
        paidCount++;
      } else {
        pendingAmount += commission.amount;
        pendingCount++;
      }
    });

    return {
      totalAmount,
      paidAmount,
      pendingAmount,
      totalCount: this.allCommissions.length,
      paidCount,
      pendingCount
    };
  }

  /**
   * Met à jour un élément de statistique
   */
  updateStatElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
    }
  }

  /**
   * Gestionnaire d'événements
   */
  bindEvents() {
    // Bouton marquer comme payé
    document.addEventListener('click', async (e) => {
      if (e.target.closest('.btn-mark-paid')) {
        const button = e.target.closest('.btn-mark-paid');
        const commissionId = button.dataset.commissionId;
        const amount = button.dataset.amount;
        const agent = button.dataset.agent;

        await this.showStatusModal(commissionId, amount, agent);
      }
    });

    // Bouton de confirmation dans le modal
    const confirmBtn = document.getElementById('confirm-status-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (this.currentCommissionId) {
          await this.markCommissionAsPaid(this.currentCommissionId);
        }
      });
    }
  }

  /**
   * Affiche le modal de confirmation de paiement
   */
  async showStatusModal(commissionId, amount, agent) {
    this.currentCommissionId = commissionId;

    const detailsEl = document.getElementById('status-commission-details');
    if (detailsEl) {
      detailsEl.innerHTML = `
        <strong>Agent:</strong> ${agent}<br>
        <strong>Montant:</strong> ${this.formatCurrency(parseFloat(amount))}
      `;
    }

    // Ouvrir le modal
    const modal = new bootstrap.Modal(document.getElementById('statusModal'));
    modal.show();
  }

  /**
   * Marque une commission comme payée
   */
  async markCommissionAsPaid(commissionId) {
    try {
      this.showLoading('Mise à jour du statut...');

      // Mettre à jour la commission dans Firestore
      await updateDoc(doc(db, 'commissions', commissionId), {
        status: 'paid',
        paidAt: new Date()
      });

      this.hideLoading();

      // Fermer le modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('statusModal'));
      if (modal) modal.hide();

      // Message de succès
      alert('✅ Commission marquée comme payée avec succès !');

      // Recharger les commissions
      await this.loadCommissions();

    } catch (error) {
      this.hideLoading();
      this.showError('Erreur lors de la mise à jour: ' + error.message);
    }
  }

  /**
   * Formate un montant en devise
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(amount);
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

  /**
   * Utilitaires d'interface
   */
  showLoading(message = 'Chargement...') {
    // Utilise le système global de loading
    if (window.UIUtils) {
      window.UIUtils.showLoading(message);
    }
  }

  hideLoading() {
    if (window.UIUtils) {
      window.UIUtils.hideLoading();
    }
  }

  showError(message) {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      setTimeout(() => {
        errorEl.style.display = 'none';
      }, 5000);
    }
  }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  window.commissionsManager = new CommissionsManager();
});