import { db } from '../firebase.js';
import { collection, doc, getDoc, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

/**
 * Service d'authentification et sécurité pour l'administration
 * Gère les vérifications de rôles, permissions et accès sécurisé
 */

export class AuthAdminService {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  /**
   * Initialise le service avec l'utilisateur actuel
   */
  async init() {
    try {
      const userData = JSON.parse(sessionStorage.getItem('user'));
      if (userData) {
        this.currentUser = userData;
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation AuthAdminService:', error);
    }
  }

  /**
   * Vérifie si l'utilisateur actuel est un admin
   */
  isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
  }

  /**
   * Obtient l'utilisateur actuel
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Obtient l'ID Firebase de l'utilisateur actuel
   */
  getCurrentUserId() {
    return this.currentUser?.firebaseUid;
  }

  /**
   * Vérifie les permissions pour une action donnée
   */
  async checkPermission(action, targetUserId = null) {
    if (!this.isAdmin()) {
      throw new Error('Accès refusé : droits administrateur requis');
    }

    // Vérifications supplémentaires selon l'action
    switch (action) {
      case 'create_user':
        return this.validateUserCreationPermissions();
      case 'delete_user':
        return await this.validateUserDeletionPermissions(targetUserId);
      case 'manage_sales':
        return true; // Les admins peuvent toujours gérer les ventes
      default:
        return true;
    }
  }

  /**
   * Valide les permissions de création d'utilisateur
   */
  validateUserCreationPermissions() {
    // Logique de validation des permissions
    return true;
  }

  /**
   * Valide les permissions de suppression d'utilisateur
   */
  async validateUserDeletionPermissions(targetUserId) {
    if (!targetUserId) {
      throw new Error('ID utilisateur cible requis');
    }

    // Empêcher la suppression de son propre compte
    if (targetUserId === this.currentUser?.uid) {
      throw new Error('Vous ne pouvez pas supprimer votre propre compte');
    }

    return true;
  }

  /**
   * Valide un rôle utilisateur
   */
  validateRole(role) {
    const validRoles = ['admin', 'agent', 'supervisor'];
    if (!validRoles.includes(role)) {
      throw new Error(`Rôle invalide. Rôles autorisés : ${validRoles.join(', ')}`);
    }
    return true;
  }

  /**
   * Valide les données d'un utilisateur
   */
  validateUserData(firstName, lastName, email, role) {
    if (!firstName?.trim()) {
      throw new Error('Le prénom est obligatoire');
    }
    if (!lastName?.trim()) {
      throw new Error('Le nom est obligatoire');
    }
    if (!email?.trim()) {
      throw new Error('L\'email est obligatoire');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Format d\'email invalide');
    }

    this.validateRole(role);

    return {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      role
    };
  }

  /**
   * Vérifie si un email existe déjà
   */
  async checkEmailExists(email) {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        throw new Error('Un utilisateur avec cet email existe déjà');
      }

      return false;
    } catch (error) {
      if (error.message.includes('existe déjà')) {
        throw error;
      }
      throw new Error('Erreur lors de la vérification de l\'email');
    }
  }

  /**
   * Log une action d'audit
   */
  async logAuditAction(action, details = {}) {
    try {
      const auditData = {
        action,
        userId: this.getCurrentUserId(),
        userEmail: this.currentUser?.email,
        timestamp: new Date(),
        details,
        ipAddress: await this.getClientIP() // À implémenter si nécessaire
      };

      // Ici on pourrait envoyer à un service de logging
      console.log('Audit Log:', auditData);

      // Pour l'instant, on stocke dans une collection audit (optionnel)
      // await addDoc(collection(db, 'audit_logs'), auditData);

    } catch (error) {
      console.error('Erreur lors du logging d\'audit:', error);
    }
  }

  /**
   * Obtient l'adresse IP du client (simplifié)
   */
  async getClientIP() {
    // Cette fonction pourrait faire appel à un service externe
    // Pour l'instant, on retourne une valeur par défaut
    return 'unknown';
  }
}

// Instance globale
export const authAdminService = new AuthAdminService();