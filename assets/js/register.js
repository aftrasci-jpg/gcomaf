import { db } from './firebase.js';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs
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

console.log('Register script loaded');

// Validation du code d'accès
async function validateAccessCode(code) {
  if (!code || code.trim().length === 0) {
    throw new Error('Le code d\'accès est obligatoire');
  }

  const ref = doc(db, 'system_config', 'agent_access_code');
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error('Aucun code d\'accès valide trouvé');
  }

  const data = snap.data();

  if (data.code !== code.trim()) {
    throw new Error('Code d\'accès invalide');
  }

  // Vérifier l'expiration
  const expiresAt = data.expiresAt?.toDate?.() || new Date(data.expiresAt);
  const now = new Date();

  if (now > expiresAt) {
    throw new Error('Ce code d\'accès a expiré. Veuillez demander un nouveau code à votre administrateur.');
  }

  return true;
}

// Soumission du formulaire d'inscription
console.log('Setting up form listener');
const registerForm = document.getElementById('register-form');
console.log('Form element:', registerForm);

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    console.log('Form submit event triggered');
    e.preventDefault();

    const formData = {
      lastName: document.getElementById('lastName').value.trim(),
      firstName: document.getElementById('firstName').value.trim(),
      email: document.getElementById('email').value.trim().toLowerCase(),
      password: document.getElementById('password').value,
      accessCode: document.getElementById('accessCode').value.trim()
    };

    console.log('Form data:', formData);

    // Masquer les messages précédents
    hideMessages();

  try {
    console.log('Starting validation...');

    // Validation des champs
    if (!formData.firstName || !formData.lastName) {
      throw new Error('Le prénom et le nom sont obligatoires');
    }

    if (!formData.email) {
      throw new Error('L\'email est obligatoire');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      throw new Error('Format d\'email invalide');
    }

    if (!formData.password || formData.password.length < 6) {
      throw new Error('Le mot de passe doit contenir au moins 6 caractères');
    }

    console.log('Field validation passed, validating access code...');

    // Validation du code d'accès
    await validateAccessCode(formData.accessCode);
    console.log('Access code validated successfully');

    console.log('Checking if email exists...');

    // Vérifier que l'email n'existe pas déjà
    await authAdminService.checkEmailExists(formData.email);
    console.log('Email check passed');

    // Créer le compte Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      formData.email,
      formData.password
    );

    const user = userCredential.user;

    // Mettre à jour le profil Firebase
    await updateProfile(user, {
      displayName: `${formData.firstName} ${formData.lastName}`
    });

    // Créer l'utilisateur dans Firestore
    await usersService.createUserInFirestore(
      user.uid,
      formData.firstName,
      formData.lastName,
      formData.email,
      'agent'
    );

    // Redirection vers le dashboard agent
    showSuccess('Compte créé avec succès ! Redirection en cours...');
    setTimeout(() => {
      window.location.href = 'agent/dashboard.html';
    }, 2000);

  } catch (error) {
    console.error('Erreur inscription:', error);
    showError(error.message);
  }
  });
} else {
  console.error('Register form not found');
}

// Fonctions utilitaires
function showError(message) {
  const errorEl = document.getElementById('error-message');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('d-none');
  }
}

function showSuccess(message) {
  // Créer un élément de succès temporaire
  const successEl = document.createElement('div');
  successEl.className = 'alert alert-success text-sm';
  successEl.textContent = message;
  successEl.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; max-width: 400px;';

  document.body.appendChild(successEl);

  setTimeout(() => {
    successEl.remove();
  }, 3000);
}

function hideMessages() {
  const errorEl = document.getElementById('error-message');
  if (errorEl) {
    errorEl.classList.add('d-none');
  }
}