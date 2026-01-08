# Workflow d'Authentification CRM Gcomaf

## 📋 Vue d'ensemble

Ce document décrit le workflow complet d'authentification et de gestion des utilisateurs du CRM Gcomaf, basé sur Firebase Authentication et Firestore.

## 🔐 Architecture de Sécurité

### Principes Fondamentaux
- **Authentification unique** : Email/Password uniquement (plus de Google Auth)
- **Génération automatique** de mots de passe temporaires
- **Changement obligatoire** à la première connexion
- **Rôles stricts** : admin, agent, supervisor
- **Audit logging** de toutes les actions sensibles

### Technologies Utilisées
- **Firebase Authentication** : Gestion des comptes utilisateurs
- **Firestore** : Stockage des profils et métadonnées
- **Firebase Rules** : Contrôle d'accès aux données

## 👥 Rôles et Permissions

### Administrateur
- ✅ Créer des comptes agent/superviseur
- ✅ Gérer tous les utilisateurs (activation/désactivation)
- ✅ Accéder à toutes les données (ventes, clients, etc.)
- ✅ Consulter tous les rapports et statistiques

### Superviseur
- ✅ Consulter les ventes et commissions des agents
- ✅ Voir les clients confirmés
- ✅ Accéder aux formulaires de prospection

### Agent Commercial
- ✅ Remplir les formulaires de prospection
- ✅ Voir ses propres ventes et commissions
- ✅ Accéder à ses clients

## 🔄 Workflow Création Utilisateur

### Phase 1: Saisie par l'Admin
```
Admin ouvre admin/users.html
Admin remplit le formulaire :
├── Prénom (requis)
├── Nom (requis)
├── Email (requis, unique)
└── Rôle (requis: agent/supervisor)
```

### Phase 2: Validation et Génération
```
Validation côté client :
├── Format email valide
├── Email non déjà utilisé
├── Rôle dans liste autorisée
├── Prénom et nom non vides

Génération automatique :
├── Mot de passe 12+ caractères
├── Mélange majuscules/minuscules/chiffres/symboles
├── Stockage temporaire pour affichage
```

### Phase 3: Création Firebase
```
1. Firebase Auth :
   ├── createUserWithEmailAndPassword(email, tempPassword)
   ├── Récupération UID généré

2. Firestore (collection 'users') :
   ├── uid: UID Firebase
   ├── firstName, lastName, email, role
   ├── status: 'active'
   ├── passwordTemporary: true
   ├── createdAt, createdBy
   ├── lastModified, lastModifiedBy
```

### Phase 4: Notification
```
Affichage immédiat à l'admin :
📧 Email: user@domain.com
🔑 Mot de passe temporaire: Xy8$zK2mP9qL4n

⚠️ L'utilisateur devra changer son mot de passe
   à sa première connexion.
```

### Phase 5: Envoi d'identifiants (À implémenter)
```
Service externe (SendGrid/Brevo) :
Objet: "Vos accès CRM Gcomaf"

Bonjour [Prénom],

Votre compte a été créé avec succès.

📧 Identifiant: [email]
🔑 Mot de passe temporaire: [password]

⚠️ Vous devrez changer ce mot de passe lors
   de votre première connexion.

🔗 Lien de connexion: [URL_LOGIN]

Cordialement,
L'équipe Gcomaf
```

## 🔑 Workflow Première Connexion

### Phase 1: Connexion
```
Utilisateur ouvre index.html
Saisie email + mot de passe temporaire
Clic "Se connecter"
```

### Phase 2: Vérification Sécurité
```
Firebase Auth valide les identifiants

Recherche Firestore :
├── Document utilisateur trouvé ?
├── Status = 'active' ?
├── passwordTemporary = true ?

Si OUI → Redirection change-password.html
Si NON → Redirection dashboard approprié
```

### Phase 3: Changement de Mot de Passe
```
Utilisateur arrive sur change-password.html

Validation :
├── Mot de passe ≥ 8 caractères
├── Confirmation identique
├── Complexité suffisante

Firebase Auth :
├── updatePassword(newPassword)

Firestore :
├── passwordTemporary: false
├── lastModified, lastModifiedBy
```

### Phase 4: Accès au Système
```
Redirection selon rôle :
├── Admin → admin/dashboard.html
├── Superviseur → supervisor/dashboard.html
├── Agent → agent/dashboard.html

Session stockée :
├── uid, email, firstName, lastName, role
├── firebaseUid pour audit
```

## 🛡️ Contrôles de Sécurité

### Validation des Entrées
```javascript
// Email
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) throw new Error('Email invalide');

// Rôles
const validRoles = ['admin', 'agent', 'supervisor'];
if (!validRoles.includes(role)) throw new Error('Rôle invalide');

// Unicité email (Firebase Auth gère cela automatiquement)
```

### Gestion des Erreurs
```javascript
// Erreurs Firebase Auth
switch (error.code) {
  case 'auth/email-already-in-use':
    return 'Email déjà utilisé';
  case 'auth/weak-password':
    return 'Mot de passe trop faible';
  case 'auth/user-not-found':
    return 'Utilisateur non trouvé';
  case 'auth/wrong-password':
    return 'Mot de passe incorrect';
}
```

### Audit Logging
```javascript
// Chaque action sensible loggée
await authAdminService.logAuditAction('create_user', {
  targetEmail: email,
  targetRole: role,
  targetUid: uid
});
```

## 📊 États Utilisateur

### Statuts Possibles
- **active** : Compte fonctionnel
- **inactive** : Compte désactivé (soft delete)

### Flags Temporaires
- **passwordTemporary: true** : Doit changer MDP
- **passwordTemporary: false** : MDP personnalisé

### Métadonnées
```javascript
{
  createdAt: Timestamp,
  createdBy: string, // UID admin
  lastModified: Timestamp,
  lastModifiedBy: string, // UID modificateur
  // Pour soft delete
  deletedAt?: Timestamp,
  deletedBy?: string
}
```

## 🔄 Gestion du Cycle de Vie

### Activation/Désactivation
```
Admin peut basculer status active ↔ inactive
Soft delete préserve les données
Audit logging de chaque changement
```

### Suppression Définitives (Non implémentée)
```
Suppression Firebase Auth + Firestore
Uniquement pour comptes de test
Jamais pour comptes en production
```

## 🚨 Gestion des Erreurs

### Erreurs Récupérables
- **Email déjà utilisé** : Suggestion nouveau email
- **Mot de passe faible** : Indications de complexité
- **Session expirée** : Redirection login

### Erreurs Irrécupérables
- **Violation sécurité** : Déconnexion forcée
- **Données corrompues** : Contact support
- **Service indisponible** : Retry automatique

## 📱 Interface Utilisateur

### Formulaire Création
- **Validation temps réel** avec messages d'aide
- **Génération MDP** affichée immédiatement
- **Confirmation visuelle** de succès
- **Bouton retry** en cas d'erreur

### Première Connexion
- **Interface dédiée** change-password.html
- **Indicateurs sécurité** pour le nouveau MDP
- **Progression claire** des étapes
- **Redirection automatique** après succès

### Gestion Utilisateurs
- **Table responsive** avec badges colorés
- **Actions groupées** (toggle + email)
- **Statistiques temps réel** (total, actifs, par rôle)
- **Filtres avancés** (recherche, rôle, statut)

## 🔧 Bonnes Pratiques Firebase

### Rules de Sécurité
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Lecture utilisateurs : admin seulement
    match /users/{userId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### Index Firestore
- **users** : email (unicité), role+status (stats)
- **clients** : agentId+confirmedAt (supervision)
- **sales** : agentId+createdAt (historique)

### Performance
- **Lazy loading** pour grandes listes
- **Cache dashboard** 5 minutes
- **Requêtes optimisées** avec limites

## 🧪 Tests et Validation

### Tests Unitaires
```javascript
describe('User Creation', () => {
  test('generates secure password', () => {
    const password = generatePassword();
    expect(password.length).toBeGreaterThanOrEqual(12);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[0-9]/.test(password)).toBe(true);
  });

  test('validates email format', () => {
    expect(validateEmail('test@domain.com')).toBe(true);
    expect(validateEmail('invalid')).toBe(false);
  });
});
```

### Tests d'Intégration
```javascript
describe('User Lifecycle', () => {
  test('complete user creation flow', async () => {
    // Création → Première connexion → Changement MDP → Accès
  });

  test('admin permissions enforcement', async () => {
    // Tentatives non-admin rejetées
  });
});
```

## 🔮 Évolutions Futures

### Authentification Multi-Facteur
```javascript
// À implémenter
const mfaService = {
  enableMFA: async (userId) => { /* ... */ },
  verifyMFA: async (userId, code) => { /* ... */ }
};
```

### SSO Entreprise
```javascript
// Intégration SAML/OAuth
const ssoService = {
  authenticateWithSSO: async (provider) => { /* ... */ }
};
```

### Gestion des Sessions
```javascript
// Monitoring et révocation
const sessionService = {
  listActiveSessions: async (userId) => { /* ... */ },
  revokeSession: async (sessionId) => { /* ... */ }
};
```

Cette architecture assure **sécurité**, **fiabilité** et **maintenabilité** pour l'authentification des utilisateurs du CRM Gcomaf.