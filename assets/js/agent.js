import { db } from './firebase.js';
import { collection, addDoc, getDocs, getDoc, doc, deleteDoc, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { checkAuth } from './auth.js';

// Role protection
checkAuth('agent');

// Variables globales
let formsCache = [];
let selectedFormId = null;
let selectedFormFields = [];

// Charger et mettre en cache les formulaires de prospection
async function loadAndCacheProspectionForms() {
  try {
    const formsRef = collection(db, 'prospection_forms');
    const querySnapshot = await getDocs(formsRef);

    formsCache = [];
    const select = document.getElementById('form-select');
    select.innerHTML = '<option value="">Sélectionnez un formulaire</option>';

    querySnapshot.forEach((docSnap) => {
      const formData = docSnap.data();
      formsCache.push({
        id: docSnap.id,
        ...formData
      });

      const option = document.createElement('option');
      option.value = docSnap.id;
      option.textContent = formData.title;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Erreur lors du chargement des formulaires:', error);
  }
}

// Générer le formulaire dynamique depuis le cache
function generateDynamicForm(formId) {
  const form = formsCache.find(f => f.id === formId);
  if (!form) {
    console.error('Formulaire non trouvé dans le cache');
    return;
  }

  selectedFormFields = form.fields || [];
  selectedFormId = formId;

  // Empêcher la génération d’un formulaire vide
  if (selectedFormFields.length === 0) {
    alert('Ce formulaire ne contient aucun champ à remplir.');
    document.getElementById('form-select').value = '';
    return;
  }

  const container = document.getElementById('dynamic-form-container');
  container.innerHTML = '';

  selectedFormFields.forEach(field => {
    const div = document.createElement('div');
    div.className = 'form-group';

    const label = document.createElement('label');
    label.textContent = field.label;
    label.setAttribute('for', field.name);

    let input;
    if (field.type === 'textarea') {
      input = document.createElement('textarea');
    } else {
      input = document.createElement('input');
      input.type = field.type || 'text';
    }

    input.id = field.name;
    input.name = field.name;
    if (field.required) input.required = true;

    div.appendChild(label);
    div.appendChild(input);
    container.appendChild(div);
  });

  // Afficher le bouton de soumission
  document.getElementById('submit-prospect-btn').style.display = 'block';
}

// Créer un prospect
async function createProspect(formData) {
  try {
    const user = JSON.parse(sessionStorage.getItem('user'));

    await addDoc(collection(db, 'prospects'), {
      agentId: user.uid,
      formId: selectedFormId,
      data: formData,
      status: 'new',
      createdAt: serverTimestamp()
    });

    // Réinitialiser le formulaire
    document.getElementById('form-select').value = '';
    document.getElementById('dynamic-form-container').innerHTML = '';
    document.getElementById('submit-prospect-btn').style.display = 'none';

    // Recharger les prospects
    loadProspects();
  } catch (error) {
    document.getElementById('error-message').textContent = error.message;
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
    tbody.innerHTML = '';

    querySnapshot.forEach((docSnap) => {
      const prospect = docSnap.data();
      const row = document.createElement('tr');

      row.innerHTML = `
        <td>${prospect.data?.name || prospect.name || ''}</td>
        <td>${prospect.data?.email || prospect.email || ''}</td>
        <td>${prospect.data?.phone || prospect.phone || ''}</td>
        <td>${prospect.status === 'new' ? 'Nouveau' : 'Prospect'}</td>
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
    document.getElementById('error-message').textContent = error.message;
  }
}

// Ouvrir le modal de confirmation
function openConfirmModal(prospectId) {
  const modal = document.getElementById('confirm-modal');
  modal.style.display = 'block';
  modal.dataset.prospectId = prospectId;
}

// Fermer le modal
function closeModal() {
  const modal = document.getElementById('confirm-modal');
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
      formId: prospect.formId,
      data: prospect.data,
      agentId: prospect.agentId,
      confirmedAt: serverTimestamp(),
      sentToAdmin: true
    });

    // Supprimer le prospect
    await deleteDoc(doc(db, 'prospects', prospectId));

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
  const cancelBtn = document.getElementById('cancel-btn');
  const confirmBtn = document.getElementById('confirm-btn');
  const formSelect = document.getElementById('form-select');
  const submitBtn = document.getElementById('submit-prospect-btn');

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

  if (formSelect) {
    formSelect.addEventListener('change', (e) => {
      const formId = e.target.value;
      if (formId) {
        generateDynamicForm(formId);
      } else {
        document.getElementById('dynamic-form-container').innerHTML = '';
        document.getElementById('submit-prospect-btn').style.display = 'none';
      }
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!selectedFormId) {
        alert('Veuillez sélectionner un formulaire');
        return;
      }

      // Validation JS des champs requis
      let hasErrors = false;
      selectedFormFields.forEach(field => {
        if (field.required) {
          const input = document.getElementById(field.name);
          if (!input || !input.value.trim()) {
            alert(`Le champ "${field.label}" est obligatoire.`);
            hasErrors = true;
            input?.focus();
            return;
          }
        }
      });
      if (hasErrors) return;

      const formData = {};
      selectedFormFields.forEach(field => {
        const input = document.getElementById(field.name);
        if (input) {
          formData[field.name] = input.value;
        }
      });
      createProspect(formData);
    });
  }

  // Charger les données au chargement
  loadAndCacheProspectionForms();
  loadProspects();
});
