import { db } from './firebase.js';
import { collection, getDocs } from 'firebase/firestore';
import { formatCFA } from './utils.js';
import { checkAuth } from './auth.js';

// Protection par rôle supervisor
checkAuth('supervisor');

// Gestion UX (loader + messages)
function showLoader(show = true) {
  const loader = document.getElementById('global-loader');
  if (!loader) return;
  loader.classList.toggle('d-none', !show);
}

function showError(message) {
  const el = document.getElementById('error-message');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('d-none');
}

function showInfo(message) {
  const el = document.getElementById('info-message');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('d-none');
  setTimeout(() => el.classList.add('d-none'), 3000);
}

// Charger toutes les données
async function loadAllData() {
  try {
    showLoader(true);

    // ---------------- USERS ----------------
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const usersMap = {};
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      usersMap[doc.id] = `${user.firstName} ${user.lastName}`;
    });

    // ---------------- PROSPECTS ----------------
    const prospectsSnapshot = await getDocs(collection(db, 'prospects'));
    const prospectsTbody = document.getElementById('prospects-tbody');
    prospectsTbody.innerHTML = '';

    prospectsSnapshot.forEach(doc => {
      const prospect = doc.data();
      const agentName = usersMap[prospect.agentId] || 'Inconnu';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="fw-bold">${agentName}</td>
        <td>${prospect.data?.firstName || ''} ${prospect.data?.lastName || ''}</td>
        <td>${prospect.data?.email || ''}</td>
      `;
      prospectsTbody.appendChild(row);
    });

    // ---------------- CLIENTS ----------------
    const clientsSnapshot = await getDocs(collection(db, 'clients'));
    const clientsTbody = document.getElementById('clients-tbody');
    clientsTbody.innerHTML = '';

    clientsSnapshot.forEach(doc => {
      const client = doc.data();
      const agentName = usersMap[client.agentId] || 'Inconnu';

      const confirmedAt = client.confirmedAt
        ? new Date(client.confirmedAt.seconds * 1000).toLocaleDateString('fr-FR')
        : '';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="fw-bold">${agentName}</td>
        <td>${client.data?.firstName || ''} ${client.data?.lastName || ''}</td>
        <td>${client.data?.email || ''}</td>
        <td>${confirmedAt}</td>
      `;
      clientsTbody.appendChild(row);
    });

    // ---------------- SALES ----------------
    const salesSnapshot = await getDocs(collection(db, 'sales'));
    const salesTbody = document.getElementById('sales-tbody');
    salesTbody.innerHTML = '';

    salesSnapshot.forEach(doc => {
      const sale = doc.data();
      const agentName = usersMap[sale.agentId] || 'Inconnu';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="fw-bold">${agentName}</td>
        <td>${formatCFA(sale.chiffreAffaires || 0)}</td>
        <td class="text-success fw-bold">${formatCFA(sale.commission || 0)}</td>
      `;
      salesTbody.appendChild(row);
    });

    showInfo('Données chargées avec succès');

  } catch (error) {
    console.error('Erreur supervisor.js:', error);
    showError('Erreur lors du chargement des données : ' + error.message);
  } finally {
    showLoader(false);
  }
}

// Gestion des événements
document.addEventListener('DOMContentLoaded', () => {
  loadAllData();
});