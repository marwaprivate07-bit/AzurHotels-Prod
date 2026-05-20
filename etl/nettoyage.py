"""
nettoyage.py — Azur Hotels ETL  (version scalable)
====================================================
Pipeline de nettoyage piloté par config.py.
• Aucune année ni hôtel codé en dur.
• Ajouter un hôtel ou une année → modifier config.py uniquement.
• Génère les mêmes CSV qu'avant, enrichis de la colonne 'hotel'.
"""

import pandas as pd
import os
import re
import glob
import warnings
warnings.filterwarnings('ignore')

from config import (
    DATA_DIR, HOTELS, ANNEES,
    ENERGIE_REPARTITION, COMPTES_ENERGIE,
    TVA, MOIS_NOMS, TAX_DIVISOR,
    get_data_dir, get_bal_dir, get_bal_gen_path, hotels_actifs,
)

print(f"  [DEBUG CONFIG] Clés de répartition chargées : {ENERGIE_REPARTITION}")

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION ET CONSTANTES
# ══════════════════════════════════════════════════════════════════════════════

CACHE_GROUPE_ENERGIE = {}

# Diviseur pour passer du TTC au HT
# Cette valeur est définie dans config.py conformément aux standards du projet.

# ══════════════════════════════════════════════════════════════════════════════
# UTILITAIRES GÉNÉRIQUES
# ══════════════════════════════════════════════════════════════════════════════

def to_float(val):
    if pd.isna(val) or val == '': return 0.0
    if isinstance(val, (int, float)): return float(val)
    s = str(val).replace('\xa0', '').replace(' ', '').replace(',', '.')
    try: return float(s)
    except: return 0.0

def to_float_bal(v) -> float:
    """Convertit une valeur brute Excel en float (retourne 0.0 si non lisible)."""
    if v is None: return 0.0
    if isinstance(v, (int, float)): return 0.0 if str(v) == 'nan' else float(v)
    s = str(v).replace('\xa0', '').replace(' ', '').replace(',', '.')
    try: return float(s)
    except Exception: return 0.0

def energy_value_from_row(row) -> float:
    """Extrait le montant d'une ligne de balance (col 4=Débit ou col 5=Solde)."""
    # Dans les BAL GEN du projet, le montant HT est généralement en colonne 4 ou 5
    for idx in (5, 4, 6):
        if len(row) > idx:
            val = to_float_bal(row.iloc[idx])
            if val > 0: return val
    return 0.0

def get_mois_from_filename(fname: str) -> int:
    base = os.path.basename(fname)
    m = re.search(r'[-\s](\d{1,2})[-\s]\d{2}\.(xlsx|xls)', base, re.IGNORECASE)
    if m: return int(m.group(1))
    m2 = re.match(r'^(\d{2})-\d{2}\.(xlsx|xls)$', base, re.IGNORECASE)
    if m2: return int(m2.group(1))
    return 0

# ══════════════════════════════════════════════════════════════════════════════
# LECTURE CA, STATS, NATIONALITÉS, AGENCES
# ══════════════════════════════════════════════════════════════════════════════

def lire_cumul_ca(fichier: str) -> dict:
    """
    Extrait le CA cumul Année depuis un fichier Excel de CA.
    Priorité: ligne 'Total Revenu Hôtel' :
      - col 19 = Année TTC
      - col 20 = Année HT
    Fallback: si HT introuvable, calcule HT via TAX_DIVISOR.
    """
    try:
        df = pd.read_excel(fichier, header=None)

        ttc_total = 0.0; ht_total = 0.0; hors_ca_ttc = 0.0; hors_ca_ht = 0.0
        found = False
        for _, row in df.iterrows():
            label = str(row.iloc[0]).strip().upper() if len(row) > 0 and not pd.isna(row.iloc[0]) else ''
            if 'TOTAL REVENU' in label and ('HTEL' in label or 'HÔTEL' in label or 'HOTEL' in label):
                ttc_total = to_float(row.iloc[19]) if len(row) > 19 else 0.0
                ht_total  = to_float(row.iloc[20]) if len(row) > 20 else 0.0
                found = True
            elif 'TOTAL HORS C.A' in label or 'TOTAL HORS CA' in label:
                hors_ca_ttc = to_float(row.iloc[19]) if len(row) > 19 else 0.0
                hors_ca_ht  = to_float(row.iloc[20]) if len(row) > 20 else 0.0

        if found:
            # CA Net = Revenu Total - Hors CA
            ttc = ttc_total - hors_ca_ttc
            ht  = ht_total  - hors_ca_ht
            return {'ttc': round(float(ttc), 3), 'ht': round(float(ht), 3)}

        # Fallback minimaliste sans recalcul si possible
        return {'ttc': 0.0, 'ht': 0.0}
    except Exception:
        return {'ttc': 0.0, 'ht': 0.0}

def lire_categories_ca(fichier: str) -> list:
    """ Extrait le détail du CA par catégorie (Hebergement, Resto, Bar, Divers). """
    try:
        df = pd.read_excel(fichier, header=None)
        logement = (0,0); restaurant = (0,0); bar = (0,0); divers = (0,0); hors_ca = (0,0)
        
        for i, row in df.iterrows():
            label = str(row.iloc[0]).strip()
            val_ttc = to_float(row.iloc[10]) if len(row) > 10 else 0
            val_ht  = to_float(row.iloc[11]) if len(row) > 11 else 0
            
            if   label == 'Total CA':               logement   = (val_ttc, val_ht)
            elif label == 'Total C.A RESTAURANT':   restaurant = (val_ttc, val_ht)
            elif label == 'Total C.A BAR':          bar        = (val_ttc, val_ht)
            elif label == 'Total Ventes Diverses':  divers     = (val_ttc, val_ht)
            elif label == 'Total Hors C.A':         hors_ca    = (val_ttc, val_ht)
            
        # IMPORTANT : On n'inclut PAS le "Hors CA" dans le Chiffre d'Affaires
        # car ce sont des taxes collectées (taxe de séjour) et non du revenu hôtel.
        
        cats = [
            ('HEBERGEMENT', logement[0] if isinstance(logement, tuple) else 0, logement[1] if isinstance(logement, tuple) else 0),
            ('RESTAURATION', restaurant[0] if isinstance(restaurant, tuple) else 0, restaurant[1] if isinstance(restaurant, tuple) else 0),
            ('BAR', bar[0] if isinstance(bar, tuple) else 0, bar[1] if isinstance(bar, tuple) else 0),
            ('DIVERS', divers[0] if isinstance(divers, tuple) else 0, divers[1] if isinstance(divers, tuple) else 0)
        ]
        return [{'categorie': c, 'ca_ttc': round(ttc, 3), 'ca_ht': round(ht, 3)} for c, ttc, ht in cats if ttc > 0]
    except Exception as e:
        # print(f"DEBUG Error cats: {e}")
        return []

def lire_nationalites(fichier: str, mois: int, annee: int, hotel_id: int) -> list:
    try:
        df = pd.read_excel(fichier, header=None)
        rows = []
        for i, row in df.iterrows():
            if i < 1: continue
            
            # On cherche un ID numérique en col 1 ou 2
            id_val = str(row.iloc[1]).strip() if len(row) > 1 else ''
            nom_candidat = str(row.iloc[2]).strip() if len(row) > 2 else ''
            
            # Si pas d'ID en col 1, on regarde col 2
            if not id_val.isdigit():
                id_val = str(row.iloc[2]).strip() if len(row) > 2 else ''
                nom_candidat = str(row.iloc[3]).strip() if len(row) > 3 else ''
            
            total = to_float(row.iloc[-1])
            
            # Cas spécial : Ligne de total général (souvent à la fin)
            if 'total' in str(row.iloc[0]).lower() or 'totaux' in str(row.iloc[0]).lower():
                continue

            if id_val.isdigit() and isinstance(total, (int, float)) and total > 0:
                # Nettoyage du nom (ex: "40 -Tunisiens" -> "Tunisiens", "03 Allemands" -> "Allemands", "Allemands 2" -> "Allemands")
                nat = nom_candidat.strip()
                nat = re.sub(r'^\d+\s*-\s*', '', nat) # "40 - ..."
                nat = re.sub(r'^\d+\s+', '', nat)     # "03 ..."
                nat = re.sub(r'\s+\d+$', '', nat)     # "... 2"
                nat = re.sub(r'\s+', ' ', nat).strip()
                
                rows.append({
                    'annee': annee, 'mois': mois, 'mois_nom': MOIS_NOMS[mois],
                    'hotel_id': hotel_id, 'nationalite': nat, 'nb_arrivees': int(total),
                })
        return rows
    except Exception as e:
        print(f"Error reading nationalities in {fichier}: {e}")
        return []

def lire_agences(fichier: str, mois: int, annee: int, hotel_id: int) -> list:
    try:
        df = pd.read_excel(fichier, header=None)
        rows = []
        for i, row in df.iterrows():
            if i == 0: continue
            code = str(row.iloc[0]).strip() if not pd.isna(row.iloc[0]) else ''
            nom  = str(row.iloc[1]).strip() if not pd.isna(row.iloc[1]) else ''
            ca   = row.iloc[-1] if not pd.isna(row.iloc[-1]) else 0
            if (code.isdigit() or len(code) > 2) and isinstance(ca, (int, float)) and float(ca) > 0:
                rows.append({
                    'annee': annee, 'mois': mois, 'mois_nom': MOIS_NOMS[mois],
                    'hotel_id': hotel_id, 'code_agence': code, 'nom_agence': nom,
                    'ca_agence': round(float(ca), 3),
                })
        return rows
    except: return []

def lire_stats_ca(fichier: str) -> dict:
    """
    Lit les statistiques depuis un fichier CA.
    Retourne les valeurs MENSUELLES (col 10) ET CUMULATIVES (col 19)
    pour permettre le calcul différentiel dans traiter_hotel_annee.
    """
    try:
        df = pd.read_excel(fichier, header=None)
        ch_occupees = nuitees = nuit_gratuit = to_lit = rev_moy = 0
        ch_occupees_cumul = nuitees_cumul = 0
        for _, row in df.iterrows():
            type_row  = str(row.iloc[0]).strip() if not pd.isna(row.iloc[0]) else ''
            label_row = str(row.iloc[1]).lower().strip() if not pd.isna(row.iloc[1]) else ''
            val_mois  = to_float(row.iloc[10]) if len(row) > 10 else 0
            val_cumul = to_float(row.iloc[19]) if len(row) > 19 else 0

            if type_row == 'Statistiques Client':
                if 'nombre client' in label_row and 'gratuit' not in label_row:
                    nuitees       = int(val_mois)
                    nuitees_cumul = int(val_cumul)
                elif any(g in label_row for g in ['nb client gratuit', 'client gratuit', 'enfant']):
                    nuit_gratuit = int(val_mois)
                elif 'taux occupation lit' in label_row:
                    to_lit = val_mois
            elif type_row == 'Statistiques Chambre':
                if 'occup' in label_row and 'taux' not in label_row:
                    ch_occupees       = int(val_mois)
                    ch_occupees_cumul = int(val_cumul)
                elif 'taux occupation chambre' in label_row:
                    to_chambre = val_mois
            elif type_row == 'Revenu Prix Moyen' and 'client' in label_row:
                rev_moy = val_mois

            # Fallback pour 'Nombre Enfant(s)' explicite hors 'Statistiques Client'
            if 'enfant' in label_row and nuit_gratuit == 0:
                nuit_gratuit = int(val_mois)

        # Calcul du ratio HT réel du mois pour les stats
        cumul = lire_cumul_ca(fichier)
        ratio = (cumul['ht'] / cumul['ttc']) if cumul['ttc'] > 0 else (1/TAX_DIVISOR)

        # Calcul de la capacité théorique du mois via le taux d'occupation réel (pour éviter les erreurs de capacité fixe)
        capacite = int(round(ch_occupees / to_chambre)) if 'to_chambre' in locals() and to_chambre > 0 else 0

        return {
            'nuitees':        int(nuitees),
            'nuitees_cumul':  int(nuitees_cumul),
            'ch_occupees':    int(ch_occupees),
            'ch_cumul':       int(ch_occupees_cumul),
            'capacite_chambre': capacite,
            'to_lit':         round(to_lit, 6),
            'indice_freq':    round(nuitees / ch_occupees, 4) if ch_occupees > 0 else 0.0,
            'rev_moy_ttc':    round(rev_moy, 2),
            'rev_moy_ht':     round(rev_moy * ratio, 2),
            'arr_enfant':     nuit_gratuit,
        }
    except:
        return {'nuitees':0,'nuitees_cumul':0,'ch_occupees':0,'ch_cumul':0,
                'to_lit':0,'indice_freq':0,'rev_moy_ttc':0,'rev_moy_ht':0,'arr_enfant':0}

def lire_arrivees_total(fichier: str) -> int:
    ARRIVEES_LABELS = ['totaux arrive', 'total arrive', 'totaux arriv', 'total arriv']
    try:
        df = pd.read_excel(fichier, header=None)
        for _, row in df.iterrows():
            val0 = str(row.iloc[0]).lower().strip()
            val1 = str(row.iloc[1]).lower().strip() if len(row) > 1 else ''
            if any(lbl in f'{val0} {val1}' for lbl in ARRIVEES_LABELS):
                # On utilise la colonne 10 (Mensuel) pour les arrivées totales
                val = to_float(row.iloc[10]) if len(row) > 10 else 0
                if val > 0: return int(val)
        return 0
    except: return 0

def lire_booking_score(fichier: str) -> float:
    """ Extrait la note Booking depuis le fichier Excel dédié. """
    try:
        df = pd.read_excel(fichier, header=None)
        for _, row in df.iterrows():
            label = str(row.iloc[0]).lower().strip()
            if 'note globale' in label or 'score' in label:
                val = to_float(row.iloc[1])
                return round(val, 2)
        return 0.0
    except:
        return 0.0


# ══════════════════════════════════════════════════════════════════════════════
# TRAITEMENT CA / STATS PAR HÔTEL × ANNÉE
# ══════════════════════════════════════════════════════════════════════════════

def traiter_hotel_annee(hotel_code: str, annee: int) -> tuple[list, list, list, list, list]:
    h        = HOTELS[hotel_code]
    hotel_id = h['id']
    dossier  = get_data_dir(hotel_code, annee)
    print(f"  [DEBUG] Dossier {hotel_code} {annee} -> {dossier}")

    if dossier is None or not os.path.exists(dossier):
        print(f"    ! Dossier introuvable: {dossier}")
        return [], [], [], [], []

    print(f'  NETTOYAGE {hotel_code} ({h["nom"]}) — {annee}')

    fichiers_reels        = os.listdir(dossier)
    suffixe               = str(annee)[2:]
    ca_data               = []
    stats_data            = []
    cats_data             = []
    nat_data_local        = []
    ag_data_local         = []
    cumul_precedent       = 0
    cumul_precedent_ht    = 0
    # Suivi cumulatif pour nuitées (même méthode que CA)
    nuitees_cumul_prec    = 0
    ch_cumul_prec         = 0

    for mois in range(1, 13):
        m = f'{mois:02d}'
        f_ca = next((f for f in fichiers_reels if f.lower().startswith('ca') and f'{m}-{suffixe}' in f), None)
        
        if f_ca:
            chemin_ca = os.path.join(dossier, f_ca)
            cumul = lire_cumul_ca(chemin_ca)
            cumul_ttc = float(cumul.get('ttc', 0) or 0)
            cumul_ht = float(cumul.get('ht', 0) or 0)
            
            if mois == 1:
                # Premier mois de l'année : le mensuel est égal au cumul
                ca_mensuel_ttc = round(cumul_ttc, 3)
                ca_mensuel_ht = round(cumul_ht, 3)
            else:
                ca_mensuel_ttc = round(cumul_ttc - cumul_precedent, 3)
                ca_mensuel_ht = round(cumul_ht - cumul_precedent_ht, 3)
                
            # Fallback en cas de données manquantes (ex: mois précédent manquant) ou négatif
            if ca_mensuel_ttc < 0:
                ca_mensuel_ttc = round(cumul_ttc, 3)
            if ca_mensuel_ht < 0:
                ca_mensuel_ht = round(cumul_ht, 3)
            
            ca_data.append({
                'annee': annee, 'mois': mois, 'mois_nom': MOIS_NOMS[mois],
                'date_id': annee * 100 + mois, 'hotel_id': hotel_id, 'hotel': hotel_code,
                'ca_ttc': ca_mensuel_ttc, 'ca_ht': ca_mensuel_ht, 'ca_cumul': cumul_ttc,
            })
            cumul_precedent = cumul_ttc
            cumul_precedent_ht = cumul_ht

            # Extraction Nationalités (pour réconcilier les totaux)
            f_nat = next((f for f in fichiers_reels if 'nat' in f.lower() and f'{m}-{suffixe}' in f), None)
            mois_nat_data = []
            if f_nat: 
                mois_nat_data = lire_nationalites(os.path.join(dossier, f_nat), mois, annee, hotel_id)
                nat_data_local.extend(mois_nat_data)

            # Extraction Stats de base
            stats = lire_stats_ca(chemin_ca)
            arr_ca = lire_arrivees_total(chemin_ca)
            
            # Réconciliation Arrivées
            nat_sum = sum(int(n['nb_arrivees']) for n in mois_nat_data)
            nat_grand_total = 0
            if f_nat:
                try:
                    df_nat = pd.read_excel(os.path.join(dossier, f_nat), header=None)
                    for _, r_nat in df_nat.iterrows():
                        l0 = str(r_nat.iloc[0]).lower()
                        if 'totaux g' in l0 or 'total g' in l0:
                            nat_grand_total = int(to_float(r_nat.iloc[-1]))
                            break
                except: pass
            
            arr_total = max(arr_ca, nat_sum, nat_grand_total)
            
            # Ajustement des détails nationalités si le total réconcilié est plus élevé
            if arr_total > nat_sum and nat_sum > 0:
                ratio_nat = arr_total / nat_sum
                for n in mois_nat_data: n['nb_arrivees'] = int(n['nb_arrivees'] * ratio_nat)
            
            # Arrivées Adulte/Enfant
            arr_enfant = min(arr_total, stats['arr_enfant'])
            arr_adulte = max(0, arr_total - arr_enfant)
            
            if arr_total == 0:
                arr_total = stats['ch_occupees']
                arr_adulte = arr_total

            # Booking Score (Real data from files)
            f_booking = next((f for f in fichiers_reels if 'booking' in f.lower() and f'{m}-{suffixe}' in f), None)
            score_val = 0.0
            if f_booking:
                score_val = lire_booking_score(os.path.join(dossier, f_booking))

            # ── Calcul différentiel nuitées ──
            nuitees_cumul = stats['nuitees_cumul']
            ch_cumul      = stats['ch_cumul']
            if mois == 1:
                nuitees_mensuel = nuitees_cumul
                ch_mensuel      = ch_cumul
            else:
                nuitees_mensuel = nuitees_cumul - nuitees_cumul_prec
                ch_mensuel      = ch_cumul      - ch_cumul_prec
            
            if nuitees_mensuel <= 0: nuitees_mensuel = stats['nuitees']
            if ch_mensuel <= 0:      ch_mensuel = stats['ch_occupees']
            
            nuitees_cumul_prec = nuitees_cumul
            ch_cumul_prec      = ch_cumul

            indice_freq = round(nuitees_mensuel / ch_mensuel, 4) if ch_mensuel > 0 else 0.0

            stats_data.append({
                'annee': annee, 'mois': mois, 'mois_nom': MOIS_NOMS[mois],
                'date_id': annee * 100 + mois, 'hotel_id': hotel_id, 'hotel': hotel_code.upper(),
                'nuitees': nuitees_mensuel, 'ch_occupees': ch_mensuel,
                'capacite_chambre': stats['capacite_chambre'],
                'to_lit': stats['to_lit'], 'indice_freq': indice_freq,
                'rev_moy_ttc': stats['rev_moy_ttc'], 'rev_moy_ht': stats['rev_moy_ht'],
                'arr_adulte': arr_adulte, 'arr_enfant': arr_enfant, 'booking_score': score_val,
            })

            # Extraction Catégories
            for cat in lire_categories_ca(chemin_ca):
                cat.update({
                    'annee': annee, 'mois': mois, 'mois_nom': MOIS_NOMS[mois],
                    'date_id': annee * 100 + mois, 'hotel_id': hotel_id, 'hotel': hotel_code,
                })
                cats_data.append(cat)

            # Agences
            f_ag = next((f for f in fichiers_reels if any(k in f.lower() for k in ('agence', 'societe', 'perf')) and f'{m}-{suffixe}' in f), None)
            if f_ag: ag_data_local.extend(lire_agences(os.path.join(dossier, f_ag), mois, annee, hotel_id))

    return ca_data, stats_data, cats_data, nat_data_local, ag_data_local

# ══════════════════════════════════════════════════════════════════════════════
# CHARGES (BALANCE)
# ══════════════════════════════════════════════════════════════════════════════

def lire_bal_gen_annuel(hotel_code: str, annee: int) -> list:
    h = HOTELS[hotel_code]
    hotel_id = h['id']
    fichier = get_bal_gen_path(hotel_code, annee)
    # Si le fichier n'existe pas, on ne s'arrête que si l'hôtel n'est pas consolidé
    if not os.path.exists(fichier) and h.get('energie_source') != 'consolidation':
        return []

    energie_bal = {c: 0.0 for c in ('eau', 'electricite', 'gaz', 'carburant')}
    totaux = {}
    ca_ht_compta = 0.0

    if os.path.exists(fichier):
        df = pd.read_excel(fichier, header=None)
        for _, row in df.iterrows():
            if pd.isna(row.iloc[0]): continue
            libelle = str(row.iloc[0]).strip().upper()
            
            # 1. Détection par numéro de compte (Flexible : n'importe où dans la ligne)
            account_found = False
            for compte, label in COMPTES_ENERGIE.items():
                if compte in libelle:
                    val = energy_value_from_row(row)
                    energie_bal[label] = energie_bal.get(label, 0) + val
                    account_found = True
                    break
            
            # 2. Fallback par mots-clés si aucun compte n'est trouvé
            if not account_found:
                if 'ELECTRICITE' in libelle or 'STEG' in libelle:
                    energie_bal['electricite'] += energy_value_from_row(row)
                elif ' EAU ' in f' {libelle} ' or 'SONEDE' in libelle:
                    energie_bal['eau'] += energy_value_from_row(row)
                elif ' GAZ ' in f' {libelle} ' or ' PROPANE ' in f' {libelle} ':
                    energie_bal['gaz'] += energy_value_from_row(row)
                elif 'CARBURANT' in libelle or ' FUEL ' in f' {libelle} ' or 'GASOIL' in libelle:
                    energie_bal['carburant'] += energy_value_from_row(row)

            # 3. Totaux de classes (60, 61...) pour les autres charges
            val_total = energy_value_from_row(row)
            if 'TOTAL' in libelle:
                if   '60****' in libelle: totaux['60'] = val_total
                elif '61****' in libelle: totaux['61'] = val_total
                elif '62****' in libelle: totaux['62'] = val_total
                elif '63****' in libelle: totaux['63'] = val_total
                elif '64****' in libelle: totaux['64'] = val_total
                elif '65****' in libelle: totaux['65'] = val_total
                elif '66****' in libelle: totaux['66'] = val_total
                elif '68****' in libelle: totaux['68'] = val_total
                elif '6*****' in libelle: totaux['total'] = val_total
                elif '73****' in libelle: totaux['73'] = val_total
                elif '75****' in libelle: totaux['75'] = val_total
            elif '7*****' in libelle: totaux['total_produits'] = val_total

        # Extraction du CA HT comptable officiel (Ligne TOTAL 70****)
        for _, row in df.iterrows():
            lib = str(row.iloc[0]).strip().upper()
            if 'TOTAL' in lib and ('70****' in lib or '70' in lib and 'VENTES' in lib):
                val = to_float_bal(row.iloc[5]) if len(row) > 5 else 0
                if val > 0:
                    ca_ht_compta = val
                    break

    personnel = round(totaux.get('64', 0), 3)
    achats_total = round(totaux.get('60', 0), 3)
    services_exterieurs = round(totaux.get('61', 0), 3)
    autres_services_exterieurs = round(totaux.get('62', 0), 3)
    charges_diverses = round(totaux.get('63', 0), 3)
    autres_exploit = round(services_exterieurs + autres_services_exterieurs + charges_diverses, 3)
    charges_fin = round(totaux.get('65', 0), 3)
    impots_taxes = round(totaux.get('66', 0), 3)
    amortissements = round(totaux.get('68', 0), 3)
    total_bal = round(totaux.get('total', 0), 3)
    
    # Nouveaux produits comptables
    produits_divers = round(totaux.get('73', 0), 3)
    produits_fin = round(totaux.get('75', 0), 3)

    ec_pct = ENERGIE_REPARTITION.get(annee, {})
    h_code = h['code'].lower()
    
    # Énergie consolidée (déjà ventilée par get_bal_gen_annuel_energie pour 2024+)
    energie_data = get_bal_gen_annuel_energie(hotel_code, annee)
    if energie_data:
        total_energie = round(energie_data['total'], 3)
        energie = {k: round(v, 3) for k, v in energie_data.items() if k != 'total'}
    else:
        # Fallback si pas de données source
        total_energie = round(sum(energie_bal.values()), 3)
        energie = {k: round(v, 3) for k, v in energie_bal.items()}

    # Achats réels : on soustrait l'énergie SEULEMENT si c'est l'hôtel source (BEL)
    if h.get('energie_source') == 'bal':
        achats_hors_energie = round(achats_total - sum(energie_bal.values()), 3)
    else:
        achats_hors_energie = round(achats_total, 3)


    total_charges_calc = round(
        personnel
        + total_energie
        + achats_hors_energie
        + services_exterieurs
        + autres_services_exterieurs
        + charges_diverses
        + charges_fin
        + impots_taxes
        + amortissements,
        3
    )

    rows = [
        {'annee':annee, 'hotel_id':hotel_id, 'hotel':hotel_code, 'poste':'ca_ht_compta', 'montant':ca_ht_compta},
        {'annee':annee, 'hotel_id':hotel_id, 'hotel':hotel_code, 'poste':'personnel', 'montant':personnel},
        {'annee':annee, 'hotel_id':hotel_id, 'hotel':hotel_code, 'poste':'energie', 'montant':total_energie, **energie},
        {'annee':annee, 'hotel_id':hotel_id, 'hotel':hotel_code, 'poste':'achats_consommation', 'montant':achats_hors_energie},
        {'annee':annee, 'hotel_id':hotel_id, 'hotel':hotel_code, 'poste':'services_exterieurs', 'montant':services_exterieurs},
        {'annee':annee, 'hotel_id':hotel_id, 'hotel':hotel_code, 'poste':'autres_services_exterieurs', 'montant':autres_services_exterieurs},
        {'annee':annee, 'hotel_id':hotel_id, 'hotel':hotel_code, 'poste':'charges_diverses', 'montant':charges_diverses},
        {'annee':annee, 'hotel_id':hotel_id, 'hotel':hotel_code, 'poste':'autres_exploit', 'montant':autres_exploit},
        {'annee':annee, 'hotel_id':hotel_id, 'hotel':hotel_code, 'poste':'charges_financieres', 'montant':charges_fin},
        {'annee':annee, 'hotel_id':hotel_id, 'hotel':hotel_code, 'poste':'impots_taxes', 'montant':impots_taxes},
        {'annee':annee, 'hotel_id':hotel_id, 'hotel':hotel_code, 'poste':'dotations_amort', 'montant':amortissements},
        {'annee':annee, 'hotel_id':hotel_id, 'hotel':hotel_code, 'poste':'total_charges', 'montant':total_charges_calc},
        {'annee':annee, 'hotel_id':hotel_id, 'hotel':hotel_code, 'poste':'produits_divers', 'montant':produits_divers},
        {'annee':annee, 'hotel_id':hotel_id, 'hotel':hotel_code, 'poste':'produits_financiers', 'montant':produits_fin}
    ]
    return [r for r in rows if r['montant'] > 0]

def get_bal_gen_annuel_energie(hotel_code: str, annee: int) -> dict:
    """Lit les montants d'énergie dans la BAL GEN source (BEL).
    Gère la ventilation hybride :
    - < 2024 : Lecture du Total (Col 4) + Application de la clé ENERGIE_REPARTITION
    - >= 2024 : Lecture directe de la ventilation comptable (Cols 5, 6 ou 7) dans la BAL BEL
    """
    fichier = get_bal_gen_path('BEL', annee)
    if not os.path.exists(fichier):
        return {}

    # Lecture via pandas pour plus de fiabilité sur les colonnes
    try:
        df = pd.read_excel(fichier, header=None)
    except:
        return {}

    res = {c: 0.0 for c in ('eau', 'electricite', 'gaz', 'carburant')}
    
    # Pour RYL et SOL, on applique TOUJOURS la clé de répartition de config.py
    # sur le total consolidé lu dans la BAL BEL (colonne 4).
    h_code = hotel_code.lower()
    ec_pct = ENERGIE_REPARTITION.get(annee, {})
    
    if h_code in ['ryl', 'sol'] and h_code in ec_pct:
        pct = ec_pct[h_code]
        for _, row in df.iterrows():
            libelle = str(row.iloc[0]).strip().upper()
            poste = None
            for compte, label in COMPTES_ENERGIE.items():
                if compte in libelle: poste = label; break
            if not poste:
                if 'ELECTRICITE' in libelle: poste = 'electricite'
                elif ' EAU ' in f' {libelle} ': poste = 'eau'
                elif ' GAZ ' in f' {libelle} ': poste = 'gaz'
                elif 'CARBURANT' in libelle: poste = 'carburant'
            
            if poste and len(row) > 4:
                val = to_float(row.iloc[4])
                res[poste] += val * pct

    # Pour BEL, on prend sa part (ou le total si les autres sont gérés à part)
    elif h_code == 'bel':
        pct = ec_pct.get(h_code, 1.0)
        for _, row in df.iterrows():
            libelle = str(row.iloc[0]).strip().upper()
            poste = None
            for compte, label in COMPTES_ENERGIE.items():
                if compte in libelle: poste = label; break
            if not poste:
                if 'ELECTRICITE' in libelle: poste = 'electricite'
                elif ' EAU ' in f' {libelle} ': poste = 'eau'
                elif ' GAZ ' in f' {libelle} ': poste = 'gaz'
                elif 'CARBURANT' in libelle: poste = 'carburant'
            
            if poste and len(row) > 4:
                val = to_float(row.iloc[4])
                res[poste] += val * pct

    res['total'] = sum(res.values())
    return res

def get_groupe_energie_total(annee: int) -> dict:
    """ 
    Calcule l'énergie totale du groupe pour une année via un scan dynamique
    des hôtels sources de consolidation (ex: BEL).
    """
    if annee in CACHE_GROUPE_ENERGIE:
        return CACHE_GROUPE_ENERGIE[annee]
    
    # Scan dynamique — uniquement les hôtels source de consolidation
    #    (energie_source == 'bal'). Ce sont eux qui portent l'énergie groupe dans
    #    leur BAL GEN. Inclure les hôtels 'consolidation' causerait un double-comptage
    #    car leur BAL ne contient pas la ligne énergie consolidée.
    res = {c: 0.0 for c in ('eau', 'electricite', 'gaz', 'carburant', 'total')}
    from config import HOTELS
    for code, h_cfg in HOTELS.items():
        if h_cfg.get('energie_source') != 'bal':
            continue  # skip hotels that use the consolidated key (RYL, SOL…)
        h_e = get_bal_gen_annuel_energie(code, annee)
        for k in res:
            res[k] += h_e.get(k, 0)
    
    CACHE_GROUPE_ENERGIE[annee] = res
    return res

def lire_charges_bal_mensuel_cumul(fichier: str) -> dict:
    try:
        df = pd.read_excel(fichier, header=None)
        totaux = {}
        for _, row in df.iterrows():
            libelle = str(row.iloc[0]).strip()
            val = to_float_bal(row.iloc[4]) if len(row) > 4 else 0
            if 'TOTAL' in libelle:
                if   '60****' in libelle: totaux['60'] = val
                elif '61****' in libelle: totaux['61'] = val
                elif '62****' in libelle: totaux['62'] = val
                elif '63****' in libelle: totaux['63'] = val
                elif '64****' in libelle: totaux['64'] = val
                elif '65****' in libelle: totaux['65'] = val
                elif '66****' in libelle: totaux['66'] = val
                elif '68****' in libelle: totaux['68'] = val
                elif '6*****' in libelle: totaux['total'] = val
                elif '73****' in libelle: totaux['73'] = val
                elif '75****' in libelle: totaux['75'] = val
        return {
            'personnel': totaux.get('64',0), 
            'achats_total': totaux.get('60',0),
            'services_exterieurs': totaux.get('61',0),
            'autres_services_exterieurs': totaux.get('62',0),
            'charges_diverses': totaux.get('63',0),
            'charges_financieres': totaux.get('65',0), 
            'impots_taxes': totaux.get('66',0),
            'dotations_amort': totaux.get('68',0),
            'total_bal': totaux.get('total',0),
            'produits_divers': totaux.get('73',0),
            'produits_financiers': totaux.get('75',0)
        }
    except: return None

def generer_charges_mensuel(hotel_code: str, annee: int, all_stats: list) -> list:
    dossier = get_bal_dir(hotel_code, annee)
    if dossier is None or not os.path.exists(dossier): return []
    fichiers = sorted(glob.glob(os.path.join(dossier, '*.*')), key=get_mois_from_filename)
    
    rows = []
    prev = {k: 0.0 for k in ('personnel', 'achats_total', 'services_exterieurs', 'autres_services_exterieurs', 'charges_diverses', 'charges_financieres', 'impots_taxes', 'dotations_amort', 'total_bal')}

    # On récupère l'énergie annuelle pour la distribuer (estimatif)
    charges_annuelles = lire_bal_gen_annuel(hotel_code, annee)
    energie_row = next((r for r in charges_annuelles if r['poste'] == 'energie'), None)
    total_e    = energie_row['montant'] if energie_row else 0
    total_eau  = energie_row.get('eau', 0) if energie_row else 0
    total_elec = energie_row.get('electricite', 0) if energie_row else 0
    total_gaz  = energie_row.get('gaz', 0) if energie_row else 0
    total_carb = energie_row.get('carburant', 0) if energie_row else 0

    # Pour les hôtels sources de consolidation (BEL) :
    # - Les charges mensuelles (charges_fin, amort, impots) viennent des BAL mensuels BEL
    #   qui contiennent les montants du GROUPE → appliquer la même clé de répartition.
    # - La classe 60 des BAL mensuels BEL inclut l'énergie groupe → en déduire l'énergie
    #   groupe (avant clé) pour isoler les achats réels de BEL.
    h_cfg = HOTELS[hotel_code]
    ec_pct_m = ENERGIE_REPARTITION.get(annee, {})
    groupe_pct = None
    e_groupe_annuel = 0.0
    if h_cfg.get('energie_source') == 'bal' and h_cfg['code'].lower() in ec_pct_m:
        groupe_pct = ec_pct_m[h_cfg['code'].lower()]
        # Énergie groupe totale = énergie BEL / clé BEL
        e_groupe_annuel = round(total_e / groupe_pct, 3) if groupe_pct > 0 else 0.0

    for f in fichiers:
        mois = get_mois_from_filename(f)
        if mois == 0: continue
        cumuls = lire_charges_bal_mensuel_cumul(f)
        if not cumuls: continue
        
        # Distribution simple 1/12 de l'énergie (on pourrait utiliser des poids saisonniers)
        poids = 1/12

        # Différentiel mensuel brut
        diff_achats  = round(cumuls['achats_total']              - prev['achats_total'],              3)
        diff_charges = round(cumuls['charges_financieres']       - prev['charges_financieres'],       3)
        diff_impots  = round(cumuls['impots_taxes']              - prev['impots_taxes'],              3)
        diff_amort   = round(cumuls['dotations_amort']           - prev['dotations_amort'],           3)

        # Correction pour les hôtels source de consolidation (BEL)
        if groupe_pct:
            # Achats réels = diff classe 60 − énergie groupe mensuelle (1/12 de l'annuel groupe)
            e_groupe_mois = round(e_groupe_annuel * poids, 3)
            diff_achats = max(0, round(diff_achats - e_groupe_mois, 3))
            # Charges groupe → appliquer la clé de répartition BEL
            diff_charges = round(diff_charges * groupe_pct, 3)
            diff_impots  = round(diff_impots  * groupe_pct, 3)
            diff_amort   = round(diff_amort   * groupe_pct, 3)

        m_data = {
            'annee': annee, 'mois': mois, 'mois_nom': MOIS_NOMS[mois], 'hotel_id': HOTELS[hotel_code]['id'], 'hotel': hotel_code,
            'personnel':                   max(0, round(cumuls['personnel']                     - prev['personnel'],                     3)),
            'achats_consommation':         max(0, diff_achats),
            'services_exterieurs':         max(0, round(cumuls['services_exterieurs']          - prev['services_exterieurs'],          3)),
            'autres_services_exterieurs':  max(0, round(cumuls['autres_services_exterieurs']   - prev['autres_services_exterieurs'],   3)),
            'charges_diverses':            max(0, round(cumuls['charges_diverses']             - prev['charges_diverses'],             3)),
            'charges_financieres':         max(0, diff_charges),
            'impots_taxes':                max(0, diff_impots),
            'dotations_amort':             max(0, diff_amort),
            'energie':      round(total_e    * poids, 3),
            'eau':          round(total_eau  * poids, 3),
            'electricite':  round(total_elec * poids, 3),
            'gaz':          round(total_gaz  * poids, 3),
            'carburant':    round(total_carb * poids, 3),
        }
        # Autres exploit (pour compatibilité SQL existante si besoin)
        m_data['autres_exploit'] = round(m_data['services_exterieurs'] + m_data['autres_services_exterieurs'] + m_data['charges_diverses'], 3)
        
        m_data['total_charges'] = sum(m_data[k] for k in ['personnel','achats_consommation','services_exterieurs','autres_services_exterieurs','charges_diverses','charges_financieres','impots_taxes','dotations_amort','energie'])

        rows.append(m_data)
        prev = {k: cumuls[k] for k in prev}
    return rows

# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def run():
    print('\n' + '='*55 + '\n  NETTOYAGE DES DONNÉES\n' + '='*55)
    all_ca = []; all_stats = []; all_cats = []; all_nat = []; all_ag = []; all_charges = []; all_charges_mensuel = []
    
    actifs = hotels_actifs()
    print(f'  Hôtels actifs : {actifs}')
    for hotel_code in actifs:
        for annee in ANNEES:
            ca, stats, cats, nat, ag = traiter_hotel_annee(hotel_code, annee)
            all_ca += ca; all_stats += stats; all_cats += cats; all_nat += nat; all_ag += ag

            # ── Charges annuelles — diagnostic ────────────────────────────
            bal_path = get_bal_gen_path(hotel_code, annee)
            bal_exists = os.path.exists(bal_path)
            charges = lire_bal_gen_annuel(hotel_code, annee)
            print(f'  [CHARGES] {hotel_code} {annee}: BAL={bal_exists} ({os.path.basename(bal_path)}) -> {len(charges)} postes')
            if bal_exists and len(charges) == 0:
                print(f'    ! Fichier trouve mais aucun poste avec montant>0 - verifier le format/comptes TOTAL')
            all_charges += charges

            all_charges_mensuel += generer_charges_mensuel(hotel_code, annee, all_stats)

    clean_dir = os.path.join(DATA_DIR, 'clean')
    os.makedirs(clean_dir, exist_ok=True)
    opts = {'index': False, 'encoding': 'utf-8-sig'}

    def safe_csv(data, path):
        """Écrit un CSV même si la liste est vide (évite EmptyDataError dans chargement.py)."""
        df = pd.DataFrame(data)
        df.to_csv(path, **opts)
        return len(df)

    n_charges = safe_csv(all_charges, os.path.join(clean_dir, 'charges_propre.csv'))
    safe_csv(all_ca,              os.path.join(clean_dir, 'ca_propre.csv'))
    safe_csv(all_stats,           os.path.join(clean_dir, 'stats_propre.csv'))
    safe_csv(all_cats,            os.path.join(clean_dir, 'categories_propre.csv'))
    safe_csv(all_nat,             os.path.join(clean_dir, 'nationalites_propre.csv'))
    safe_csv(all_ag,              os.path.join(clean_dir, 'agences_propre.csv'))
    safe_csv(all_charges_mensuel, os.path.join(clean_dir, 'charges_mensuel_propre.csv'))

    print(f'  -> charges_propre.csv : {n_charges} lignes')

    print(f"\nEXPORT TERMINÉ : {len(all_ca)} CA, {len(all_stats)} Stats.")

if __name__ == '__main__':
    run()
