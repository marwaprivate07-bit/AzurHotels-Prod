# Azur Hotels BI - Plateforme Décisionnelle

Ce projet est une solution de **Business Intelligence Full-Stack** conçue pour le groupe hôtelier Azur Hotels. Elle permet d'automatiser la collecte de données financières et opérationnelles depuis des fichiers Excel pour les transformer en tableaux de bord interactifs.

---

## 🚀 Fonctionnalités Clés

-   **Pipeline ETL Automatisé** : Scripts Python pour l'extraction, le nettoyage et le chargement des données (Balances comptables, Stats CA, Avis Booking).
-   **Entrepôt de Données** : Modèle de données en **Constellation** optimisé pour MySQL.
-   **Dashboard Interactif** : Visualisation des KPIs (CA, RBE, Taux d'occupation, Nationalités) avec React et ApexCharts.
-   **Gestion d'Accès** : Système d'authentification sécurisé (JWT) avec gestion des rôles (Admin/Viewer).

---

## 🛠️ Architecture Technique

-   **Data Engine** : Python 3 (Pandas, Openpyxl)
-   **Database** : MySQL
-   **Backend** : Node.js & Express.js
-   **Frontend** : React.js (Vite)

---

## 📂 Structure du Projet

-   `/etl` : Scripts de transformation de données.
-   `/data` : Données sources (Excel) et fichiers nettoyés (CSV).
-   `/backend` : API REST et logique métier.
-   `/frontend` : Interface utilisateur.
-   `azur_hotels_dump.sql` : Script d'initialisation de la base de données.

---

## ⚙️ Installation Rapide

1.  **Base de Données** : Importer le fichier `azur_hotels_dump.sql` dans votre instance MySQL.
2.  **Mise à jour des Données** : Exécuter `LANCER_LA_MISE_A_JOUR.bat` à la racine pour synchroniser les derniers fichiers Excel.
3.  **Lancement du Serveur** :
    ```bash
    cd backend && npm start
    ```
4.  **Lancement du Dashboard** :
    ```bash
    cd frontend && npm run dev
    ```

---

## 👤 Auteur
**Projet de Fin d'Études (PFE)** - Azur Hotels BI
