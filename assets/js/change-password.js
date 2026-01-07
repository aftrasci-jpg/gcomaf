import { auth, db } from './firebase.js';
import { updatePassword } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { doc, updateDoc, query, collection, where, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Vérifier si l'utilisateur est connecté
const user = auth.currentUser;
if (!user) {
  window.location.href = 'index.html';
}

// Gestionnaire d'événement pour le formulaire
document.addEventListener('DOMContentLoaded', () => {
  const changePasswordForm = document.getElementById('change-password-form');
  const errorMessage = document.getElementById('error-message');
  const successMessage = document.getElementById('success-message');

  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Masquer les messages précédents
      errorMessage.style.display = 'none';
      successMessage.style.display = 'none';

      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      // Validation côté client
      if (newPassword.length < 8) {
        errorMessage.textContent = 'Le mot de passe doit contenir au moins 8 caractères.';
        errorMessage.style.display = 'block';
        return;
      }

      if (newPassword !== confirmPassword) {
        errorMessage.textContent = 'Les mots de passe ne correspondent pas.';
        errorMessage.style.display = 'block';
        return;
      }

      try {
        // Changer le mot de passe dans Firebase Auth
        await updatePassword(user, newPassword);

        // Mettre à jour le document Firestore pour marquer le mot de passe comme non temporaire
        const userQuery = query(collection(db, 'users'), where('uid', '==', user.uid));
        const userSnapshot = await getDocs(userQuery);

        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          await updateDoc(doc(db, 'users', userDoc.id), {
            passwordTemporary: false
          });
        }

        // Afficher le message de succès
        successMessage.textContent = 'Mot de passe changé avec succès ! Redirection vers le dashboard...';
        successMessage.style.display = 'block';

        // Rediriger vers le dashboard approprié après 2 secondes
        setTimeout(() => {
          // Récupérer le rôle de l'utilisateur depuis Firestore pour la redirection
          if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            switch (userData.role) {
              case 'admin':
                window.location.href = 'admin/dashboard.html';
                break;
              case 'supervisor':
                window.location.href = 'supervisor/dashboard.html';
                break;
              case 'agent':
                window.location.href = 'agent/dashboard.html';
                break;
              default:
                window.location.href = 'index.html';
            }
          }
        }, 2000);

      } catch (error) {
        console.error('Erreur lors du changement de mot de passe:', error);

        let errorMsg = 'Une erreur est survenue. Veuillez réessayer.';

        switch (error.code) {
          case 'auth/weak-password':
            errorMsg = 'Le mot de passe est trop faible. Utilisez au moins 8 caractères.';
            break;
          case 'auth/requires-recent-login':
            errorMsg = 'Session expirée. Veuillez vous reconnecter.';
            window.location.href = 'index.html';
            break;
          default:
            errorMsg = error.message;
        }

        errorMessage.textContent = errorMsg;
        errorMessage.style.display = 'block';
      }
    });
  }
});