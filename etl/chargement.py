"""
chargement.py — Azur Hotels ETL  (version scalable)
=====================================================
Charge les CSV générés par nettoyage.py dans MySQL.
Piloté par config.py : aucun hôtel ni année codé en dur.
"""

import pandas as pd
import mysql.connector
import os
import warnings
warnings.filterwarnings('ignore')

from config import DATA_DIR, HOTELS, ANNEES, ENERGIE_CONSOLIDEE, hotels_actifs


def safe_read_csv(path: str) -> pd.DataFrame:
    """Lit un CSV et retourne un DataFrame vide sans planter si le fichier est vide."""
    try:
        return pd.read_csv(path)
    except Exception as e:
        print(f'  [WARN] {os.path.basename(path)} : {e} — ignoré')
        return pd.DataFrame()



# ══════════════════════════════════════════════════════════════════════════════
# 1. CONNEXION
# ══════════════════════════════════════════════════════════════════════════════

# Load .env manually to avoid python-dotenv dependency
env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            if '=' in line and not line.strip().startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ[k] = v

try:
    conn = mysql.connector.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 3306)),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASS', ''),
        database=os.getenv('DB_NAME', 'azur_hotels'),
    )
    cursor = conn.cursor()
    print('OK Connexion MySQL réussie !')
except Exception as e:
    print(f'ERREUR : {e}')
    exit(1)


# ══════════════════════════════════════════════════════════════════════════════
# 1.5. POPULATION dim_date (idempotent)
# ══════════════════════════════════════════════════════════════════════════════

MOIS_NOM = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre']
SAISONS = {1:'Basse', 2:'Basse', 3:'Basse', 4:'Moyenne', 5:'Moyenne', 6:'Haute', 7:'Haute', 8:'Haute', 9:'Haute', 10:'Moyenne', 11:'Basse', 12:'Basse'}
TRIMESTRES = {1:1, 2:1, 3:1, 4:2, 5:2, 6:2, 7:3, 8:3, 9:3, 10:4, 11:4, 12:4}

for annee in ANNEES:
    for mois in range(1, 13):
        date_id = int(f"{annee}{mois:02d}")
        cursor.execute("SELECT 1 FROM dim_date WHERE date_id = %s", (date_id,))
        if not cursor.fetchone():
            cursor.execute('''
                INSERT INTO dim_date (date_id, annee, mois, mois_nom, trimestre, saison, date_complete)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''', (
                date_id, annee, mois, MOIS_NOM[mois-1],
                str(TRIMESTRES[mois]), SAISONS[mois], f"{annee}-{mois:02d}-01"
            ))
conn.commit()

# ══════════════════════════════════════════════════════════════════════════════
# 2. CRÉATION DES TABLES (idempotent)
# ══════════════════════════════════════════════════════════════════════════════

# Population dim_hotel si vide
cursor.execute("CREATE TABLE IF NOT EXISTS dim_hotel (hotel_id INT AUTO_INCREMENT PRIMARY KEY, code_hotel VARCHAR(10) UNIQUE, nom_hotel VARCHAR(100), categorie VARCHAR(10), nb_chambres INT, nb_lits INT, logo_url VARCHAR(500))")
for code_key, h in HOTELS.items():
    cursor.execute("INSERT INTO dim_hotel (hotel_id, code_hotel, nom_hotel, categorie, nb_chambres, nb_lits, logo_url) VALUES (%s, %s, %s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE nom_hotel=VALUES(nom_hotel), categorie=VALUES(categorie), nb_chambres=VALUES(nb_chambres), nb_lits=VALUES(nb_lits), logo_url=VALUES(logo_url)", 
                  (h['id'], code_key, h['nom'], h.get('categorie'), h.get('chambres'), h.get('lits'), h.get('logo_url')))
conn.commit()

cursor.execute("DROP TABLE IF EXISTS fact_charges")
cursor.execute("DROP TABLE IF EXISTS fact_charges_mensuel")
cursor.execute("DROP TABLE IF EXISTS fact_revenus")
cursor.execute("DROP TABLE IF EXISTS fact_revenus_categorie")
cursor.execute("DROP TABLE IF EXISTS fact_stats")
cursor.execute("DROP TABLE IF EXISTS fact_nationalites")
cursor.execute("DROP TABLE IF EXISTS fact_agences")

cursor.execute("""
CREATE TABLE IF NOT EXISTS dim_poste_charge (
    poste_id INT AUTO_INCREMENT PRIMARY KEY,
    code_poste VARCHAR(50) NOT NULL UNIQUE,
    nom_poste VARCHAR(100),
    categorie VARCHAR(50) DEFAULT 'Exploitation'
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS fact_charges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date_id INT,
    annee INT NOT NULL,
    mois INT DEFAULT 0,
    hotel_id INT NOT NULL,
    poste_id INT NOT NULL,
    montant DECIMAL(18,3) DEFAULT 0,
    INDEX idx_date (date_id),
    INDEX idx_annee (annee),
    INDEX idx_mois (mois),
    INDEX idx_hotel (hotel_id),
    INDEX idx_poste (poste_id),
    CONSTRAINT fk_charges_hotel FOREIGN KEY (hotel_id) REFERENCES dim_hotel (hotel_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_charges_poste FOREIGN KEY (poste_id) REFERENCES dim_poste_charge (poste_id) ON DELETE CASCADE ON UPDATE CASCADE
)
""")

conn.commit()

cursor.execute("""
CREATE TABLE IF NOT EXISTS fact_revenus (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    date_id     INT NOT NULL,
    hotel_id    INT NOT NULL,
    ca_ttc      DECIMAL(18,3) DEFAULT 0,
    ca_ht       DECIMAL(18,3) DEFAULT 0,
    ca_cumul    DECIMAL(18,3) DEFAULT 0,
    INDEX idx_date  (date_id),
    INDEX idx_hotel (hotel_id),
    CONSTRAINT fk_revenus_date FOREIGN KEY (date_id) REFERENCES dim_date (date_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_revenus_hotel FOREIGN KEY (hotel_id) REFERENCES dim_hotel (hotel_id) ON DELETE CASCADE ON UPDATE CASCADE
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS fact_revenus_categorie (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    date_id     INT NOT NULL,
    hotel_id    INT NOT NULL,
    categorie   VARCHAR(50),
    ca_ttc      DECIMAL(18,3) DEFAULT 0,
    ca_ht       DECIMAL(18,3) DEFAULT 0,
    INDEX idx_date      (date_id),
    INDEX idx_hotel     (hotel_id),
    INDEX idx_categorie (categorie),
    CONSTRAINT fk_revcat_date FOREIGN KEY (date_id) REFERENCES dim_date (date_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_revcat_hotel FOREIGN KEY (hotel_id) REFERENCES dim_hotel (hotel_id) ON DELETE CASCADE ON UPDATE CASCADE
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS fact_stats (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    date_id     INT NOT NULL,
    hotel_id    INT NOT NULL,
    nuitees     INT DEFAULT 0,
    ch_occupees INT DEFAULT 0,
    capacite_chambre INT DEFAULT 0,
    to_lit      DECIMAL(10,4) DEFAULT 0,
    indice_freq DECIMAL(10,4) DEFAULT 0,
    rev_moy_ttc DECIMAL(10,2) DEFAULT 0,
    rev_moy_ht  DECIMAL(10,2) DEFAULT 0,
    arr_adulte  INT DEFAULT 0,
    arr_enfant  INT DEFAULT 0,
    booking_score DECIMAL(5,2) DEFAULT 0,
    INDEX idx_date (date_id),
    INDEX idx_hotel (hotel_id),
    CONSTRAINT fk_stats_date FOREIGN KEY (date_id) REFERENCES dim_date (date_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_stats_hotel FOREIGN KEY (hotel_id) REFERENCES dim_hotel (hotel_id) ON DELETE CASCADE ON UPDATE CASCADE
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS fact_nationalites (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    date_id     INT NOT NULL,
    hotel_id    INT NOT NULL,
    nat_id      INT NOT NULL,
    nb_arrivees INT DEFAULT 0,
    INDEX idx_date (date_id),
    INDEX idx_hotel (hotel_id),
    INDEX idx_nat (nat_id),
    CONSTRAINT fk_nat_date FOREIGN KEY (date_id) REFERENCES dim_date (date_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_nat_hotel FOREIGN KEY (hotel_id) REFERENCES dim_hotel (hotel_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_nat_dimension FOREIGN KEY (nat_id) REFERENCES dim_nationalite (nat_id) ON DELETE CASCADE ON UPDATE CASCADE
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS fact_agences (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    date_id     INT NOT NULL,
    hotel_id    INT NOT NULL,
    agence_id   INT NOT NULL,
    ca_agence   DECIMAL(18,3) DEFAULT 0,
    INDEX idx_date (date_id),
    INDEX idx_hotel (hotel_id),
    INDEX idx_agence (agence_id),
    CONSTRAINT fk_agences_date FOREIGN KEY (date_id) REFERENCES dim_date (date_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_agences_hotel FOREIGN KEY (hotel_id) REFERENCES dim_hotel (hotel_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_agences_agence FOREIGN KEY (agence_id) REFERENCES dim_agence (agence_id) ON DELETE CASCADE ON UPDATE CASCADE
)
""")

conn.commit()


# ══════════════════════════════════════════════════════════════════════════════
# 3. VIDAGE
# ══════════════════════════════════════════════════════════════════════════════

cursor.execute('SET FOREIGN_KEY_CHECKS = 0;')
cursor.execute('TRUNCATE TABLE fact_charges;')
# fact_charges_mensuel is deleted
cursor.execute('TRUNCATE TABLE fact_stats;')
cursor.execute('TRUNCATE TABLE fact_revenus;')
cursor.execute('TRUNCATE TABLE fact_revenus_categorie;')
cursor.execute('TRUNCATE TABLE fact_nationalites;')
cursor.execute('TRUNCATE TABLE fact_agences;')
cursor.execute('TRUNCATE TABLE dim_nationalite;')
cursor.execute('SET FOREIGN_KEY_CHECKS = 1;')


# ══════════════════════════════════════════════════════════════════════════════
# 4. DIM POSTE CHARGE
# ══════════════════════════════════════════════════════════════════════════════
print('\nChargement dim_poste_charge…')
postes = [
    ('ca_ht_compta', 'Chiffre d''Affaires HT Compta', 'Revenus'),
    ('produits_divers', 'Produits Divers', 'Revenus'),
    ('produits_financiers', 'Produits Financiers', 'Revenus'),
    ('personnel', 'Frais de Personnel', 'Exploitation'),
    ('energie', 'Energie Globale', 'Energie'),
    ('eau', 'Eau', 'Energie'),
    ('electricite', 'Electricité', 'Energie'),
    ('gaz', 'Gaz', 'Energie'),
    ('carburant', 'Carburant', 'Energie'),
    ('achats_consommation', 'Achats Consommation', 'Exploitation'),
    ('services_exterieurs', 'Services Extérieurs', 'Exploitation'),
    ('autres_services_exterieurs', 'Autres Services Ext.', 'Exploitation'),
    ('charges_diverses', 'Charges Diverses', 'Exploitation'),
    ('autres_exploit', 'Autres Charges Exploitation', 'Exploitation'),
    ('charges_financieres', 'Charges Financières', 'Financier'),
    ('impots_taxes', 'Impôts et Taxes', 'Fiscale'),
    ('dotations_amort', 'Dotations aux Amortissements', 'Amortissement'),
    ('total_charges', 'Total Charges', 'Total')
]
for code, nom, cat in postes:
    cursor.execute('''
        INSERT INTO dim_poste_charge (code_poste, nom_poste, categorie)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE nom_poste=VALUES(nom_poste), categorie=VALUES(categorie)
    ''', (code, nom, cat))
conn.commit()

cursor.execute('SELECT code_poste, poste_id FROM dim_poste_charge')
poste_map = {row[0]: row[1] for row in cursor.fetchall()}

# ══════════════════════════════════════════════════════════════════════════════
# 4b. CHARGES ANNUELLES
# ══════════════════════════════════════════════════════════════════════════════

print('\nChargement charges annuelles…')
clean_dir = os.path.join(DATA_DIR, 'clean')
df_charges = safe_read_csv(os.path.join(clean_dir, 'charges_propre.csv'))

for _, row in df_charges.iterrows():
    poste_code = str(row['poste'])
    if poste_code not in poste_map:
        continue
        
    poste_id = poste_map[poste_code]
    montant = float(row['montant'])
    
    cursor.execute(
        'INSERT INTO fact_charges (date_id, annee, mois, hotel_id, poste_id, montant) '
        'VALUES (%s, %s, %s, %s, %s, %s)',
        (int(row['annee']) * 100, int(row['annee']), 0, int(row['hotel_id']), poste_id, montant)
    )

    if poste_code == 'energie':
        for sub_poste in ['eau', 'electricite', 'gaz', 'carburant']:
            val = float(row.get(sub_poste, 0) or 0)
            if val != 0:
                cursor.execute(
                    'INSERT INTO fact_charges (date_id, annee, mois, hotel_id, poste_id, montant) '
                    'VALUES (%s, %s, %s, %s, %s, %s)',
                    (int(row['annee']) * 100, int(row['annee']), 0, int(row['hotel_id']), poste_map[sub_poste], val)
                )

print(f'  OK {len(df_charges)} lignes charges annuelles')

# ══════════════════════════════════════════════════════════════════════════════
# 5. CHARGES MENSUELLES
# ══════════════════════════════════════════════════════════════════════════════

print('\nChargement charges mensuelles…')
df_cm = safe_read_csv(os.path.join(clean_dir, 'charges_mensuel_propre.csv'))

for _, row in df_cm.iterrows():
    annee = int(row['annee'])
    mois = int(row['mois'])
    hotel_id = int(row['hotel_id'])
    
    cols = ['personnel', 'energie', 'eau', 'electricite', 'gaz', 'carburant', 
            'achats_consommation', 'services_exterieurs', 'autres_services_exterieurs', 
            'charges_diverses', 'autres_exploit', 'charges_financieres', 
            'impots_taxes', 'dotations_amort', 'total_charges']
            
    for col in cols:
        val = float(row.get(col, 0) or 0)
        if val != 0 and col in poste_map:
            cursor.execute(
                'INSERT INTO fact_charges (date_id, annee, mois, hotel_id, poste_id, montant) '
                'VALUES (%s, %s, %s, %s, %s, %s)',
                (annee * 100 + mois, annee, mois, hotel_id, poste_map[col], val)
            )

print(f'  OK {len(df_cm)} mois insérés pour charges mensuelles')


# ══════════════════════════════════════════════════════════════════════════════
# 6. STATS MENSUELLES
# ══════════════════════════════════════════════════════════════════════════════

print('\nChargement stats mensuelles…')
df_stats = safe_read_csv(os.path.join(clean_dir, 'stats_propre.csv'))

for _, row in df_stats.iterrows():
    cursor.execute(
        'INSERT INTO fact_stats '
        '(date_id, hotel_id, nuitees, ch_occupees, capacite_chambre, to_lit, indice_freq, '
        'rev_moy_ttc, rev_moy_ht, arr_adulte, arr_enfant, booking_score) '
        'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
        (
            int(row['date_id']),
            int(row['hotel_id']),
            int(row.get('nuitees',        0) or 0),
            int(row.get('ch_occupees',    0) or 0),
            int(row.get('capacite_chambre', 0) or 0),
            float(row.get('to_lit',       0) or 0),
            float(row.get('indice_freq',  0) or 0),
            float(row.get('rev_moy_ttc',  0) or 0),
            float(row.get('rev_moy_ht',   0) or 0),
            int(row.get('arr_adulte',     0) or 0),
            int(row.get('arr_enfant',     0) or 0),
            float(row.get('booking_score', 0) or 0),
        )
    )

print(f'  OK {len(df_stats)} stats mensuelles')

# Vérification globale
cursor.execute("""
    SELECT hotel_id, SUM(arr_adulte), SUM(arr_enfant), SUM(nuitees)
    FROM fact_stats
    GROUP BY hotel_id ORDER BY hotel_id
""")
for r in cursor.fetchall():
    print(f'  [CHECK] hotel_id={r[0]}: arr_adulte={r[1]:,} | arr_enfant={r[2]:,} | nuitees={r[3]:,}')


# ══════════════════════════════════════════════════════════════════════════════
# 7. CA (REVENUS)
# ══════════════════════════════════════════════════════════════════════════════
print('\nChargement CA…')
df_ca = safe_read_csv(os.path.join(clean_dir, 'ca_propre.csv'))
for _, row in df_ca.iterrows():
    date_id = int(f"{row['annee']}{row['mois']:02d}")
    cursor.execute(
        'INSERT INTO fact_revenus (date_id, hotel_id, ca_ttc, ca_ht, ca_cumul) VALUES (%s, %s, %s, %s, %s)',
        (date_id, int(row['hotel_id']), float(row.get('ca_ttc', 0) or 0), float(row.get('ca_ht', 0) or 0), float(row.get('ca_cumul', 0) or 0))
    )
print(f'  OK {len(df_ca)} CA mensuels')

# ══════════════════════════════════════════════════════════════════════════════
# 8. CATEGORIES
# ══════════════════════════════════════════════════════════════════════════════
print('\nChargement Categories…')
df_cats = safe_read_csv(os.path.join(clean_dir, 'categories_propre.csv'))
for _, row in df_cats.iterrows():
    date_id = int(f"{row['annee']}{row['mois']:02d}")
    cursor.execute(
        'INSERT INTO fact_revenus_categorie (date_id, hotel_id, categorie, ca_ttc, ca_ht) VALUES (%s, %s, %s, %s, %s)',
        (date_id, int(row['hotel_id']), str(row['categorie']), float(row.get('ca_ttc', 0) or 0), float(row.get('ca_ht', 0) or 0))
    )
print(f'  OK {len(df_cats)} categories')

# ══════════════════════════════════════════════════════════════════════════════
# 9. NATIONALITES
# ══════════════════════════════════════════════════════════════════════════════
print('\nChargement Nationalités…')
df_nat = safe_read_csv(os.path.join(clean_dir, 'nationalites_propre.csv'))
cursor.execute("SELECT nom_nat, nat_id FROM dim_nationalite")
nat_map = {row[0]: row[1] for row in cursor.fetchall()}

for _, row in df_nat.iterrows():
    nat_name = str(row['nationalite'])
    if nat_name not in nat_map:
        cursor.execute('INSERT INTO dim_nationalite (nom_nat) VALUES (%s)', (nat_name,))
        nat_map[nat_name] = cursor.lastrowid
    
    date_id = int(f"{row['annee']}{row['mois']:02d}")
    cursor.execute(
        'INSERT INTO fact_nationalites (date_id, hotel_id, nat_id, nb_arrivees) VALUES (%s, %s, %s, %s)',
        (date_id, int(row['hotel_id']), nat_map[nat_name], int(row.get('nb_arrivees', 0) or 0))
    )
print(f'  OK {len(df_nat)} nationalites')

# ══════════════════════════════════════════════════════════════════════════════
# 10. AGENCES
# ══════════════════════════════════════════════════════════════════════════════
print('\nChargement Agences…')
df_ag = safe_read_csv(os.path.join(clean_dir, 'agences_propre.csv'))
cursor.execute("SELECT code_agence, agence_id FROM dim_agence")
ag_map = {row[0]: row[1] for row in cursor.fetchall()}

for _, row in df_ag.iterrows():
    code_ag = str(row['code_agence'])
    nom_ag = str(row['nom_agence'])
    if code_ag not in ag_map:
        cursor.execute('INSERT INTO dim_agence (code_agence, nom_agence) VALUES (%s, %s)', (code_ag, nom_ag))
        ag_map[code_ag] = cursor.lastrowid
    
    date_id = int(f"{row['annee']}{row['mois']:02d}")
    cursor.execute(
        'INSERT INTO fact_agences (date_id, hotel_id, agence_id, ca_agence) VALUES (%s, %s, %s, %s)',
        (date_id, int(row['hotel_id']), ag_map[code_ag], float(row.get('ca_agence', 0) or 0))
    )
print(f'  OK {len(df_ag)} agences')

# ══════════════════════════════════════════════════════════════════════════════
# ══════════════════════════════════════════════════════════════════════════════
# 11. AGGREGATE ENERGY FROM MONTHLY TO ANNUEL (DÉSACTIVÉ - On garde le détail BAL GEN)
# ══════════════════════════════════════════════════════════════════════════════
# print('\nAggregating annual energy from monthly data…')
# cursor.execute('SELECT hotel_id, annee, SUM(energie) AS total_e, SUM(eau) AS total_eau, SUM(electricite) AS total_elec, SUM(gaz) AS total_gaz, SUM(carburant) AS total_c FROM fact_charges_mensuel GROUP BY hotel_id, annee')
# for hid, annee, total_e, total_eau, total_elec, total_gaz, total_c in cursor.fetchall():
#     cursor.execute('SELECT code_hotel FROM dim_hotel WHERE hotel_id = %s', (hid,))
#     hotel_code_row = cursor.fetchone()
#     hotel_code = hotel_code_row[0] if hotel_code_row else ''
#     cursor.execute('DELETE FROM fact_charges WHERE hotel_id = %s AND annee = %s AND poste = %s', (hid, annee, 'energie'))
#     cursor.execute(
#         'INSERT INTO fact_charges (annee, hotel_id, hotel, poste, montant, eau, electricite, gaz, carburant) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)',
#         (annee, hid, hotel_code, 'energie', total_e or 0, total_eau or 0, total_elec or 0, total_gaz or 0, total_c or 0)
#     )
# print(f'  OK energy aggregation completed for {cursor.rowcount} rows')
# ══════════════════════════════════════════════════════════════════════════════

conn.commit()
print('\nDATA WAREHOUSE READY OK')

cursor.close()
conn.close()
