import { authAdminService } from './auth-admin.js';
import { usersService } from './users.service.js';
import { clientsService } from './clients.service.js';
import { salesService } from './sales.service.js';
import { formsService } from './forms.service.js';

/**
 * Service de gestion du dashboard admin
 * Centralise toutes les statistiques et métriques
 */

export class DashboardService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Récupère toutes les statistiques du dashboard
   */
  async getDashboardStats() {
    try {
      await authAdminService.checkPermission('view_dashboard');

      const cacheKey = 'dashboard_stats';
      const cached = this.getCached(cacheKey);
      if (cached) return cached;

      // Récupération parallèle des statistiques
      const [
        userStats,
        clientStats,
        salesStats,
        formStats
      ] = await Promise.all([
        usersService.getUserStats(),
        clientsService.getClientStats(),
        salesService.getSalesStats(),
        formsService.getFormsStats()
      ]);

      const stats = {
        users: userStats,
        clients: clientStats,
        sales: salesStats,
        forms: formStats,
        overview: {
          totalUsers: userStats.total,
          totalClients: clientStats.total,
          totalSales: salesStats.total,
          totalRevenue: salesStats.totalRevenue,
          totalCommissions: salesStats.totalCommissions,
          activeForms: formStats.active
        },
        lastUpdated: new Date()
      };

      this.setCached(cacheKey, stats);
      return stats;

    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques du dashboard:', error);
      throw new Error('Impossible de charger les statistiques du dashboard');
    }
  }

  /**
   * Récupère les statistiques des cartes principales
   */
  async getMainStats() {
    try {
      const [
        clientsResult,
        agentsResult,
        salesResult,
        commissionsResult
      ] = await Promise.all([
        clientsService.getAllClients(),
        usersService.getAllUsers(),
        salesService.getAllSales(),
        salesService.getSalesStats()
      ]);

      const activeAgents = agentsResult.filter(u => u.status === 'active' && (u.role === 'agent' || u.role === 'supervisor'));

      return {
        clientsCount: clientsResult.length,
        agentsCount: activeAgents.length,
        salesTotal: commissionsResult.totalRevenue,
        commissionsTotal: commissionsResult.totalCommissions
      };

    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques principales:', error);
      throw new Error('Impossible de charger les statistiques principales');
    }
  }

  /**
   * Récupère les métriques de performance
   */
  async getPerformanceMetrics() {
    try {
      const [salesStats, clientStats] = await Promise.all([
        salesService.getSalesStats(),
        clientsService.getClientStats()
      ]);

      const now = new Date();
      const thisMonth = {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
      };

      return {
        monthlyRevenue: salesStats.thisMonth.revenue,
        monthlyCommissions: salesStats.thisMonth.commissions,
        monthlyClients: clientStats.thisMonth,
        monthlySales: salesStats.thisMonth.count,
        conversionRate: clientStats.total > 0 ? (salesStats.total / clientStats.total * 100) : 0,
        averageCommissionRate: salesStats.averageCommissionRate
      };

    } catch (error) {
      console.error('Erreur lors du calcul des métriques de performance:', error);
      throw new Error('Impossible de calculer les métriques de performance');
    }
  }

  /**
   * Récupère les données pour les graphiques
   */
  async getChartData(timeRange = 'month') {
    try {
      const sales = await salesService.getAllSales();
      const clients = await clientsService.getAllClients();

      // Grouper par période
      const groupedData = this.groupDataByPeriod(sales, clients, timeRange);

      return {
        sales: groupedData.sales,
        clients: groupedData.clients,
        commissions: groupedData.commissions,
        labels: groupedData.labels
      };

    } catch (error) {
      console.error('Erreur lors de la récupération des données de graphique:', error);
      throw new Error('Impossible de charger les données de graphique');
    }
  }

  /**
   * Groupe les données par période
   */
  groupDataByPeriod(sales, clients, timeRange) {
    const result = {
      sales: [],
      clients: [],
      commissions: [],
      labels: []
    };

    const now = new Date();
    const periods = this.getPeriods(now, timeRange);

    periods.forEach(period => {
      const periodSales = sales.filter(s => this.isInPeriod(s.createdAt, period));
      const periodClients = clients.filter(c => this.isInPeriod(c.confirmedAt, period));

      result.sales.push(periodSales.length);
      result.clients.push(periodClients.length);
      result.commissions.push(periodSales.reduce((sum, s) => sum + s.commission, 0));
      result.labels.push(this.formatPeriodLabel(period, timeRange));
    });

    return result;
  }

  /**
   * Génère les périodes selon le timeRange
   */
  getPeriods(now, timeRange) {
    const periods = [];
    const count = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 12;

    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(now);

      switch (timeRange) {
        case 'week':
          date.setDate(now.getDate() - i);
          periods.push({
            start: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
            end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
          });
          break;
        case 'month':
          date.setDate(now.getDate() - i);
          periods.push({
            start: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
            end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
          });
          break;
        case 'year':
          date.setMonth(now.getMonth() - i);
          periods.push({
            start: new Date(date.getFullYear(), date.getMonth(), 1),
            end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)
          });
          break;
      }
    }

    return periods;
  }

  /**
   * Vérifie si une date est dans une période
   */
  isInPeriod(date, period) {
    return date >= period.start && date <= period.end;
  }

  /**
   * Formate le label d'une période
   */
  formatPeriodLabel(period, timeRange) {
    switch (timeRange) {
      case 'week':
      case 'month':
        return period.start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      case 'year':
        return period.start.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
      default:
        return period.start.toLocaleDateString('fr-FR');
    }
  }

  /**
   * Récupère les données depuis le cache
   */
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Stocke les données en cache
   */
  setCached(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Vide le cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Export des données du dashboard
   */
  async exportDashboardData() {
    try {
      await authAdminService.checkPermission('export_dashboard');

      const stats = await this.getDashboardStats();

      const exportData = {
        generatedAt: new Date().toISOString(),
        summary: stats.overview,
        detailed: {
          users: stats.users,
          clients: stats.clients,
          sales: stats.sales,
          forms: stats.forms
        }
      };

      // Log d'audit
      await authAdminService.logAuditAction('export_dashboard', {
        dataPoints: Object.keys(stats.overview).length
      });

      return JSON.stringify(exportData, null, 2);

    } catch (error) {
      await authAdminService.logAuditAction('export_dashboard_failed', {
        error: error.message
      });
      throw new Error('Erreur lors de l\'export des données du dashboard');
    }
  }
}

// Instance globale
export const dashboardService = new DashboardService();