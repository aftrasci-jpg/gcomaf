import { db } from './firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Fonction pour obtenir l'agentId depuis l'URL
function getAgentIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('agentId');
}

// Soumission du formulaire
document.getElementById('prospect-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const agentId = getAgentIdFromUrl();
  if (!agentId) {
    showError('Lien invalide. Aucun agent associé.');
    return;
  }

  // Collecter les données du formulaire
  const formData = {
    firstName: document.getElementById('firstName').value.trim(),
    lastName: document.getElementById('lastName').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim(),
    country: document.getElementById('country').value.trim(),
    city: document.getElementById('city').value.trim(),
    company: document.getElementById('company').value.trim(),
    productInterest: document.getElementById('productInterest').value,
    estimatedQty: document.getElementById('estimatedQty').value ? parseInt(document.getElementById('estimatedQty').value) : null
  };

  // Validation basique
  if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
    showError('Veuillez remplir tous les champs obligatoires.');
    return;
  }

  if (!isValidEmail(formData.email)) {
    showError('Veuillez saisir une adresse email valide.');
    return;
  }

  try {
    // Masquer les messages précédents
    hideMessages();

    // Désactiver le bouton
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Envoi en cours...';

    // Enregistrer dans remote_prospects
    await addDoc(collection(db, 'remote_prospects'), {
      agentId: agentId,
      data: formData,
      status: 'pending',
      createdAt: serverTimestamp()
    });

    // Masquer le formulaire et afficher le succès
    document.getElementById('prospect-form').style.display = 'none';
    showSuccess();

  } catch (error) {
    console.error('Erreur lors de l\'envoi:', error);
    showError('Une erreur s\'est produite. Veuillez réessayer.');
  } finally {
    // Réactiver le bouton
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Envoyer ma demande';
  }
});

// Fonctions utilitaires
function showSuccess() {
  document.getElementById('success-message').style.display = 'block';
}

function showError(message) {
  document.getElementById('error-message').style.display = 'block';
  document.getElementById('error-text').textContent = message;
}

function hideMessages() {
  document.getElementById('success-message').style.display = 'none';
  document.getElementById('error-message').style.display = 'none';
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}