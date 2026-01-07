import { auth, db, provider } from './firebase.js';
import { signInWithEmailAndPassword, signInWithPopup } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Fonction de connexion admin
async function loginAdminEmailPassword(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await checkUserInFirestore(user.email);
  } catch (error) {
    throw error;
  }
}

// Fonction de connexion Google
async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
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
  if (window.location.protocol === 'file:') {
    window.location.href = path;
  } else {
    window.location.href = '/' + path;
  }
}

// Garde d'authentification
function checkAuth(requiredRole) {
  const user = JSON.parse(sessionStorage.getItem('user'));
  if (!user) {
    const loginUrl = window.location.protocol === 'file:' ? '../index.html' : '/index.html';
    window.location.href = loginUrl;
    return;
  }
  if (user.role !== requiredRole) {
    const loginUrl = window.location.protocol === 'file:' ? '../index.html' : '/index.html';
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
  const adminForm = document.getElementById('admin-form');
  const googleBtn = document.getElementById('google-login');
  const errorDiv = document.getElementById('error-message');

  if (adminForm) {
    adminForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('admin-email').value;
      const password = document.getElementById('admin-password').value;
      try {
        await loginAdminEmailPassword(email, password);
      } catch (error) {
        errorDiv.textContent = error.message;
      }
    });
  }

  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      try {
        await loginWithGoogle();
      } catch (error) {
        errorDiv.textContent = error.message;
      }
    });
  }
});

// Exporter les fonctions pour les gardes
export { checkAuth };
