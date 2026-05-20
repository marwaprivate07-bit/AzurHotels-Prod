/**
 * stats.js — Statistiques Hôtelières API
 *
 * Schéma réel confirmé :
 *   fact_stats    : id, date_id, hotel_id, nuitees, ch_occupees,
 *                   to_lit, indice_freq, rev_moy_ttc,
 *                   arr_adulte, arr_enfant, booking_score
 *   dim_hotel     : hotel_id, nom_hotel, code_hotel, categorie, nb_chambres
 *   dim_date      : date_id, annee, mois, mois_nom, trimestre, saison, date_complete
 *   dim_nationalite : nat_id, nom_nat, continent
  *   dim_agence    : agence_id, nom_agence, code_agence
 *
 * Calculs :
 *   chambres_disponibles = h.nb_chambres * jours_du_mois (via dim_date)
 *   taux_occupation = ch_occupees / nb_chambres * 100
 *   RevPAR = rev_moy_ttc * to_lit
 *   arr_total = arr_adulte + arr_enfant
 *
 * Données disponibles : 2023 et 2024
 *
 * Routes:
 *   GET /api/stats/mensuel
 *   GET /api/stats/kpi
 *   GET /api/stats/comparaison
 *   GET /api/stats/arrivees
 *   GET /api/stats/nationalites
 *   GET /api/stats/agences
 *   GET /api/stats/ytd
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
// GET /api/stats/mensuel?annee=2024&hotel_id=1
// Indicateurs mensuels hôteliers complets
//
// Formules :
//   taux_occupation = ch_occupees / nb_chambres * 100
//   RevPAR = rev_moy_ttc * to_lit
//   arr_total = arr_adulte + arr_enfant
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
        s.nuitees,
        s.ch_occupees,
        h.nb_chambres,
        ROUND(s.ch_occupees / NULLIF(DAY(LAST_DAY(d.date_complete)) * h.nb_chambres, 0) * 100, 2) AS taux_occupation_chambres,
        -- Revenu Moyen par Client HT
        s.rev_moy_ht                                            AS revenu_moyen_client,
        -- ADR HT (Prix Moyen Chambre)
        ROUND((s.rev_moy_ht * s.nuitees) / NULLIF(s.ch_occupees, 0), 2) AS adr,
        s.indice_freq,
        s.arr_adulte,
        s.arr_enfant,
        COALESCE(s.arr_adulte, 0) + COALESCE(s.arr_enfant, 0)  AS arr_total,
        s.booking_score
      FROM fact_stats s
      JOIN dim_date  d ON s.date_id  = d.date_id
      JOIN dim_hotel h ON s.hotel_id = h.hotel_id
      WHERE d.annee = ? AND s.hotel_id = ?
      ORDER BY d.mois
    `, [annee, hotel_id]);
    ok(res, rows);
  } catch (e) { err(res, e); }
});


// ─────────────────────────────────────────────────
// GET /api/stats/kpi?annee=2024&hotel_id=1
// KPI agrégés annuels — objet unique
// Correspond à la section "MACRO" + "PROGR DATA" du tableau Excel
// ─────────────────────────────────────────────────
router.get('/kpi', async (req, res) => {
  const annee    = parseYear(req.query.annee);
  const hotel_id = parseHotel(req.query.hotel_id);
  const anneeN1  = annee - 1;
  try {
    const [[hotel]] = await pool.execute(
      `SELECT nb_chambres FROM dim_hotel WHERE hotel_id = ?`,
      [hotel_id]
    );
    const nb_chambres = hotel ? hotel.nb_chambres : null;

    const [[row]] = await pool.execute(`
      SELECT
        -- N (2024)
        COALESCE(SUM(CASE WHEN d.annee = ? THEN s.nuitees ELSE 0 END), 0)              AS total_nuitees,
        COALESCE(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0)          AS total_ch_occupees,
        COALESCE(SUM(CASE WHEN d.annee = ? THEN s.arr_adulte + s.arr_enfant ELSE 0 END), 0) AS total_arrivees,
        ROUND(COALESCE(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0) / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.capacite_chambre ELSE 0 END), 0) * 100, 2) AS taux_occupation_chambres,
        ROUND(COALESCE(SUM(CASE WHEN d.annee = ? THEN s.rev_moy_ht * s.nuitees ELSE 0 END), 0) / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0), 2) AS prix_moyen_chambre,
        ROUND(COALESCE(SUM(CASE WHEN d.annee = ? THEN s.rev_moy_ht * s.nuitees ELSE 0 END), 0) / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.nuitees ELSE 0 END), 0), 2) AS revenu_moyen_client,
        ROUND(COALESCE(SUM(CASE WHEN d.annee = ? THEN s.nuitees ELSE 0 END), 0) / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0), 2) AS indice_freq,

        -- N-1 (2023)
        COALESCE(SUM(CASE WHEN d.annee = ? THEN s.nuitees ELSE 0 END), 0)              AS n1_nuitees,
        COALESCE(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0)          AS n1_ch_occupees,
        COALESCE(SUM(CASE WHEN d.annee = ? THEN s.arr_adulte + s.arr_enfant ELSE 0 END), 0) AS n1_arrivees,
        ROUND(COALESCE(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0) / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.capacite_chambre ELSE 0 END), 0) * 100, 2) AS n1_taux_occ,
        ROUND(COALESCE(SUM(CASE WHEN d.annee = ? THEN s.rev_moy_ht * s.nuitees ELSE 0 END), 0) / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0), 2) AS n1_adr,
        ROUND(COALESCE(SUM(CASE WHEN d.annee = ? THEN s.rev_moy_ht * s.nuitees ELSE 0 END), 0) / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.nuitees ELSE 0 END), 0), 2) AS n1_rev_client,
        ROUND(COALESCE(SUM(CASE WHEN d.annee = ? THEN s.nuitees ELSE 0 END), 0) / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0), 2) AS n1_indice_freq
      FROM fact_stats s
      JOIN dim_date d ON s.date_id = d.date_id
      WHERE d.annee IN (?, ?) AND s.hotel_id = ?
    `, [
      // N (11 placeholders)
      annee, annee, annee, annee, annee, annee, annee, annee, annee, annee, annee,
      // N-1 (11 placeholders)
      anneeN1, anneeN1, anneeN1, anneeN1, anneeN1, anneeN1, anneeN1, anneeN1, anneeN1, anneeN1, anneeN1,
      // WHERE (3 placeholders)
      annee, anneeN1, hotel_id
    ]);

    ok(res, { annee, anneeN1, hotel_id, nb_chambres, ...row });
  } catch (e) { err(res, e); }
});


// ─────────────────────────────────────────────────
// GET /api/stats/comparaison?annee=2024&hotel_id=1
// Comparaison N vs N-1 de tous les indicateurs hôteliers
// Correspond aux sections "Difference" du tableau Excel
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
        MAX(d.saison) AS saison,
        /* Nuitées */
        COALESCE(SUM(CASE WHEN d.annee = ? THEN s.nuitees ELSE 0 END), 0)              AS nuitees_n,
        COALESCE(SUM(CASE WHEN d.annee = ? THEN s.nuitees ELSE 0 END), 0)              AS nuitees_n1,
        ROUND(
          (COALESCE(SUM(CASE WHEN d.annee = ? THEN s.nuitees ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN d.annee = ? THEN s.nuitees ELSE 0 END), 0))
          / NULLIF(COALESCE(SUM(CASE WHEN d.annee = ? THEN s.nuitees ELSE 0 END), 0), 0) * 100
        , 2)                                                               AS nuitees_growth_pct,
        /* Chambres Occupées */
        COALESCE(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0)          AS ch_occupees_n,
        COALESCE(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0)          AS ch_occupees_n1,
        /* TO Chambre % */
        ROUND(
          COALESCE(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0)
          / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.capacite_chambre ELSE 0 END), 0) * 100
        , 2)                                                               AS to_chambre_n,
        ROUND(
          COALESCE(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0)
          / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.capacite_chambre ELSE 0 END), 0) * 100
        , 2)                                                               AS to_chambre_n1,
        ROUND(
          ( (COALESCE(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0) / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.capacite_chambre ELSE 0 END), 0))
            - (COALESCE(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0) / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.capacite_chambre ELSE 0 END), 0)) )
          / NULLIF( (COALESCE(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0) / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.capacite_chambre ELSE 0 END), 0)), 0) * 100
        , 2)                                                               AS to_chambre_growth_pct,
        /* Indice Fréquentation */
        ROUND(AVG(CASE WHEN d.annee = ? THEN s.indice_freq END), 4)        AS indice_freq_n,
        ROUND(AVG(CASE WHEN d.annee = ? THEN s.indice_freq END), 4)        AS indice_freq_n1,
        ROUND(
          (AVG(CASE WHEN d.annee = ? THEN s.indice_freq END)
           - AVG(CASE WHEN d.annee = ? THEN s.indice_freq END))
          / NULLIF(AVG(CASE WHEN d.annee = ? THEN s.indice_freq END), 0) * 100
        , 2)                                                               AS indice_freq_growth_pct,
        /* ADR (Prix Moyen Chambre HT) */
        ROUND(
          COALESCE(SUM(CASE WHEN d.annee = ? THEN s.rev_moy_ht * s.nuitees ELSE 0 END), 0)
          / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0)
        , 2)                                                               AS adr_n,
        ROUND(
          COALESCE(SUM(CASE WHEN d.annee = ? THEN s.rev_moy_ht * s.nuitees ELSE 0 END), 0)
          / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0)
        , 2)                                                               AS adr_n1,
        ROUND(
          ( (COALESCE(SUM(CASE WHEN d.annee = ? THEN s.rev_moy_ht * s.nuitees ELSE 0 END), 0) / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0))
            - (COALESCE(SUM(CASE WHEN d.annee = ? THEN s.rev_moy_ht * s.nuitees ELSE 0 END), 0) / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0)) )
          / NULLIF( (COALESCE(SUM(CASE WHEN d.annee = ? THEN s.rev_moy_ht * s.nuitees ELSE 0 END), 0) / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.ch_occupees ELSE 0 END), 0)), 0) * 100
        , 2)                                                               AS adr_growth_pct,
        /* Revenu moyen par client HT */
        ROUND(
          COALESCE(SUM(CASE WHEN d.annee = ? THEN s.rev_moy_ht * s.nuitees ELSE 0 END), 0)
          / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.nuitees ELSE 0 END), 0)
        , 2)                                                               AS revenu_moyen_client_n,
        ROUND(
          COALESCE(SUM(CASE WHEN d.annee = ? THEN s.rev_moy_ht * s.nuitees ELSE 0 END), 0)
          / NULLIF(SUM(CASE WHEN d.annee = ? THEN s.nuitees ELSE 0 END), 0)
        , 2)                                                               AS revenu_moyen_client_n1,
        /* Arrivées totales */
        COALESCE(SUM(CASE WHEN d.annee = ? THEN s.arr_adulte + s.arr_enfant ELSE 0 END), 0)
                                                                            AS arr_total_n,
        COALESCE(SUM(CASE WHEN d.annee = ? THEN s.arr_adulte + s.arr_enfant ELSE 0 END), 0)
                                                                            AS arr_total_n1
      FROM fact_stats s
      JOIN dim_date d ON s.date_id = d.date_id
      WHERE d.annee IN (?, ?) AND s.hotel_id = ?
      GROUP BY d.mois, d.mois_nom
      ORDER BY d.mois
    `, [
      annee, anneeN1, annee, anneeN1, anneeN1,   /* nuitées */
      annee, anneeN1,                             /* ch_occupees */
      annee, annee, anneeN1, anneeN1, annee, annee, anneeN1, anneeN1, annee, annee, /* to_chambre */
      annee, anneeN1, annee, anneeN1, anneeN1,   /* indice_freq */
      annee, annee, anneeN1, anneeN1, annee, annee, anneeN1, anneeN1, annee, annee, /* adr */
      annee, annee, anneeN1, anneeN1,             /* revenu_moyen_client */
      annee, anneeN1,                             /* arr_total */
      annee, anneeN1, hotel_id
    ]);
    ok(res, rows);
  } catch (e) { err(res, e); }
});


// ─────────────────────────────────────────────────
// GET /api/stats/arrivees?annee=2024&hotel_id=1
// Arrivées mensuelles adultes / enfants + cumul
// ─────────────────────────────────────────────────
router.get('/arrivees', async (req, res) => {
  const annee    = parseYear(req.query.annee);
  const hotel_id = parseHotel(req.query.hotel_id);
  try {
    const [rows] = await pool.execute(`
      SELECT
        d.mois,
        d.mois_nom,
        d.saison,
        s.arr_adulte,
        s.arr_enfant,
        (s.arr_adulte + s.arr_enfant)                           AS arr_total,
        SUM(s.arr_adulte + s.arr_enfant) OVER (
          PARTITION BY d.annee
          ORDER BY d.mois
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )                                                       AS arr_cumul
      FROM fact_stats s
      JOIN dim_date d ON s.date_id = d.date_id
      WHERE d.annee = ? AND s.hotel_id = ?
      ORDER BY d.mois
    `, [annee, hotel_id]);
    ok(res, rows);
  } catch (e) { err(res, e); }
});


// ─────────────────────────────────────────────────
// GET /api/stats/nationalites?annee=2024&hotel_id=1
// Top 10 nationalités par arrivées + part % + continent
// ─────────────────────────────────────────────────
router.get('/nationalites', async (req, res) => {
  const annee    = parseYear(req.query.annee);
  const hotel_id = parseHotel(req.query.hotel_id);
    try {
    const [rows] = await pool.execute(`
      SELECT
        dn.nom_nat,
        dn.continent,
        SUM(fn.nb_arrivees)                                     AS total_arrivees,
        ROUND(
          SUM(fn.nb_arrivees)
          / NULLIF(SUM(SUM(fn.nb_arrivees)) OVER (), 0) * 100
        , 2)                                                    AS part_pct
      FROM fact_nationalites fn
      JOIN dim_date        d  ON fn.date_id = d.date_id
      JOIN dim_nationalite dn ON fn.nat_id  = dn.nat_id
      WHERE d.annee = ? AND fn.hotel_id = ?
      GROUP BY dn.nom_nat, dn.continent
      ORDER BY total_arrivees DESC
      LIMIT 10
    `, [annee, hotel_id]);
    ok(res, rows);
  } catch (e) { err(res, e); }
});


// ─────────────────────────────────────────────────
// GET /api/stats/agences?annee=2024&hotel_id=1
// Top 10 agences par CA + part % + type de canal
// ─────────────────────────────────────────────────
router.get('/agences', async (req, res) => {
  const annee    = parseYear(req.query.annee);
  const hotel_id = parseHotel(req.query.hotel_id);
  try {
    const [rows] = await pool.execute(`
      SELECT
        da.nom_agence,
        SUM(fa.ca_agence)                                       AS ca_total,
        ROUND(
          SUM(fa.ca_agence)
          / NULLIF(SUM(SUM(fa.ca_agence)) OVER (), 0) * 100
        , 2)                                                    AS part_pct
      FROM fact_agences fa
      JOIN dim_date  d  ON fa.date_id   = d.date_id
      JOIN dim_agence da ON fa.agence_id = da.agence_id
      WHERE d.annee = ? AND fa.hotel_id = ?
      GROUP BY da.nom_agence
      ORDER BY ca_total DESC
      LIMIT 10
    `, [annee, hotel_id]);
    ok(res, rows);
  } catch (e) { err(res, e); }
});


// ─────────────────────────────────────────────────
// GET /api/stats/ytd?annee=2024&mois=10&hotel_id=1
// Year-To-Date statistiques N vs N-1
// ─────────────────────────────────────────────────
router.get('/ytd', async (req, res) => {
  const annee    = parseYear(req.query.annee);
  const hotel_id = parseHotel(req.query.hotel_id);
  const mois     = parseInt(req.query.mois, 10) || new Date().getMonth() + 1;
  const anneeN1  = annee - 1;
  try {
    const [[row]] = await pool.execute(`
      SELECT
        SUM(CASE WHEN d.annee = ? AND d.mois <= ? THEN s.nuitees ELSE 0 END)
                                                                AS ytd_nuitees_n,
        SUM(CASE WHEN d.annee = ? AND d.mois <= ? THEN s.nuitees ELSE 0 END)
                                                                AS ytd_nuitees_n1,
        ROUND(
          (SUM(CASE WHEN d.annee = ? AND d.mois <= ? THEN s.nuitees ELSE 0 END)
           - SUM(CASE WHEN d.annee = ? AND d.mois <= ? THEN s.nuitees ELSE 0 END))
          / NULLIF(SUM(CASE WHEN d.annee = ? AND d.mois <= ? THEN s.nuitees ELSE 0 END), 0) * 100
        , 2)                                                    AS ytd_nuitees_growth_pct,
        ROUND(AVG(CASE WHEN d.annee = ? AND d.mois <= ? THEN s.to_lit END) * 100, 2)
                                                                AS ytd_avg_to_lit_n,
        ROUND(AVG(CASE WHEN d.annee = ? AND d.mois <= ? THEN s.to_lit END) * 100, 2)
                                                                AS ytd_avg_to_lit_n1,
        ROUND(AVG(CASE WHEN d.annee = ? AND d.mois <= ? THEN s.rev_moy_ttc END), 2)
                                                                AS ytd_avg_adr_n,
        ROUND(AVG(CASE WHEN d.annee = ? AND d.mois <= ? THEN s.rev_moy_ttc END), 2)
                                                                AS ytd_avg_adr_n1,
        ROUND(AVG(CASE WHEN d.annee = ? AND d.mois <= ? THEN s.rev_moy_ttc * s.to_lit END), 2)
                                                                AS ytd_avg_revpar_n,
        ROUND(AVG(CASE WHEN d.annee = ? AND d.mois <= ? THEN s.rev_moy_ttc * s.to_lit END), 2)
                                                                AS ytd_avg_revpar_n1,
        SUM(CASE WHEN d.annee = ? AND d.mois <= ?
              THEN s.arr_adulte + s.arr_enfant ELSE 0 END)
                                                                AS ytd_arrivees_n,
        SUM(CASE WHEN d.annee = ? AND d.mois <= ?
              THEN s.arr_adulte + s.arr_enfant ELSE 0 END)
                                                                AS ytd_arrivees_n1
      FROM fact_stats s
      JOIN dim_date d ON s.date_id = d.date_id
      WHERE d.annee IN (?, ?) AND s.hotel_id = ?
    `, [
      annee, mois, anneeN1, mois,
      annee, mois, anneeN1, mois, anneeN1, mois,
      annee, mois, anneeN1, mois,
      annee, mois, anneeN1, mois,
      annee, mois, anneeN1, mois,
      annee, mois, anneeN1, mois,
      annee, anneeN1, hotel_id
    ]);

    ok(res, { annee, anneeN1, mois, hotel_id, ...row });
  } catch (e) { err(res, e); }
});


module.exports = router;
