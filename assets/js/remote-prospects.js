import { db } from './firebase.js';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { checkAuth } from './auth.js';

// Role protection
checkAuth('agent');

// Charger les prospects distants de l'agent
async function loadRemoteProspects() {
  try {
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (!user) return;

    const remoteProspectsRef = collection(db, 'remote_prospects');
    const q = query(remoteProspectsRef, where('agentId', '==', user.uid));
    const querySnapshot = await getDocs(q);

    const tbody = document.getElementById('remote-prospects-tbody');
    const countEl = document.getElementById('prospects-count');

    if (!tbody) return;

    tbody.innerHTML = '';

    let count = 0;
    querySnapshot.forEach((docSnap) => {
      const remoteProspect = docSnap.data();
      const row = document.createElement('tr');

      // Formater la date
      const createdAt = remoteProspect.createdAt?.toDate?.() || new Date(remoteProspect.createdAt);
      const formattedDate = createdAt.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      row.innerHTML = `
        <td>${remoteProspect.data.firstName} ${remoteProspect.data.lastName}</td>
        <td>${remoteProspect.data.phone}</td>
        <td>${remoteProspect.data.email}</td>
        <td>${getProductLabel(remoteProspect.data.productInterest)}</td>
        <td>${remoteProspect.data.estimatedQty || '-'}</td>
        <td>${formattedDate}</td>
        <td>
          <button class="btn btn-sm btn-info me-2" onclick="verifyRemoteProspect('${docSnap.id}')">
            <i class="fas fa-eye"></i> Vérifier
          </button>
        </td>
      `;

      tbody.appendChild(row);
      count++;
    });

    if (countEl) {
      countEl.textContent = count;
    }

  } catch (error) {
    console.error('Erreur chargement prospects distants:', error);
    showError('Erreur lors du chargement des prospects distants: ' + error.message);
  }
}

// Fonction globale pour vérifier un prospect distant
window.verifyRemoteProspect = async function(prospectId) {
  try {
    const remoteProspectsRef = collection(db, 'remote_prospects');
    const prospectDoc = await getDocs(query(remoteProspectsRef, where('__name__', '==', prospectId)));
    const prospectData = prospectDoc.docs[0]?.data();

    if (!prospectData) {
      throw new Error('Prospect non trouvé');
    }

    // Remplir le modal de vérification
    document.getElementById('verify-firstName').value = prospectData.data.firstName || '';
    document.getElementById('verify-lastName').value = prospectData.data.lastName || '';
    document.getElementById('verify-phone').value = prospectData.data.phone || '';
    document.getElementById('verify-email').value = prospectData.data.email || '';
    document.getElementById('verify-country').value = prospectData.data.country || '';
    document.getElementById('verify-city').value = prospectData.data.city || '';
    document.getElementById('verify-company').value = prospectData.data.company || '';
    document.getElementById('verify-productInterest').value = prospectData.data.productInterest || '';
    document.getElementById('verify-estimatedQty').value = prospectData.data.estimatedQty || '';

    // Stocker l'ID pour la confirmation
    document.getElementById('verify-modal').dataset.prospectId = prospectId;

    // Ouvrir le modal
    const modal = new bootstrap.Modal(document.getElementById('verify-modal'));
    modal.show();

  } catch (error) {
    console.error('Erreur vérification prospect:', error);
    showError('Erreur lors de la vérification: ' + error.message);
  }
};

// Confirmer un prospect distant (le déplacer vers prospects)
async function confirmRemoteProspect() {
  const modal = document.getElementById('verify-modal');
  const prospectId = modal.dataset.prospectId;

  if (!prospectId) return;

  try {
    // Fermer le modal
    const modalInstance = bootstrap.Modal.getInstance(modal);
    modalInstance.hide();

    const user = JSON.parse(sessionStorage.getItem('user'));

    // Collecter les données modifiées du formulaire
    const formData = {
      firstName: document.getElementById('verify-firstName').value.trim(),
      lastName: document.getElementById('verify-lastName').value.trim(),
      phone: document.getElementById('verify-phone').value.trim(),
      email: document.getElementById('verify-email').value.trim(),
      country: document.getElementById('verify-country').value.trim(),
      city: document.getElementById('verify-city').value.trim(),
      company: document.getElementById('verify-company').value.trim(),
      productInterest: document.getElementById('verify-productInterest').value,
      estimatedQty: document.getElementById('verify-estimatedQty').value ? parseInt(document.getElementById('verify-estimatedQty').value) : null
    };

    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      showError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    // Créer le prospect dans la collection prospects
    await addDoc(collection(db, 'prospects'), {
      agentId: user.uid,
      data: formData,
      status: 'in_progress', // Status différent pour les prospects validés depuis distants
      createdAt: serverTimestamp()
    });

    // Supprimer de remote_prospects
    await deleteDoc(doc(db, 'remote_prospects', prospectId));

    showSuccess('Prospect confirmé et ajouté à votre liste !');

    // Recharger les prospects distants
    loadRemoteProspects();

  } catch (error) {
    console.error('Erreur confirmation prospect:', error);
    showError('Erreur lors de la confirmation: ' + error.message);
  }
}

// Fonctions utilitaires
function getProductLabel(productKey) {
  const products = {
    'logiciel': 'Logiciel',
    'consulting': 'Consulting',
    'formation': 'Formation',
    'support': 'Support technique',
    'autre': 'Autre'
  };
  return products[productKey] || productKey;
}

function showSuccess(message) {
  const successEl = document.getElementById('success-message');
  if (successEl) {
    successEl.textContent = message;
    successEl.style.display = 'block';
    setTimeout(() => successEl.style.display = 'none', 3000);
  }
}

function showError(message) {
  const errorEl = document.getElementById('error-message');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
}

// Gestion des événements
document.addEventListener('DOMContentLoaded', () => {
  // Bouton de confirmation dans le modal
  const confirmBtn = document.getElementById('confirm-remote-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', confirmRemoteProspect);
  }

  // Charger les données au chargement
  loadRemoteProspects();
});