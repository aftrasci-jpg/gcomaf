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
        <div class="btn-group btn-group-sm">
          <button class="btn btn-sm btn-outline-primary btn-info-client"
                  data-client-id="${client.id}"
                  title="Voir les détails">
            <i class="fas fa-eye"></i> Infos
          </button>
          <button class="btn btn-sm btn-success btn-sell-client"
                  data-client-id="${client.id}"
                  data-client-name="${firstName} ${lastName}"
                  data-agent-id="${client.agentId}"
                  data-agent-name="${client.agentName}"
                  title="Conclure une vente">
            <i class="fas fa-shopping-cart"></i> Vendre
          </button>
        </div>
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

      // Bouton de vente
      if (e.target.closest('.btn-sell-client')) {
        const button = e.target.closest('.btn-sell-client');
        const clientId = button.dataset.clientId;
        const clientName = button.dataset.clientName;
        const agentId = button.dataset.agentId;
        const agentName = button.dataset.agentName;
        await this.showSaleModal(clientId, clientName, agentId, agentName);
      }
    });

    // Formulaire de vente
    const saleForm = document.getElementById('create-sale-form');
    if (saleForm) {
      saleForm.addEventListener('submit', (e) => this.handleSaleSubmit(e));
    }
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

  /**
   * Affiche le modal de création de vente
   */
  async showSaleModal(clientId, clientName, agentId, agentName) {
    try {
      // Pré-remplir le modal
      const clientNameEl = document.getElementById('sale-client-name');
      const agentNameEl = document.getElementById('sale-agent-name');
      const form = document.getElementById('create-sale-form');

      if (clientNameEl) clientNameEl.textContent = clientName;
      if (agentNameEl) agentNameEl.textContent = agentName;

      // Stocker les données dans le formulaire
      if (form) {
        form.dataset.clientId = clientId;
        form.dataset.agentId = agentId;
      }

      // Réinitialiser le formulaire
      this.resetSaleForm();

      // Ouvrir le modal
      const modal = new bootstrap.Modal(document.getElementById('saleModal'));
      modal.show();

      // Attacher les événements de calcul
      this.attachSaleCalculationEvents();

    } catch (error) {
      this.showError('Erreur lors de l\'ouverture du modal de vente: ' + error.message);
    }
  }

  /**
   * Réinitialise le formulaire de vente
   */
  resetSaleForm() {
    const form = document.getElementById('create-sale-form');
    if (form) {
      form.reset();
      // Valeurs par défaut
      const tauxCommissionEl = document.getElementById('sale-taux-commission');
      if (tauxCommissionEl) tauxCommissionEl.value = '15';

      // Réinitialiser les champs calculés
      this.updateSaleCalculations();
    }
  }

  /**
   * Attache les événements de calcul pour le formulaire de vente
   */
  attachSaleCalculationEvents() {
    const caInput = document.getElementById('sale-chiffre-affaires');
    const mrInput = document.getElementById('sale-montant-reel');
    const tauxInput = document.getElementById('sale-taux-commission');

    const updateCalculations = () => this.updateSaleCalculations();

    if (caInput) caInput.addEventListener('input', updateCalculations);
    if (mrInput) mrInput.addEventListener('input', updateCalculations);
    if (tauxInput) tauxInput.addEventListener('input', updateCalculations);
  }

  /**
   * Met à jour les calculs du formulaire de vente
   */
  updateSaleCalculations() {
    const ca = parseFloat(document.getElementById('sale-chiffre-affaires')?.value) || 0;
    const mr = parseFloat(document.getElementById('sale-montant-reel')?.value) || 0;
    const taux = parseFloat(document.getElementById('sale-taux-commission')?.value) || 0;

    // Calcul du bénéfice
    const benefice = ca - mr;
    const commission = (benefice * taux) / 100;

    // Mise à jour des champs affichés
    const beneficeEl = document.getElementById('sale-benefice');
    const commissionEl = document.getElementById('sale-commission');

    if (beneficeEl) beneficeEl.textContent = this.formatCurrency(benefice);
    if (commissionEl) commissionEl.textContent = this.formatCurrency(commission);
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
   * Gère la soumission du formulaire de vente
   */
  async handleSaleSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const clientId = form.dataset.clientId;
    const agentId = form.dataset.agentId;

    const saleData = {
      clientId,
      agentId,
      chiffreAffaires: parseFloat(document.getElementById('sale-chiffre-affaires')?.value) || 0,
      montantReel: parseFloat(document.getElementById('sale-montant-reel')?.value) || 0,
      tauxCommission: parseFloat(document.getElementById('sale-taux-commission')?.value) || 15
    };

    // Validation
    if (!clientId || !agentId) {
      this.showError('Données client/agent manquantes');
      return;
    }

    if (saleData.chiffreAffaires <= 0) {
      this.showError('Le chiffre d\'affaires doit être supérieur à 0');
      return;
    }

    if (saleData.montantReel < 0) {
      this.showError('Le montant réel ne peut pas être négatif');
      return;
    }

    if (saleData.montantReel > saleData.chiffreAffaires) {
      this.showError('Le montant réel ne peut pas être supérieur au chiffre d\'affaires');
      return;
    }

    // Confirmation
    const benefice = saleData.chiffreAffaires - saleData.montantReel;
    const commission = (benefice * saleData.tauxCommission) / 100;

    const confirmMessage = `
      Confirmer la vente ?

      💰 Chiffre d'affaires: ${this.formatCurrency(saleData.chiffreAffaires)}
      💵 Montant réel: ${this.formatCurrency(saleData.montantReel)}
      📈 Bénéfice: ${this.formatCurrency(benefice)}
      💎 Commission (${saleData.tauxCommission}%): ${this.formatCurrency(commission)}
    `;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      this.showLoading('Création de la vente...');

      // Créer la vente
      const saleResult = await this.createSale(saleData);

      // Créer la commission automatiquement
      await this.createCommission({
        saleId: saleResult.id,
        agentId: saleData.agentId,
        clientId: saleData.clientId,
        benefice,
        taux: saleData.tauxCommission,
        amount: commission
      });

      this.hideLoading();

      // Fermer le modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('saleModal'));
      if (modal) modal.hide();

      // Message de succès
      alert(`✅ Vente créée avec succès !

💰 Bénéfice: ${this.formatCurrency(benefice)}
💎 Commission: ${this.formatCurrency(commission)}

La commission a été automatiquement créée pour l'agent.`);

    } catch (error) {
      this.hideLoading();
      this.showError('Erreur lors de la création de la vente: ' + error.message);
    }
  }

  /**
   * Crée une vente dans Firestore
   */
  async createSale(saleData) {
    const { addDoc, collection } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

    const benefice = saleData.chiffreAffaires - saleData.montantReel;
    const commission = (benefice * saleData.tauxCommission) / 100;

    const saleDoc = {
      clientId: saleData.clientId,
      agentId: saleData.agentId,
      chiffreAffaires: saleData.chiffreAffaires,
      montantReel: saleData.montantReel,
      benefice,
      tauxCommission: saleData.tauxCommission,
      commission,
      createdAt: new Date()
    };

    const docRef = await addDoc(collection(db, 'sales'), saleDoc);
    return { id: docRef.id, ...saleDoc };
  }

  /**
   * Crée une commission dans Firestore
   */
  async createCommission(commissionData) {
    const { addDoc, collection } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

    const commissionDoc = {
      saleId: commissionData.saleId,
      agentId: commissionData.agentId,
      clientId: commissionData.clientId,
      benefice: commissionData.benefice,
      taux: commissionData.taux,
      amount: commissionData.amount,
      status: 'pending',
      createdAt: new Date(),
      paidAt: null
    };

    await addDoc(collection(db, 'commissions'), commissionDoc);
  }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  window.clientsConfirmesManager = new ClientsConfirmesManager();
});