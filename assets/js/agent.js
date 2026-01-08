import { db } from './firebase.js';
import { collection, addDoc, getDocs, getDoc, doc, deleteDoc, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { checkAuth } from './auth.js';

// Role protection
checkAuth('agent');

// Créer un prospect local
async function createLocalProspect(formData) {
  try {
    const user = JSON.parse(sessionStorage.getItem('user'));

    await addDoc(collection(db, 'prospects'), {
      agentId: user.uid,
      data: formData,
      status: 'new',
      createdAt: serverTimestamp()
    });

    showSuccess('Prospect créé avec succès !');
    resetProspectForm();

    // Recharger les prospects
    loadProspects();
  } catch (error) {
    console.error('Erreur création prospect:', error);
    showError('Erreur lors de la création du prospect: ' + error.message);
  }
}

// Charger les prospects de l'agent
async function loadProspects() {
  try {
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (!user) return;

    const prospectsRef = collection(db, 'prospects');
    const q = query(prospectsRef, where('agentId', '==', user.uid));
    const querySnapshot = await getDocs(q);

    const tbody = document.getElementById('prospects-tbody');
    if (!tbody) return; // Pour éviter les erreurs sur les pages qui n'ont pas cette table

    tbody.innerHTML = '';

    querySnapshot.forEach((docSnap) => {
      const prospect = docSnap.data();
      const row = document.createElement('tr');

      row.innerHTML = `
        <td>${prospect.data?.firstName || prospect.data?.name || prospect.name || ''} ${prospect.data?.lastName || ''}</td>
        <td>${prospect.data?.email || prospect.email || ''}</td>
        <td>${prospect.data?.phone || prospect.phone || ''}</td>
        <td>${prospect.status === 'new' ? 'Nouveau' : 'En cours'}</td>
        <td>
          <label class="switch">
            <input type="checkbox" data-id="${docSnap.id}">
            <span class="slider"></span>
          </label>
        </td>
      `;

      tbody.appendChild(row);
    });

    // Ajouter les event listeners pour les toggles
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          openConfirmModal(e.target.dataset.id);
        }
      });
    });

  } catch (error) {
    console.error('Erreur chargement prospects:', error);
    showError('Erreur lors du chargement des prospects: ' + error.message);
  }
}

// Fonctions utilitaires pour les messages
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
  if (!errorEl) return;

  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function resetProspectForm() {
  const form = document.getElementById('prospect-form');
  if (form) {
    form.reset();
  }
}

// Ouvrir le modal de confirmation
function openConfirmModal(prospectId) {
  const modal = document.getElementById('confirm-modal');
  if (!modal) return;

  modal.style.display = 'block';
  modal.dataset.prospectId = prospectId;
}

// Fermer le modal
function closeModal() {
  const modal = document.getElementById('confirm-modal');
  if (!modal) return;

  modal.style.display = 'none';
  delete modal.dataset.prospectId;
}

// Confirmer la conversion
async function confirmConversion() {
  const modal = document.getElementById('confirm-modal');
  const prospectId = modal.dataset.prospectId;

  try {
    const user = JSON.parse(sessionStorage.getItem('user'));

    // Récupérer les données du prospect
    const prospectDoc = await getDoc(doc(db, 'prospects', prospectId));
    const prospect = prospectDoc.data();

    if (!prospect) {
      throw new Error('Prospect non trouvé');
    }

    // Créer le client avec les données du prospect
    await addDoc(collection(db, 'clients'), {
      data: prospect.data,
      agentId: prospect.agentId,
      confirmedAt: serverTimestamp(),
      sentToAdmin: true
    });

    // Supprimer le prospect
    await deleteDoc(doc(db, 'prospects', prospectId));

    // Désactiver le toggle après conversion
    const checkbox = document.querySelector(`input[data-id="${prospectId}"]`);
    if (checkbox) checkbox.disabled = true;

    // Message de succès
    showSuccess('Prospect converti en client avec succès !');

    // Fermer le modal
    closeModal();

    // Recharger la liste
    loadProspects();

  } catch (error) {
    document.getElementById('error-message').textContent = error.message;
  }
}

// Gestion des événements
document.addEventListener('DOMContentLoaded', () => {
  // Gestion du formulaire de création de prospect local
  const prospectForm = document.getElementById('prospect-form');
  if (prospectForm) {
    prospectForm.addEventListener('submit', async (e) => {
      e.preventDefault();

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

      await createLocalProspect(formData);
    });
  }

  // Gestion du modal de confirmation prospect → client
  const cancelBtn = document.getElementById('cancel-btn');
  const confirmBtn = document.getElementById('confirm-btn');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      // Remettre le toggle à off
      const modal = document.getElementById('confirm-modal');
      const prospectId = modal.dataset.prospectId;
      const checkbox = document.querySelector(`input[data-id="${prospectId}"]`);
      if (checkbox) checkbox.checked = false;
      closeModal();
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', confirmConversion);
  }

  // Charger les données au chargement
  loadProspects();
});

// Fonction utilitaire pour validation email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
