import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Fonction de connexion Email/Password
async function loginWithEmailPassword(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await checkUserInFirestore(user.email);
  } catch (error) {
    throw error;
  }
}

// Vérification utilisateur dans Firestore
async function checkUserInFirestore(email) {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', email));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error('Utilisateur non trouvé dans Firestore');
  }

  const userDoc = querySnapshot.docs[0];
  const userData = userDoc.data();

  if (userData.status !== 'active') {
    throw new Error('Compte inactif');
  }

  if (!userData.firstName || !userData.lastName) {
    throw new Error('Identité incomplète');
  }

  // Vérifier si l'utilisateur doit changer son mot de passe
  if (userData.passwordTemporary === true) {
    // Rediriger vers la page de changement de mot de passe
    const changePasswordUrl = window.location.origin + '/gcomaf/change-password.html';
    window.location.href = changePasswordUrl;
    return; // Ne pas continuer avec la redirection normale
  }

  // Stocker en session
  sessionStorage.setItem('user', JSON.stringify({
    uid: userDoc.id,
    firebaseUid: auth.currentUser.uid,
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    role: userData.role
  }));

  redirectByRole(userData.role);
}

// Redirection par rôle
function redirectByRole(role) {
  let path;
  if (role === 'admin') {
    path = 'admin/dashboard.html';
  } else if (role === 'agent') {
    path = 'agent/dashboard.html';
  } else if (role === 'supervisor') {
    path = 'supervisor/dashboard.html';
  } else {
    throw new Error('Rôle inconnu');
  }

  // Pour GitHub Pages, utiliser le chemin relatif au repository
  const baseUrl = window.location.origin + '/gcomaf/';
  window.location.href = baseUrl + path;
}

// Garde d'authentification
function checkAuth(requiredRole) {
  const user = JSON.parse(sessionStorage.getItem('user'));
  if (!user) {
    const loginUrl = window.location.origin + '/gcomaf/index.html';
    window.location.href = loginUrl;
    return;
  }
  if (user.role !== requiredRole) {
    const loginUrl = window.location.origin + '/gcomaf/index.html';
    window.location.href = loginUrl;
    return;
  }
  // Afficher le nom
  const nameElement = document.getElementById('user-name');
  if (nameElement) {
    nameElement.textContent = `Bonjour ${user.firstName} ${user.lastName}`;
  }
}

// Gestion des événements
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const errorDiv = document.getElementById('error-message');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      try {
        await loginWithEmailPassword(email, password);
      } catch (error) {
        let errorMessage = 'Erreur de connexion';
        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = 'Utilisateur non trouvé';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Mot de passe incorrect';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Format d\'email invalide';
            break;
          case 'auth/user-disabled':
            errorMessage = 'Compte désactivé';
            break;
          default:
            errorMessage = error.message;
        }
        errorDiv.textContent = errorMessage;
        errorDiv.style.display = 'block';
      }
    });
  }
});

import { signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// Vérification des permissions
export function checkPermission(action) {
  if (action === "FORM_MANAGEMENT") {
    console.error("Accès refusé : gestion des formulaires supprimée.");
    return false;
  }
  return true;
}

// Fonction de déconnexion
export async function logout() {
  try {
    await signOut(auth);

    // Nettoyage session
    localStorage.clear();
    sessionStorage.clear();

    // Redirection vers login avec URL complète pour GitHub Pages
    const loginUrl = window.location.origin + '/gcomaf/index.html';
    window.location.href = loginUrl;
  } catch (error) {
    console.error("Erreur déconnexion :", error);
    alert("Erreur lors de la déconnexion.");
  }
}

// Exporter les fonctions pour les gardes
export { checkAuth };
