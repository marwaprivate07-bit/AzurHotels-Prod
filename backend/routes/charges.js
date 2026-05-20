// backend/routes/charges.js  — VERSION CORRIGÉE
const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// ── NOTE SQL (à exécuter une seule fois si les tables n'existent pas) ──────────
// CREATE TABLE IF NOT EXISTS fact_charges (
//   id INT AUTO_INCREMENT PRIMARY KEY, annee INT, hotel_id INT DEFAULT 1,
//   poste VARCHAR(50), montant DECIMAL(18,3) DEFAULT 0,
//   eau DECIMAL(15,3) DEFAULT 0, electricite DECIMAL(15,3) DEFAULT 0,
//   gaz DECIMAL(15,3) DEFAULT 0, carburant DECIMAL(15,3) DEFAULT 0,
//   INDEX idx_annee(annee), INDEX idx_hotel(hotel_id), INDEX idx_poste(poste)
// );
// CREATE TABLE IF NOT EXISTS fact_charges_mensuel (
//   id INT AUTO_INCREMENT PRIMARY KEY, annee INT, mois INT, mois_nom VARCHAR(20),
//   hotel_id INT DEFAULT 1, personnel DECIMAL(15,3) DEFAULT 0,
//   energie DECIMAL(15,3) DEFAULT 0, eau DECIMAL(15,3) DEFAULT 0,
//   electricite DECIMAL(15,3) DEFAULT 0, gaz DECIMAL(15,3) DEFAULT 0,
//   carburant DECIMAL(15,3) DEFAULT 0, achats_consommation DECIMAL(15,3) DEFAULT 0,
//   autres_exploit DECIMAL(15,3) DEFAULT 0, charges_financieres DECIMAL(15,3) DEFAULT 0,
//   impots_taxes DECIMAL(15,3) DEFAULT 0, total_charges DECIMAL(15,3) DEFAULT 0,
//   INDEX idx_annee(annee), INDEX idx_hotel(hotel_id)
// );

// ─── GET /api/charges/kpi ─────────────────────────────────────────────────────
// KPIs annuels N vs N-1 pour tous les postes + décomposition énergie
// FIX: Séparation requête postes / requête énergie pour éviter les mauvaises
//      agrégations des sous-colonnes eau/elec/gaz/carburant sur tous les postes.
router.get('/kpi', async (req, res) => {
  const annee = parseInt(req.query.annee) || 2024;
  const hotel_id = parseInt(req.query.hotel_id) || 1;
  const n1 = annee - 1;

  try {
    // Requête 1 : montants par poste N et N-1
    const [postes] = await pool.execute(`
      SELECT
        p.code_poste as poste,
        SUM(CASE WHEN f.annee = ? THEN f.montant ELSE 0 END) AS montant_n,
        SUM(CASE WHEN f.annee = ? THEN f.montant ELSE 0 END) AS montant_n1
      FROM fact_charges f
      JOIN dim_poste_charge p ON f.poste_id = p.poste_id
      WHERE f.hotel_id = ? AND f.annee IN (?, ?) AND f.mois = 0
      GROUP BY p.code_poste`,
      [annee, n1, hotel_id, annee, n1]
    );

    // Requête 2 : décomposition énergie (eau/elec/gaz/carburant) — uniquement poste='energie'
    const [energie] = await pool.execute(`
      SELECT
        SUM(CASE WHEN f.annee = ? AND p.code_poste = 'eau' THEN f.montant ELSE 0 END) AS eau_n,
        SUM(CASE WHEN f.annee = ? AND p.code_poste = 'electricite' THEN f.montant ELSE 0 END) AS elec_n,
        SUM(CASE WHEN f.annee = ? AND p.code_poste = 'gaz' THEN f.montant ELSE 0 END) AS gaz_n,
        SUM(CASE WHEN f.annee = ? AND p.code_poste = 'carburant' THEN f.montant ELSE 0 END) AS carb_n,
        SUM(CASE WHEN f.annee = ? AND p.code_poste = 'eau' THEN f.montant ELSE 0 END) AS eau_n1,
        SUM(CASE WHEN f.annee = ? AND p.code_poste = 'electricite' THEN f.montant ELSE 0 END) AS elec_n1,
        SUM(CASE WHEN f.annee = ? AND p.code_poste = 'gaz' THEN f.montant ELSE 0 END) AS gaz_n1,
        SUM(CASE WHEN f.annee = ? AND p.code_poste = 'carburant' THEN f.montant ELSE 0 END) AS carb_n1
      FROM fact_charges f
      JOIN dim_poste_charge p ON f.poste_id = p.poste_id
      WHERE f.hotel_id = ? AND p.code_poste IN ('eau', 'electricite', 'gaz', 'carburant') 
        AND f.annee IN (?, ?) AND f.mois = 0`,
      [annee, annee, annee, annee, n1, n1, n1, n1, hotel_id, annee, n1]
    );

    // Fusion : enrichir la ligne 'energie' avec les sous-colonnes
    const energieExtra = energie[0] || {};
    const rows = postes.map(r => {
      if (r.poste === 'energie') {
        return { ...r, ...energieExtra };
      }
      return {
        ...r,
        eau_n: 0, elec_n: 0, gaz_n: 0, carb_n: 0,
        eau_n1: 0, elec_n1: 0, gaz_n1: 0, carb_n1: 0,
      };
    });

    res.json({ success: true, data: rows, annee, annee_n1: n1 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/charges/mensuel ─────────────────────────────────────────────────
// Charges mensuelles pour un année donnée + N-1
router.get('/mensuel', async (req, res) => {
  const annee    = parseInt(req.query.annee)    || 2024;
  const hotel_id = parseInt(req.query.hotel_id) || 1;
  const n1 = annee - 1;
  try {
    const [rows] = await pool.execute(`
      SELECT
        f.mois, 
        MAX(d.mois_nom) AS mois_nom, 
        f.annee,
        SUM(CASE WHEN p.code_poste = 'personnel' THEN f.montant ELSE 0 END) AS personnel,
        SUM(CASE WHEN p.code_poste = 'energie' THEN f.montant ELSE 0 END) AS energie,
        SUM(CASE WHEN p.code_poste = 'eau' THEN f.montant ELSE 0 END) AS eau,
        SUM(CASE WHEN p.code_poste = 'electricite' THEN f.montant ELSE 0 END) AS electricite,
        SUM(CASE WHEN p.code_poste = 'gaz' THEN f.montant ELSE 0 END) AS gaz,
        SUM(CASE WHEN p.code_poste = 'carburant' THEN f.montant ELSE 0 END) AS carburant,
        SUM(CASE WHEN p.code_poste = 'achats_consommation' THEN f.montant ELSE 0 END) AS achats_consommation,
        SUM(CASE WHEN p.code_poste = 'services_exterieurs' THEN f.montant ELSE 0 END) AS services_exterieurs,
        SUM(CASE WHEN p.code_poste = 'autres_services_exterieurs' THEN f.montant ELSE 0 END) AS autres_services_exterieurs,
        SUM(CASE WHEN p.code_poste = 'charges_diverses' THEN f.montant ELSE 0 END) AS charges_diverses,
        SUM(CASE WHEN p.code_poste = 'autres_exploit' THEN f.montant ELSE 0 END) AS autres_exploit,
        SUM(CASE WHEN p.code_poste = 'charges_financieres' THEN f.montant ELSE 0 END) AS charges_financieres,
        SUM(CASE WHEN p.code_poste = 'impots_taxes' THEN f.montant ELSE 0 END) AS impots_taxes,
        SUM(CASE WHEN p.code_poste = 'dotations_amort' THEN f.montant ELSE 0 END) AS dotations_amort,
        SUM(CASE WHEN p.code_poste = 'total_charges' THEN f.montant ELSE 0 END) AS total_charges
      FROM fact_charges f
      JOIN dim_poste_charge p ON f.poste_id = p.poste_id
      LEFT JOIN dim_date d ON d.annee = f.annee AND d.mois = f.mois
      WHERE f.hotel_id = ? AND f.annee IN (?, ?) AND f.mois != 0
      GROUP BY f.annee, f.mois
      ORDER BY f.annee, f.mois`,
      [hotel_id, annee, n1]
    );
    res.json({ success: true, data: rows, annee, annee_n1: n1 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/charges/annuel ──────────────────────────────────────────────────
// Tous les postes par année (pour graphique évolution multi-années)
// FIX: exclusion de total_charges pour éviter le double comptage
router.get('/annuel', async (req, res) => {
  const hotel_id = parseInt(req.query.hotel_id) || 1;
  try {
    const [rows] = await pool.execute(`
      SELECT f.annee, p.code_poste as poste, f.montant
      FROM fact_charges f
      JOIN dim_poste_charge p ON f.poste_id = p.poste_id
      WHERE f.hotel_id = ? AND p.code_poste != 'total_charges' AND f.mois = 0
      ORDER BY f.annee, p.code_poste`,
      [hotel_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/charges/comparaison ────────────────────────────────────────────
// Comparaison N vs N-1 par poste
// FIX: exclusion de total_charges pour éviter le double comptage dans le tableau
router.get('/comparaison', async (req, res) => {
  const annee    = parseInt(req.query.annee)    || 2024;
  const hotel_id = parseInt(req.query.hotel_id) || 1;
  const n1 = annee - 1;
  try {
    const [rows] = await pool.execute(`
      SELECT
        p.code_poste as poste,
        SUM(CASE WHEN f.annee = ? THEN f.montant ELSE 0 END) AS montant_n,
        SUM(CASE WHEN f.annee = ? THEN f.montant ELSE 0 END) AS montant_n1
      FROM fact_charges f
      JOIN dim_poste_charge p ON f.poste_id = p.poste_id
      WHERE f.hotel_id = ? AND f.annee IN (?, ?) AND p.code_poste != 'total_charges' AND f.mois = 0
      GROUP BY p.code_poste
      ORDER BY montant_n DESC`,
      [annee, n1, hotel_id, annee, n1]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/charges/energie ─────────────────────────────────────────────────
// Décomposition énergie annuelle N vs N-1
router.get('/energie', async (req, res) => {
  const annee    = parseInt(req.query.annee)    || 2024;
  const hotel_id = parseInt(req.query.hotel_id) || 1;
  const n1 = annee - 1;
  try {
    const [rows] = await pool.execute(`
      SELECT
        f.annee,
        SUM(CASE WHEN p.code_poste = 'electricite' THEN f.montant ELSE 0 END) AS electricite,
        SUM(CASE WHEN p.code_poste = 'gaz' THEN f.montant ELSE 0 END) AS gaz,
        SUM(CASE WHEN p.code_poste = 'eau' THEN f.montant ELSE 0 END) AS eau,
        SUM(CASE WHEN p.code_poste = 'carburant' THEN f.montant ELSE 0 END) AS carburant,
        SUM(CASE WHEN p.code_poste = 'energie' THEN f.montant ELSE 0 END) AS total_energie
      FROM fact_charges f
      JOIN dim_poste_charge p ON f.poste_id = p.poste_id
      WHERE f.hotel_id = ? AND p.code_poste IN ('electricite', 'gaz', 'eau', 'carburant', 'energie') 
        AND f.annee IN (?, ?) AND f.mois = 0
      GROUP BY f.annee
      ORDER BY f.annee`,
      [hotel_id, annee, n1]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/charges/repartition ────────────────────────────────────────────
// Répartition énergie consolidée par hôtel (%)
// Note : ces % proviennent du rapport de gestion du conseil d'administration
router.get('/repartition', async (req, res) => {
  const repartition = {
    2023: [
      { hotel: 'Royal Azur', pct: 23, color: '#c9a84c' },
      { hotel: 'Bel Azur',   pct: 50, color: '#3b82f6' },
      { hotel: 'Sol Azur',   pct: 27, color: '#f97316' },
    ],
    2024: [
      { hotel: 'Royal Azur', pct: 25, color: '#c9a84c' },
      { hotel: 'Bel Azur',   pct: 46, color: '#3b82f6' },
      { hotel: 'Sol Azur',   pct: 29, color: '#f97316' },
    ],
  };
  res.json({ success: true, data: repartition });
});

module.exports = router;
