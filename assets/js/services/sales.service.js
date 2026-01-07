import { db } from '../firebase.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { formatCFA } from '../utils.js';
import { authAdminService } from './auth-admin.js';

/**
 * Service de gestion des ventes et commissions
 * Gère la création, modification et calcul des ventes
 */

export class SalesService {
  constructor() {
    this.collectionName = 'sales';
  }

  /**
   * Crée une nouvelle vente avec calcul automatique des commissions
   */
  async createSale(agentId, chiffreAffaires, montantReel, tauxCommission) {
    try {
      await authAdminService.checkPermission('create_sales');

      // Validation des données
      this.validateSaleData(agentId, chiffreAffaires, montantReel, tauxCommission);

      // Calculs
      const benefice = chiffreAffaires - montantReel;
      const commission = benefice * (tauxCommission / 100);

      // Création de la vente
      const saleData = {
        agentId,
        chiffreAffaires,
        montantReel,
        tauxCommission,
        benefice,
        commission,
        status: 'completed', // ou 'pending', 'cancelled'
        createdAt: serverTimestamp(),
        createdBy: authAdminService.getCurrentUserId(),
        lastModified: serverTimestamp(),
        lastModifiedBy: authAdminService.getCurrentUserId()
      };

      const docRef = await addDoc(collection(db, this.collectionName), saleData);

      // Log d'audit
      await authAdminService.logAuditAction('create_sale', {
        saleId: docRef.id,
        agentId,
        montant: chiffreAffaires
      });

      return {
        id: docRef.id,
        ...saleData
      };

    } catch (error) {
      await authAdminService.logAuditAction('create_sale_failed', {
        agentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Récupère toutes les ventes avec informations des agents
   */
  async getAllSales() {
    try {
      await authAdminService.checkPermission('view_sales');

      // Récupérer les utilisateurs pour les noms d'agents
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersMap = {};
      usersSnapshot.forEach(doc => {
        const user = doc.data();
        usersMap[doc.id] = `${user.firstName} ${user.lastName}`;
      });

      // Récupérer les ventes
      const salesQuery = query(
        collection(db, this.collectionName),
        orderBy('createdAt', 'desc')
      );
      const salesSnapshot = await getDocs(salesQuery);

      const sales = [];
      salesSnapshot.forEach((docSnap) => {
        const saleData = docSnap.data();
        const agentName = usersMap[saleData.agentId] || 'Agent inconnu';

        sales.push({
          id: docSnap.id,
          ...saleData,
          agentName,
          // Convertir les timestamps Firestore
          createdAt: saleData.createdAt?.toDate?.() || new Date(saleData.createdAt),
          lastModified: saleData.lastModified?.toDate?.() || new Date(saleData.lastModified)
        });
      });

      return sales;
    } catch (error) {
      console.error('Erreur lors de la récupération des ventes:', error);
      throw new Error('Impossible de récupérer la liste des ventes');
    }
  }

  /**
   * Récupère les ventes d'un agent spécifique
   */
  async getSalesByAgent(agentId) {
    try {
      await authAdminService.checkPermission('view_sales');

      const salesQuery = query(
        collection(db, this.collectionName),
        where('agentId', '==', agentId),
        orderBy('createdAt', 'desc')
      );
      const salesSnapshot = await getDocs(salesQuery);

      const sales = [];
      salesSnapshot.forEach((docSnap) => {
        const saleData = docSnap.data();
        sales.push({
          id: docSnap.id,
          ...saleData,
          createdAt: saleData.createdAt?.toDate?.() || new Date(saleData.createdAt),
          lastModified: saleData.lastModified?.toDate?.() || new Date(saleData.lastModified)
        });
      });

      return sales;
    } catch (error) {
      console.error('Erreur lors de la récupération des ventes de l\'agent:', error);
      throw error;
    }
  }

  /**
   * Met à jour une vente
   */
  async updateSale(saleId, updates) {
    try {
      await authAdminService.checkPermission('update_sales');

      // Recalculer si nécessaire
      if (updates.chiffreAffaires !== undefined || updates.montantReel !== undefined || updates.tauxCommission !== undefined) {
        const saleDoc = await getDoc(doc(db, this.collectionName, saleId));
        if (saleDoc.exists()) {
          const currentData = saleDoc.data();
          const ca = updates.chiffreAffaires !== undefined ? updates.chiffreAffaires : currentData.chiffreAffaires;
          const mr = updates.montantReel !== undefined ? updates.montantReel : currentData.montantReel;
          const tc = updates.tauxCommission !== undefined ? updates.tauxCommission : currentData.tauxCommission;

          updates.benefice = ca - mr;
          updates.commission = updates.benefice * (tc / 100);
        }
      }

      const saleRef = doc(db, this.collectionName, saleId);
      await updateDoc(saleRef, {
        ...updates,
        lastModified: serverTimestamp(),
        lastModifiedBy: authAdminService.getCurrentUserId()
      });

      // Log d'audit
      await authAdminService.logAuditAction('update_sale', {
        saleId,
        updates
      });

    } catch (error) {
      await authAdminService.logAuditAction('update_sale_failed', {
        saleId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Annule une vente
   */
  async cancelSale(saleId, reason) {
    try {
      await authAdminService.checkPermission('cancel_sales');

      const saleRef = doc(db, this.collectionName, saleId);
      await updateDoc(saleRef, {
        status: 'cancelled',
        cancellationReason: reason,
        cancelledAt: serverTimestamp(),
        cancelledBy: authAdminService.getCurrentUserId(),
        lastModified: serverTimestamp(),
        lastModifiedBy: authAdminService.getCurrentUserId()
      });

      // Log d'audit
      await authAdminService.logAuditAction('cancel_sale', {
        saleId,
        reason
      });

    } catch (error) {
      await authAdminService.logAuditAction('cancel_sale_failed', {
        saleId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calcule les statistiques des ventes
   */
  async getSalesStats() {
    try {
      const sales = await this.getAllSales();

      const stats = {
        total: sales.length,
        totalRevenue: sales.reduce((sum, s) => sum + s.chiffreAffaires, 0),
        totalCommissions: sales.reduce((sum, s) => sum + s.commission, 0),
        totalBenefice: sales.reduce((sum, s) => sum + s.benefice, 0),
        thisMonth: {
          count: 0,
          revenue: 0,
          commissions: 0
        },
        thisWeek: {
          count: 0,
          revenue: 0,
          commissions: 0
        },
        byAgent: {},
        averageCommissionRate: 0
      };

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      sales.forEach(sale => {
        const saleDate = sale.createdAt;

        // Statistiques du mois en cours
        if (saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear()) {
          stats.thisMonth.count++;
          stats.thisMonth.revenue += sale.chiffreAffaires;
          stats.thisMonth.commissions += sale.commission;
        }

        // Statistiques de la semaine en cours
        if (saleDate >= oneWeekAgo) {
          stats.thisWeek.count++;
          stats.thisWeek.revenue += sale.chiffreAffaires;
          stats.thisWeek.commissions += sale.commission;
        }

        // Statistiques par agent
        const agentId = sale.agentId;
        if (!stats.byAgent[agentId]) {
          stats.byAgent[agentId] = {
            name: sale.agentName,
            count: 0,
            revenue: 0,
            commissions: 0
          };
        }
        stats.byAgent[agentId].count++;
        stats.byAgent[agentId].revenue += sale.chiffreAffaires;
        stats.byAgent[agentId].commissions += sale.commission;
      });

      // Taux de commission moyen
      if (sales.length > 0) {
        stats.averageCommissionRate = sales.reduce((sum, s) => sum + s.tauxCommission, 0) / sales.length;
      }

      return stats;
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques de ventes:', error);
      throw new Error('Impossible de calculer les statistiques de ventes');
    }
  }

  /**
   * Recherche des ventes par critères
   */
  async searchSales(criteria) {
    try {
      await authAdminService.checkPermission('search_sales');

      let sales = await this.getAllSales();

      if (criteria.agentId) {
        sales = sales.filter(s => s.agentId === criteria.agentId);
      }

      if (criteria.status) {
        sales = sales.filter(s => s.status === criteria.status);
      }

      if (criteria.minAmount) {
        sales = sales.filter(s => s.chiffreAffaires >= criteria.minAmount);
      }

      if (criteria.maxAmount) {
        sales = sales.filter(s => s.chiffreAffaires <= criteria.maxAmount);
      }

      // Filtrage par période
      if (criteria.dateFrom) {
        const fromDate = new Date(criteria.dateFrom);
        sales = sales.filter(s => s.createdAt >= fromDate);
      }

      if (criteria.dateTo) {
        const toDate = new Date(criteria.dateTo);
        toDate.setHours(23, 59, 59, 999); // Fin de journée
        sales = sales.filter(s => s.createdAt <= toDate);
      }

      return sales;
    } catch (error) {
      console.error('Erreur lors de la recherche de ventes:', error);
      throw new Error('Erreur lors de la recherche');
    }
  }

  /**
   * Export des données de ventes (format CSV)
   */
  async exportSales() {
    try {
      await authAdminService.checkPermission('export_sales');

      const sales = await this.getAllSales();

      const csvHeaders = [
        'Agent',
        'Chiffre d\'affaires',
        'Montant réel',
        'Bénéfice',
        'Taux commission',
        'Commission',
        'Date de création',
        'Statut'
      ];

      const csvData = sales.map(sale => [
        sale.agentName,
        sale.chiffreAffaires,
        sale.montantReel,
        sale.benefice,
        `${sale.tauxCommission}%`,
        sale.commission,
        sale.createdAt.toLocaleDateString('fr-FR'),
        sale.status || 'completed'
      ]);

      // Créer le contenu CSV
      const csvContent = [
        csvHeaders.join(','),
        ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Log d'audit
      await authAdminService.logAuditAction('export_sales', {
        recordCount: sales.length
      });

      return csvContent;
    } catch (error) {
      await authAdminService.logAuditAction('export_sales_failed', {
        error: error.message
      });
      throw new Error('Erreur lors de l\'export des ventes');
    }
  }

  /**
   * Valide les données d'une vente
   */
  validateSaleData(agentId, chiffreAffaires, montantReel, tauxCommission) {
    if (!agentId) {
      throw new Error('L\'agent est obligatoire');
    }
    if (typeof chiffreAffaires !== 'number' || chiffreAffaires < 0) {
      throw new Error('Le chiffre d\'affaires doit être un nombre positif');
    }
    if (typeof montantReel !== 'number' || montantReel < 0) {
      throw new Error('Le montant réel doit être un nombre positif');
    }
    if (montantReel > chiffreAffaires) {
      throw new Error('Le montant réel ne peut pas être supérieur au chiffre d\'affaires');
    }
    if (typeof tauxCommission !== 'number' || tauxCommission < 0 || tauxCommission > 100) {
      throw new Error('Le taux de commission doit être entre 0 et 100');
    }

    return true;
  }

  /**
   * Calcule la commission en temps réel
   */
  calculateCommission(chiffreAffaires, montantReel, tauxCommission) {
    if (!chiffreAffaires || !montantReel || tauxCommission === undefined) {
      return { benefice: 0, commission: 0 };
    }

    const benefice = chiffreAffaires - montantReel;
    const commission = benefice * (tauxCommission / 100);

    return {
      benefice: Math.max(0, benefice), // Pas de bénéfice négatif
      commission: Math.max(0, commission) // Pas de commission négative
    };
  }
}

// Instance globale
export const salesService = new SalesService();