/**
 * previsions.js — Prévisions VAR Multivariées
 *
 * Données source : table fact_previsions (générée par etl/prevision.py)
 *
 * Routes:
 *   GET /api/previsions/annuel?hotel_id=1          → prévisions 12 mois
 *   GET /api/previsions/kpi?hotel_id=1             → synthèse KPI prévus
 *   GET /api/previsions/recommandations?hotel_id=1 → actions tarifaires
 *   GET /api/previsions/comparaison?hotel_id=1     → réel 2025 vs prévu 2026
 *   GET /api/previsions/metriques?hotel_id=1       → MAPE et qualité modèle
 *
 * FIXES APPLIQUÉS:
 *   [FIX-5] TVA_DIVISEUR centralisé (1.07 = taux TVA hôtelière Tunisie 7%)
 *   [FIX-6] Merge réel/prévu par numéro de mois (pas par index de position)
 *   [FIX-3] Exposition du MAPE par horizon dans les routes annuel + comparaison
 *   [FIX-4] Champ fiabilite exposé dans kpi et metriques
 */

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// ─── [FIX-5] CONSTANTE TVA CENTRALISÉE ───────────────────────────────────────
// Taux TVA hôtelière Tunisie : 7% → diviseur = 1.07
// À modifier ici uniquement si le taux change
const TVA_DIVISEUR = 1.07;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const parseHotel = (v, def = 1) => parseInt(v, 10) || def;
const ok  = (res, data) => res.json({ success: true,  data });
const err = (res, e)    => {
  console.error('[PREVISIONS]', e.message);
  res.status(500).json({ success: false, error: e.message });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/previsions/annuel?hotel_id=1
// Prévisions mensuelles CA + TO + ADR + RevPAR pour les 12 prochains mois
// [FIX-3] Inclut fiabilite et mape_par_horizon
// [FIX-5] Utilise TVA_DIVISEUR (7%) au lieu de 1.0807
// ─────────────────────────────────────────────────────────────────────────────
router.get('/annuel', async (req, res) => {
  const hotel_id = parseHotel(req.query.hotel_id);
  try {
    const [rows] = await pool.query(`
      SELECT
        p.date_id,
        p.annee,
        p.mois,
        d.mois_nom,
        ROUND(p.ca_prevu, 0)                        AS ca_prevu,
        ROUND(p.ca_prevu / ?, 0)                    AS ca_prevu_ht,
        ROUND(p.to_prevu * 100, 1)                  AS to_prevu_pct,
        ROUND(p.adr_prevu, 1)                       AS adr_prevu,
        ROUND(p.revpar_prevu, 1)                    AS revpar_prevu,
        p.couleur_alerte,
        p.action_tarifaire,
        p.recommandation,
        p.mape_ca,
        p.mape_to,
        p.mape_adr,
        p.fiabilite,
        p.mape_par_horizon,
        p.modele,
        p.date_calcul
      FROM fact_previsions p
      LEFT JOIN dim_date d ON p.date_id = d.date_id
      WHERE p.hotel_id = ?
      ORDER BY p.date_id ASC
    `, [TVA_DIVISEUR, hotel_id]);

    // Parser le JSON mape_par_horizon si présent
    const data = rows.map(r => ({
      ...r,
      mape_par_horizon: r.mape_par_horizon
        ? (typeof r.mape_par_horizon === 'string'
            ? JSON.parse(r.mape_par_horizon)
            : r.mape_par_horizon)
        : null
    }));

    ok(res, data);
  } catch (e) { err(res, e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/previsions/kpi?hotel_id=1
// KPIs synthétiques des prévisions
// [FIX-4] Inclut fiabilite du modèle
// [FIX-5] Utilise TVA_DIVISEUR
// ─────────────────────────────────────────────────────────────────────────────
router.get('/kpi', async (req, res) => {
  const hotel_id = parseHotel(req.query.hotel_id);
  try {
    const [rows] = await pool.query(`
      SELECT
        p.annee,
        ROUND(SUM(p.ca_prevu), 0)           AS ca_total_prevu,
        ROUND(SUM(p.ca_prevu) / ?, 0)       AS ca_total_prevu_ht,
        ROUND(AVG(p.to_prevu) * 100, 1)     AS to_moyen_prevu,
        ROUND(AVG(p.adr_prevu), 1)          AS adr_moyen_prevu,
        ROUND(AVG(p.revpar_prevu), 1)       AS revpar_moyen_prevu,
        ROUND(MAX(p.ca_prevu), 0)           AS ca_pic_prevu,
        ROUND(MIN(p.ca_prevu), 0)           AS ca_creux_prevu,
        MAX(p.mape_ca)                      AS mape_ca,
        MAX(p.mape_to)                      AS mape_to,
        MAX(p.mape_adr)                     AS mape_adr,
        MAX(p.fiabilite)                    AS fiabilite,
        MAX(p.modele)                       AS modele
      FROM fact_previsions p
      WHERE p.hotel_id = ?
      GROUP BY p.annee
    `, [TVA_DIVISEUR, hotel_id]);

    const annee_prevue = rows[0]?.annee || new Date().getFullYear() + 1;
    const annee_precedente = annee_prevue - 1;

    // Calcul croissance vs année précédente réelle
    const [reel] = await pool.query(`
      SELECT
        ROUND(SUM(ca_ttc), 0) AS ca_reel_annee_precedente
      FROM fact_revenus
      WHERE hotel_id = ? AND date_id BETWEEN ? AND ?
    `, [hotel_id, parseInt(`${annee_precedente}01`), parseInt(`${annee_precedente}12`)]);

    const ca_reel = reel[0]?.ca_reel_annee_precedente || 0;
    const ca_prev = rows[0]?.ca_total_prevu || 0;
    const croissance = ca_reel > 0
      ? Math.round(((ca_prev - ca_reel) / ca_reel) * 100 * 10) / 10
      : null;

    // [FIX-4] Alerte si modèle peu fiable
    const fiabilite     = rows[0]?.fiabilite || 'bon';
    const alerte_fiab   = fiabilite === 'peu_fiable'
      ? 'Modèle peu fiable (MAPE > 25%) — interpréter avec précaution'
      : null;

    ok(res, {
      ...rows[0],
      ca_reel_annee_precedente: ca_reel,
      croissance_prevue_pct:    croissance,
      alerte_fiabilite:         alerte_fiab,   // [FIX-4] null si tout va bien
    });
  } catch (e) { err(res, e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/previsions/recommandations?hotel_id=1
// Recommandations tarifaires par mois — pour le dashboard Revenue Management
// [FIX-5] Utilise TVA_DIVISEUR
// ─────────────────────────────────────────────────────────────────────────────
router.get('/recommandations', async (req, res) => {
  const hotel_id = parseHotel(req.query.hotel_id);
  try {
    const [rows] = await pool.query(`
      SELECT
        p.date_id,
        p.mois,
        COALESCE(d.mois_nom, CONCAT('Mois ', p.mois)) AS mois_nom,
        ROUND(p.to_prevu * 100, 1)    AS to_prevu_pct,
        ROUND(p.ca_prevu, 0)          AS ca_prevu,
        ROUND(p.ca_prevu / ?, 0)      AS ca_prevu_ht,
        ROUND(p.adr_prevu, 1)         AS adr_prevu,
        p.couleur_alerte,
        p.recommandation              AS niveau,
        p.action_tarifaire            AS action
      FROM fact_previsions p
      LEFT JOIN dim_date d ON p.date_id = d.date_id
      WHERE p.hotel_id = ?
      ORDER BY FIELD(p.couleur_alerte, 'rouge', 'orange', 'jaune', 'bleu', 'vert'), p.date_id ASC
    `, [TVA_DIVISEUR, hotel_id]);

    const groupes = {
      rouge:  rows.filter(r => r.couleur_alerte === 'rouge'),
      orange: rows.filter(r => r.couleur_alerte === 'orange'),
      jaune:  rows.filter(r => r.couleur_alerte === 'jaune'),
      bleu:   rows.filter(r => r.couleur_alerte === 'bleu'),
      vert:   rows.filter(r => r.couleur_alerte === 'vert'),
    };

    ok(res, { detail: rows, groupes });
  } catch (e) { err(res, e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/previsions/comparaison?hotel_id=1
// Comparaison Réel N-1 vs Prévu N (même mois)
//
// [FIX-6] CORRECTION CRITIQUE : merge par numéro de mois (pas par position)
//
// AVANT (bugué) : reel.map((r, i) => ({ ca_prevu: prev[i]?.ca_prevu }))
//   → si un mois réel manque (ex: mois 5 absent), tous les suivants sont décalés
//
// APRÈS (correct) : on crée un Map<mois → données> pour chaque côté,
//   puis on itère sur les 12 mois en cherchant dans chaque Map
// ─────────────────────────────────────────────────────────────────────────────
router.get('/comparaison', async (req, res) => {
  const hotel_id = parseHotel(req.query.hotel_id);
  try {
    const [prevRows] = await pool.query(`
      SELECT
        p.annee,
        p.mois,
        ROUND(p.ca_prevu, 0)          AS ca_prevu,
        ROUND(p.ca_prevu / ?, 0)      AS ca_prevu_ht,
        ROUND(p.to_prevu * 100, 1)    AS to_prevu,
        ROUND(p.adr_prevu, 1)         AS adr_prevu,
        ROUND(p.revpar_prevu, 1)      AS revpar_prevu,
        p.couleur_alerte,
        p.action_tarifaire
      FROM fact_previsions p
      WHERE p.hotel_id = ?
      ORDER BY p.date_id ASC
    `, [TVA_DIVISEUR, hotel_id]);

    const annee_prevue = prevRows[0]?.annee || new Date().getFullYear() + 1;
    const annee_precedente = annee_prevue - 1;

    const [reelRows] = await pool.query(`
      SELECT
        d.mois,
        COALESCE(d.mois_nom, CONCAT('M', d.mois)) AS mois_nom,
        ROUND(r.ca_ttc, 0)                         AS ca_reel,
        ROUND(r.ca_ttc / ?, 0)                     AS ca_reel_ht,
        ROUND(s.to_lit * 100, 1)                   AS to_reel,
        ROUND(s.rev_moy_ttc, 1)                    AS adr_reel,
        ROUND(s.rev_moy_ttc * s.to_lit, 1)         AS revpar_reel
      FROM fact_revenus r
      JOIN fact_stats s   ON r.date_id = s.date_id AND r.hotel_id = s.hotel_id
      LEFT JOIN dim_date d ON r.date_id = d.date_id
      WHERE r.hotel_id = ? AND r.date_id BETWEEN ? AND ?
      ORDER BY r.date_id ASC
    `, [TVA_DIVISEUR, hotel_id, parseInt(`${annee_precedente}01`), parseInt(`${annee_precedente}12`)]);

    // [FIX-6] Construction de Maps indexées par numéro de mois
    const reelParMois = new Map(reelRows.map(r => [r.mois, r]));
    const prevParMois = new Map(prevRows.map(p => [p.mois, p]));

    // Itération sur les 12 mois de l'année
    const merged = Array.from({ length: 12 }, (_, i) => {
      const mois = i + 1;
      const r    = reelParMois.get(mois) || null;
      const p    = prevParMois.get(mois) || null;

      return {
        mois,
        mois_nom:     r?.mois_nom || p?.mois_nom || `Mois ${mois}`,
        // Réel N-1 — null si le mois n'existe pas encore
        ca_reel:      r?.ca_reel_ht   ?? null,
        to_reel:      r?.to_reel      ?? null,
        adr_reel:     r?.adr_reel     ?? null,
        revpar_reel:  r?.revpar_reel  ?? null,
        // Prévu N — null si aucune prévision calculée
        ca_prevu:     p?.ca_prevu_ht  ?? null,
        to_prevu:     p?.to_prevu     ?? null,
        adr_prevu:    p?.adr_prevu    ?? null,
        revpar_prevu: p?.revpar_prevu ?? null,
        couleur:      p?.couleur_alerte    ?? null,
        action:       p?.action_tarifaire  ?? null,
      };
    });

    ok(res, merged);
  } catch (e) { err(res, e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/previsions/metriques?hotel_id=1
// Métriques de performance du modèle VAR (MAPE, qualité)
// [FIX-4] Inclut fiabilite + alerte visuelle si peu_fiable
// [FIX-3] Inclut mape_par_horizon pour affichage dans le dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/metriques', async (req, res) => {
  const hotel_id = parseHotel(req.query.hotel_id);
  try {
    const [rows] = await pool.query(`
      SELECT
        mape_ca,
        mape_to,
        mape_adr,
        fiabilite,
        mape_par_horizon,
        modele,
        date_calcul,
        CASE
          WHEN mape_ca < 10 THEN 'Excellent'
          WHEN mape_ca < 20 THEN 'Bon'
          WHEN mape_ca < 25 THEN 'Acceptable'
          ELSE 'À améliorer ⚠️'
        END AS qualite_ca
      FROM fact_previsions
      WHERE hotel_id = ?
      LIMIT 1
    `, [hotel_id]);

    if (!rows[0]) { ok(res, null); return; }

    const row = rows[0];

    // Parser mape_par_horizon si c'est une string JSON
    let mapeParHorizon = null;
    if (row.mape_par_horizon) {
      try {
        // MySQL peut retourner le JSON déjà parsé ou comme string
        mapeParHorizon = typeof row.mape_par_horizon === 'string'
          ? JSON.parse(row.mape_par_horizon)
          : row.mape_par_horizon;
      } catch (_) {
        mapeParHorizon = null;
      }
    }

    ok(res, {
      ...row,
      mape_par_horizon: mapeParHorizon,
      // [FIX-4] message d'alerte prêt à afficher dans l'UI
      alerte_fiabilite: row.fiabilite === 'peu_fiable'
        ? 'Modèle peu fiable (MAPE > 25%) — interpréter avec précaution'
        : null,
    });
  } catch (e) { err(res, e); }
});

module.exports = router;
