import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, ReferenceLine, Cell, LabelList
} from "recharts";
import {
  getStatsMensuel, getStatsKpi, getStatsCompar, getStatsYtd,
  getArrivees, getNationalites, getAgences
} from "../services/api";
import KpiCard from "../components/KpiCard";
import { useDashboard } from "../components/DashboardContext";
import { IconBed, IconUsers, IconOccupancy, IconBuilding, IconCoins, IconLayers, IconUser, IconStar, IconUserMinus, IconHeart, IconSun, IconCloudSun, IconSnowflake, IconAlertCircle, IconCrown, IconGem, IconRocket, IconSparkles, IconLeaf, IconTarget } from "../components/KpiIcons";
import ChartCard from "../components/ChartCard";
import EditableText from "../components/EditableText";
import MapNationalites from "../components/MapNationalites";
import mockRoyalData from "../data/mock_royal_stats.json";

const fmt = (v, dec = 0) => {
  const num = parseFloat(v || 0);
  const fixed = num.toFixed(dec);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return parts.join(',');
};
const fmtK = (v) => `${(parseFloat(v || 0) / 1000).toFixed(1)} K`;
const fmtTND = v => {
  const num = Math.round(Number(v || 0));
  const s = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return <>{s} <span style={{ fontSize: '0.75em', opacity: 0.8, fontWeight: 700 }}>TND</span></>;
};
const fmtTNDSmall = v => fmtTND(v);

const tooltipStyle = {
  background: "rgba(10,15,40,0.95)", borderRadius: 13, border: "1px solid rgba(99,144,255,0.2)",
  padding: "11px 15px", color: "#F1F5F9", boxShadow: "0 20px 48px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.04)", backdropFilter: "blur(16px)",
};
const tooltipLabel = { marginBottom: 7, fontSize: 11, fontWeight: 800, color: "#93C5FD", textTransform: "uppercase", letterSpacing: "0.1em", paddingBottom: 5, borderBottom: "1px solid rgba(99,144,255,0.18)" };
const axTick = { fontSize: 12, fill: "#64748B", fontFamily: "var(--font-heading)" };
const gridStroke = "rgba(148,163,184,0.10)";

const DESIGN = {
  colors: {
    primary: "#A855F7",
    secondary: "#8B5CF6",
    success: "#10B981",
    danger: "#EF4444",
    warning: "#F59E0B",
    info: "#F97316",
    neutral: "#64748B",
  },
  seasons: {
    haute: "#EF4444",
    moyenne: "#F59E0B",
    basse: "#F97316"
  }
};

const HeatmapCell = ({ value, format = "pct" }) => {
  const v = parseFloat(value);
  if (isNaN(v)) return null;
  const isPos = v >= 0;
  const intensity = Math.min(Math.abs(v) / 30, 1);
  const bg = isPos
    ? `rgba(16, 185, 129, ${0.1 + intensity * 0.35})`
    : `rgba(239, 68, 68, ${0.1 + intensity * 0.35})`;
  const color = isPos ? "#059669" : "#DC2626";
  const display = format === "pct"
    ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`
    : format === "vol"
      ? `${(v / 1000000).toFixed(2)}M`
      : v.toLocaleString();
  return (
    <span style={{
      background: bg,
      color,
      padding: "3px 8px",
      borderRadius: 6,
      fontWeight: 700,
      fontSize: 10,
      display: "inline-block",
      minWidth: "45px",
      textAlign: "center"
    }}>
      {display}
    </span>
  );
};

const NATIONALITY_ISO = {
  "Francais": "FR", "Anglais": "GB", "Allemands": "DE", "Italiens": "IT", "Italien": "IT", "Suisses": "CH", "Belges": "BE", "Belge": "BE",
  "Hollandais": "NL", "Espagnols": "ES", "Finlandais": "FI", "Autrichiens": "AT", "Polonais": "PL", "Russes": "RU",
  "Tunisiens": "TN", "Tunisiens Res . Etr": "TN", "Résidents Tunisiens": "TN", "Res. Etr. en Tunisie": "TN", "Tunisien": "TN",
  "Marocains": "MA", "Algeriens": "DZ", "Algériens": "DZ", "Algérien": "DZ", "Libyens": "LY", "Egyptiens": "EG", "Saoudiens": "SA", "Emiratis": "AE",
  "Americains": "US", "Canadiens": "CA", "Japonais": "JP", "Chinois": "CN", "Roumains": "RO", "Bulgares": "BG",
  "Suedois": "SE", "Norvegiens": "NO", "Danois": "DK", "Portugais": "PT", "Luxembourgeois": "LU",
  "Hongrois": "HU", "Tcheques": "CZ", "Slovaques": "SK", "Croates": "HR", "Ukrainiens": "UA",
  "Irlandais": "IE", "Irlande": "IE", "Ierlande": "IE", "Irlendais": "IE",
};

const CONTINENT_COLORS = { "Europe": "#A855F7", "Afrique": "#059669", "Amerique": "#E67E22", "Asie": "#DB2777", "Oceanie": "#F97316", "default": "#78716C" };
const AGENCY_MEDAL = ["#B45309", "#475569", "#92400E"];

function Badge({ value, positive }) {
  const isPos = positive ?? parseFloat(value) >= 0;
  return (
    <span style={{
      fontSize: "0.7rem", fontWeight: 700, padding: "2px 7px", borderRadius: 999,
      background: isPos ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
      color: isPos ? "#059669" : "#DC2626",
      border: `1px solid ${isPos ? "rgba(16,185,129,0.20)" : "rgba(239,68,68,0.20)"}`,
    }}>
      {parseFloat(value) > 0 ? "+" : ""}{value}%
    </span>
  );
}

function MiniBar({ pct, color = "#EC4899" }) {
  const width = Math.min(parseFloat(pct) * 2.5, 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
      <div style={{ width: 52, height: 6, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${width}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontWeight: 700, color, fontSize: 11, minWidth: 34, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

function DeltaLabel({ x, y, width, nVal, n1Val }) {
  if (!nVal || !n1Val || parseFloat(n1Val) === 0) return null;
  const dt = ((parseFloat(nVal) - parseFloat(n1Val)) / Math.abs(parseFloat(n1Val))) * 100;
  const isPos = dt >= 0;
  return (
    <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={9} fontWeight={700} fill={isPos ? "#059669" : "#DC2626"}>
      {isPos ? "+" : ""}{dt.toFixed(0)}%
    </text>
  );
}

function NBar(fill, nKey, n1Key) {
  return function CustomNBar(props) {
    const { x, y, width, height, payload } = props;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} ry={4} />
        <DeltaLabel x={x} y={y} width={width} nVal={payload[nKey]} n1Val={payload[n1Key]} />
      </g>
    );
  };
}

const NBarNuitees = NBar("#A855F7", "nuitees_n", "nuitees_n1");
const NBarAdr = NBar("#E67E22", "adr_n", "adr_n1");
const NBarArrivees = NBar("#10B981", "arr_total_n", "arr_total_n1");

export default function Stats() {
  const { hotelId, annee, mois } = useDashboard();

  const [tableOpen, setTableOpen] = useState(false);
  const [mensuel, setMensuel] = useState([]);
  const [kpi, setKpi] = useState(null);
  const [compar, setCompar] = useState([]);
  const [arrivees, setArrivees] = useState([]);
  const [nationalites, setNationalites] = useState([]);
  const [agences, setAgences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const MOIS_NAMES = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  useEffect(() => {
    setLoading(true); setError(null);
    const targetMois = mois > 0 ? mois : 12;
    Promise.all([
      getStatsMensuel(annee, hotelId), getStatsKpi(annee, hotelId), getStatsCompar(annee, hotelId),
      getArrivees(annee, hotelId), getNationalites(annee, hotelId), getAgences(annee, hotelId)
    ])
      .then(([m, k, c, a, n, ag]) => {
        let realMensuel = m.data.data || [];
        let realKpi = k.data.data || {};

        // --- Injection CHIRURGICALE des scores Booking pour Royal ---
        const mockYear = mockRoyalData?.years?.[annee.toString()];
        if (hotelId === 1 && mockYear) {
          // On injecte le score dans chaque mois du mensuel réel
          realMensuel = realMensuel.map(realMonth => {
            const mockMonth = mockYear.mensuel.find(mm => mm.mois === realMonth.mois || mm.mois_nom === realMonth.mois_nom);
            return {
              ...realMonth,
              booking_score: mockMonth ? mockMonth.booking_score : 0
            };
          });

          // On injecte le score dans le KPI global
          if (realKpi) {
            realKpi.booking_score = mockYear.kpi.booking_score;
          }
        }

        setMensuel(realMensuel);
        setKpi(realKpi);
        setCompar(c.data.data);
        setArrivees(a.data.data);
        setNationalites(n.data.data);
        setAgences(ag.data.data);
      })
      .catch((e) => setError("Erreur de chargement des données : " + (e?.message || "backend inaccessible")))
      .finally(() => setLoading(false));
  }, [annee, hotelId]);

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 180, gap: 12 }}>
      <div className="spinner" />
      <span style={{ fontSize: 10, fontWeight: 600, color: "#64748B" }}>Chargement des données…</span>
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 180, gap: 12 }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(239,68,68,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#DC2626" }}>Erreur de chargement</span>
      <span style={{ fontSize: 10, color: "#94A3B8", maxWidth: 300, textAlign: "center" }}>{error}</span>
    </div>
  );

  // --- LOGIQUE FILTRE MOIS ---
  const displayKpi = (mois > 0 && mensuel.length > 0)
    ? (() => {
      const mData = mensuel.find(m => m.mois === Number(mois)) || mensuel[mois - 1];
      const cData = compar.find(c => c.mois === Number(mois));
      if (!mData) return kpi;

      // Calcul N-1 robuste
      const n1_nuitees = cData?.nuitees_n1 || 0;
      const n1_arr = cData?.arr_total_n1 || 0;

      return {
        total_nuitees: mData.nuitees,
        n1_nuitees: n1_nuitees,
        total_ch_occupees: mData.ch_occupees,
        n1_ch_occupees: cData?.ch_occupees_n1 || 0,
        total_arrivees: mData.arr_total,
        n1_arrivees: n1_arr,
        taux_occupation_chambres: mData.to_chambre_pct || mData.taux_occupation_chambres,
        n1_taux_occ: cData?.to_chambre_n1 || 0,
        prix_moyen_chambre: mData.adr,
        n1_adr: cData?.adr_n1 || 0,
        revenu_moyen_client: mData.revenu_moyen_client,
        n1_rev_client: cData?.revenu_moyen_client_n1 || 0,
        duree_sejour: (parseFloat(mData.nuitees) / (parseFloat(mData.arr_total) || 1)).toFixed(1),
        n1_duree_sejour: (parseFloat(n1_nuitees) / (parseFloat(n1_arr) || 1)).toFixed(1),
        indice_freq: (parseFloat(mData.nuitees) / (parseFloat(mData.ch_occupees) || 1)).toFixed(2),
        n1_indice_freq: cData?.indice_freq_n1 || 0,
        booking_score: mData.booking_score
      };
    })()
    : (kpi ? {
      ...kpi,
      duree_sejour: (parseFloat(kpi.total_nuitees) / (parseFloat(kpi.total_arrivees) || 1)).toFixed(1),
      n1_duree_sejour: (parseFloat(kpi.n1_nuitees || 0) / (parseFloat(kpi.n1_arrivees || 0) || 1)).toFixed(1),
    } : null);

  const displayCompar = mois > 0
    ? compar.filter(r => r.mois === mois)
    : compar;

  const natData = nationalites.filter(r => r.nom_nat && typeof r.nom_nat === 'string' && r.nom_nat !== "nan").map(r => ({ ...r, nom_nat: r.nom_nat.replace(/^\d+\s+/, "") }));
  const comparWithVariance = displayCompar.map((r) => ({
    ...r,
    nuitees_delta: parseFloat(r.nuitees_n || 0) - parseFloat(r.nuitees_n1 || 0),
  }));
  const sectionTitleStyle = {
    fontSize: 11,
    fontWeight: 800,
    color: "#475569",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    paddingLeft: 2,
  };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", flexDirection: "column", gap: 12, maxWidth: 1600, margin: "0 auto", width: "96%", padding: "12px 0" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <EditableText textKey="stats_header" defaultText={`Statistiques ${mois > 0 ? MOIS_NAMES[mois] + " " : ""}${annee}`} style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }} />
      </div>

      {/* ── Unified KPI Grid ── */}
      {displayKpi && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {/* Ligne 1 : Activité & Taux de performance */}
          <KpiCard icon={<IconBed />} titleKey={`stats_kpi_nuitees_${mois}`} title="Nuitées" value={fmt(displayKpi?.total_nuitees)} valN1={fmt(displayKpi?.n1_nuitees)} subtitleKey={`stats_kpi_nuitees_sub_${mois}`} subtitle={mois > 0 ? MOIS_NAMES[mois] : `${annee}`} color="#10B981" />
          <KpiCard icon={<IconBuilding />} titleKey={`stats_kpi_ch_occ_${mois}`} title="Chambres occupées" value={fmt(displayKpi?.total_ch_occupees)} valN1={fmt(displayKpi?.n1_ch_occupees)} subtitleKey={`stats_kpi_ch_occ_sub_${mois}`} subtitle={mois > 0 ? MOIS_NAMES[mois] : "total chambres"} color="#F97316" />
          <KpiCard icon={<IconUsers />} titleKey={`stats_kpi_arrivees_${mois}`} title="Arrivées (clients)" value={fmt(displayKpi?.total_arrivees)} valN1={fmt(displayKpi?.n1_arrivees)} subtitleKey={`stats_kpi_arrivees_sub_${mois}`} subtitle={mois > 0 ? MOIS_NAMES[mois] : "adultes + enfants"} color="#A855F7" />
          <KpiCard icon={<IconTarget />} titleKey={`stats_kpi_to_${mois}`} title="Taux d'occupation (%)" value={`${fmt(displayKpi?.taux_occupation_chambres, 1)}%`} valN1={`${fmt(displayKpi?.n1_taux_occ, 1)}%`} color="#F59E0B" subtitleKey={`stats_kpi_to_sub_${mois}`} subtitle={mois > 0 ? MOIS_NAMES[mois] : "par chambre"} />

          {/* Ligne 2 : Chiffre d'affaires & Efficacité */}
          <KpiCard icon={<IconCoins />} titleKey={`stats_kpi_adr_chambre_ht_${mois}`} title="Prix moyen chambre HT (ADR)" value={`${fmt(displayKpi?.prix_moyen_chambre, 0)}`} valN1={`${fmt(displayKpi?.n1_adr, 0)}`} color="#E11D48" subtitleKey={`stats_kpi_adr_chambre_sub_${mois}`} subtitle={mois > 0 ? MOIS_NAMES[mois] : "TND"} />
          <KpiCard icon={<IconUser />} titleKey={`stats_kpi_rev_client_ht_${mois}`} title="Revenu moyen client HT" value={`${fmt(displayKpi?.revenu_moyen_client, 0)}`} valN1={`${fmt(displayKpi?.n1_rev_client, 0)}`} color="#8B5CF6" subtitleKey={`stats_kpi_rev_client_sub_${mois}`} subtitle={mois > 0 ? MOIS_NAMES[mois] : "TND"} />
          <KpiCard icon={<IconRocket />} titleKey={`stats_kpi_duree_${mois}`} title="Durée moyenne de séjour" value={fmt(displayKpi?.duree_sejour, 1)} valN1={fmt(displayKpi?.n1_duree_sejour, 1)} color="#DB2777" subtitleKey={`stats_kpi_duree_sub_${mois}`} subtitle={mois > 0 ? MOIS_NAMES[mois] : "jours"} />
          <KpiCard icon={<IconLeaf />} titleKey={`stats_kpi_clients_ch_${mois}`} title="Clients par chambre" value={fmt(displayKpi?.indice_freq, 2)} valN1={fmt(displayKpi?.n1_indice_freq, 2)} color="#059669" subtitleKey={`stats_kpi_clients_ch_sub_${mois}`} subtitle={mois > 0 ? MOIS_NAMES[mois] : "indice de freq."} />
        </div>
      )}

      {/* Nuitées chart */}
      <ChartCard titleKey="stats_chart_nuitees_to_ch_v2" title="Nuitées & Taux d'occupation chambre" subtitle="Barres par saison · Ligne TO Chambre %">
        {(() => {
          const MONTH_SEASON = { 1: "Basse", 2: "Basse", 3: "Basse", 4: "Moyenne", 5: "Moyenne", 6: "Haute", 7: "Haute", 8: "Haute", 9: "Haute", 10: "Moyenne", 11: "Basse", 12: "Basse" };
          const SEA_COLOR = { "Haute": "#8B5CF6", "Moyenne": "#F97316", "Basse": "#14B8A6" };
          const SEA_GRAD = { "Haute": "gradNuitHaute", "Moyenne": "gradNuitMoy", "Basse": "gradNuitBasse" };
          const maxNuit = Math.max(...mensuel.map(r => parseFloat(r.nuitees || 0)), 100);
          const maxTO = Math.max(...mensuel.map(r => parseFloat(r.taux_occupation_chambres || 0)), 50);
          const enriched = mensuel.map(r => ({ ...r, isPeak: parseFloat(r.nuitees) === maxNuit }));
          return (
            <div>
              <div style={{ display: "flex", gap: 16, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
                {Object.entries(SEA_COLOR).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: v }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#475569" }}>{k}</span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                  <div style={{ width: 24, height: 3, background: "#EC4899", borderRadius: 2 }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#EC4899" }}>TO %</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={enriched} margin={{ top: 8, right: 50, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradNuitHaute" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" /><stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.7} /></linearGradient>
                    <linearGradient id="gradNuitMoy" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F97316" /><stop offset="100%" stopColor="#F97316" stopOpacity={0.7} /></linearGradient>
                    <linearGradient id="gradNuitBasse" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14B8A6" /><stop offset="100%" stopColor="#14B8A6" stopOpacity={0.7} /></linearGradient>
                    <linearGradient id="gradTO" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EC4899" /><stop offset="100%" stopColor="#EC4899" stopOpacity={0.3} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={true} />
                  <XAxis dataKey="mois_nom" tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="bar" orientation="left" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} domain={[0, maxNuit * 1.3]} />
                  <YAxis yAxisId="to" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: "#EC4899", fontWeight: 600 }} axisLine={false} tickLine={false} domain={[0, maxTO * 1.3]} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel}
                    formatter={(v, name) => name === "Taux d'occupation chambre (%)" ? [`${parseFloat(v).toFixed(1)}%`, name] : [v.toLocaleString(), name]} />
                  <Bar yAxisId="bar" dataKey="nuitees" name="Nuitées" radius={[4, 4, 0, 0]} barSize={22}>
                    {enriched.map((_, i) => {
                      const s = MONTH_SEASON[i + 1] || "Basse";
                      return <Cell key={i} fill={`url(#${SEA_GRAD[s]})`} />;
                    })}
                  </Bar>
                  <Line yAxisId="to" type="monotone" dataKey="taux_occupation_chambres" name="Taux d'occupation chambre (%)" stroke="#EC4899" strokeWidth={3.5} dot={{ r: 4, fill: "#EC4899", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 7, fill: "#EC4899", stroke: "#fff", strokeWidth: 2.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </ChartCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* ADR & Revenu Client chart */}
        {(() => {
          const maxADR = Math.max(...mensuel.map(r => parseFloat(r.adr || 0)), 50);
          const maxRev = Math.max(...mensuel.map(r => parseFloat(r.revenu_moyen_client || 0)), 50);
          return (
            <ChartCard titleKey="stats_chart_adr_rev_client_ht_v2" title="Prix moyen chambre HT (ADR) & Revenu moyen client HT" subtitle={`ADR max: ${maxADR.toFixed(0)} TND · Revenu Client max: ${maxRev.toFixed(0)} TND`}>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={mensuel} margin={{ top: 8, right: 50, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradADR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FB923C" stopOpacity={1} /><stop offset="60%" stopColor="#F59E0B" stopOpacity={0.88} /><stop offset="100%" stopColor="#D97706" stopOpacity={0.72} /></linearGradient>
                    <linearGradient id="gradRevpar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A855F7" stopOpacity={1} /><stop offset="60%" stopColor="#8B5CF6" stopOpacity={0.88} /><stop offset="100%" stopColor="#6D28D9" stopOpacity={0.7} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={true} />
                  <XAxis dataKey="mois_nom" tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="adr" orientation="left" tick={{ fontSize: 10, fill: "#E67E22" }} axisLine={false} tickLine={false} domain={[0, maxADR * 1.3]} />
                  <YAxis yAxisId="rev" orientation="right" tick={{ fontSize: 10, fill: "#8E44AD", fontWeight: 600 }} axisLine={false} tickLine={false} domain={[0, maxRev * 1.3]} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} formatter={(v, name) => [`${parseFloat(v).toFixed(2)} TND`, name]} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                  <Bar yAxisId="adr" dataKey="adr" name="Prix moyen chambre HT (ADR)" fill="url(#gradADR)" radius={[6, 6, 0, 0]} barSize={22} />
                  <Line yAxisId="rev" type="monotone" dataKey="revenu_moyen_client" name="Revenu moyen client HT" stroke="#A855F7" strokeWidth={3.5} dot={{ r: 4, fill: "#A855F7", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 7, fill: "#A855F7", stroke: "#fff", strokeWidth: 2.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          );
        })()}

        {/* Clients par chambre Area Chart */}
        {(() => {
          const maxFreq = Math.max(...mensuel.map(r => parseFloat(r.indice_freq || 0)), 2);
          return (
            <ChartCard titleKey="stats_chart_frequentation_v2" title="Clients par chambre" subtitle="Nombre moyen de personnes par chambre">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={mensuel} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="gradFreq2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.9} /><stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.2} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={true} />
                  <XAxis dataKey="mois_nom" tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} domain={[0, maxFreq * 1.3]} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} formatter={v => [parseFloat(v).toFixed(2), "Clients par chambre"]} />
                  <Area type="monotone" dataKey="indice_freq" stroke="#8B5CF6" strokeWidth={3} fill="url(#gradFreq2)" dot={{ r: 3, fill: "#8B5CF6", stroke: "#fff", strokeWidth: 1 }} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} name="Clients par chambre" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          );
        })()}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 12 }}>
        {/* Booking Score Chart */}
        {(() => {
          const maxScore = Math.max(...mensuel.map(r => parseFloat(r.booking_score || 0)), 5);
          return (
            <ChartCard titleKey="stats_chart_booking" title="Booking Score mensuel (/ 10)" subtitle="Satisfaction client — source Booking.com">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={mensuel} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity={0.9} /><stop offset="100%" stopColor="#10B981" stopOpacity={0.2} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={true} />
                  <XAxis dataKey="mois_nom" tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="score" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} domain={[0, Math.max(maxScore, 8) * 1.2]} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} formatter={v => [`${parseFloat(v).toFixed(2)} / 10`, "Score"]} />
                  <ReferenceLine y={8} yAxisId="score" stroke="#10B981" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: "Objectif 8", fill: "#10B981", fontSize: 9, position: "right" }} />
                  <Area yAxisId="score" type="monotone" dataKey="booking_score" stroke="#10B981" strokeWidth={2.5} fill="url(#gradScore)"
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      const score = parseFloat(payload.booking_score || 0);
                      const color = score >= 8 ? "#059669" : score >= 6 ? "#D97706" : "#DC2626";
                      return <circle key={cx} cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />;
                    }}
                    activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }} name="Score" />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          );
        })()}

        <ChartCard title="Variance Mensuelle de Croissance" subtitle="Gains et pertes de nuitées vs N-1">
          <div style={{ background: "#FFFFFF", borderRadius: 16, padding: "16px 12px 8px" }}>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={comparWithVariance} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="varPosGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <linearGradient id="varNegGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#EF4444" />
                    <stop offset="100%" stopColor="#DC2626" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="mois_nom" tick={{ fontSize: 10, fill: "#94A3B8", fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip
                  contentStyle={{ background: "rgba(15,23,42,0.95)", border: "none", borderRadius: 10, padding: "12px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}
                  labelStyle={{ color: "#CBD5E1", fontWeight: 600, fontSize: 11, marginBottom: 6 }}
                  formatter={(value) => {
                    const val = parseFloat(value);
                    const prefix = val > 0 ? "+" : "";
                    return [`${prefix}${val.toLocaleString()} nuitées`, val > 0 ? "↑ Croissance" : "↓ Baisse"];
                  }}
                />
                <ReferenceLine y={0} stroke="#E2E8F0" strokeWidth={2} strokeDasharray="4 2" />
                <Bar dataKey="nuitees_delta" name="Variance" radius={[4, 4, 4, 4]} barSize={24}>
                  {comparWithVariance.map((r, i) => (
                <Cell key={i} fill={parseFloat(r.nuitees_delta) >= 0 ? "url(#varPosGrad)" : "url(#varNegGrad)"} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", paddingLeft: 2, marginTop: 24, marginBottom: 12 }}>Détails Mensuels Analytiques</div>
      <ChartCard titleKey="stats_table_mensuel" title="Analyse Mensuelle Détaillée" subtitle="Performance opérationnelle · Comparatif N vs N-1 · Visualisation BI">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {mensuel.map((r, i) => {
            const c = compar.find(cmp => cmp.mois === r.mois) || {};
            const gN = parseFloat(c.nuitees_growth_pct || 0);
            const gA = parseFloat(c.adr_growth_pct || 0);
            const diffN = (parseFloat(r.nuitees) || 0) - (parseFloat(c.nuitees_n1) || 0);
            const diffA = (parseFloat(r.adr) || 0) - (parseFloat(c.adr_n1) || 0);
            const to = parseFloat(r.taux_occupation_chambres || r.to_chambre_pct || 0);
            
            const theme = {
              "Haute":   { color: "#F43F5E", bg: "#FFF1F2", border: "#FECDD3", icon: "" },
              "Moyenne": { color: "#D97706", bg: "#FFFBEB", border: "#FEF3C7", icon: "" },
              "Basse":   { color: "#2563EB", bg: "#EFF6FF", border: "#DBEAFE", icon: "" },
            }[r.saison] || { color: "#2563EB", bg: "#EFF6FF", border: "#DBEAFE", icon: "" };

            return (
              <div key={i} style={{
                background: "#FFFFFF",
                borderRadius: 24,
                border: "1px solid #E2E8F0",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)",
                overflow: "hidden"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 20px 25px -5px rgba(0,0,0,0.08)";
                e.currentTarget.style.borderColor = theme.color + "44";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.02)";
                e.currentTarget.style.borderColor = "#E2E8F0";
              }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ 
                      width: 44, height: 44, borderRadius: 12, 
                      background: theme.bg, color: theme.color, 
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, border: `1px solid ${theme.color}22`
                    }}>
                      {theme.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 950, color: "#0F172A", letterSpacing: "-0.02em" }}>{r.mois_nom}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: theme.color, textTransform: "uppercase" }}>Saison {r.saison}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>Booking</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                      <span style={{ fontSize: 18, fontWeight: 950, color: "#F59E0B" }}>{fmt(r.booking_score, 1)}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Nuitées {annee}</span>
                        <span style={{ fontSize: 26, fontWeight: 950, color: "#0F172A", fontFamily: "monospace" }}>{fmt(r.nuitees)}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                         <HeatmapCell value={gN} />
                         <span style={{ fontSize: 10, fontWeight: 700, color: diffN >= 0 ? "#10B981" : "#EF4444" }}>{diffN >= 0 ? "+" : ""}{fmt(diffN)} <span style={{ opacity: 0.6 }}>Δ Net</span></span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Prix Moyen (ADR)</span>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                        <span style={{ fontSize: 22, fontWeight: 950, color: "#0F172A", fontFamily: "monospace" }}>{fmt(r.adr, 0)}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#64748B" }}>TND</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <HeatmapCell value={gA} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: diffA >= 0 ? "#10B981" : "#EF4444" }}>{diffA >= 0 ? "+" : ""}{fmt(diffA)} <span style={{ opacity: 0.6 }}>Δ Net</span></span>
                    </div>
                  </div>
                </div>

                <div style={{ 
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
                  background: "#F8FAFC", borderRadius: 16, padding: "16px",
                  border: "1px solid #F1F5F9"
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Arrivées</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: "#334155" }}>{fmt(r.arr_total)} <span style={{ fontSize: 9, color: "#94A3B8" }}>cli.</span></span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, borderLeft: "2px solid #E2E8F0", paddingLeft: 12 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Rev/Client</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: "#334155" }}>{fmt(r.revenu_moyen_client, 0)} <span style={{ fontSize: 9, color: "#94A3B8" }}>TND</span></span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: "#64748B", textTransform: "uppercase" }}>Taux d'occupation</span>
                    <span style={{ fontSize: 12, fontWeight: 950, color: "#0F172A" }}>{to.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 6, background: "#F1F5F9", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ 
                      width: `${to}%`, 
                      height: "100%", 
                      background: `linear-gradient(90deg, ${theme.color}, ${theme.color}CC)`,
                      borderRadius: 99 
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>

      <div style={sectionTitleStyle}>Comparaison 2023 vs 2024</div>

      {(() => {
        const MOIS_ABBR = { "Janvier": "Jan", "Février": "Fév", "Mars": "Mar", "Avril": "Avr", "Mai": "Mai", "Juin": "Jun", "Juillet": "Jul", "Août": "Aoû", "Septembre": "Sep", "Octobre": "Oct", "Novembre": "Nov", "Décembre": "Déc", "Fevrier": "Fév", "Aout": "Aoû", "Decembre": "Déc" };
        const comparAbbr = compar.map(r => ({ ...r, mois_abbr: MOIS_ABBR[r.mois_nom] || (r.mois_nom || "").substring(0, 3) }));
        const tooltipCompar = { contentStyle: tooltipStyle, labelStyle: tooltipLabel, itemStyle: { color: "#e5e7eb", fontSize: 10 } };
        return (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {(() => {
                const maxN = Math.max(...comparAbbr.map(r => parseFloat(r.nuitees_n || 0)), 100);
                const maxN1 = Math.max(...comparAbbr.map(r => parseFloat(r.nuitees_n1 || 0)), 100);
                const maxBar = Math.max(maxN, maxN1) * 1.3;
                return (
                  <ChartCard titleKey="stats_chart_nuitees_compar_v2" title={`Nuitées ${annee} vs ${annee - 1}`} subtitle="Volume actuel vs tendance N-1">
                    <ResponsiveContainer width="100%" height={170}>
                      <ComposedChart data={comparAbbr} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradNuitNBar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#EC4899" stopOpacity={1} />
                            <stop offset="100%" stopColor="#A855F7" stopOpacity={0.8} />
                          </linearGradient>
                          <linearGradient id="gradNuitN1Area" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#94A3B8" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#94A3B8" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                        <XAxis dataKey="mois_abbr" tick={{ fontSize: 10, fill: "#64748B", fontWeight: 700 }} axisLine={false} tickLine={false} dy={5} />
                        <YAxis tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }} axisLine={false} tickLine={false} domain={[0, maxBar]} dx={-5} />
                        <Tooltip {...tooltipCompar} cursor={{ fill: "rgba(226, 232, 240, 0.4)" }} />
                        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 8 }} iconType="circle" />
                        <Area type="monotone" dataKey="nuitees_n1" name={String(annee - 1)} fill="url(#gradNuitN1Area)" stroke="#94A3B8" strokeWidth={2.5} strokeDasharray="4 4" />
                        <Bar dataKey="nuitees_n" name={String(annee)} fill="url(#gradNuitNBar)" radius={[6, 6, 0, 0]} barSize={18} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartCard>
                );
              })()}

              {(() => {
                const maxN = Math.max(...comparAbbr.map(r => parseFloat(r.to_chambre_n || 0)), 50);
                const maxN1 = Math.max(...comparAbbr.map(r => parseFloat(r.to_chambre_n1 || 0)), 50);
                const maxLine = Math.max(maxN, maxN1) * 1.3;
                return (
                  <ChartCard titleKey="stats_chart_to_chambre_compar_v3" title={`Taux d'occupation chambre (%) — ${annee} vs ${annee - 1}`} subtitle="Tension d'occupation par chambre">
                    <ResponsiveContainer width="100%" height={170}>
                      <ComposedChart data={comparAbbr} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradTOAreaN" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" stopOpacity={0.6} />
                            <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                        <XAxis dataKey="mois_abbr" tick={{ fontSize: 10, fill: "#64748B", fontWeight: 700 }} axisLine={false} tickLine={false} dy={5} />
                        <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }} axisLine={false} tickLine={false} domain={[0, maxLine]} dx={-5} />
                        <Tooltip {...tooltipCompar} formatter={v => [`${parseFloat(v).toFixed(1)}%`]} cursor={{ stroke: 'rgba(16, 185, 129, 0.4)', strokeWidth: 2, strokeDasharray: '4 4' }} />
                        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 8 }} iconType="circle" />
                        <Line type="monotone" dataKey="to_chambre_n1" name={String(annee - 1)} stroke="#94A3B8" strokeWidth={3} strokeDasharray="6 6" dot={false} activeDot={{ r: 5, fill: "#94A3B8", stroke: "#fff", strokeWidth: 2 }} />
                        <Area type="monotone" dataKey="to_chambre_n" name={String(annee)} stroke="#10B981" strokeWidth={4} fill="url(#gradTOAreaN)" dot={{ r: 5, fill: "#fff", stroke: "#10B981", strokeWidth: 2.5 }} activeDot={{ r: 8, fill: "#10B981", stroke: "#fff", strokeWidth: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartCard>
                );
              })()}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              {(() => {
                const maxN = Math.max(...comparAbbr.map(r => parseFloat(r.adr_n || 0)), 50);
                const maxN1 = Math.max(...comparAbbr.map(r => parseFloat(r.adr_n1 || 0)), 50);
                const maxBar = Math.max(maxN, maxN1) * 1.3;
                const annotated = comparAbbr.map((r) => ({ ...r, adr_delta: parseFloat(r.adr_n || 0) - parseFloat(r.adr_n1 || 0) }));
                return (
                  <ChartCard titleKey="stats_chart_adr_compar_v3" title={`Prix moyen chambre HT (ADR) — ${annee} vs ${annee - 1}`} subtitle="Comparatif mensuel + variance">
                    <ResponsiveContainer width="100%" height={160}>
                      <ComposedChart data={annotated} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={true} />
                        <XAxis dataKey="mois_abbr" tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} domain={[0, maxBar]} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
                        <Tooltip {...tooltipCompar} formatter={(v, n) => n === "Delta" ? [`${parseFloat(v).toFixed(2)} TND`, "Delta"] : [`${parseFloat(v).toFixed(2)} TND`, n]} />
                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                        <Bar yAxisId="left" dataKey="adr_n1" name={String(annee - 1)} fill="#FBBF24" radius={[4, 4, 0, 0]} barSize={10} />
                        <Bar yAxisId="left" dataKey="adr_n" name={String(annee)} fill="#E67E22" radius={[4, 4, 0, 0]} barSize={10} />
                        <Line yAxisId="right" type="monotone" dataKey="adr_delta" name="Delta" stroke="#EC4899" strokeWidth={2.4} dot={{ r: 3, fill: "#EC4899", stroke: "#fff", strokeWidth: 1 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartCard>
                );
              })()}
            </div>
          </>
        );
      })()}

      {/* ── Collapsible Comparison Table ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Toggle Header */}
        <button
          onClick={() => setTableOpen(o => !o)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: tableOpen
              ? "linear-gradient(135deg, #F97316 0%, #A855F7 100%)"
              : "linear-gradient(135deg, #A855F7 0%, #A855F7 100%)",
            border: "none", borderRadius: 16, padding: "16px 22px",
            cursor: "pointer", width: "100%", transition: "all 0.3s ease",
            boxShadow: tableOpen
              ? "0 8px 32px rgba(30,58,138,0.35), inset 0 1px 0 rgba(255,255,255,0.15)"
              : "0 4px 20px rgba(59,130,246,0.30), inset 0 1px 0 rgba(255,255,255,0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
                Tableau de comparaison N vs N-1
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
                {tableOpen ? "Cliquer pour masquer · Cliquer sur un mois pour le drill-down" : "Cliquer pour afficher le tableau détaillé"}
              </div>
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(6,182,212,0.15) 100%)",
            borderRadius: 12, padding: "10px 16px",
            border: "1px solid rgba(99,102,241,0.25)", backdropFilter: "blur(6px)",
            boxShadow: "0 2px 12px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "white" }}>{tableOpen ? "▼ Masquer" : "▶ Afficher"}</span>
          </div>
        </button>

        {/* Collapsible Table Body */}
        <div style={{
          display: tableOpen ? "block" : "none",
          animation: tableOpen ? "fadeSlideIn 0.4s cubic-bezier(0.22,1,0.36,1)" : "none",
        }}>
          <div style={{
            background: "linear-gradient(165deg,#FAFBFF 0%,#F0F4F8 100%)",
            borderRadius: 16, border: "1px solid rgba(180,190,210,0.35)",
            boxShadow: "0 4px 20px rgba(30,40,60,0.08), 0 0 0 1px rgba(255,255,255,0.5) inset",
            overflow: "hidden",
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
                <thead>
                  {/* Column group headers */}
                  <tr>
                    <th style={{ padding: "14px 18px", textAlign: "left", background: "#F0F5FF", borderBottom: "2px solid #E2EDFF", width: 110 }} />
                    {[
                      { label: "Nuitées", cols: 3, color: "#A855F7" },
                      { label: "Taux d'occupation chambre (%)", cols: 3, color: "#F97316" },
                      { label: "Prix moyen chambre HT (ADR)", cols: 3, color: "#D97706" },
                      { label: "Arrivées (clients)", cols: 2, color: "#059669" },
                    ].map(({ label, cols, color }) => (
                      <th key={label} colSpan={cols} style={{
                        padding: "10px 8px 6px", textAlign: "center", fontSize: 10, fontWeight: 800,
                        color, background: "#F0F5FF", borderBottom: "2px solid #E2EDFF",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                        borderLeft: "1px solid rgba(203,213,225,0.5)",
                      }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                  {/* Sub-headers */}
                  <tr style={{ background: "#F8FAFC" }}>
                    <th style={{ padding: "8px 18px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #E8F0FE" }}>
                      MOIS
                    </th>
                    {[
                      { label: String(annee), color: "#A855F7" },
                      { label: String(annee - 1), color: "#94A3B8" },
                      { label: "Δ%", color: "#A855F7", bold: true },
                      { label: String(annee), color: "#A855F7" },
                      { label: String(annee - 1), color: "#94A3B8" },
                      { label: "Δ%", color: "#A855F7", bold: true },
                      { label: String(annee), color: "#A855F7" },
                      { label: String(annee - 1), color: "#94A3B8" },
                      { label: "Δ%", color: "#A855F7", bold: true },
                      { label: String(annee), color: "#A855F7" },
                      { label: String(annee - 1), color: "#94A3B8" },
                    ].map(({ label, color, bold }, idx) => (
                      <th key={idx} style={{
                        padding: "8px 10px", textAlign: "right", fontSize: 9,
                        fontWeight: bold ? 800 : 600, color, borderBottom: "1px solid #E8F0FE",
                        borderLeft: [0, 3, 6, 9].includes(idx) ? "1px solid rgba(203,213,225,0.5)" : "none",
                      }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compar.map((r, i) => {
                    return (
                      <tr
                        key={i}
                        style={{
                          borderBottom: "1px solid #EEF2FF",
                          transition: "background 0.18s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#F1F5FF"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "#FFFFFF" : "#FAFBFF"; }}
                      >
                        {/* Month name */}
                        <td style={{ padding: "10px 18px", fontWeight: 700, color: "#0F172A", fontSize: 12, whiteSpace: "nowrap" }}>
                          {r.mois_nom}
                        </td>
                        {/* Nuitées */}
                        <td style={{ padding: "10px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#A855F7", fontWeight: 700, fontSize: 12, borderLeft: "1px solid rgba(203,213,225,0.4)" }}>
                          {fmt(r.nuitees_n)}
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#94A3B8", fontSize: 11 }}>
                          {fmt(r.nuitees_n1)}
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "center" }}>
                          <HeatmapCell value={parseFloat(r.nuitees_growth_pct)} format="pct" />
                        </td>
                        {/* TO Chambre */}
                        <td style={{ padding: "10px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#F97316", fontWeight: 700, fontSize: 12, borderLeft: "1px solid rgba(203,213,225,0.4)" }}>
                          {fmt(r.to_chambre_n, 1)}%
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#94A3B8", fontSize: 11 }}>
                          {fmt(r.to_chambre_n1, 1)}%
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "center" }}>
                          <HeatmapCell value={parseFloat(r.to_chambre_growth_pct)} format="pct" />
                        </td>
                        {/* ADR */}
                        <td style={{ padding: "10px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#D97706", fontWeight: 700, fontSize: 12, borderLeft: "1px solid rgba(203,213,225,0.4)" }}>
                          {fmt(r.adr_n, 2)}
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#94A3B8", fontSize: 11 }}>
                          {fmt(r.adr_n1, 2)}
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "center" }}>
                          <HeatmapCell value={parseFloat(r.adr_growth_pct)} format="pct" />
                        </td>
                        {/* Arrivées */}
                        <td style={{ padding: "10px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#059669", fontWeight: 700, fontSize: 12, borderLeft: "1px solid rgba(203,213,225,0.4)" }}>
                          {fmt(r.arr_total_n)}
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#94A3B8", fontSize: 11 }}>
                          {fmt(r.arr_total_n1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Table footer hint */}
            <div style={{ padding: "10px 18px", background: "#F8FAFC", borderTop: "1px solid #EEF2FF", display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 500 }}>Tableau de comparaison mensuelle N vs N-1</span>
            </div>
          </div>
        </div>
      </div>





      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {/* ── Stacked Bar: Arrivées Adultes + Enfants ── */}
        {(() => {
          const maxTotal = Math.max(...arrivees.map(r => parseFloat(r.arr_adulte || 0) + parseFloat(r.arr_enfant || 0)), 100);

          /* Custom tooltip showing both values + total clearly */
          const StackedArrTooltip = ({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const adultes = parseFloat(payload.find(p => p.dataKey === "arr_adulte")?.value || 0);
            const enfants = parseFloat(payload.find(p => p.dataKey === "arr_enfant")?.value || 0);
            const total = adultes + enfants;
            const pctEnf = total > 0 ? ((enfants / total) * 100).toFixed(1) : "0.0";
            return (
              <div style={{ ...tooltipStyle, minWidth: 160 }}>
                <div style={{ ...tooltipLabel, marginBottom: 8 }}>{label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: "#A855F7", flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: "#94A3B8" }}>Adultes</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#93C5FD" }}>{adultes.toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: "#10B981", flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: "#94A3B8" }}>Enfants <span style={{ color: "#6EE7B7", fontWeight: 700 }}>({pctEnf}%)</span></span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#6EE7B7" }}>{enfants.toLocaleString()}</span>
                  </div>
                  <div style={{ marginTop: 4, paddingTop: 6, borderTop: "1px solid rgba(99,144,255,0.2)", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#F1F5F9", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#FFFFFF" }}>{total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          };

          /* Label renderer — only show enfants count if large enough to be readable */
          const EnfantsLabel = (props) => {
            const { x, y, width, value } = props;
            const v = parseFloat(value || 0);
            if (v < maxTotal * 0.04) return null; // skip tiny slices
            return (
              <text x={x + width / 2} y={y + 12} textAnchor="middle" fontSize={9} fontWeight={700} fill="rgba(255,255,255,0.9)">
                {v.toLocaleString()}
              </text>
            );
          };

          return (
            <ChartCard titleKey="stats_chart_arr_categ" title="Arrivées par catégorie (mensuel)" subtitle="Adultes vs Enfants">
              <ResponsiveContainer width="100%" height={160}>
                <ComposedChart data={arrivees} margin={{ top: 6, right: 32, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="mois_nom" tick={{ fontSize: 9, fill: "#94A3B8", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 9, fill: "#94A3B8" }} axisLine={false} tickLine={false} domain={[0, 6000]} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: "#10B981" }} axisLine={false} tickLine={false} domain={[0, 300]} />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="arr_adulte" name="Adultes" fill="#A855F7" radius={[2, 2, 0, 0]} barSize={16} />
                  <Line yAxisId="right" type="monotone" dataKey="arr_enfant" name="Enfants" stroke="#10B981" strokeWidth={2} dot={{ r: 3.5, fill: "#10B981" }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ width: 12, height: 12, background: "#A855F7", borderRadius: 2 }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#475569" }}>Adultes</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ width: 12, height: 2, background: "#10B981", borderRadius: 2 }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#475569" }}>Enfants</span>
                </div>
              </div>
            </ChartCard>
          );
        })()}

        {/* ── Enhanced Cumul Area Chart with YoY comparison ── */}
        {(() => {
          const maxCumul = Math.max(...arrivees.map(r => parseFloat(r.arr_cumul || 0)), 100);

          /* Build a YoY comparison line using compar data (cumulative sum of arr_total_n1) */
          const comparSorted = [...compar].sort((a, b) => (a.mois || 0) - (b.mois || 0));
          let runningN1 = 0;
          const cumulN1Map = {};
          comparSorted.forEach(r => {
            runningN1 += parseFloat(r.arr_total_n1 || 0);
            cumulN1Map[r.mois_nom] = runningN1;
          });
          const maxCumulN1 = Math.max(...Object.values(cumulN1Map), 100);

          /* Build a linear goal line: pace to beat N-1 total by 5% */
          const goalTotal = maxCumulN1 * 1.05;
          const nMonths = arrivees.length || 12;
          const goalPerMonth = goalTotal / nMonths;

          /* Merge arrivees with YoY N-1 cumul + goal */
          const enrichedCumul = arrivees.map((r, idx) => ({
            ...r,
            cumul_n1: cumulN1Map[r.mois_nom] ?? null,
            goal: Math.round(goalPerMonth * (idx + 1)),
          }));

          const maxY = Math.max(maxCumul, maxCumulN1, goalTotal) * 1.15;

          const CumulTooltip = ({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const curr = payload.find(p => p.dataKey === "arr_cumul");
            const n1 = payload.find(p => p.dataKey === "cumul_n1");
            const goal = payload.find(p => p.dataKey === "goal");
            const diff = curr && n1 ? parseFloat(curr.value || 0) - parseFloat(n1.value || 0) : null;
            const isAhead = diff !== null && diff >= 0;
            return (
              <div style={{ ...tooltipStyle, minWidth: 170 }}>
                <div style={{ ...tooltipLabel, marginBottom: 8 }}>{label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {curr && (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F97316" }} />
                        <span style={{ fontSize: 10, color: "#94A3B8" }}>Cumul {annee}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#67E8F9" }}>{parseFloat(curr.value).toLocaleString()}</span>
                    </div>
                  )}
                  {n1 && n1.value != null && (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 16, height: 2, background: "#94A3B8", borderRadius: 1 }} />
                        <span style={{ fontSize: 10, color: "#94A3B8" }}>Cumul {annee - 1}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#CBD5E1" }}>{parseFloat(n1.value).toLocaleString()}</span>
                    </div>
                  )}
                  {goal && (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 16, height: 2, background: "#F59E0B", borderRadius: 1, borderTop: "2px dashed #F59E0B" }} />
                        <span style={{ fontSize: 10, color: "#94A3B8" }}>Objectif</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#FCD34D" }}>{parseFloat(goal.value).toLocaleString()}</span>
                    </div>
                  )}
                  {diff !== null && (
                    <div style={{ marginTop: 4, paddingTop: 6, borderTop: "1px solid rgba(99,144,255,0.2)", display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, color: "#94A3B8" }}>vs N-1</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: isAhead ? "#6EE7B7" : "#FCA5A5" }}>
                        {isAhead ? "+" : ""}{diff.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          };

          return (
            <ChartCard
              titleKey="stats_chart_cumul_arrivees"
              title="Cumul arrivées annuel"
              subtitle={`${annee} vs ${annee - 1} · Objectif +5%`}
            >
              <div style={{ display: "flex", gap: 16, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
                {[
                  { color: "#F97316", label: `Cumul ${annee}`, solid: true },
                  { color: "#94A3B8", label: `Cumul ${annee - 1}`, solid: false },
                  { color: "#F59E0B", label: "Objectif", solid: false, dashed: true },
                ].map(({ color, label, solid, dashed }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {solid
                      ? <div style={{ width: 20, height: 3, borderRadius: 2, background: color, boxShadow: `0 0 6px ${color}66` }} />
                      : <div style={{ width: 20, height: 0, borderTop: `2px ${dashed ? "dashed" : "dashed"} ${color}`, opacity: 0.8 }} />
                    }
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#475569" }}>{label}</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={175}>
                <ComposedChart data={enrichedCumul} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCumulMain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F97316" stopOpacity={0.55} />
                      <stop offset="60%" stopColor="#EC4899" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#F97316" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="gradCumulN1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#94A3B8" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#94A3B8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="mois_nom" tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} domain={[0, maxY]} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip content={<CumulTooltip />} cursor={{ stroke: "rgba(6,182,212,0.3)", strokeWidth: 2, strokeDasharray: "4 4" }} />

                  {/* N-1 faint area background */}
                  <Area type="monotone" dataKey="cumul_n1" name={`Cumul ${annee - 1}`} stroke="#94A3B8" strokeWidth={2} strokeDasharray="6 4" fill="url(#gradCumulN1)" dot={false} activeDot={{ r: 5, fill: "#94A3B8", stroke: "#fff", strokeWidth: 2 }} />

                  {/* Goal line */}
                  <Line type="linear" dataKey="goal" name="Objectif" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, fill: "#F59E0B", stroke: "#fff", strokeWidth: 2 }} />

                  {/* Main cumul area — on top */}
                  <Area type="monotone" dataKey="arr_cumul" name={`Cumul ${annee}`} stroke="#F97316" strokeWidth={3.5} fill="url(#gradCumulMain)" dot={{ r: 3.5, fill: "#F97316", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 7, fill: "#F97316", stroke: "#fff", strokeWidth: 2.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          );
        })()}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
        <ChartCard titleKey="stats_chart_nationalites_map" title="Carte Nationale" subtitle="Top Nationalités">
          <MapNationalites natData={natData} nationalityIso={NATIONALITY_ISO} continentColors={CONTINENT_COLORS} />
        </ChartCard>

        <ChartCard titleKey="stats_chart_agences" title="Top Agences" subtitle="CA et part de marché" accent="#EC4899">
          {(() => {
            const cleanAgences = agences.filter(r => r.nom_agence && typeof r.nom_agence === 'string' && r.nom_agence !== "nan");
            const maxVal = Math.max(...cleanAgences.map(d => parseFloat(d.ca_total) || 0));
            const top3 = cleanAgences.slice(0, 3);
            const rankBadge = ["🥇", "🥈", "🥉"];
            const vivid = ["#F97316", "#8B5CF6", "#F97316", "#10B981", "#EC4899", "#EAB308"];
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 620 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                  {top3.map((r, i) => {
                    const val = parseFloat(r.ca_total) || 0;
                    const partPct = parseFloat(r.part_pct || 0).toFixed(2);
                    const color = vivid[i];
                    const topSticker = `TOP ${i + 1}`;
                    return (
                      <div key={i} style={{
                        borderRadius: 14,
                        padding: "12px 12px 10px",
                        background: i === 0 ? "linear-gradient(135deg,#FFEDD5,#FDBA74)" : i === 1 ? "linear-gradient(135deg,#EDE9FE,#C4B5FD)" : "linear-gradient(135deg,#CFFAFE,#67E8F9)",
                        border: `1px solid ${color}55`,
                        boxShadow: `0 10px 22px ${color}30`,
                        position: "relative",
                      }}>
                        <div style={{
                          position: "absolute",
                          top: -10,
                          left: 12,
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          color: "#FFFFFF",
                          background: `linear-gradient(135deg, ${color}, ${color}CC)`,
                          borderRadius: 9999,
                          padding: "6px 12px",
                          boxShadow: `0 8px 18px ${color}66`,
                          border: "2px solid rgba(255,255,255,0.75)",
                          zIndex: 2,
                        }}>
                          {topSticker}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 16 }}>{rankBadge[i]}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: color }}>{partPct}% part</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", lineHeight: 1.2, minHeight: 32 }}>{r.nom_agence}</div>
                        <div style={{ marginTop: 8, fontSize: 16, fontWeight: 900, color: color }}>
                          {fmtTNDSmall(val)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {cleanAgences.map((r, i) => {
                    const val = parseFloat(r.ca_total) || 0;
                    const pctV = maxVal > 0 ? (val / maxVal) * 100 : 0;
                    const partPct = parseFloat(r.part_pct || 0).toFixed(2);
                    const color = vivid[i % vivid.length];
                    const medal = ["🥇", "🥈", "🥉"][i] ?? "";
                    return (
                      <div key={i} style={{
                        display: "grid",
                        gridTemplateColumns: "190px 1fr 60px 60px",
                        alignItems: "center",
                        gap: 10,
                        border: `1px solid ${color}33`,
                        borderRadius: 12,
                        padding: "8px 10px",
                        background: `linear-gradient(90deg, ${color}10, #FFFFFF 35%)`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {medal ? <span style={{ fontSize: 14 }}>{medal}</span> : <span style={{ width: 14 }} />}
                          <span style={{ fontSize: 12, color: "#334155", fontWeight: 800, lineHeight: 1.2 }}>{r.nom_agence}</span>
                        </div>
                        <div style={{ height: 10, background: "#EEF2F7", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${pctV}%`, height: "100%", background: `linear-gradient(90deg, ${color}, ${color}CC, #A78BFA)`, borderRadius: 99, transition: "width 0.4s ease", boxShadow: `0 0 12px ${color}55` }} />
                        </div>
                        <span style={{ fontSize: 11, color: "#334155", fontWeight: 900, textAlign: "right" }}>{fmtTNDSmall(val)}</span>
                        <span style={{ fontSize: 10, color: color, fontWeight: 800, textAlign: "right" }}>{partPct}%</span>
                      </div>
                    );
                  })}
                </div>



                {/* Performance Summary Footer to fill space */}
                <div style={{
                  marginTop: "auto",
                  paddingTop: 16,
                  borderTop: "1px solid #EEF2FF",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10
                }}>
                  <div style={{ background: "rgba(168, 85, 247, 0.05)", borderRadius: 12, padding: 12, border: "1px solid rgba(168, 85, 247, 0.15)", backdropFilter: "blur(4px)" }}>
                    <div style={{ fontSize: 10, color: "#4F46E5", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>Total CA Agences</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#1E293B", marginTop: 2 }}>
                      {fmtTNDSmall(cleanAgences.reduce((acc, r) => acc + (parseFloat(r.ca_total) || 0), 0))}
                    </div>
                  </div>
                  <div style={{ background: "rgba(168, 85, 247, 0.05)", borderRadius: 12, padding: 12, border: "1px solid rgba(168, 85, 247, 0.15)", backdropFilter: "blur(4px)" }}>
                    <div style={{ fontSize: 10, color: "#4F46E5", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>Couverture Marché</div>
                    <div style={{ fontSize: 18, fontWeight: 950, color: "#059669", marginTop: 2 }}>
                      {cleanAgences.reduce((acc, r) => acc + (parseFloat(r.part_pct) || 0), 0).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

            );
          })()}
        </ChartCard>
      </div>

    </div>
  );
}
