import { db } from '../firebase.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { authAdminService } from './auth-admin.js';

/**
 * Service de gestion des clients
 * Gère les clients confirmés et leurs informations
 */

export class ClientsService {
  constructor() {
    this.collectionName = 'clients';
  }

  /**
   * Récupère tous les clients confirmés avec informations des agents
   */
  async getAllClients() {
    try {
      await authAdminService.checkPermission('view_clients');

      // Récupérer les utilisateurs pour les noms d'agents
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersMap = {};
      usersSnapshot.forEach(doc => {
        const user = doc.data();
        usersMap[doc.id] = `${user.firstName} ${user.lastName}`;
      });

      // Récupérer les clients envoyés à l'admin
      const clientsQuery = query(
        collection(db, this.collectionName),
        where('sentToAdmin', '==', true)
      );
      const clientsSnapshot = await getDocs(clientsQuery);

      const clients = [];
      clientsSnapshot.forEach((docSnap) => {
        const clientData = docSnap.data();
        const agentName = usersMap[clientData.agentId] || 'Agent inconnu';

        clients.push({
          id: docSnap.id,
          ...clientData,
          agentName,
          // Convertir les timestamps Firestore
          confirmedAt: clientData.confirmedAt?.toDate?.() || new Date(clientData.confirmedAt),
          createdAt: clientData.createdAt?.toDate?.() || new Date(clientData.createdAt)
        });
      });

      return clients;
    } catch (error) {
      console.error('Erreur lors de la récupération des clients:', error);
      throw new Error('Impossible de récupérer la liste des clients');
    }
  }

  /**
   * Récupère un client par ID
   */
  async getClientById(clientId) {
    try {
      await authAdminService.checkPermission('view_clients');

      const clientDoc = await getDoc(doc(db, this.collectionName, clientId));

      if (!clientDoc.exists()) {
        throw new Error('Client non trouvé');
      }

      const clientData = clientDoc.data();

      // Récupérer le nom de l'agent
      let agentName = 'Agent inconnu';
      if (clientData.agentId) {
        const agentDoc = await getDoc(doc(db, 'users', clientData.agentId));
        if (agentDoc.exists()) {
          const agentData = agentDoc.data();
          agentName = `${agentData.firstName} ${agentData.lastName}`;
        }
      }

      return {
        id: clientDoc.id,
        ...clientData,
        agentName,
        confirmedAt: clientData.confirmedAt?.toDate?.() || new Date(clientData.confirmedAt),
        createdAt: clientData.createdAt?.toDate?.() || new Date(clientData.createdAt)
      };
    } catch (error) {
      console.error('Erreur lors de la récupération du client:', error);
      throw error;
    }
  }

  /**
   * Recherche des clients par critères
   */
  async searchClients(criteria) {
    try {
      await authAdminService.checkPermission('search_clients');

      let clients = await this.getAllClients();

      if (criteria.agentId) {
        clients = clients.filter(c => c.agentId === criteria.agentId);
      }

      if (criteria.status) {
        clients = clients.filter(c => c.status === criteria.status);
      }

      if (criteria.searchTerm) {
        const term = criteria.searchTerm.toLowerCase();
        clients = clients.filter(c =>
          (
            `${c.data?.firstName || ''} ${c.data?.lastName || ''}`
          ).toLowerCase().includes(term) ||
          (c.data?.email || '').toLowerCase().includes(term) ||
          c.agentName.toLowerCase().includes(term)
        );
      }

      // Filtrage par période
      if (criteria.dateFrom) {
        const fromDate = new Date(criteria.dateFrom);
        clients = clients.filter(c => c.confirmedAt >= fromDate);
      }

      if (criteria.dateTo) {
        const toDate = new Date(criteria.dateTo);
        toDate.setHours(23, 59, 59, 999); // Fin de journée
        clients = clients.filter(c => c.confirmedAt <= toDate);
      }

      return clients;
    } catch (error) {
      console.error('Erreur lors de la recherche de clients:', error);
      throw new Error('Erreur lors de la recherche');
    }
  }

  /**
   * Met à jour les informations d'un client
   */
  async updateClient(clientId, updates) {
    try {
      await authAdminService.checkPermission('update_clients');

      const clientRef = doc(db, this.collectionName, clientId);
      await updateDoc(clientRef, {
        ...updates,
        lastModified: serverTimestamp(),
        lastModifiedBy: authAdminService.getCurrentUserId()
      });

      // Log d'audit
      await authAdminService.logAuditAction('update_client', {
        clientId,
        updates
      });

    } catch (error) {
      await authAdminService.logAuditAction('update_client_failed', {
        clientId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtient les statistiques des clients
   */
  async getClientStats() {
    try {
      const clients = await this.getAllClients();

      const stats = {
        total: clients.length,
        thisMonth: clients.filter(c => {
          const now = new Date();
          const clientDate = c.confirmedAt;
          return clientDate.getMonth() === now.getMonth() &&
                 clientDate.getFullYear() === now.getFullYear();
        }).length,
        thisWeek: clients.filter(c => {
          const now = new Date();
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return c.confirmedAt >= oneWeekAgo;
        }).length,
        byAgent: {}
      };

      // Statistiques par agent
      clients.forEach(client => {
        const agentId = client.agentId;
        if (!stats.byAgent[agentId]) {
          stats.byAgent[agentId] = {
            name: client.agentName,
            count: 0
          };
        }
        stats.byAgent[agentId].count++;
      });

      return stats;
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques clients:', error);
      throw new Error('Impossible de calculer les statistiques clients');
    }
  }

  /**
   * Export des données clients (format CSV)
   */
  async exportClients() {
    try {
      await authAdminService.checkPermission('export_clients');

      const clients = await this.getAllClients();

      const csvHeaders = [
        'Nom',
        'Email',
        'Téléphone',
        'Agent',
        'Date de confirmation',
        'Statut'
      ];

      const csvData = clients.map(client => [
        `${client.data?.firstName || ''} ${client.data?.lastName || ''}`.trim(),
        client.data?.email || '',
        client.data?.phone || '',
        client.agentName,
        client.confirmedAt.toLocaleDateString('fr-FR'),
        client.status || 'confirmé'
      ]);

      // Créer le contenu CSV
      const csvContent = [
        csvHeaders.join(','),
        ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Log d'audit
      await authAdminService.logAuditAction('export_clients', {
        recordCount: clients.length
      });

      return csvContent;
    } catch (error) {
      await authAdminService.logAuditAction('export_clients_failed', {
        error: error.message
      });
      throw new Error('Erreur lors de l\'export des clients');
    }
  }

  /**
   * Valide les données d'un client
   */
  validateClientData(clientData) {
    if (!clientData?.firstName?.trim()) {
      throw new Error('Le prénom du client est obligatoire');
    }
    if (!clientData?.lastName?.trim()) {
      throw new Error('Le nom du client est obligatoire');
    }
    if (!clientData?.email?.trim()) {
      throw new Error("L'email du client est obligatoire");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientData.email)) {
      throw new Error("Format d'email invalide pour le client");
    }

    return {
      firstName: clientData.firstName.trim(),
      lastName: clientData.lastName.trim(),
      email: clientData.email.trim().toLowerCase(),
      phone: clientData.phone?.trim() || '',
      company: clientData.company?.trim() || '',
      country: clientData.country?.trim() || '',
      city: clientData.city?.trim() || '',
      productInterest: clientData.productInterest?.trim() || '',
      estimatedQty: clientData.estimatedQty || null
    };
  }
}

// Instance globale
export const clientsService = new ClientsService();
