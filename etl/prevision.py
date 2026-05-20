"""
prevision.py — Azur Hotels BI
================================
Module de Prévision Multivariée VAR (Vector AutoRegression)
Prédit CA, Taux d'Occupation et ADR pour les 12 prochains mois.

    python prevision.py                     → prévision tous hôtels actifs
    python prevision.py --hotel RYL         → prévision Royal Azur uniquement
    python prevision.py --hotel RYL --mois 6 → prévision 6 mois

FIXES APPLIQUÉS:
  [FIX-1] Borne CA et ADR : pas plus de 5× le max historique (évite divergence VAR)
  [FIX-2] Fallback lag_date loggé explicitement avec avertissement
  [FIX-3] MAPE dégradé par horizon (précision décroit avec le temps)
  [FIX-4] Alerte automatique si MAPE > 25% → modèle signalé comme peu fiable
  [FIX-5] Constante TVA_RATE centralisée (remplace 1.0807 dispersé)
  [FIX-6] Lag maximal paramétrable via config (plus codé en dur silencieusement)
"""

import os
import sys
import argparse
import json
import logging
from datetime import datetime

import pandas as pd
import numpy as np
import mysql.connector
from statsmodels.tsa.vector_ar.var_model import VAR
from statsmodels.tsa.stattools import adfuller
from sklearn.metrics import mean_absolute_percentage_error
import warnings
warnings.filterwarnings('ignore')

# ─── Import config existant ───────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))
from config import HOTELS

# ─── [FIX-5] CONSTANTE TVA CENTRALISÉE ───────────────────────────────────────
# Taux TVA hôtelière Tunisie : 7% → diviseur = 1.07
# À modifier ici uniquement si le taux change
TVA_DIVISEUR = 1.07

# ─── [FIX-6] PARAMÈTRE LAG MAX PAR DÉFAUT ────────────────────────────────────
# Peut être surchargé par config.py si la clé PREVISION_MAX_LAG existe
DEFAULT_MAX_LAG = getattr(
    __import__('config'), 'PREVISION_MAX_LAG', 1
)

# ─── LOGGING ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [PREVISION] %(levelname)s — %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger(__name__)

# ─── CONNEXION DB ─────────────────────────────────────────────────────────────
def get_connection():
    """Connexion MySQL via variables d'environnement (même pattern que chargement.py)."""
    env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                if '=' in line and not line.strip().startswith('#'):
                    k, v = line.strip().split('=', 1)
                    os.environ[k] = v

    return mysql.connector.connect(
        host     = os.getenv('DB_HOST', 'localhost'),
        port     = int(os.getenv('DB_PORT', 3306)),
        user     = os.getenv('DB_USER', 'root'),
        password = os.getenv('DB_PASS', ''),
        database = os.getenv('DB_NAME', 'azur_hotels'),
    )

# ─── EXTRACTION DONNÉES ───────────────────────────────────────────────────────
def charger_donnees_hotel(conn, hotel_id: int) -> pd.DataFrame:
    """
    Charge CA, TO et ADR mensuels depuis le Data Warehouse pour un hôtel donné.
    Retourne un DataFrame indexé par date (fréquence mensuelle).
    """
    query = """
        SELECT
            r.date_id,
            r.ca_ttc,
            s.to_lit,
            s.rev_moy_ttc AS adr
        FROM fact_revenus r
        JOIN fact_stats s
            ON r.date_id = s.date_id
            AND r.hotel_id = s.hotel_id
        WHERE r.hotel_id = %s
        ORDER BY r.date_id ASC
    """
    df = pd.read_sql(query, conn, params=(hotel_id,))

    if df.empty:
        raise ValueError(f"Aucune donnée trouvée pour hotel_id={hotel_id}")

    # Convertir date_id (AAAAMM) en datetime
    df['date'] = pd.to_datetime(df['date_id'].astype(str), format='%Y%m')
    df = df.set_index('date')

    # Sécurisation : chronologie continue + interpolation des mois manquants
    df = df.resample('MS').interpolate(method='linear')

    df = df[['ca_ttc', 'to_lit', 'adr']].astype(float)

    log.info(f"  Données chargées: {len(df)} mois "
             f"({df.index[0].strftime('%b %Y')} → {df.index[-1].strftime('%b %Y')})")
    return df

# ─── MODÈLE VAR ───────────────────────────────────────────────────────────────
def tester_stationnarite(df: pd.DataFrame) -> dict:
    """Test ADF de stationnarité pour chaque variable."""
    resultats = {}
    for col in df.columns:
        stat, pval, *_ = adfuller(df[col])
        resultats[col] = {
            'stationnaire': pval < 0.05,
            'p_value': round(pval, 4)
        }
    return resultats


def preparer_donnees(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """
    Applique une différenciation saisonnière lag=12 ET une transformation logarithmique.
    Dans l'hôtellerie, la variance entre le CA (en millions) et le TO (0.x) détruit
    la stabilité du modèle VAR. Le passage au Log stabilise les échelles.
    """
    log.info("  Transformation LOG + Différenciation saisonnière (lag=12) FORCÉE")
    df_log = np.log(df.replace(0, 1.0))
    df_diff = df_log.diff(12).dropna()
    return df_diff, 12


def selectionner_lag(df_diff: pd.DataFrame, maxlags: int = None) -> int:
    """
    Sélectionne le lag optimal VAR.
    [FIX-6] Le lag max est maintenant paramétrable (DEFAULT_MAX_LAG depuis config).
    Vu le faible volume de données (36 mois), on limite à 1 pour éviter l'overfitting.
    """
    safe_maxlags = maxlags if maxlags is not None else DEFAULT_MAX_LAG

    model = VAR(df_diff)
    try:
        resultats = model.select_order(maxlags=safe_maxlags)
        lag_optimal = resultats.selected_orders.get('aic', 1)
    except Exception:
        lag_optimal = 1

    lag_optimal = max(1, min(lag_optimal, safe_maxlags))
    log.info(f"  Lag (mémoire court-terme) verrouillé à : {lag_optimal} "
             f"(max autorisé: {safe_maxlags})")
    return lag_optimal


def valider_modele(df: pd.DataFrame, df_diff: pd.DataFrame,
                   lag: int, diff_lag: int, n_test: int = 6) -> dict:
    """
    Validation hold-out: entraîne sur (n-n_test) points, teste sur les n_test derniers.
    [FIX-3] Retourne le MAPE global ET le MAPE par position dans l'horizon (dégradation).
    [FIX-4] Alerte si MAPE CA > 25% → modèle signalé peu fiable.
    """
    train_diff = df_diff.iloc[:-n_test]
    test_diff  = df_diff.iloc[-n_test:]

    model   = VAR(train_diff)
    results = model.fit(lag)

    forecast_diff = results.forecast(train_diff.values, steps=n_test)

    df_log = np.log(df.replace(0, 1.0))
    actuel_real = df.iloc[-n_test:].copy()
    prevu_real  = []

    for i in range(n_test):
        idx      = actuel_real.index[i]
        lag_idx  = idx - pd.DateOffset(months=diff_lag)
        if lag_idx in df_log.index:
            lag_vals = df_log.loc[lag_idx].values
        else:
            # [FIX-2] Log explicite du fallback
            log.warning(f"  [FALLBACK] lag_date {lag_idx.strftime('%Y-%m')} absent "
                        f"de l'index — utilisation d'un point approché (validation, pas=#{i})")
            lag_vals = df_log.iloc[-(n_test + diff_lag - i)].values

        prevu_log = lag_vals + forecast_diff[i]
        prevu_real.append(np.exp(prevu_log))

    prevu_df = pd.DataFrame(prevu_real,
                            columns=['ca_ttc', 'to_lit', 'adr'],
                            index=actuel_real.index)

    def safe_mape(y_true, y_pred):
        y_true_safe = np.where(y_true == 0, 1.0, y_true)
        return mean_absolute_percentage_error(y_true_safe, y_pred) * 100

    mape_ca  = safe_mape(actuel_real['ca_ttc'], prevu_df['ca_ttc'])
    mape_to  = safe_mape(actuel_real['to_lit'], prevu_df['to_lit'])
    mape_adr = safe_mape(actuel_real['adr'],    prevu_df['adr'])

    # [FIX-3] MAPE par pas dans l'horizon (montre la dégradation)
    mape_par_horizon = []
    for i in range(n_test):
        m = {}
        for col, label in [('ca_ttc', 'ca'), ('to_lit', 'to'), ('adr', 'adr')]:
            vrai  = actuel_real[col].iloc[i]
            prevu = prevu_df[col].iloc[i]
            vrai_safe = vrai if vrai != 0 else 1.0
            m[label] = round(abs(vrai_safe - prevu) / abs(vrai_safe) * 100, 1)
        mape_par_horizon.append({'pas': i + 1, **m})

    log.info(f"  Validation MAPE → CA: {mape_ca:.1f}% | TO: {mape_to:.1f}% | ADR: {mape_adr:.1f}%")

    # [FIX-4] Alerte qualité
    fiabilite = 'excellent' if mape_ca < 10 else 'bon' if mape_ca < 20 else 'acceptable' if mape_ca < 25 else 'peu_fiable'
    if fiabilite == 'peu_fiable':
        log.warning(f"  ⚠️  MAPE CA = {mape_ca:.1f}% > 25% — modèle PEU FIABLE, "
                    f"prévisions à interpréter avec précaution")

    return {
        'mape_ca':          round(mape_ca,  2),
        'mape_to':          round(mape_to,  2),
        'mape_adr':         round(mape_adr, 2),
        'n_test':           n_test,
        'fiabilite':        fiabilite,
        'mape_par_horizon': mape_par_horizon,
    }


def generer_previsions(df: pd.DataFrame, df_diff: pd.DataFrame,
                       lag: int, diff_lag: int, horizon: int = 12) -> pd.DataFrame:
    """
    Entraîne le modèle VAR sur toutes les données et prédit les `horizon` prochains mois.
    [FIX-1] Borne CA et ADR : pas plus de 5× le max historique (protection contre divergence).
    [FIX-2] Fallback lag_date loggé explicitement.
    """
    model   = VAR(df_diff)
    results = model.fit(lag)

    forecast_diff = results.forecast(df_diff.values, steps=horizon)

    # Dates futures
    derniere_date = df.index[-1]
    future_dates  = pd.date_range(
        start=derniere_date + pd.DateOffset(months=1),
        periods=horizon,
        freq='MS'
    )

    # [FIX-1] Bornes de cohérence basées sur l'historique
    ca_max_historique  = df['ca_ttc'].max()
    adr_max_historique = df['adr'].max()
    ca_borne_haute     = ca_max_historique * 5
    adr_borne_haute    = adr_max_historique * 3
    log.info(f"  Bornes de cohérence → CA max: {ca_borne_haute:,.0f} | ADR max: {adr_borne_haute:.1f}")

    df_log = np.log(df.replace(0, 1.0))
    ca_list, to_list, adr_list = [], [], []

    for i in range(horizon):
        lag_date = future_dates[i] - pd.DateOffset(months=diff_lag)

        if lag_date in df_log.index:
            lag_vals = df_log.loc[lag_date].values
        else:
            # [FIX-2] Log explicite du fallback au lieu d'un accès silencieux
            approx_idx = max(-diff_lag + i, -len(df_log))
            log.warning(f"  [FALLBACK] lag_date {lag_date.strftime('%Y-%m')} absent — "
                        f"utilisation de df_log.iloc[{approx_idx}] "
                        f"({df_log.index[approx_idx].strftime('%Y-%m')})")
            lag_vals = df_log.iloc[approx_idx].values

        vals_log = lag_vals + forecast_diff[i]
        vals = np.exp(vals_log)

        # [FIX-1] Application des bornes avec log si dépassement
        ca_brut = max(0, vals[0])
        if ca_brut > ca_borne_haute:
            log.warning(f"  [BORNE CA] {future_dates[i].strftime('%b %Y')}: "
                        f"CA prévu {ca_brut:,.0f} > borne {ca_borne_haute:,.0f} → plafonné")
            ca_brut = ca_borne_haute

        adr_brut = max(0, vals[2])
        if adr_brut > adr_borne_haute:
            log.warning(f"  [BORNE ADR] {future_dates[i].strftime('%b %Y')}: "
                        f"ADR prévu {adr_brut:.1f} > borne {adr_borne_haute:.1f} → plafonné")
            adr_brut = adr_borne_haute

        ca_list.append(ca_brut)
        to_list.append(min(max(0, vals[1]), 1.2))   # TO entre 0 et 120%
        adr_list.append(adr_brut)

    df_prev = pd.DataFrame({
        'ca_prevu':     ca_list,
        'to_prevu':     to_list,
        'adr_prevu':    adr_list,
        'revpar_prevu': [t * a for t, a in zip(to_list, adr_list)]
    }, index=future_dates)

    return df_prev


def generer_recommandations(row: pd.Series) -> dict:
    """
    Génère une recommandation tarifaire automatique basée sur le TO prévu.
    Logique Revenue Management hôtelier standard.
    """
    to = row['to_prevu']

    if to >= 0.90:
        niveau   = 'critique_haut'
        couleur  = 'rouge'
        action   = 'AUGMENTER tarifs +15% — Forte demande'
        priorite = 1
    elif to >= 0.80:
        niveau   = 'eleve'
        couleur  = 'orange'
        action   = 'AUGMENTER tarifs +10% — Bonne demande'
        priorite = 2
    elif to >= 0.65:
        niveau   = 'bon'
        couleur  = 'jaune'
        action   = 'Maintenir tarifs actuels'
        priorite = 3
    elif to >= 0.45:
        niveau   = 'moyen'
        couleur  = 'bleu'
        action   = 'Promotions ciblées — stimuler la demande'
        priorite = 4
    else:
        niveau   = 'bas'
        couleur  = 'vert'
        action   = 'Offres spéciales & packages — basse saison'
        priorite = 5

    return {
        'niveau':   niveau,
        'couleur':  couleur,
        'action':   action,
        'priorite': priorite
    }

# ─── SAUVEGARDE EN BASE ───────────────────────────────────────────────────────
def sauvegarder_previsions(conn, hotel_id: int, df_prev: pd.DataFrame,
                           metriques: dict, hotel_code: str):
    """
    Insère les prévisions dans la table fact_previsions.
    Crée la table si elle n'existe pas.
    [FIX-3] Stocke aussi le MAPE dégradé par horizon (JSON) et la fiabilité.
    """
    cursor = conn.cursor()

    # Création table si nécessaire — ajout colonne fiabilite + mape_par_horizon
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS fact_previsions (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            hotel_id         INT NOT NULL,
            date_id          INT NOT NULL,
            annee            INT NOT NULL,
            mois             INT NOT NULL,
            ca_prevu         DECIMAL(15,3),
            to_prevu         DECIMAL(8,4),
            adr_prevu        DECIMAL(10,2),
            revpar_prevu     DECIMAL(10,2),
            recommandation   VARCHAR(100),
            couleur_alerte   VARCHAR(20),
            action_tarifaire VARCHAR(200),
            mape_ca          DECIMAL(6,2),
            mape_to          DECIMAL(6,2),
            mape_adr         DECIMAL(6,2),
            fiabilite        VARCHAR(20) DEFAULT 'bon',
            mape_par_horizon JSON,
            modele           VARCHAR(50) DEFAULT 'VAR',
            date_calcul      DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_hotel_date (hotel_id, date_id)
        )
    """)

    # Migration silencieuse : ajout colonnes si table existante sans elles
    for col_def in [
        "ALTER TABLE fact_previsions ADD COLUMN IF NOT EXISTS fiabilite VARCHAR(20) DEFAULT 'bon'",
        "ALTER TABLE fact_previsions ADD COLUMN IF NOT EXISTS mape_par_horizon JSON",
    ]:
        try:
            cursor.execute(col_def)
        except Exception:
            pass

    cursor.execute("DELETE FROM fact_previsions WHERE hotel_id = %s", (hotel_id,))

    inserts = 0
    # [FIX-3] Index dans l'horizon pour le MAPE dégradé
    mape_horizon_list = metriques.get('mape_par_horizon', [])

    for pos, (date, row) in enumerate(df_prev.iterrows()):
        date_id = int(date.strftime('%Y%m'))
        annee   = date.year
        mois    = date.month
        reco    = generer_recommandations(row)

        # MAPE dégradé : pour les mois au-delà du hold-out (6), on extrapole
        # la tendance de dégradation observée sur les 6 mois de validation
        mape_horizon_json = None
        if mape_horizon_list:
            if pos < len(mape_horizon_list):
                mape_horizon_json = json.dumps(mape_horizon_list[pos])
            else:
                # Extrapolation : dernier MAPE connu + 2% par mois supplémentaire
                last = mape_horizon_list[-1]
                extra_mois = pos - len(mape_horizon_list) + 1
                mape_horizon_json = json.dumps({
                    'pas':  pos + 1,
                    'ca':   round(last['ca']  + extra_mois * 2, 1),
                    'to':   round(last['to']  + extra_mois * 1, 1),
                    'adr':  round(last['adr'] + extra_mois * 1.5, 1),
                    'extrapolé': True
                })

        cursor.execute("""
            INSERT INTO fact_previsions
                (hotel_id, date_id, annee, mois,
                 ca_prevu, to_prevu, adr_prevu, revpar_prevu,
                 recommandation, couleur_alerte, action_tarifaire,
                 mape_ca, mape_to, mape_adr,
                 fiabilite, mape_par_horizon, modele)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            hotel_id, date_id, annee, mois,
            round(row['ca_prevu'],     3),
            round(row['to_prevu'],     4),
            round(row['adr_prevu'],    2),
            round(row['revpar_prevu'], 2),
            reco['niveau'],
            reco['couleur'],
            reco['action'],
            metriques['mape_ca'],
            metriques['mape_to'],
            metriques['mape_adr'],
            metriques['fiabilite'],
            mape_horizon_json,
            'VAR(1)-SDIFF12'
        ))
        inserts += 1

    conn.commit()
    cursor.close()
    log.info(f"  {inserts} prévisions sauvegardées en base pour {hotel_code}")


def afficher_rapport(hotel_code: str, df_prev: pd.DataFrame, metriques: dict):
    """Affiche un rapport lisible dans le terminal."""
    fiabilite = metriques.get('fiabilite', '?')
    alerte_fiab = " ⚠️  MODÈLE PEU FIABLE" if fiabilite == 'peu_fiable' else ""

    print(f"\n{'=' * 70}")
    print(f"  [HOTEL] PREVISIONS 2026 — {hotel_code}{alerte_fiab}")
    print(f"{'=' * 70}")
    print(f"  Modele    : VAR(1) avec differenciation saisonniere (lag=12)")
    print(f"  Fiabilite : {fiabilite.upper()}")
    print(f"  MAPE CA   : {metriques['mape_ca']:.1f}%  |  "
          f"MAPE TO : {metriques['mape_to']:.1f}%  |  "
          f"MAPE ADR: {metriques['mape_adr']:.1f}%")

    # [FIX-3] Affichage de la dégradation MAPE
    if metriques.get('mape_par_horizon'):
        print(f"\n  Dégradation MAPE par horizon (validation) :")
        for m in metriques['mape_par_horizon']:
            print(f"    Mois +{m['pas']:2d} → CA: {m['ca']:5.1f}% | TO: {m['to']:5.1f}% | ADR: {m['adr']:5.1f}%")

    print(f"\n{'-' * 70}")
    print(f"  {'Mois':<12} {'CA Prevu':>13} {'CA HT':>11} {'TO':>8} {'ADR':>8} {'RevPAR':>9}  Action")
    print(f"{'-' * 70}")

    for date, row in df_prev.iterrows():
        reco = generer_recommandations(row)
        ca_ht = row['ca_prevu'] / TVA_DIVISEUR
        print(f"  {date.strftime('%b %Y'):<12} "
              f"{row['ca_prevu']:>13,.0f} "
              f"{ca_ht:>11,.0f} "
              f"{row['to_prevu']:>7.1%} "
              f"{row['adr_prevu']:>8.1f} "
              f"{row['revpar_prevu']:>9.1f}  "
              f"[{reco['couleur'].upper()}] {reco['action']}")

    total_ca    = df_prev['ca_prevu'].sum()
    total_ca_ht = total_ca / TVA_DIVISEUR
    moy_to  = df_prev['to_prevu'].mean()
    moy_adr = df_prev['adr_prevu'].mean()
    print(f"{'-' * 70}")
    print(f"  {'TOTAL/MOY':<12} {total_ca:>13,.0f} {total_ca_ht:>11,.0f} "
          f"{moy_to:>7.1%} {moy_adr:>8.1f}")
    print(f"{'=' * 70}\n")

# ─── PIPELINE PRINCIPAL ───────────────────────────────────────────────────────
def pipeline_prevision(hotel_code: str, horizon: int = 12,
                       sauvegarder: bool = True) -> dict:
    """
    Pipeline complet : chargement → préparation → VAR → validation → sauvegarde.
    Retourne un dict JSON-serializable avec toutes les prévisions et métriques.
    """
    hotel_info = HOTELS.get(hotel_code.upper())
    if not hotel_info:
        raise ValueError(f"Hôtel inconnu: {hotel_code}. Disponibles: {list(HOTELS.keys())}")

    hotel_id  = hotel_info['id']
    hotel_nom = hotel_info['nom']

    log.info(f"━━━ PRÉVISION {hotel_code} ({hotel_nom}) ━━━")

    conn = get_connection()
    try:
        # 1. Charger données
        df = charger_donnees_hotel(conn, hotel_id)

        if len(df) < 24:
            raise ValueError(f"Données insuffisantes: {len(df)} mois (minimum 24 requis)")

        # 2. Préparer (différenciation)
        df_diff, diff_lag = preparer_donnees(df)

        # 3. Sélectionner lag optimal
        lag = selectionner_lag(df_diff)

        # 4. Valider le modèle
        metriques = valider_modele(df, df_diff, lag, diff_lag)

        # 5. Générer prévisions complètes
        df_prev = generer_previsions(df, df_diff, lag, diff_lag, horizon)

        # 6. Sauvegarder en base
        if sauvegarder:
            sauvegarder_previsions(conn, hotel_id, df_prev, metriques, hotel_code)

        # 7. Afficher rapport terminal
        afficher_rapport(hotel_code, df_prev, metriques)

        # 8. Construire résultat JSON
        previsions_list = []
        mape_horizon = metriques.get('mape_par_horizon', [])

        for pos, (date, row) in enumerate(df_prev.iterrows()):
            reco = generer_recommandations(row)

            # [FIX-3] MAPE estimé pour ce mois précis
            if pos < len(mape_horizon):
                mape_ce_mois = mape_horizon[pos]['ca']
            else:
                last_mape = mape_horizon[-1]['ca'] if mape_horizon else metriques['mape_ca']
                extra = pos - len(mape_horizon) + 1
                mape_ce_mois = round(last_mape + extra * 2, 1)

            previsions_list.append({
                'date_id':        int(date.strftime('%Y%m')),
                'annee':          date.year,
                'mois':           date.month,
                'mois_nom':       date.strftime('%B %Y'),
                'ca_prevu':       round(row['ca_prevu'],     0),
                'ca_prevu_ht':    round(row['ca_prevu'] / TVA_DIVISEUR, 0),
                'to_prevu':       round(row['to_prevu'],     4),
                'adr_prevu':      round(row['adr_prevu'],    2),
                'revpar_prevu':   round(row['revpar_prevu'], 2),
                'recommandation': reco['action'],
                'couleur':        reco['couleur'],
                'niveau':         reco['niveau'],
                'priorite':       reco['priorite'],
                'mape_estime_ca': mape_ce_mois,    # [FIX-3] précision par mois
            })

        return {
            'hotel_id':    hotel_id,
            'hotel_code':  hotel_code,
            'hotel_nom':   hotel_nom,
            'modele':      f'VAR({lag})-SDIFF{diff_lag}',
            'horizon':     horizon,
            'tva_diviseur': TVA_DIVISEUR,           # [FIX-5] exposé dans le JSON
            'metriques': {
                'mape_ca':          metriques['mape_ca'],
                'mape_to':          metriques['mape_to'],
                'mape_adr':         metriques['mape_adr'],
                'n_validation':     metriques['n_test'],
                'fiabilite':        metriques['fiabilite'],  # [FIX-4]
                'mape_par_horizon': mape_horizon,            # [FIX-3]
            },
            'synthese': {
                'ca_total_prevu':    round(df_prev['ca_prevu'].sum(), 0),
                'ca_total_prevu_ht': round(df_prev['ca_prevu'].sum() / TVA_DIVISEUR, 0),
                'to_moyen_prevu':    round(df_prev['to_prevu'].mean(), 4),
                'adr_moyen_prevu':   round(df_prev['adr_prevu'].mean(), 2),
            },
            'previsions':    previsions_list,
            'date_calcul':   datetime.now().isoformat(),
        }

    finally:
        conn.close()


# ─── POINT D'ENTRÉE CLI ──────────────────────────────────────────────────────
if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Prévision VAR multivariée — Azur Hotels BI'
    )
    parser.add_argument('--hotel',
                        default='ALL',
                        help='Code hôtel (RYL, BEL, SOL) ou ALL pour tous')
    parser.add_argument('--mois',
                        type=int,
                        default=12,
                        help='Horizon de prévision en mois (défaut: 12)')
    parser.add_argument('--no-save',
                        action='store_true',
                        help='Ne pas sauvegarder en base (mode test)')
    parser.add_argument('--json',
                        action='store_true',
                        help='Sortie JSON uniquement')
    args = parser.parse_args()

    hotels_a_traiter = (
        [h for h, info in HOTELS.items() if info.get('actif')]
        if args.hotel.upper() == 'ALL'
        else [args.hotel.upper()]
    )

    resultats = {}
    erreurs   = []

    for code in hotels_a_traiter:
        try:
            res = pipeline_prevision(
                hotel_code=code,
                horizon=args.mois,
                sauvegarder=not args.no_save
            )
            resultats[code] = res
        except Exception as e:
            log.error(f"Erreur pour {code}: {e}")
            erreurs.append({'hotel': code, 'erreur': str(e)})

    if args.json:
        print(json.dumps({'resultats': resultats, 'erreurs': erreurs},
                         ensure_ascii=False, indent=2))
    else:
        print(f"\n[OK] Previsions terminees: {len(resultats)} hotel(s) traite(s)")
        if erreurs:
            print(f"[!] Erreurs: {len(erreurs)} hotel(s) en echec")
            for e in erreurs:
                print(f"   - {e['hotel']}: {e['erreur']}")
