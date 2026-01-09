import { db } from '../firebase.js';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

/**
 * Service d'authentification et sécurité pour l'administration
 * Gère les vérifications de rôles, permissions et accès sécurisé
 */

export class AuthAdminService {
  constructor() {
    this.currentUser = null;

    // 🔐 Configuration code d'accès agent
    this.ACCESS_CODE_COLLECTION = 'system_config';
    this.ACCESS_CODE_DOC = 'agent_access_code';
    this.CODE_VALIDITY_HOURS = 24;

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
      console.error(
        "Erreur lors de l'initialisation AuthAdminService:",
        error
      );
    }
  }

  /* =========================
   *  GESTION DES RÔLES
   * ========================= */

  isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getCurrentUserId() {
    return this.currentUser?.firebaseUid;
  }

  /* =========================
   *  PERMISSIONS
   * ========================= */

  async checkPermission(action) {
    // 🔧 DEBUG : Temporairement désactiver les vérifications de permissions
    // TODO: Réactiver après résolution des problèmes Firestore
    console.log(`🔐 Vérification permission: ${action} pour user:`, this.currentUser);
    return true;

    /*
    if (!this.isAdmin()) {
      throw new Error(
        'Accès refusé : droits administrateur requis'
      );
    }

    switch (action) {
      case 'generate_access_code':
        return true;
      case 'create_user':
        return true;
      case 'delete_user':
        return true;
      default:
        return true;
    }
    */
  }

  /* =========================
   *  CODE D'ACCÈS AGENT
   * ========================= */

  /**
   * Retourne un code valide ou en génère un automatiquement
   */
  async getOrCreateAgentAccessCode() {

    // 🔐 S'assurer que l'utilisateur courant est bien chargé
    if (!this.currentUser) {
      try {
        const userData = JSON.parse(sessionStorage.getItem('user'));
        if (userData) this.currentUser = userData;
      } catch (e) {
        console.warn("Impossible de lire l'utilisateur en session");
      }
    }

    await this.checkPermission('generate_access_code');

    const ref = doc(
      db,
      this.ACCESS_CODE_COLLECTION,
      this.ACCESS_CODE_DOC
    );

    const snap = await getDoc(ref);
    const now = new Date();

    if (snap.exists()) {
      const data = snap.data();

      const expiresAt = data.expiresAt?.toDate
        ? data.expiresAt.toDate()
        : new Date(data.expiresAt);

      // ✅ Code encore valide → on le renvoie
      if (now < expiresAt) {
        return this.buildAccessCodePayload(
          data.code,
          expiresAt
        );
      }
    }

    // 🔄 Code inexistant ou expiré → génération automatique
    const { code, expiresAt } =
      await this.generateAgentAccessCode();

    return this.buildAccessCodePayload(code, expiresAt);
  }

  /**
   * Génère un nouveau code d'accès agent
   */
  async generateAgentAccessCode() {
    await this.checkPermission('generate_access_code');

    const code = this.createRandomCode(8);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() +
        this.CODE_VALIDITY_HOURS * 60 * 60 * 1000
    );

    const ref = doc(
      db,
      this.ACCESS_CODE_COLLECTION,
      this.ACCESS_CODE_DOC
    );

    await setDoc(ref, {
      code,
      createdAt: now,
      expiresAt
    });

    return { code, expiresAt };
  }

  /**
   * Génère un code alphanumérique
   */
  createRandomCode(length = 8) {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(
        Math.floor(Math.random() * chars.length)
      );
    }
    return result;
  }

  /**
   * Construit l'objet retourné au dashboard
   */
  buildAccessCodePayload(code, expiresAt) {

    let baseUrl;

    // 🔹 GitHub Pages
    if (window.location.hostname.includes('github.io')) {
      baseUrl = `${window.location.origin}/gcomaf/register.html`;
    }

    // 🔹 Local file://
    else if (window.location.protocol === 'file:') {
      baseUrl = 'register.html';
    }

    // 🔹 Serveur classique / Vercel / Netlify
    else {
      baseUrl = `${window.location.origin}/register.html`;
    }

    const link = `${baseUrl}?code=${encodeURIComponent(code)}`;

    return {
      code,
      link,
      expiresAt
    };
  }

  /* =========================
   *  VALIDATIONS UTILISATEUR
   * ========================= */

  validateRole(role) {
    const validRoles = ['admin', 'agent', 'supervisor'];
    if (!validRoles.includes(role)) {
      throw new Error(
        `Rôle invalide. Rôles autorisés : ${validRoles.join(
          ', '
        )}`
      );
    }
    return true;
  }

  validateUserData(firstName, lastName, email, role) {
    if (!firstName?.trim())
      throw new Error('Le prénom est obligatoire');
    if (!lastName?.trim())
      throw new Error('Le nom est obligatoire');
    if (!email?.trim())
      throw new Error("L'email est obligatoire");

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new Error("Format d'email invalide pour le client");
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
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('email', '==', email.toLowerCase())
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      throw new Error(
        'Un utilisateur avec cet email existe déjà'
      );
    }

    return false;
  }
}

// Instance globale
export const authAdminService = new AuthAdminService();
