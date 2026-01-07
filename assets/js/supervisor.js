import { db } from './firebase.js';
import { collection, getDocs } from 'firebase/firestore';

// Charger toutes les données
async function loadAllData() {
  try {
    // Charger les utilisateurs pour les noms
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const usersMap = {};
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      usersMap[doc.id] = `${user.firstName} ${user.lastName}`;
    });

    // Charger les prospects
    const prospectsSnapshot = await getDocs(collection(db, 'prospects'));
    const prospectsTbody = document.getElementById('prospects-tbody');
    prospectsTbody.innerHTML = '';
    prospectsSnapshot.forEach(doc => {
      const prospect = doc.data();
      const agentName = usersMap[prospect.agentId] || 'Inconnu';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${agentName}</td>
        <td>${prospect.data?.name || ''}</td>
        <td>${prospect.data?.email || ''}</td>
      `;
      prospectsTbody.appendChild(row);
    });

    // Charger les clients
    const clientsSnapshot = await getDocs(collection(db, 'clients'));
    const clientsTbody = document.getElementById('clients-tbody');
    clientsTbody.innerHTML = '';
    clientsSnapshot.forEach(doc => {
      const client = doc.data();
      const agentName = usersMap[client.agentId] || 'Inconnu';
      const confirmedAt = client.confirmedAt ? new Date(client.confirmedAt.seconds * 1000).toLocaleDateString() : '';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${agentName}</td>
        <td>${client.data?.name || ''}</td>
        <td>${client.data?.email || ''}</td>
        <td>${confirmedAt}</td>
      `;
      clientsTbody.appendChild(row);
    });

    // Charger les ventes
    const salesSnapshot = await getDocs(collection(db, 'sales'));
    const salesTbody = document.getElementById('sales-tbody');
    salesTbody.innerHTML = '';
    salesSnapshot.forEach(doc => {
      const sale = doc.data();
      const agentName = usersMap[sale.agentId] || 'Inconnu';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${agentName}</td>
        <td>${sale.chiffreAffaires || 0}€</td>
        <td>${sale.commission || 0}€</td>
      `;
      salesTbody.appendChild(row);
    });

  } catch (error) {
    document.getElementById('error-message').textContent = error.message;
  }
}

// Gestion des événements
document.addEventListener('DOMContentLoaded', () => {
  loadAllData();
});