/**
 * ca.js — Chiffre d'Affaires API
 *
 * Schéma réel confirmé :
 *   fact_revenus  : id, date_id, hotel_id, ca_ttc, ca_ht, ca_cumul
 *   fact_revenus_categorie : id, date_id, hotel_id, categorie, ca_ttc, ca_ht
 *   dim_date      : date_id, annee, mois, mois_nom, trimestre, saison, date_complete
 *
 * Données disponibles : 2023 et 2024
 *
 * Routes:
 *   GET /api/ca/annuel
 *   GET /api/ca/mensuel
 *   GET /api/ca/comparaison
 *   GET /api/ca/comparaison-cumul
 *   GET /api/ca/kpi
 *   GET /api/ca/categories
 *   GET /api/ca/cumul
 *   GET /api/ca/trimestriel
 *   GET /api/ca/saisonnier
 *   GET /api/ca/ytd
 */

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────
const parseYear  = (v, def = 2024) => parseInt(v, 10) || def;
const parseHotel = (v, def = 1)    => parseInt(v, 10) || def;
const ok  = (res, data) => res.json({ success: true,  data });
const err = (res, e)    => res.status(500).json({ success: false, error: e.message });


// ─────────────────────────────────────────────────
// GET /api/ca/annuel?hotel_id=1
// CA total par année
// ─────────────────────────────────────────────────
router.get('/annuel', async (req, res) => {
  const hotel_id = parseHotel(req.query.hotel_id);
  try {
    const [rows] = await pool.execute(`
      SELECT
        d.annee,
        SUM(f.ca_ttc)                                           AS ca_total_ttc,
        SUM(f.ca_ht)                                            AS ca_total_ht,
        SUM(SUM(f.ca_ht)) OVER (ORDER BY d.annee)              AS ca_cumul_global_ht
      FROM fact_revenus f
      JOIN dim_date d ON f.date_id = d.date_id
      WHERE f.hotel_id = ?
      GROUP BY d.annee
      ORDER BY d.annee
    `, [hotel_id]);
    ok(res, rows);
  } catch (e) { err(res, e); }
});


// ─────────────────────────────────────────────────
// GET /api/ca/mensuel?annee=2024&hotel_id=1
// CA mensuel + cumul progressif
// Utilise ca_cumul stocké ET recalcule via window function
// ─────────────────────────────────────────────────
router.get('/mensuel', async (req, res) => {
  const annee    = parseYear(req.query.annee);
  const hotel_id = parseHotel(req.query.hotel_id);
  try {
    const [rows] = await pool.execute(`
      SELECT
        d.mois,
        d.mois_nom,
        d.trimestre,
        d.saison,
        f.ca_ttc,
        f.ca_ht,
        f.ca_cumul                                              AS ca_cumul_stored,
        SUM(f.ca_ttc) OVER (
          PARTITION BY d.annee
          ORDER BY d.mois
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )                                                       AS ca_cumul
        ,
        SUM(f.ca_ht) OVER (
          PARTITION BY d.annee
          ORDER BY d.mois
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )                                                       AS ca_cumul_ht
      FROM fact_revenus f
      JOIN dim_date d ON f.date_id = d.date_id
      WHERE d.annee = ? AND f.hotel_id = ?
      ORDER BY d.mois
    `, [annee, hotel_id]);
    ok(res, rows);
  } catch (e) { err(res, e); }
});


// ─────────────────────────────────────────────────
// GET /api/ca/comparaison?annee=2024&hotel_id=1
// N vs N-1 mensuel + différence absolue + growth_rate
// Formule Excel : growth_rate = ((N - N1) / N1) * 100
// ─────────────────────────────────────────────────
router.get('/comparaison', async (req, res) => {
  const annee    = parseYear(req.query.annee);
  const hotel_id = parseHotel(req.query.hotel_id);
  const anneeN1  = annee - 1;
  try {
    const [rows] = await pool.execute(`
      SELECT
        d.mois,
        d.mois_nom,
        d.trimestre,
        d.saison,
        SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END)      AS ca_n,
        SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END)      AS ca_n1,
        SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END)
          - SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END)  AS diff_absolue,
        ROUND(
          (SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END)
           - SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END))
          / NULLIF(SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END), 0) * 100
        , 2)                                                     AS growth_rate
      FROM fact_revenus f
      JOIN dim_date d ON f.date_id = d.date_id
      WHERE d.annee IN (?, ?) AND f.hotel_id = ?
      GROUP BY d.mois, d.mois_nom, d.trimestre, d.saison
      ORDER BY d.mois
    `, [annee, anneeN1, annee, anneeN1, annee, anneeN1, anneeN1, annee, anneeN1, hotel_id]);
    ok(res, rows);
  } catch (e) { err(res, e); }
});


// ─────────────────────────────────────────────────
// GET /api/ca/comparaison-cumul?annee=2024&hotel_id=1
// Cumul progressif N vs N-1 mois par mois
// ─────────────────────────────────────────────────
router.get('/comparaison-cumul', async (req, res) => {
  const annee    = parseYear(req.query.annee);
  const hotel_id = parseHotel(req.query.hotel_id);
  const anneeN1  = annee - 1;
  try {
    const [rows] = await pool.execute(`
      SELECT
        d.mois,
        d.mois_nom,
        SUM(SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END))
          OVER (ORDER BY d.mois ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
                                                                 AS cumul_n,
        SUM(SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END))
          OVER (ORDER BY d.mois ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
                                                                 AS cumul_n1,
        ROUND(
          (SUM(SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END))
             OVER (ORDER BY d.mois ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
           - SUM(SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END))
             OVER (ORDER BY d.mois ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW))
          / NULLIF(
              SUM(SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END))
                OVER (ORDER BY d.mois ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
            , 0) * 100
        , 2)                                                     AS growth_rate_cumul
      FROM fact_revenus f
      JOIN dim_date d ON f.date_id = d.date_id
      WHERE d.annee IN (?, ?) AND f.hotel_id = ?
      GROUP BY d.mois, d.mois_nom
      ORDER BY d.mois
    `, [annee, anneeN1, annee, anneeN1, anneeN1, annee, anneeN1, hotel_id]);
    ok(res, rows);
  } catch (e) { err(res, e); }
});


// ─────────────────────────────────────────────────
// GET /api/ca/kpi?annee=2024&hotel_id=1
// KPI CA global — objet unique
// ─────────────────────────────────────────────────
router.get('/kpi', async (req, res) => {
  const annee    = parseYear(req.query.annee);
  const hotel_id = parseHotel(req.query.hotel_id);
  const anneeN1  = annee - 1;
  try {
    const [[row]] = await pool.execute(`
      SELECT
        SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END)      AS total_revenue_n,
        SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END)      AS total_revenue_n1,
        SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END)
          - SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END)  AS total_growth_amount,
        ROUND(
          (SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END)
           - SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END))
          / NULLIF(SUM(CASE WHEN d.annee = ? THEN f.ca_ht ELSE 0 END), 0) * 100
        , 2)                                                     AS total_growth_percentage
      FROM fact_revenus f
      JOIN dim_date d ON f.date_id = d.date_id
      WHERE d.annee IN (?, ?) AND f.hotel_id = ?
    `, [annee, anneeN1, annee, anneeN1, annee, anneeN1, anneeN1, annee, anneeN1, hotel_id]);

    ok(res, { annee, anneeN1, hotel_id, ...row });
  } catch (e) { err(res, e); }
});


// ─────────────────────────────────────────────────
// GET /api/ca/categories?annee=2024&hotel_id=1
// Répartition CA par catégorie (LOGEMENT, RESTAURANT, BARS, DIVERS)
// part_pct = (ca_categorie / total_ca) * 100
// ─────────────────────────────────────────────────
router.get('/categories', async (req, res) => {
  const annee    = parseYear(req.query.annee);
  const hotel_id = parseHotel(req.query.hotel_id);
  try {
    const [rows] = await pool.execute(`
      SELECT
        rc.categorie,
        SUM(rc.ca_ttc)                                          AS ca_ttc_total,
        SUM(rc.ca_ht)                                           AS ca_ht_total,
        ROUND(
          SUM(rc.ca_ttc)
          / NULLIF(SUM(SUM(rc.ca_ttc)) OVER (), 0) * 100
        , 2)                                                    AS part_pct
      FROM fact_revenus_categorie rc
      JOIN dim_date d ON rc.date_id = d.date_id
      WHERE d.annee = ? AND rc.hotel_id = ?
      GROUP BY rc.categorie
      ORDER BY ca_ttc_total DESC
    `, [annee, hotel_id]);
    ok(res, rows);
  } catch (e) { err(res, e); }
});


// ─────────────────────────────────────────────────
// GET /api/ca/cumul?annee=2024&hotel_id=1
// CA mensuel + cumul (calcule le cumul HT via window)
// ─────────────────────────────────────────────────
router.get('/cumul', async (req, res) => {
  const annee    = parseYear(req.query.annee);
  const hotel_id = parseHotel(req.query.hotel_id);
  try {
    const [rows] = await pool.execute(`
      SELECT
        d.mois,
        d.mois_nom,
        f.ca_ttc,
        f.ca_ht,
        SUM(f.ca_ht) OVER (
          PARTITION BY d.annee
          ORDER BY d.mois
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )                                                       AS ca_cumul_ht
      FROM fact_revenus f
      JOIN dim_date d ON f.date_id = d.date_id
      WHERE d.annee = ? AND f.hotel_id = ?
      ORDER BY d.mois
    `, [annee, hotel_id]);
    ok(res, rows);
  } catch (e) { err(res, e); }
});


// ─────────────────────────────────────────────────
// GET /api/ca/trimestriel?annee=2024&hotel_id=1
// CA par trimestre (utilise d.trimestre de dim_date)
// ─────────────────────────────────────────────────
router.get('/trimestriel', async (req, res) => {
  const annee    = parseYear(req.query.annee);
  const hotel_id = parseHotel(req.query.hotel_id);
  try {
    const [rows] = await pool.execute(`
      SELECT
        d.trimestre,
        SUM(f.ca_ht)                                            AS ca_total,
        SUM(SUM(f.ca_ht)) OVER (
          ORDER BY d.trimestre
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )                                                       AS ca_cumul
      FROM fact_revenus f
      JOIN dim_date d ON f.date_id = d.date_id
      WHERE d.annee = ? AND f.hotel_id = ?
      GROUP BY d.trimestre
      ORDER BY d.trimestre
    `, [annee, hotel_id]);
    ok(res, rows);
  } catch (e) { err(res, e); }
});


// ─────────────────────────────────────────────────
// GET /api/ca/saisonnier?annee=2024&hotel_id=1
// CA par saison (Basse / Moyenne / Haute) — colonne d.saison de dim_date
// ─────────────────────────────────────────────────
router.get('/saisonnier', async (req, res) => {
  const annee    = parseYear(req.query.annee);
  const hotel_id = parseHotel(req.query.hotel_id);
  try {
    const [rows] = await pool.execute(`
      SELECT
        d.saison,
        SUM(f.ca_ht)                                            AS ca_total,
        ROUND(
          SUM(f.ca_ht)
          / NULLIF(SUM(SUM(f.ca_ht)) OVER (), 0) * 100
        , 2)                                                    AS part_pct
      FROM fact_revenus f
      JOIN dim_date d ON f.date_id = d.date_id
      WHERE d.annee = ? AND f.hotel_id = ?
      GROUP BY d.saison
      ORDER BY ca_total DESC
    `, [annee, hotel_id]);
    ok(res, rows);
  } catch (e) { err(res, e); }
});


// ─────────────────────────────────────────────────
// GET /api/ca/ytd?annee=2024&mois=10&hotel_id=1
// Year-To-Date N vs N-1 jusqu'au mois donné
// ─────────────────────────────────────────────────
router.get('/ytd', async (req, res) => {
  const annee    = parseYear(req.query.annee);
  const hotel_id = parseHotel(req.query.hotel_id);
  const mois     = parseInt(req.query.mois, 10) || new Date().getMonth() + 1;
  const anneeN1  = annee - 1;
  try {
    const [[row]] = await pool.execute(`
      SELECT
        SUM(CASE WHEN d.annee = ? AND d.mois <= ? THEN f.ca_ht ELSE 0 END)  AS ytd_n,
        SUM(CASE WHEN d.annee = ? AND d.mois <= ? THEN f.ca_ht ELSE 0 END)  AS ytd_n1,
        ROUND(
          (SUM(CASE WHEN d.annee = ? AND d.mois <= ? THEN f.ca_ht ELSE 0 END)
           - SUM(CASE WHEN d.annee = ? AND d.mois <= ? THEN f.ca_ht ELSE 0 END))
          / NULLIF(SUM(CASE WHEN d.annee = ? AND d.mois <= ? THEN f.ca_ht ELSE 0 END), 0) * 100
        , 2)                                                    AS ytd_growth_pct
      FROM fact_revenus f
      JOIN dim_date d ON f.date_id = d.date_id
      WHERE d.annee IN (?, ?) AND f.hotel_id = ?
    `, [annee, mois, anneeN1, mois, annee, mois, anneeN1, mois, anneeN1, mois, annee, anneeN1, hotel_id]);

    ok(res, { annee, anneeN1, mois, hotel_id, ...row });
  } catch (e) { err(res, e); }
});


module.exports = router;
