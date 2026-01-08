# CRM Gcomaf - Application de Gestion Commerciale

Application CRM moderne développée avec Firebase, Bootstrap 5 et Argon Dashboard pour la gestion des prospects, clients, ventes et commissions.

## 🚀 Déploiement sur Cloudflare Pages

### Configuration Requise

1. **Repository GitHub** : Ce projet est configuré pour le déploiement automatique sur Cloudflare Pages
2. **Variables d'Environnement** : Configurer les variables Firebase dans le dashboard Cloudflare

### Variables d'Environnement (Cloudflare Pages)

Dans votre dashboard Cloudflare Pages → Settings → Environment variables :

```bash
FIREBASE_API_KEY=votre_api_key
FIREBASE_AUTH_DOMAIN=votre_projet.firebaseapp.com
FIREBASE_PROJECT_ID=votre_project_id
FIREBASE_STORAGE_BUCKET=votre_projet.appspot.com
FIREBASE_MESSAGING_SENDER_ID=votre_sender_id
FIREBASE_APP_ID=votre_app_id
```

### Configuration du Build

- **Build command** : (laisser vide - site statique)
- **Build output directory** : `.` (racine du projet)
- **Root directory** : `/` (racine du projet)

### Fichiers de Configuration

- **`_headers`** : Headers de sécurité HTTP
- **`_redirects`** : Redirections SPA et API Firebase
- **`wrangler.toml`** : Configuration alternative pour Wrangler

### URL de Production

Après déploiement : `https://crm-gcomaf.pages.dev`

### Fonctionnalités

- ✅ **Authentification Firebase** : Login/signup sécurisé
- ✅ **Dashboard Admin** : Statistiques et navigation
- ✅ **Gestion Utilisateurs** : CRUD complet pour admin/agent/superviseur
- ✅ **Prospects & Clients** : Workflow complet de prospection
- ✅ **Ventes & Commissions** : Calculs automatiques et paiement
- ✅ **Interface Responsive** : Mobile-first avec menu adaptatif
- ✅ **Sécurité** : Headers HTTP et validation côté client

### Architecture

```
├── index.html                 # Page d'accueil
├── admin/                     # Interface administration
│   ├── dashboard.html         # Dashboard avec cartes cliquables
│   ├── users.html            # Gestion utilisateurs
│   ├── clients-confirmes.html # Clients validés
│   ├── sales.html            # Historique ventes
│   └── commissions.html      # Gestion commissions
├── agent/                     # Interface agent commercial
├── assets/                    # Ressources statiques
│   ├── argon/                # Thème Argon Dashboard
│   ├── js/                   # Scripts JavaScript
│   └── css/                  # Styles personnalisés
└── _redirects                # Configuration redirections
```

### Technologies Utilisées

- **Frontend** : HTML5, CSS3, JavaScript ES6+
- **Framework** : Bootstrap 5, Argon Dashboard
- **Backend** : Firebase (Auth, Firestore, Hosting)
- **Déploiement** : Cloudflare Pages
- **CDN** : Cloudflare global network

### Sécurité

- Headers de sécurité configurés
- Authentification Firebase obligatoire
- Validation côté client et serveur
- Protection CSRF et XSS

---

**Développé avec ❤️ pour optimiser la gestion commerciale**