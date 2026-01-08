import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { checkAuth } from './auth.js';

// Protection d'accès admin
checkAuth('admin');

/**
 * Gestionnaire de la page Clients Confirmés
 * Gère l'affichage, la recherche et les détails des clients confirmés
 */

class ClientsConfirmesManager {
  constructor() {
    this.clientsTable = null;
    this.allClients = [];
    this.filteredClients = [];
    this.init();
  }

  async init() {
    this.clientsTable = document.getElementById('confirmed-clients-tbody');
    if (this.clientsTable) {
      await this.loadClients();
      this.initSearch();
      this.bindEvents();
    }
  }

  /**
   * Charge tous les clients confirmés
   */
  async loadClients() {
    try {
      this.showLoading('Chargement des clients confirmés...');

      // Récupérer les utilisateurs pour les noms d'agents
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersMap = {};
      usersSnapshot.forEach(doc => {
        const user = doc.data();
        usersMap[doc.id] = `${user.firstName} ${user.lastName}`;
      });

      // Récupérer les clients confirmés
      const clientsQuery = query(
        collection(db, 'clients'),
        orderBy('confirmedAt', 'desc')
      );
      const clientsSnapshot = await getDocs(clientsQuery);

      this.allClients = [];
      clientsSnapshot.forEach((docSnap) => {
        const clientData = docSnap.data();
        const agentName = usersMap[clientData.agentId] || 'Agent inconnu';

        const client = {
          id: docSnap.id,
          ...clientData,
          agentName,
          // Conversion des timestamps Firestore
          confirmedAt: clientData.confirmedAt?.toDate?.() || new Date(clientData.confirmedAt),
          createdAt: clientData.createdAt?.toDate?.() || new Date(clientData.createdAt)
        };

        this.allClients.push(client);
      });

      this.filteredClients = [...this.allClients];
      this.renderClients();
      this.updateClientCount();

      this.hideLoading();

    } catch (error) {
      this.hideLoading();
      this.showError('Erreur lors du chargement des clients: ' + error.message);
      console.error('Erreur chargement clients:', error);
    }
  }

  /**
   * Affiche les clients dans le tableau
   */
  renderClients() {
    if (!this.clientsTable) return;

    this.clientsTable.innerHTML = '';

    if (this.filteredClients.length === 0) {
      // Message pour aucun résultat
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="6" class="text-center py-4">
          <div class="text-muted">
            <i class="fas fa-users fa-2x mb-3"></i>
            <p class="mb-0">Aucun client trouvé</p>
          </div>
        </td>
      `;
      this.clientsTable.appendChild(emptyRow);
      return;
    }

    this.filteredClients.forEach(client => {
      const row = this.createClientRow(client);
      this.clientsTable.appendChild(row);
    });
  }

  /**
   * Crée une ligne de tableau pour un client
   */
  createClientRow(client) {
    const row = document.createElement('tr');

    // Extraction des données du formulaire de prospection
    const clientData = client.data || {};
    const firstName = clientData.firstName || clientData.prenom || clientData.name?.split(' ')[0] || 'N/A';
    const lastName = clientData.lastName || clientData.nom || clientData.name?.split(' ').slice(1).join(' ') || 'N/A';
    const phone = clientData.phone || clientData.telephone || clientData.tel || 'N/A';

    row.innerHTML = `
      <td>
        <div class="d-flex align-items-center">
          <div class="avatar avatar-sm me-3">
            <i class="fas fa-user-circle fa-lg text-primary"></i>
          </div>
          <div>
            <span class="font-weight-bold">${lastName}</span>
          </div>
        </div>
      </td>
      <td>${firstName}</td>
      <td>
        ${phone !== 'N/A' ? `<a href="tel:${phone}" class="text-decoration-none">${phone}</a>` : 'N/A'}
      </td>
      <td>
        <span class="badge bg-info">${this.formatDate(client.confirmedAt)}</span>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <div class="avatar avatar-xs me-2">
            <i class="fas fa-user-tie text-secondary"></i>
          </div>
          <span>${client.agentName}</span>
        </div>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary btn-info-client"
                data-client-id="${client.id}"
                title="Voir les détails">
          <i class="fas fa-eye"></i> Infos
        </button>
      </td>
    `;

    return row;
  }

  /**
   * Initialise la fonctionnalité de recherche
   */
  initSearch() {
    const searchInput = document.getElementById('client-search');
    const clearButton = document.getElementById('clear-client-search');

    if (!searchInput) return;

    // Recherche en temps réel
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.trim().toLowerCase();
      this.filterClients(searchTerm);
    });

    // Bouton effacer
    if (clearButton) {
      clearButton.addEventListener('click', () => {
        searchInput.value = '';
        this.filterClients('');
        searchInput.focus();
      });
    }
  }

  /**
   * Filtre les clients selon le terme de recherche
   */
  filterClients(searchTerm) {
    if (!searchTerm) {
      this.filteredClients = [...this.allClients];
    } else {
      this.filteredClients = this.allClients.filter(client => {
        const clientData = client.data || {};
        const fullName = `${clientData.firstName || ''} ${clientData.lastName || ''} ${clientData.name || ''}`.toLowerCase();
        const agentName = client.agentName.toLowerCase();

        return fullName.includes(searchTerm) || agentName.includes(searchTerm);
      });
    }

    this.renderClients();
    this.updateClientCount();
  }

  /**
   * Met à jour le compteur de clients
   */
  updateClientCount() {
    const countEl = document.getElementById('client-count');
    const badgeEl = document.getElementById('total-clients-badge');

    if (countEl) {
      countEl.textContent = this.filteredClients.length;
    }

    if (badgeEl) {
      badgeEl.textContent = `${this.filteredClients.length} client${this.filteredClients.length > 1 ? 's' : ''}`;
    }
  }

  /**
   * Gestionnaire d'événements
   */
  bindEvents() {
    // Bouton d'infos client
    document.addEventListener('click', async (e) => {
      if (e.target.closest('.btn-info-client')) {
        const button = e.target.closest('.btn-info-client');
        const clientId = button.dataset.clientId;
        await this.showClientDetails(clientId);
      }
    });
  }

  /**
   * Affiche les détails d'un client dans le modal
   */
  async showClientDetails(clientId) {
    try {
      this.showLoading('Chargement des détails...');

      const client = this.allClients.find(c => c.id === clientId);
      if (!client) {
        throw new Error('Client non trouvé');
      }

      // Récupération des détails complets depuis Firestore
      const clientDoc = await getDoc(doc(db, 'clients', clientId));
      if (!clientDoc.exists()) {
        throw new Error('Client non trouvé en base');
      }

      const clientData = clientDoc.data();
      const detailsHtml = this.generateClientDetailsHtml(clientData, client);

      const contentEl = document.getElementById('client-details-content');
      if (contentEl) {
        contentEl.innerHTML = detailsHtml;
      }

      // Ouvrir le modal
      const modal = new bootstrap.Modal(document.getElementById('clientDetailsModal'));
      modal.show();

      this.hideLoading();

    } catch (error) {
      this.hideLoading();
      this.showError('Erreur lors du chargement des détails: ' + error.message);
    }
  }

  /**
   * Génère le HTML des détails du client
   */
  generateClientDetailsHtml(clientData, client) {
    const formData = clientData.data || {};
    const prospectData = clientData.prospectData || {};

    return `
      <div class="client-details">
        <!-- Informations générales -->
        <div class="row mb-4">
          <div class="col-12">
            <h6 class="text-primary mb-3">
              <i class="fas fa-user-circle me-2"></i>Informations Générales
            </h6>
            <div class="row">
              <div class="col-md-6">
                <p><strong>Nom complet:</strong> ${formData.name || `${formData.firstName || ''} ${formData.lastName || ''}`.trim() || 'Non spécifié'}</p>
                <p><strong>Email:</strong> ${formData.email || 'Non spécifié'}</p>
                <p><strong>Téléphone:</strong> ${formData.phone || formData.telephone || 'Non spécifié'}</p>
              </div>
              <div class="col-md-6">
                <p><strong>Adresse:</strong> ${formData.address || 'Non spécifiée'}</p>
                <p><strong>Agent assigné:</strong> ${client.agentName}</p>
                <p><strong>Date de confirmation:</strong> ${this.formatDate(client.confirmedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Besoin du client -->
        <div class="row mb-4">
          <div class="col-12">
            <h6 class="text-success mb-3">
              <i class="fas fa-bullseye me-2"></i>Besoin du Client
            </h6>
            <div class="bg-light p-3 rounded">
              ${this.formatTextArea(formData.need || formData.besoin || 'Non spécifié')}
            </div>
          </div>
        </div>

        <!-- Observations de l'agent -->
        <div class="row mb-4">
          <div class="col-12">
            <h6 class="text-info mb-3">
              <i class="fas fa-comments me-2"></i>Observations de l'Agent
            </h6>
            <div class="bg-light p-3 rounded">
              ${this.formatTextArea(formData.observations || formData.notes || 'Aucune observation')}
            </div>
          </div>
        </div>

        <!-- Statut du dossier -->
        <div class="row">
          <div class="col-12">
            <h6 class="text-warning mb-3">
              <i class="fas fa-clipboard-list me-2"></i>Statut du Dossier
            </h6>
            <div class="d-flex align-items-center">
              <span class="badge bg-success fs-6 me-3">Confirmé</span>
              <small class="text-muted">
                Client validé et prêt pour la commercialisation
              </small>
            </div>
          </div>
        </div>

        <!-- Métadonnées -->
        <hr class="my-4">
        <div class="row">
          <div class="col-12">
            <small class="text-muted">
              <i class="fas fa-clock me-1"></i>
              Créé le ${this.formatDate(client.createdAt)} •
              Confirmé le ${this.formatDate(client.confirmedAt)}
            </small>
          </div>
        </div>
      </div>
    `;
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
   * Formate le contenu d'une zone de texte
   */
  formatTextArea(content) {
    if (!content || content === 'Non spécifié' || content === 'Aucune observation') {
      return `<em class="text-muted">${content}</em>`;
    }
    return content.replace(/\n/g, '<br>');
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
  window.clientsConfirmesManager = new ClientsConfirmesManager();
});