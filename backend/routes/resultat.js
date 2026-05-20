// backend/routes/resultat.js  — VERSION CORRIGÉE
// FIX: Exclusion de la ligne 'total_charges' du SUM pour éviter le double comptage.
// Formules issues du CEO Dashboard Excel 2023-2024 Consolidé :
//   RBE              = CA_HT - Total_Charges_Exploitation
//   Résultat Net     = RBE - Amortissements - Charges_Financières - IS + Produits_Financiers
//   Marge Nette      = Résultat_Net / CA_HT * 100
//   Taux_Charges     = Total_Charges / CA_TTC * 100

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// ─── GET /api/resultat/annuel?hotel_id=1 ──────────────────────────────────────
// Résultat par année : CA, charges (sans double comptage), RBE, résultat net, marges
router.get('/annuel', async (req, res) => {
  const hotel_id = parseInt(req.query.hotel_id) || 1;

  try {
    // CA TTC mensuel agrégé par année
    const [caRows] = await pool.execute(`
      SELECT d.annee, SUM(f.ca_ttc) AS ca_ttc, SUM(f.ca_ht) AS ca_ht
      FROM fact_revenus f
      JOIN dim_date d ON f.date_id = d.date_id
      WHERE f.hotel_id = ?
      GROUP BY d.annee
      ORDER BY d.annee`,
      [hotel_id]
    );

    // Charges par poste par année — FIX : exclure 'total_charges' (ligne agrégée)
    // pour éviter de compter deux fois les charges
    const [chRows] = await pool.execute(`
      SELECT f.annee, p.code_poste as poste, SUM(f.montant) AS montant
      FROM fact_charges f
      JOIN dim_poste_charge p ON f.poste_id = p.poste_id
      WHERE f.hotel_id = ? AND p.code_poste != 'total_charges' AND f.mois = 0
      GROUP BY f.annee, p.code_poste
      ORDER BY f.annee, p.code_poste`,
      [hotel_id]
    );

    // Construire le résultat par année
    const result = caRows.map(caRow => {
      const yr   = caRow.annee;
      const caTtc = parseFloat(caRow.ca_ttc) || 0;
      const caHt  = parseFloat(caRow.ca_ht)  || (caTtc / 1.0807);

      // Regrouper les charges de cette année
      const chargesAn = chRows.filter(r => r.annee === yr);
      const byPoste   = {};
      chargesAn.forEach(r => { byPoste[r.poste] = parseFloat(r.montant) || 0; });

      // Charges d'exploitation (postes opérationnels)
      const personnel          = byPoste['personnel']           || 0;
      const energie            = byPoste['energie']             || 0;
      const achats             = byPoste['achats_consommation'] || 0;
      const autresExploit      = byPoste['autres_exploit']      || 0;
      const chargesFinExploit  = byPoste['charges_financieres'] || 0;
      const impotsTaxes        = byPoste['impots_taxes']        || 0;
      const dotations          = byPoste['dotations_amort']     || 0;

      // Totaux intermédiaires (formules Excel CEO Dashboard)
      const totalChargesExploit = personnel + energie + achats + autresExploit + chargesFinExploit;
      const rbe                 = caHt - totalChargesExploit;
      const totalCharges        = totalChargesExploit + impotsTaxes + dotations;
      const resultatNet         = rbe - dotations - impotsTaxes;

      // Ratios
      const margeRbe   = caHt  > 0 ? (rbe        / caHt  * 100) : 0;
      const margeNette = caHt  > 0 ? (resultatNet / caHt  * 100) : 0;
      const txCharges  = caHt > 0 ? (totalCharges / caHt * 100) : 0;

      return {
        annee: yr,
        ca_ttc:               Math.round(caTtc  * 100) / 100,
        ca_ht:                Math.round(caHt   * 100) / 100,
        personnel:            Math.round(personnel         * 100) / 100,
        energie:              Math.round(energie           * 100) / 100,
        achats_consommation:  Math.round(achats            * 100) / 100,
        autres_exploit:       Math.round(autresExploit     * 100) / 100,
        charges_financieres:  Math.round(chargesFinExploit * 100) / 100,
        impots_taxes:         Math.round(impotsTaxes       * 100) / 100,
        dotations_amort:      Math.round(dotations         * 100) / 100,
        total_charges_exploit:Math.round(totalChargesExploit * 100) / 100,
        total_charges:        Math.round(totalCharges      * 100) / 100,
        rbe:                  Math.round(rbe               * 100) / 100,
        resultat_net:         Math.round(resultatNet        * 100) / 100,
        marge_rbe:            parseFloat(margeRbe.toFixed(1)),
        marge_nette:          parseFloat(margeNette.toFixed(1)),
        taux_charges:         parseFloat(txCharges.toFixed(1)),
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📊 GET /api/resultat/mensuel?hotel_id=1&annee=2024&mois=5
// Résultat mensuel ou YTD avec ratios calculés
router.get('/mensuel', async (req, res) => {
  const hotel_id = parseInt(req.query.hotel_id) || 1;
  const annee = parseInt(req.query.annee) || 2024;
  const mois = parseInt(req.query.mois) || 0; // 0 = annuel (somme des 12 mois)
  const n1 = annee - 1;

  try {
    // 1. CA HT & TTC (Revenus)
    // On récupère le CA mensuel pour N et N1
    const [caRows] = await pool.execute(`
      SELECT annee, mois, SUM(ca_ttc) AS ca_ttc, SUM(ca_ht) AS ca_ht
      FROM fact_revenus f
      JOIN dim_date d ON f.date_id = d.date_id
      WHERE f.hotel_id = ? AND d.annee IN (?, ?)
      GROUP BY annee, mois`,
      [hotel_id, annee, n1]
    );

    // 2. Charges (Mensuelles ou Annuelles)
    const [chRows] = await pool.execute(`
      SELECT f.annee, f.mois, p.code_poste as poste, f.montant
      FROM fact_charges f
      JOIN dim_poste_charge p ON f.poste_id = p.poste_id
      WHERE f.hotel_id = ? AND f.annee IN (?, ?)`,
      [hotel_id, annee, n1]
    );

    const getPeriodData = (yr, mo) => {
      let caTtc = 0;
      let caHt_db = 0;
      let ch = {
        personnel: 0, energie: 0, achats_consommation: 0, 
        autres_exploit: 0, charges_financieres: 0,
        impots_taxes: 0, dotations_amort: 0
      };

      // Force integer comparison — MySQL can return BigInt or strings for numeric columns
      const iyr = parseInt(yr);
      const imo = parseInt(mo);

      if (imo === 0) {
        // Annuel : somme CA mensuel
        const targetRows = caRows.filter(r => parseInt(r.annee) === iyr);
        caTtc = targetRows.reduce((sum, r) => sum + (parseFloat(r.ca_ttc) || 0), 0);
        caHt_db = targetRows.reduce((sum, r) => sum + (parseFloat(r.ca_ht) || 0), 0);

        // D'abord : charges depuis le bilan annuel (mois=0)
        const yrCh0 = chRows.filter(r => parseInt(r.annee) === iyr && parseInt(r.mois) === 0);
        yrCh0.forEach(r => {
          if (ch[r.poste] !== undefined) ch[r.poste] += parseFloat(r.montant) || 0;
        });

        // Ensuite : pour les postes encore à 0, sommer les mois 1→12 (fallback ETL partiel)
        const postesAZero = Object.keys(ch).filter(k => ch[k] === 0);
        if (postesAZero.length > 0) {
          const yrChMensuel = chRows.filter(r => parseInt(r.annee) === iyr && parseInt(r.mois) >= 1);
          yrChMensuel.forEach(r => {
            if (postesAZero.includes(r.poste)) ch[r.poste] += parseFloat(r.montant) || 0;
          });
        }

      } else {
        // Mensuel spécifique
        const targetCa = caRows.find(r => parseInt(r.annee) === iyr && parseInt(r.mois) === imo);
        caTtc = targetCa ? parseFloat(targetCa.ca_ttc) : 0;
        caHt_db = targetCa ? parseFloat(targetCa.ca_ht) : 0;

        // Charges mensuelles d'abord
        const targetCh = chRows.filter(r => parseInt(r.annee) === iyr && parseInt(r.mois) === imo);
        if (targetCh.length > 0) {
          targetCh.forEach(r => {
            if (ch[r.poste] !== undefined) ch[r.poste] += parseFloat(r.montant) || 0;
          });
        } else {
          // Fallback : prorata sur charges annuelles
          const caAnnuelTtc = caRows
            .filter(r => Math.floor(parseInt(r.date_id) / 100) === iyr)
            .reduce((sum, r) => sum + (parseFloat(r.ca_ttc) || 0), 0);
          const ratioMois = caAnnuelTtc > 0 ? (caTtc / caAnnuelTtc) : (1 / 12);

          const yrCh = chRows.filter(r => parseInt(r.annee) === iyr && parseInt(r.mois) === 0);
          yrCh.forEach(r => {
            if (ch[r.poste] !== undefined) ch[r.poste] += (parseFloat(r.montant) || 0) * ratioMois;
          });
        }
      }

      const caHt = caHt_db || (caTtc / 1.0807);
      const totalExploit = ch.personnel + ch.energie + ch.achats_consommation + ch.autres_exploit + ch.charges_financieres;
      const rbe = caHt - totalExploit;
      const resNet = rbe - ch.dotations_amort - ch.impots_taxes;
      const totalChg = totalExploit + ch.dotations_amort + ch.impots_taxes;

      const ratio = (val) => caHt > 0 ? (val / caHt * 100) : 0;

      return {
        ca_ttc: caTtc,
        ca_ht: caHt,
        ...ch,
        total_charges_exploit: totalExploit,
        total_charges: totalChg,
        rbe,
        resultat_net: resNet,
        ratios: {
          personnel: ratio(ch.personnel),
          energie: ratio(ch.energie),
          achats: ratio(ch.achats_consommation),
          autres: ratio(ch.autres_exploit),
          fin: ratio(ch.charges_financieres),
          rbe: ratio(rbe),
          net: ratio(resNet),
          total: ratio(totalChg)
        }
      };
    };

    const dataN = getPeriodData(annee, mois);
    const dataN1 = getPeriodData(n1, mois);

    res.json({
      success: true,
      annee,
      mois,
      data: dataN,
      dataN1: dataN1
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
