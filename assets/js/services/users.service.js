import { db, auth } from '../firebase.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, query, where } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { generatePassword } from '../utils.js';
import { authAdminService } from './auth-admin.js';

/**
 * Service de gestion des utilisateurs
 * Gère la création, modification et suppression des comptes utilisateur
 */

export class UsersService {
  constructor() {
    this.collectionName = 'users';
  }

  /**
   * Crée un nouvel utilisateur avec génération automatique de mot de passe
   */
  async createUser(firstName, lastName, email, role) {
    try {
      // Vérification des permissions
      await authAdminService.checkPermission('create_user');

      // Validation des données
      const validatedData = authAdminService.validateUserData(firstName, lastName, email, role);

      // Vérification de l'unicité de l'email
      await authAdminService.checkEmailExists(validatedData.email);

      // Génération du mot de passe temporaire
      const temporaryPassword = generatePassword();

      // Création du compte Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, validatedData.email, temporaryPassword);
      const uid = userCredential.user.uid;

      // Création du document Firestore
      const userData = {
        uid,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        email: validatedData.email,
        role: validatedData.role,
        status: 'active',
        passwordTemporary: true, // Marquer comme mot de passe temporaire
        createdAt: serverTimestamp(),
        createdBy: authAdminService.getCurrentUserId(),
        lastModified: serverTimestamp(),
        lastModifiedBy: authAdminService.getCurrentUserId()
      };

      await addDoc(collection(db, this.collectionName), userData);

      // Log d'audit
      await authAdminService.logAuditAction('create_user', {
        targetEmail: validatedData.email,
        targetRole: validatedData.role,
        targetUid: uid
      });

      return {
        uid,
        email: validatedData.email,
        temporaryPassword,
        role: validatedData.role,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName
      };

    } catch (error) {
      // Log d'audit en cas d'erreur
      await authAdminService.logAuditAction('create_user_failed', {
        error: error.message,
        email,
        role
      });
      throw error;
    }
  }

  /**
   * Récupère tous les utilisateurs
   */
  async getAllUsers() {
    try {
      await authAdminService.checkPermission('view_users');

      const querySnapshot = await getDocs(collection(db, this.collectionName));
      const users = [];

      querySnapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        users.push({
          id: docSnap.id,
          ...userData,
          // Convertir les timestamps Firestore
          createdAt: userData.createdAt?.toDate?.() || new Date(userData.createdAt),
          lastModified: userData.lastModified?.toDate?.() || new Date(userData.lastModified)
        });
      });

      return users;
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      throw new Error('Impossible de récupérer la liste des utilisateurs');
    }
  }

  /**
   * Met à jour le statut d'un utilisateur
   */
  async updateUserStatus(userId, newStatus) {
    try {
      await authAdminService.checkPermission('update_user_status', userId);

      const validStatuses = ['active', 'inactive'];
      if (!validStatuses.includes(newStatus)) {
        throw new Error(`Statut invalide. Statuts autorisés : ${validStatuses.join(', ')}`);
      }

      const userRef = doc(db, this.collectionName, userId);
      await updateDoc(userRef, {
        status: newStatus,
        lastModified: serverTimestamp(),
        lastModifiedBy: authAdminService.getCurrentUserId()
      });

      // Log d'audit
      await authAdminService.logAuditAction('update_user_status', {
        targetUserId: userId,
        newStatus
      });

    } catch (error) {
      await authAdminService.logAuditAction('update_user_status_failed', {
        targetUserId: userId,
        newStatus,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Supprime un utilisateur (soft delete - désactivation)
   */
  async deactivateUser(userId) {
    try {
      await authAdminService.checkPermission('delete_user', userId);

      const userRef = doc(db, this.collectionName, userId);
      await updateDoc(userRef, {
        status: 'inactive',
        deletedAt: serverTimestamp(),
        deletedBy: authAdminService.getCurrentUserId(),
        lastModified: serverTimestamp(),
        lastModifiedBy: authAdminService.getCurrentUserId()
      });

      // Log d'audit
      await authAdminService.logAuditAction('deactivate_user', {
        targetUserId: userId
      });

    } catch (error) {
      await authAdminService.logAuditAction('deactivate_user_failed', {
        targetUserId: userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtient les statistiques des utilisateurs
   */
  async getUserStats() {
    try {
      const users = await this.getAllUsers();

      const stats = {
        total: users.length,
        active: users.filter(u => u.status === 'active').length,
        inactive: users.filter(u => u.status === 'inactive').length,
        byRole: {
          admin: users.filter(u => u.role === 'admin').length,
          agent: users.filter(u => u.role === 'agent').length,
          supervisor: users.filter(u => u.role === 'supervisor').length
        }
      };

      return stats;
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques utilisateurs:', error);
      throw new Error('Impossible de calculer les statistiques utilisateurs');
    }
  }

  /**
   * Recherche des utilisateurs par critères
   */
  async searchUsers(criteria) {
    try {
      await authAdminService.checkPermission('search_users');

      let users = await this.getAllUsers();

      if (criteria.role) {
        users = users.filter(u => u.role === criteria.role);
      }

      if (criteria.status) {
        users = users.filter(u => u.status === criteria.status);
      }

      if (criteria.searchTerm) {
        const term = criteria.searchTerm.toLowerCase();
        users = users.filter(u =>
          u.firstName.toLowerCase().includes(term) ||
          u.lastName.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term)
        );
      }

      return users;
    } catch (error) {
      console.error('Erreur lors de la recherche d\'utilisateurs:', error);
      throw new Error('Erreur lors de la recherche');
    }
  }

  /**
   * Crée un utilisateur dans Firestore seulement (pour l'inscription)
   */
  async createUserInFirestore(uid, firstName, lastName, email, role) {
    try {
      const userData = {
        uid,
        firstName,
        lastName,
        email,
        role,
        status: 'active',
        passwordTemporary: false, // Mot de passe défini par l'utilisateur
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp()
      };

      await setDoc(doc(db, this.collectionName, uid), userData);

      return userData;
    } catch (error) {
      console.error('Erreur lors de la création de l\'utilisateur dans Firestore:', error);
      throw new Error('Impossible de créer le compte utilisateur');
    }
  }
}

// Instance globale
export const usersService = new UsersService();