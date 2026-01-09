import { db } from './firebase.js';
import {
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import {
  createUserWithEmailAndPassword,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { auth } from './firebase.js';
import { authAdminService } from './services/auth-admin.js';
import { usersService } from './services/users.service.js';

/**
 * Gestionnaire d'inscription des agents
 * Valide le code d'accès et crée le compte utilisateur
 */

/* =========================
   VALIDATION CODE D’ACCÈS
========================= */
async function validateAccessCode(code) {
  if (!code || !code.trim()) {
    throw new Error("Le code d'accès est obligatoire");
  }

  const ref = doc(db, 'system_config', 'agent_access_code');
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Aucun code d'accès valide trouvé");
  }

  const data = snap.data();

  if (data.code !== code.trim()) {
    throw new Error("Code d'accès invalide");
  }

  const expiresAt = data.expiresAt?.toDate?.() || new Date(data.expiresAt);
  if (new Date() > expiresAt) {
    throw new Error("Ce code d'accès a expiré");
  }

  return true;
}

/* =========================
   FORM LISTENER
========================= */
const registerForm = document.getElementById('register-form');

if (!registerForm) {
  console.error('Register form not found');
} else {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    hideMessages();

    const formData = {
      lastName: document.getElementById('lastName').value.trim(),
      firstName: document.getElementById('firstName').value.trim(),
      email: document.getElementById('email').value.trim().toLowerCase(),
      password: document.getElementById('password').value,
      accessCode: document.getElementById('accessCode').value.trim()
    };

    try {
      /* =========================
         VALIDATIONS
      ========================= */
      if (!formData.firstName || !formData.lastName) {
        throw new Error('Le prénom et le nom sont obligatoires');
      }

      if (!formData.email) {
        throw new Error("L'email est obligatoire");
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        throw new Error("Format d'email invalide");
      }

      if (!formData.password || formData.password.length < 6) {
        throw new Error('Le mot de passe doit contenir au moins 6 caractères');
      }

      /* =========================
         CODE D’ACCÈS
      ========================= */
      await validateAccessCode(formData.accessCode);

      /* =========================
         EMAIL UNIQUE
      ========================= */
      await authAdminService.checkEmailExists(formData.email);

      /* =========================
         CRÉATION AUTH
      ========================= */
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const user = userCredential.user;

      await updateProfile(user, {
        displayName: `${formData.firstName} ${formData.lastName}`
      });

      /* =========================
         CRÉATION FIRESTORE
      ========================= */
      await usersService.createUserInFirestore(
        user.uid,
        formData.firstName,
        formData.lastName,
        formData.email,
        'agent'
      );

      /* =========================
         SUCCESS
      ========================= */
      showSuccess('Compte créé avec succès ! Redirection...');

      setTimeout(() => {
        window.location.href = 'agent/dashboard.html';
      }, 2000);

    } catch (error) {
      console.error('Erreur inscription:', error);
      showError(error.message || "Erreur lors de l'inscription");
    }
  });
}

/* =========================
   UI HELPERS
========================= */
function showError(message) {
  const el = document.getElementById('error-message');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('d-none');
}

function hideMessages() {
  const el = document.getElementById('error-message');
  if (el) el.classList.add('d-none');
}

function showSuccess(message) {
  const el = document.createElement('div');
  el.className = 'alert alert-success text-sm';
  el.textContent = message;
  el.style.cssText =
    'position: fixed; top:20px; right:20px; z-index:10000; max-width:400px;';
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 3000);
}
