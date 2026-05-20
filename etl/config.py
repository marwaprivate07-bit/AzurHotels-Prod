"""
config.py — Azur Hotels ETL
============================
FICHIER DE CONFIGURATION CENTRAL.
Toute la logique métier (hôtels, périodes, clés de répartition, poids mensuels)
est définie ici. Aucune valeur codée en dur dans nettoyage.py ou chargement.py.

Pour ajouter un nouvel hôtel  → ajouter une entrée dans HOTELS
Pour ajouter une nouvelle année → mettre à jour ENERGIE_CONSOLIDEE
"""

import os
import csv

# ─── CHEMINS ──────────────────────────────────────────────────────────────────
# BASE est la racine du projet (dossier parent du dossier etl/)
BASE      = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA_DIR  = os.path.join(BASE, 'data')
RAW_DIR   = os.path.join(DATA_DIR, 'raw')   # data/raw/{code}/{annee}/...
ETL_DIR   = os.path.join(BASE, 'etl')

# Diviseur pour passer du TTC au HT (TVA 7% + FDCST 1% = ~8.067% effectif)
TAX_DIVISOR = 1.08067

# ─── HÔTELS ───────────────────────────────────────────────────────────────────
# Chaque hôtel est décrit par :
#   id          : identifiant numérique (hotel_id en base)
#   code        : code court utilisé dans les noms de fichiers (ex: ryl, bel)
#   nom         : nom complet affiché dans les logs
#   data_dir_tpl: sous-dossier des fichiers CA/stats (relatif à DATA_DIR)
#                 None = pas de fichiers CA pour cet hôtel
#   bal_dir_tpl : sous-dossier des BAL mensuels pour les charges
#                 None = pas de BAL mensuel (charges annuelles seulement)
#   energie_source : 'consolidation' (clé de répartition BEL) | 'bal' (lire dans BAL GEN annuel)
#   actif       : True = traité par l'ETL

HOTELS = {
    'RYL': {
        'id':             1,
        'code':           'ryl',
        'nom':            'Royal Azur Thalassa',
        'logo_url':       '',
        'categorie':      '5*',
        'chambres':       230,
        'lits':           460,
        # Répertoire CA/Stats mensuel : data/raw/ryl/{annee}/CA_Stats/
        'data_dir_tpl':   'raw/{code}/{annee}/CA_Stats',
        # Répertoire BAL mensuels    : data/raw/ryl/{annee}/Balances/
        'bal_dir_tpl':    'raw/{code}/{annee}/Balances',
        'energie_source': 'consolidation',  # énergie via clé de répartition (606400/606500 absents dans BAL)
        'actif':          True,
    },
    'BEL': {
        'id':             2,
        'code':           'bel',
        'nom':            'Bel Azur',
        'logo_url':       '',
        'categorie':      '4*',
        'chambres':       280,
        'lits':           560,
        # BEL a aussi des fichiers CA/Stats
        'data_dir_tpl':   'raw/{code}/{annee}/CA_Stats',
        # Répertoire BAL mensuels    : data/raw/bel/{annee}/Balances/
        'bal_dir_tpl':    'raw/{code}/{annee}/Balances',
        'energie_source': 'bal',              # énergie lue dans BAL GEN BEL (annuel)
        'actif':          True,
    },

    'SOL': {
        'id':             3,
        'code':           'sol',
        'nom':            'Sol Azur Beach',
        'logo_url':       '',
        'categorie':      '4*',
        'chambres':       270,
        'lits':           540,
        'data_dir_tpl':   'raw/{code}/{annee}/CA_Stats',
        'bal_dir_tpl':    'raw/{code}/{annee}/Balances',
        'energie_source': 'consolidation', # Energie via clé de répartition (BEL)
        'actif':          True,
    },
}

# ─── PÉRIODES (ANNÉES) ────────────────────────────────────────────────────────
# Liste des années à traiter.
ANNEES = [2023, 2024, 2025]

# ─── BAL GEN (fichiers balance générale annuelle) ────────────────────────────
# Fichiers réels : data/raw/{code}/{annee}/BAL GEN {CODE} {annee}.xlsx
BAL_GEN_PATTERN = os.path.join(RAW_DIR, '{code}', '{annee}', 'BAL GEN {CODE} {annee}.xlsx')

# Surcharges manuelles si un fichier ne respecte pas le pattern :
BAL_GEN_OVERRIDES = {
    # ('SOL', 2023): '/chemin/complet/vers/le/fichier.xlsx',
}

# ─── CLÉS DE RÉPARTITION ÉNERGIE ─────────────────────────────────────────────
# L'énergie est facturée sous BEL AZUR (entité consolidée regroupant 4 hôtels).
# La clé de répartition est validée par le rapport du conseil d'administration.
ENERGIE_CONSOLIDEE = {
    # ✅ FIX 6 — Virgule décimale corrigée : 0,27 → 0.27  (Python utilise le point)
    2023: {'ryl': 0.23, 'bel': 0.50, 'sol': 0.27},
    2024: {'ryl': 0.25, 'bel': 0.46, 'sol': 0.29},
    # ✅ FIX 6 — Idem pour 2025 : 0,30 → 0.30
    2025: {'ryl': 0.24, 'bel': 0.47, 'sol': 0.30},
}

# Fichiers de paramétrage dans data/ (modifiables sans changer le code)
ENERGIE_REPARTITION_CSV = os.path.join(DATA_DIR, 'raw', 'repartition_energie.csv')
ENERGIE_SOURCE_CSV      = os.path.join(DATA_DIR, 'raw', 'energie_consolidee.csv')


# ─── COMPTES COMPTABLES ───────────────────────────────────────────────────────
COMPTES_ENERGIE = {
    '606400': 'eau',
    '606500': 'electricite',
    '606501': 'gaz',
    '606502': 'carburant',
}

# ─── TVA ──────────────────────────────────────────────────────────────────────
TVA = 1.07

# ─── NOMS DES MOIS ────────────────────────────────────────────────────────────
MOIS_NOMS = {
    1: 'Janvier',   2: 'Fevrier',   3: 'Mars',
    4: 'Avril',     5: 'Mai',       6: 'Juin',
    7: 'Juillet',   8: 'Aout',      9: 'Septembre',
    10: 'Octobre',  11: 'Novembre', 12: 'Decembre',
}

# ─── HELPERS ──────────────────────────────────────────────────────────────────

def get_data_dir(hotel_code: str, annee: int) -> str | None:
    """Retourne le chemin absolu du dossier de données CA/stats pour un hôtel/année."""
    h = HOTELS.get(hotel_code, {})
    tpl = h.get('data_dir_tpl')
    if tpl is None:
        return None
    folder = tpl.format(annee=annee, code=h['code'])
    return os.path.join(DATA_DIR, folder)


def get_bal_dir(hotel_code: str, annee: int) -> str | None:
    """Retourne le chemin absolu du dossier BAL mensuel pour un hôtel/année."""
    h = HOTELS.get(hotel_code, {})
    tpl = h.get('bal_dir_tpl')
    if tpl is None:
        return None
    folder = tpl.format(annee=annee, code=h['code'])
    return os.path.join(DATA_DIR, folder)


def get_bal_gen_path(hotel_code: str, annee: int) -> str:
    """Retourne le chemin du fichier BAL GEN annuel.
    Cherche d'abord dans data/raw/{code}/{annee}/ (emplacement canonique),
    puis parcourt récursivement data/raw/{code}/ comme fallback.
    """
    key = (hotel_code, annee)
    if key in BAL_GEN_OVERRIDES:
        return BAL_GEN_OVERRIDES[key]

    code_lower = hotel_code.lower()
    annee_str  = str(annee)
    annee_court = annee_str[-2:]

    # 1. Chercher dans le dossier canonique : data/raw/{code}/{annee}/
    canon_dir = os.path.join(RAW_DIR, code_lower, annee_str)
    if os.path.exists(canon_dir):
        for f in os.listdir(canon_dir):
            if not (f.endswith('.xls') or f.endswith('.xlsx')):
                continue
            f_lower = f.lower()
            # Doit contenir le code hôtel ET l'année ET "bal gen"
            if ('bal gen' in f_lower or 'balgen' in f_lower) and \
               code_lower in f_lower and \
               (annee_str in f_lower or annee_court in f_lower):
                return os.path.join(canon_dir, f)

    # 2. Fallback : parcours récursif de data/raw/{code}/
    hotel_raw = os.path.join(RAW_DIR, code_lower)
    if os.path.exists(hotel_raw):
        for root, _, files in os.walk(hotel_raw):
            for f in files:
                if not (f.endswith('.xls') or f.endswith('.xlsx')):
                    continue
                f_lower = f.lower()
                if ('bal gen' in f_lower or 'balgen' in f_lower) and \
                   code_lower in f_lower and \
                   (annee_str in f_lower or annee_court in f_lower):
                    return os.path.join(root, f)

    # 3. Chemin par défaut (fichier absent → lire_bal_gen_annuel retournera [])
    return BAL_GEN_PATTERN.format(
        code=code_lower, CODE=hotel_code.upper(), annee=annee
    )


def hotels_actifs():
    """Retourne la liste des codes hôtels actifs."""
    return [code for code, h in HOTELS.items() if h.get('actif', False)]



def load_energie_repartition() -> dict:
    """Charge les clés de répartition énergie depuis CSV (annee -> hotel_code -> pct)."""
    repartition = {k: dict(v) for k, v in ENERGIE_CONSOLIDEE.items()}
    if not os.path.exists(ENERGIE_REPARTITION_CSV):
        return repartition

    with open(ENERGIE_REPARTITION_CSV, mode='r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                annee = int(row.get('annee', 0))
                hotel = str(row.get('hotel', '')).strip().lower()
                pct = float(row.get('pct', 0))
            except Exception:
                continue
            if annee <= 0 or not hotel:
                continue
            repartition.setdefault(annee, {})
            repartition[annee][hotel] = pct
    return repartition


ENERGIE_REPARTITION = load_energie_repartition()
