import { db } from './firebase.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, where } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { checkAuth } from './auth.js';

// Role protection
checkAuth('admin');

// Charger les statistiques du dashboard
async function loadDashboardStats() {
  try {
    // Clients confirmés
    const clientsSnapshot = await getDocs(collection(db, 'clients'));
    const clientsCount = clientsSnapshot.size;
    const clientsEl = document.getElementById('clients-count');
    if (clientsEl) clientsEl.textContent = clientsCount;

    // Agents actifs
    const agentsQuery = query(collection(db, 'users'), where('role', '==', 'agent'), where('status', '==', 'active'));
    const agentsSnapshot = await getDocs(agentsQuery);
    const agentsCount = agentsSnapshot.size;
    const agentsEl = document.getElementById('agents-count');
    if (agentsEl) agentsEl.textContent = agentsCount;

    // Total ventes et commissions
    const salesSnapshot = await getDocs(collection(db, 'sales'));
    const totals = salesSnapshot.docs.reduce((acc, doc) => {
      const sale = doc.data();
      acc.sales += parseFloat(sale.chiffreAffaires) || 0;
      acc.commissions += parseFloat(sale.commission) || 0;
      return acc;
    }, { sales: 0, commissions: 0 });

    const salesEl = document.getElementById('sales-total');
    if (salesEl) salesEl.textContent = totals.sales.toFixed(2) + '€';

    const commissionsEl = document.getElementById('commissions-total');
    if (commissionsEl) commissionsEl.textContent = totals.commissions.toFixed(2) + '€';

  } catch (error) {
    const errorBox = document.getElementById('error-message');
    if (errorBox) {
      errorBox.textContent = error.message;
    } else {
      console.error(error);
    }
  }
}

// Créer un utilisateur
async function createUser(firstName, lastName, email, role) {
  // Validation des entrées
  const errorBox = document.getElementById('error-message');
  if (!firstName.trim() || !lastName.trim() || !email.trim()) {
    if (errorBox) errorBox.textContent = 'Tous les champs sont obligatoires';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (errorBox) errorBox.textContent = 'Format email invalide';
    return;
  }
  if (!['admin', 'agent', 'supervisor'].includes(role)) {
    if (errorBox) errorBox.textContent = 'Rôle invalide';
    return;
  }

  try {
    // Vérification unicité email
    const existingQuery = query(collection(db, 'users'), where('email', '==', email));
    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
      if (errorBox) errorBox.textContent = 'Email déjà utilisé';
      return;
    }

    const currentUser = JSON.parse(sessionStorage.getItem('user'));
    const userData = {
      firstName,
      lastName,
      email,
      role,
      status: 'active',
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    };

    if (role === 'agent' || role === 'supervisor') {
      userData.authProvider = 'google';
    }

    await addDoc(collection(db, 'users'), userData);
    loadUsers(); // Recharger la liste
  } catch (error) {
    if (errorBox) {
      errorBox.textContent = error.message;
    } else {
      console.error(error);
    }
  }
}

// Charger les utilisateurs
async function loadUsers() {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    querySnapshot.forEach((docSnap) => {
      const user = docSnap.data();
      const row = document.createElement('tr');

      row.innerHTML = `
        <td>${user.firstName}</td>
        <td>${user.lastName}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td>${user.status}</td>
        <td>
          <button class="btn-toggle" data-id="${docSnap.id}" data-status="${user.status}">
            ${user.status === 'active' ? 'Désactiver' : 'Activer'}
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });

    // Ajouter les event listeners pour les boutons
    document.querySelectorAll('.btn-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const status = e.target.dataset.status;
        toggleStatus(id, status);
      });
    });

  } catch (error) {
    const errorBox = document.getElementById('error-message');
    if (errorBox) {
      errorBox.textContent = error.message;
    } else {
      console.error(error);
    }
  }
}



// Charger tous les clients pour supervision admin
async function loadAllClients() {
  try {
    // Charger les utilisateurs pour les noms
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const usersMap = {};
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      usersMap[doc.id] = `${user.firstName} ${user.lastName}`;
    });

    const querySnapshot = await getDocs(collection(db, 'clients'));
    const tbody = document.getElementById('clients-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    querySnapshot.forEach((docSnap) => {
      const client = docSnap.data();
      const agentName = usersMap[client.agentId] || 'Inconnu';
      const confirmedAt = client.confirmedAt ? new Date(client.confirmedAt.seconds * 1000).toLocaleDateString() : 'N/A';

      const row = document.createElement('tr');

      row.innerHTML = `
        <td>${client.data?.name || 'N/A'}</td>
        <td>${client.data?.email || 'N/A'}</td>
        <td>${confirmedAt}</td>
        <td>${agentName}</td>
      `;

      tbody.appendChild(row);
    });

  } catch (error) {
    const errorBox = document.getElementById('error-message');
    if (errorBox) {
      errorBox.textContent = error.message;
    } else {
      console.error(error);
    }
  }
}

// Basculer le statut
async function toggleStatus(userId, currentStatus) {
  try {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await updateDoc(doc(db, 'users', userId), {
      status: newStatus
    });
    loadUsers();
  } catch (error) {
    const errorBox = document.getElementById('error-message');
    if (errorBox) {
      errorBox.textContent = error.message;
    } else {
      console.error(error);
    }
  }
}



// Fonctions pour les formulaires de prospection
async function createProspectionForm(title, description, fields) {
  // Validation des entrées
  const errorBox = document.getElementById('error-message');
  if (!title.trim() || !description.trim()) {
    if (errorBox) errorBox.textContent = 'Titre et description obligatoires';
    return;
  }
  if (fields.length === 0) {
    if (errorBox) errorBox.textContent = 'Au moins un champ requis';
    return;
  }

  try {
    const currentUser = JSON.parse(sessionStorage.getItem('user'));
    await addDoc(collection(db, 'prospection_forms'), {
      title,
      description,
      fields,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });
    loadProspectionForms();
  } catch (error) {
    if (errorBox) {
      errorBox.textContent = error.message;
    } else {
      console.error(error);
    }
  }
}

// Ajouter un champ au formulaire
function addField() {
  const container = document.getElementById('fields-container');
  const fieldDiv = document.createElement('div');
  fieldDiv.className = 'field-item';

  fieldDiv.innerHTML = `
    <div class="form-group">
      <label>Nom du champ</label>
      <input type="text" class="field-name" required>
    </div>
    <div class="form-group">
      <label>Label</label>
      <input type="text" class="field-label" required>
    </div>
    <div class="form-group">
      <label>Type</label>
      <select class="field-type">
        <option value="text">Texte</option>
        <option value="email">Email</option>
        <option value="tel">Téléphone</option>
        <option value="textarea">Zone de texte</option>
      </select>
    </div>
    <div class="form-group">
      <label>
        <input type="checkbox" class="field-required"> Obligatoire
      </label>
    </div>
    <button type="button" class="btn btn-danger remove-field-btn">Supprimer</button>
  `;

  container.appendChild(fieldDiv);

  // Event listener pour supprimer le champ
  fieldDiv.querySelector('.remove-field-btn').addEventListener('click', () => {
    container.removeChild(fieldDiv);
  });
}

// Collecter les champs du formulaire
function collectFields() {
  const fields = [];
  const fieldItems = document.querySelectorAll('.field-item');

  fieldItems.forEach(item => {
    const name = item.querySelector('.field-name').value;
    const label = item.querySelector('.field-label').value;
    const type = item.querySelector('.field-type').value;
    const required = item.querySelector('.field-required').checked;

    if (name && label) {
      fields.push({ name, label, type, required });
    }
  });

  return fields;
}

async function loadProspectionForms() {
  try {
    const querySnapshot = await getDocs(collection(db, 'prospection_forms'));
    const tbody = document.getElementById('forms-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    querySnapshot.forEach((docSnap) => {
      const form = docSnap.data();
      const row = document.createElement('tr');

      row.innerHTML = `
        <td>${form.title}</td>
        <td>${form.description}</td>
        <td>
          <button class="btn-delete-form" data-id="${docSnap.id}">Supprimer</button>
        </td>
      `;

      tbody.appendChild(row);
    });

    document.querySelectorAll('.btn-delete-form').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        deleteProspectionForm(id);
      });
    });

  } catch (error) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) errorDiv.textContent = error.message;
  }
}

async function deleteProspectionForm(formId) {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce formulaire ?')) {
    try {
      await deleteDoc(doc(db, 'prospection_forms', formId));
      loadProspectionForms();
    } catch (error) {
      const errorDiv = document.getElementById('error-message');
      if (errorDiv) errorDiv.textContent = error.message;
    }
  }
}

// Gestion des événements
document.addEventListener('DOMContentLoaded', () => {
  const createUserForm = document.getElementById('create-user-form');
  if (createUserForm) {
    createUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const firstName = document.getElementById('firstName').value;
      const lastName = document.getElementById('lastName').value;
      const email = document.getElementById('email').value;
      const role = document.getElementById('role').value;

      try {
        await createUser(firstName, lastName, email, role);
        createUserForm.reset();
      } catch (error) {
        const errorBox = document.getElementById('error-message');
        if (errorBox) {
          errorBox.textContent = error.message;
        } else {
          console.error(error);
        }
      }
    });
  }

  const createFormForm = document.getElementById('create-form-form');
  if (createFormForm) {
    createFormForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('form-title').value;
      const description = document.getElementById('form-description').value;
      const fields = collectFields();

      try {
        await createProspectionForm(title, description, fields);
        createFormForm.reset();
        document.getElementById('fields-container').innerHTML = '';
      } catch (error) {
        const errorBox = document.getElementById('error-message');
        if (errorBox) {
          errorBox.textContent = error.message;
        } else {
          console.error(error);
        }
      }
    });
  }

  const addFieldBtn = document.getElementById('add-field-btn');
  if (addFieldBtn) {
    addFieldBtn.addEventListener('click', addField);
  }

  const createSaleForm = document.getElementById('create-sale-form');
  if (createSaleForm) {
    // Charger les agents
    loadAgentsForSelect();

    // Calculer automatiquement
    const inputs = ['chiffre-affaires', 'montant-reel', 'taux-commission'];
    inputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', calculateCommission);
      }
    });

    createSaleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const agentId = document.getElementById('agent-select').value;
      const ca = parseFloat(document.getElementById('chiffre-affaires').value);
      const mr = parseFloat(document.getElementById('montant-reel').value);
      const tc = parseFloat(document.getElementById('taux-commission').value);

      // Validation des entrées
      const errorBox = document.getElementById('error-message');
      if (!agentId) {
        if (errorBox) errorBox.textContent = 'Sélectionnez un agent';
        return;
      }
      if (isNaN(ca) || isNaN(mr) || isNaN(tc) || ca < 0 || mr < 0 || tc < 0 || tc > 100) {
        if (errorBox) errorBox.textContent = 'Valeurs numériques invalides';
        return;
      }

      const benefice = ca - mr;
      const commission = benefice * (tc / 100);

      try {
        await createSale(agentId, ca, mr, tc, benefice, commission);
        createSaleForm.reset();
        document.getElementById('benefice').textContent = '0';
        document.getElementById('commission').textContent = '0';
      } catch (error) {
        const errorBox = document.getElementById('error-message');
        if (errorBox) {
          errorBox.textContent = error.message;
        } else {
          console.error(error);
        }
      }
    });
  }

  // Charger les données au chargement
  loadDashboardStats();
  if (document.getElementById('users-tbody')) {
    loadUsers();
  }
  if (document.getElementById('clients-tbody')) {
    loadAllClients();
  }
  if (document.getElementById('forms-tbody')) {
    loadProspectionForms();
  }
  if (document.getElementById('sales-tbody')) {
    loadSales();
  }

  // Fix UX bug: Auto-close sidenav on mobile after clicking nav links
  const sidenav = document.getElementById("sidenav-main");
  const toggler = document.getElementById("iconNavbarSidenav");

  if (sidenav) {
    const navLinks = sidenav.querySelectorAll(".nav-link");

    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        // Remove pinned class if present
        if (document.body.classList.contains("g-sidenav-pinned")) {
          document.body.classList.remove("g-sidenav-pinned");
        }

        // Trigger the toggler button to close the menu
        if (toggler && window.innerWidth < 1200) {
          toggler.click();
        }
      });
    });
  }
});
// Fonctions pour les ventes
async function loadAgentsForSelect() {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    const select = document.getElementById('agent-select');
    if (!select) return;

    querySnapshot.forEach((docSnap) => {
      const user = docSnap.data();
      if (user.role === 'agent') {
        const option = document.createElement('option');
        option.value = docSnap.id;
        option.textContent = `${user.firstName} ${user.lastName}`;
        select.appendChild(option);
      }
    });
  } catch (error) {
    const errorBox = document.getElementById('error-message');
    if (errorBox) {
      errorBox.textContent = error.message;
    } else {
      console.error(error);
    }
  }
}

function calculateCommission() {
  const beneficeEl = document.getElementById('benefice');
  const commissionEl = document.getElementById('commission');
  const ca = parseFloat(document.getElementById('chiffre-affaires').value) || 0;
  const mr = parseFloat(document.getElementById('montant-reel').value) || 0;
  const tc = parseFloat(document.getElementById('taux-commission').value) || 0;

  const benefice = ca - mr;
  const commission = benefice * (tc / 100);

  if (beneficeEl) beneficeEl.textContent = benefice.toFixed(2);
  if (commissionEl) commissionEl.textContent = commission.toFixed(2);
}

async function createSale(agentId, chiffreAffaires, montantReel, tauxCommission, benefice, commission) {
  try {
    const currentUser = JSON.parse(sessionStorage.getItem('user'));
    await addDoc(collection(db, 'sales'), {
      agentId,
      chiffreAffaires,
      montantReel,
      tauxCommission,
      benefice,
      commission,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });
    loadSales();
  } catch (error) {
    const errorBox = document.getElementById('error-message');
    if (errorBox) {
      errorBox.textContent = error.message;
    } else {
      console.error(error);
    }
  }
}

async function loadSales() {
  try {
    // Charger les utilisateurs pour les noms
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const usersMap = {};
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      usersMap[doc.id] = `${user.firstName} ${user.lastName}`;
    });

    const querySnapshot = await getDocs(collection(db, 'sales'));
    const tbody = document.getElementById('sales-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    querySnapshot.forEach((docSnap) => {
      const sale = docSnap.data();
      const agentName = usersMap[sale.agentId] || 'Inconnu';
      const row = document.createElement('tr');

      row.innerHTML = `
        <td>${agentName}</td>
        <td>${sale.chiffreAffaires}€</td>
        <td>${sale.montantReel}€</td>
        <td>${sale.benefice}€</td>
        <td>${sale.tauxCommission}%</td>
        <td>${sale.commission}€</td>
      `;

      tbody.appendChild(row);
    });

  } catch (error) {
    const errorBox = document.getElementById('error-message');
    if (errorBox) {
      errorBox.textContent = error.message;
    } else {
      console.error(error);
    }
  }
}