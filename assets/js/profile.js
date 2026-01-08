import { auth } from './firebase.js';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// afficher email
auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById('userEmail').value = user.email;
  }
});

document
  .getElementById('profile-form')
  .addEventListener('submit', async (e) => {

    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    const errorBox = document.getElementById('errorBox');
    const successBox = document.getElementById('successBox');

    errorBox.textContent = "";
    successBox.textContent = "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      errorBox.textContent = "Tous les champs sont obligatoires.";
      return;
    }

    if (newPassword.length < 6) {
      errorBox.textContent = "Mot de passe minimum : 6 caractères.";
      return;
    }

    if (newPassword !== confirmPassword) {
      errorBox.textContent = "Les mots de passe ne correspondent pas.";
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Utilisateur non connecté");

      // 🔐 re-authentification
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );

      await reauthenticateWithCredential(user, credential);

      // 🔁 mise à jour
      await updatePassword(user, newPassword);

      successBox.textContent = "Mot de passe mis à jour avec succès.";

      document.getElementById('currentPassword').value = "";
      document.getElementById('newPassword').value = "";
      document.getElementById('confirmPassword').value = "";

    } catch (err) {
      console.error(err);

      if (err.code === "auth/wrong-password") {
        errorBox.textContent = "Mot de passe actuel incorrect.";
      } else if (err.code === "auth/too-many-requests") {
        errorBox.textContent = "Trop de tentatives. Réessayez plus tard.";
      } else {
        errorBox.textContent = err.message;
      }
    }
  });