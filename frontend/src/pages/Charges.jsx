// frontend/src/pages/Charges.jsx — PREMIUM LIGHT THEME (Reference Design)
import { useState, useEffect } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, ComposedChart,
} from "recharts";
import { useDashboard } from "../components/DashboardContext";
import KpiCard from "../components/KpiCard";
import DonutChart from "../components/DonutChart";
import ChartCard from "../components/ChartCard";
import EditableText from "../components/EditableText";
import { IconUsers, IconZap, IconShoppingCart, IconBuilding2, IconCreditCard, IconClipboard, IconCrane, IconLightBulb, IconFlame, IconDroplet, IconFuel, IconBarChart, IconCheckCircle, IconAlertCircle, IconCrown, IconGem, IconSparkles, IconRocket, IconLeaf, IconTarget, IconCoins, IconTrendUp, IconTrendDown, IconScale } from "../components/KpiIcons";

// ─── API ──────────────────────────────────────────────────────────────────────
const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem("bi_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const formatSpaces = v => {
  const num = Math.round(Number(v || 0));
  const s = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return s + " TND";
};
const fmtM = v => formatSpaces(v);
const fmtK = v => formatSpaces(v);
const fmtNum = (v, d = 0) => {
  const num = Number(v || 0);
  const fixed = num.toFixed(d);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return parts.join(',');
};

const pct = (a, b) => (b > 0 ? (((a - b) / b) * 100).toFixed(1) : null);
const delta = d => {
  if (d === null) return "—";
  const num = parseFloat(d);
  return num >= 0 ? `+${d}%` : `${d}%`;
};

const axTick = { fontSize: 12, fill: "#64748B", fontFamily: "var(--font-heading)", fontWeight: 600 };
const gridStroke = "rgba(148,163,184,0.18)";

// ─── Couleurs (Premium Palette) ───────────────────────────────────────────────
const C = {
  personnel: "#7C3AED", energie: "#E67E22", achats_consommation: "#F59E0B",
  autres_exploit: "#A855F7", charges_financieres: "#E11D48", impots_taxes: "#475569",
  dotations_amort: "#78716C", electricite: "#E67E22", gaz: "#DC2626",
  eau: "#F97316", carburant: "#A855F7", royalAzur: "#A855F7", belAzur: "#D946EF", solAzur: "#EA580C",
};

const POSTES = [
  { k: "achats_consommation", label: "Achats & Consommation", icon: <IconShoppingCart />, color: C.achats_consommation },
  { k: "personnel", label: "Personnel", icon: <IconUsers />, color: C.personnel },
  { k: "energie", label: "Énergie", icon: <IconZap />, color: C.energie },
  { k: "charges_financieres", label: "Charges Financières", icon: <IconCreditCard />, color: C.charges_financieres },
  { k: "charges_diverses", label: "Autres Charges", icon: <IconClipboard />, color: "#EC4899" },
  { k: "services_exterieurs", label: "Services Extérieurs", icon: <IconBuilding2 />, color: "#8B5CF6" },
  { k: "autres_services_exterieurs", label: "Autres Serv. Ext.", icon: <IconCrane />, color: "#6366F1" },
  { k: "impots_taxes", label: "Impôts & Taxes", icon: <IconTarget />, color: C.impots_taxes },
  { k: "dotations_amort", label: "Amortissements", icon: <IconBarChart />, color: C.dotations_amort },
];

const ENERGIE_ITEMS = [
  { k: "electricite", label: "Électricité", icon: <IconLightBulb />, color: C.electricite },
  { k: "gaz", label: "Gaz", icon: <IconFlame />, color: C.gaz },
  { k: "eau", label: "Eau", icon: <IconDroplet />, color: C.eau },
  { k: "carburant", label: "Carburant", icon: <IconFuel />, color: C.carburant },
];

// REPARTITION supprimé ici — chargé dynamiquement depuis /api/charges/repartition
// Les % proviennent du rapport du conseil d'administration (source : backend config.py)

const MOIS_COURT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

// ─── Tooltips ─────────────────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  // (KPI filtering for carburant removed to rely on runtime data)
  return (
    <div style={{ background: "rgba(15,23,42,0.92)", borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.12)", color: "#F1F5F9", fontSize: 12, boxShadow: "0 16px 40px rgba(0,0,0,0.25)", backdropFilter: "blur(12px)" }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#60A5FA", fontSize: 11 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "#f1f5f9", marginBottom: 2 }}>
          {p.name}: <strong>{fmtK(p.value)}</strong>
        </div>
      ))}
    </div>
  );
};

const PctTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(15,23,42,0.92)", borderRadius: 10, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.1)", color: "#f1f5f9", fontSize: 12 }}>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.payload.name} : {p.value}%</div>
      ))}
    </div>
  );
};

const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontWeight: 700 }}>
      {value}%
    </text>
  );
};

const hex2rgba = (hex, a) => {
  if (!hex || hex.length < 7) return `rgba(59,130,246,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

const Spinner = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 180, flexDirection: "column", gap: 10 }}>
    <div className="spinner" />
    <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>Chargement des données…</span>
  </div>
);

// ─── Section Énergie ──────────────────────────────────────────────────────────
function EnergieDashboard({ kpiData, mensuelN, mensuelN1, annee, anneeN1, repartition, mois }) {
  const byPoste = {};
  
  if (mois > 0) {
    // Mode mensuel : on cherche la ligne du mois dans les séries
    const rN = mensuelN.find(r => r.mois === mois) || {};
    const rN1 = mensuelN1.find(r => r.mois === mois) || {};
    // On simule le format attendu par byPoste
    byPoste["energie"] = {
      montant_n: Number(rN.energie || 0),
      montant_n1: Number(rN1.energie || 0),
      elec_n: Number(rN.electricite || 0),
      elec_n1: Number(rN1.electricite || 0),
      gaz_n: Number(rN.gaz || 0),
      gaz_n1: Number(rN1.gaz || 0),
      eau_n: Number(rN.eau || 0),
      eau_n1: Number(rN1.eau || 0),
      carb_n: Number(rN.carburant || 0),
      carb_n1: Number(rN1.carburant || 0),
    };
    byPoste["total_charges"] = {
      montant_n: Number(rN.total_charges || 0)
    };
  } else {
    kpiData.forEach(r => { byPoste[r.poste] = r; });
  }

  const get = (p, f) => Number(byPoste[p]?.[f] || 0);

  const energieN = get("energie", "montant_n");
  const energieN1 = get("energie", "montant_n1");

  // Mapping des clés backend → clé locale
  // Le backend /charges/kpi retourne: elec_n, gaz_n, eau_n, carb_n (pas carburant_n)
  const ENERGIE_KEY_MAP = {
    electricite: { n: "elec_n", n1: "elec_n1" },
    gaz: { n: "gaz_n", n1: "gaz_n1" },
    eau: { n: "eau_n", n1: "eau_n1" },
    carburant: { n: "carb_n", n1: "carb_n1" },
  };
  const energieItems = ENERGIE_ITEMS.map(e => {
    const keys = ENERGIE_KEY_MAP[e.k] || { n: `${e.k}_n`, n1: `${e.k}_n1` };
    return { ...e, valN: get("energie", keys.n), valN1: get("energie", keys.n1) };
  });

  const dataMensuelEnergie = MOIS_COURT.map((m, i) => {
    const rowN = mensuelN.find(r => r.mois === i + 1) || {};
    const rowN1 = mensuelN1.find(r => r.mois === i + 1) || {};
    return {
      mois: m,
      [`elec_${annee}`]: Number(rowN.electricite || 0),
      [`gaz_${annee}`]: Number(rowN.gaz || 0),
      [`eau_${annee}`]: Number(rowN.eau || 0),
      [`carb_${annee}`]: Number(rowN.carburant || 0),
      [`total_${annee}`]: Number(rowN.energie || 0),
      [`total_${anneeN1}`]: Number(rowN1.energie || 0),
    };
  }).filter(d => d[`total_${annee}`] > 0 || d[`total_${anneeN1}`] > 0);

  const repN = repartition?.[annee] || repartition?.[2024] || null;
  const repN1 = repartition?.[anneeN1] || repartition?.[2023] || null;

  const pctEnergie = pct(energieN, energieN1);
  const pctEnergieNum = pctEnergie !== null ? parseFloat(pctEnergie) : null;

  const MOIS_NOMS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  return (
    <div style={{ background: "#FFFFFF", borderRadius: 20, padding: "26px 28px", boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 6px 20px rgba(59,130,246,0.06)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#F59E0B,#D97706)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(245,158,11,0.35)" }}>
              <IconZap />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.01em" }}>
              <EditableText textKey={`charges_energie_title_${mois}`} defaultText={`Tableau de Bord Énergie ${mois > 0 ? MOIS_NOMS[mois-1] : annee}`} />
            </h2>
          </div>
          <p style={{ fontSize: 12, color: "#94A3B8", paddingLeft: 54 }}>
            <EditableText textKey={`charges_energie_subtitle_${mois}`} defaultText={`Décomposition ${mois > 0 ? MOIS_NOMS[mois-1] : "Annuelle"} · Électricité · Gaz · Eau · Carburant`} />
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={{ background: "rgba(59,130,246,0.08)", border: "1.5px solid rgba(59,130,246,0.25)", borderRadius: 99, padding: "5px 14px", fontSize: 11, color: "#3B82F6", fontWeight: 700 }}>{annee}</span>
          <span style={{
            background: pctEnergieNum === null ? "rgba(148,163,184,0.08)" : pctEnergieNum > 0 ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)",
            border: `1px solid ${pctEnergieNum === null ? "rgba(148,163,184,0.2)" : pctEnergieNum > 0 ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
            borderRadius: 99, padding: "5px 14px", fontSize: 11, fontWeight: 700,
            color: pctEnergieNum === null ? "#64748B" : pctEnergieNum > 0 ? "#DC2626" : "#059669",
          }}>
            {pctEnergieNum === null ? "—" : pctEnergieNum > 0 ? `▲ +${pctEnergie}%` : `▼ ${pctEnergie}%`}
            {pctEnergieNum !== null && ` vs ${anneeN1}`}
          </span>
        </div>
      </div>

      {/* 4 KPI énergie */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 22 }}>
        {energieItems.map((e) => {
          const d = pct(e.valN, e.valN1);
          const pctOf = energieN > 0 ? ((e.valN / energieN) * 100).toFixed(0) : 0;
          return (
            <KpiCard
              key={e.k}
              title={e.label}
              value={fmtK(e.valN)}
              valN1={fmtK(e.valN1)}
              delta={delta(d)}
              color={e.color}
              icon={e.icon}
              subtitle={`${pctOf}% de l'énergie`}
            />
          );
        })}
      </div>

      {/* KPI total énergie */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 22 }}>
        <KpiCard 
          title={`Total Énergie ${annee}`} 
          value={fmtK(energieN)} 
          valN1={fmtK(energieN1)}
          subtitle="Toutes énergies confondues" 
          delta={delta(pctEnergie)} 
          color="#F59E0B" 
          icon={<IconZap />} 
        />
        <KpiCard 
          title={`Variation vs ${anneeN1}`} 
          value={delta(pctEnergie)} 
          subtitle={pctEnergieNum === null ? "Pas de données N-1" : pctEnergieNum > 0 ? "Hausse de consommation" : "Baisse de consommation"} 
          color={pctEnergieNum === null ? "#94a3b8" : pctEnergieNum > 0 ? "#DC2626" : "#10B981"} 
          icon={pctEnergieNum > 0 ? <IconTrendUp /> : <IconTrendDown />} 
        />
        <KpiCard 
          title="Poids dans les charges" 
          value={(() => { const tot = get("total_charges", "montant_n"); return tot > 0 ? `${((energieN / tot) * 100).toFixed(1)}%` : "—"; })()} 
          subtitle="Énergie / Total Charges" 
          color="#F59E0B" 
          icon={<IconScale />} 
        />
      </div>

      {/* Graphiques mensuels énergie */}
      {dataMensuelEnergie.length > 0 && (
        <div style={{ background: "#F8FAFC", borderRadius: 16, padding: "18px 18px 14px", marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 14 }}>Évolution mensuelle — Total Énergie {annee} vs {anneeN1} (TND)</div>
          <ResponsiveContainer width="100%" height={150}>
            <ComposedChart data={dataMensuelEnergie} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="mois" tick={axTick} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={axTick} />
              <Tooltip content={<DarkTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, color: "#64748B" }} />
              <Bar dataKey={`total_${annee}`} name={String(annee)} fill="#f59e0b" radius={[5, 5, 0, 0]} opacity={0.9} />
              <Bar dataKey={`total_${anneeN1}`} name={String(anneeN1)} fill="#DBEAFE" radius={[5, 5, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {dataMensuelEnergie.length > 0 && (
        <div style={{ background: "#F8FAFC", borderRadius: 16, padding: "18px 18px 14px", marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 14 }}>Décomposition mensuelle {annee} — Élec · Gaz · Eau · Carburant (TND)</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={dataMensuelEnergie} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barSize={14}>
              <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="mois" tick={axTick} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={axTick} />
              <Tooltip content={<DarkTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, color: "#64748B" }} />
              <Bar dataKey={`elec_${annee}`} name="Électricité" stackId="a" fill={C.electricite} />
              <Bar dataKey={`gaz_${annee}`} name="Gaz" stackId="a" fill={C.gaz} />
              <Bar dataKey={`eau_${annee}`} name="Eau" stackId="a" fill={C.eau} />
              <Bar dataKey={`carb_${annee}`} name="Carburant" stackId="a" fill={C.carburant} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Répartition consolidée */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[anneeN1, annee].map(yr => {
          const rep = repartition?.[yr];
          if (!rep || rep.length === 0) return null;
          return (
            <div key={yr} style={{ background: "#F8FAFC", borderRadius: 16, padding: "18px 18px 14px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 14 }}>Répartition Énergie Consolidée — {yr}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                {rep.map((h, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#0F172A", fontWeight: 600 }}>{h.name}</span>
                      <span style={{ fontSize: 11, color: h.color, fontWeight: 800 }}>{h.value}%</span>
                    </div>
                    <div style={{ height: 6, background: "#F1F5F9", borderRadius: 99 }}>
                      <div style={{ height: "100%", width: `${h.value}%`, background: h.color, borderRadius: 99, transition: "width 0.6s ease", boxShadow: `0 0 6px ${h.color}40` }} />
                    </div>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={rep} cx="40%" cy="50%" outerRadius={60} dataKey="value" labelLine={false} label={PieLabel}>
                    {rep.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Legend layout="vertical" align="right" verticalAlign="middle"
                    formatter={(v, e) => (<span style={{ color: "#475569", fontSize: 10 }}>{v} ({e.payload.value}%)</span>)} />
                  <Tooltip content={<PctTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Charges() {
  const { hotelId, annee, mois } = useDashboard();
  const anneeN1 = annee - 1;
  const [kpiData, setKpiData] = useState([]);
  const [mensuelAll, setMensuelAll] = useState([]);
  const [repartition, setRepartition] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredPie, setHoveredPie] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      API.get("/charges/kpi", { params: { annee, hotel_id: hotelId } }),
      API.get("/charges/mensuel", { params: { annee, hotel_id: hotelId } }),
      API.get("/charges/repartition", { params: { annee, hotel_id: hotelId } }),
    ])
      .then(([kpiRes, mensRes, repRes]) => {
        setKpiData(kpiRes.data.data || []);
        setMensuelAll(mensRes.data.data || []);
        // Transformer [{hotel, pct, color}] par année en {annee: [{name, value, color}]}
        const repRaw = repRes.data.data || {};
        const repFormatted = {};
        Object.entries(repRaw).forEach(([yr, items]) => {
          repFormatted[Number(yr)] = items.map(h => ({
            name: h.hotel, value: h.pct, color: h.color,
          }));
        });
        setRepartition(repFormatted);
      })
      .catch(e => setError("Erreur de chargement : " + (e?.message || "backend inaccessible")))
      .finally(() => setLoading(false));
  }, [annee, hotelId]);

  if (loading) return <Spinner />;
  if (error) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 320, flexDirection: "column", gap: 10 }}>
      <IconAlertCircle />
      <span style={{ fontWeight: 700, color: "#DC2626" }}>{error}</span>
    </div>
  );

  const MOIS_NOMS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  // --- LOGIQUE FILTRE MOIS ---
  const displayKpiData = (mois > 0 && mensuelAll.length > 0)
    ? (() => {
        const rowN = mensuelAll.find(r => r.mois === mois && r.annee === annee);
        const rowN1 = mensuelAll.find(r => r.mois === mois && r.annee === anneeN1);
        if (!rowN) return kpiData;

        // On re-map les colonnes du mensuel vers le format attendu par le dashboard
        return POSTES.map(p => {
          return {
            poste: p.k,
            montant_n: parseFloat(rowN[p.k] || 0),
            montant_n1: parseFloat(rowN1?.[p.k] || 0),
            // Décomposition énergie si poste === 'energie'
            ...(p.k === 'energie' ? {
              elec_n: parseFloat(rowN.electricite || 0),
              gaz_n: parseFloat(rowN.gaz || 0),
              eau_n: parseFloat(rowN.eau || 0),
              carb_n: parseFloat(rowN.carburant || 0),
              elec_n1: parseFloat(rowN1?.electricite || 0),
              gaz_n1: parseFloat(rowN1?.gaz || 0),
              eau_n1: parseFloat(rowN1?.eau || 0),
              carb_n1: parseFloat(rowN1?.carburant || 0),
            } : {})
          };
        }).concat([{
          poste: "total_charges",
          montant_n: parseFloat(rowN.total_charges || 0),
          montant_n1: parseFloat(rowN1?.total_charges || 0)
        }]);
      })()
    : kpiData;

  const byPoste = {};
  displayKpiData.forEach(r => { byPoste[r.poste] = r; });

  const getSafeValue = (row, keys) => {
    for (const k of keys) {
      const v = row?.[k];
      if (v !== undefined && v !== null && !Number.isNaN(Number(v))) return Number(v);
    }
    return 0;
  };

  const totalRow = byPoste["total_charges"] || {};
  const totalN = getSafeValue(totalRow, ["montant_n"]);
  const totalN1 = getSafeValue(totalRow, ["montant_n1"]);
  const pctTotal = pct(totalN, totalN1);
  const pctTotalNum = pctTotal !== null ? parseFloat(pctTotal) : null;

  const energieRow = byPoste["energie"] || {};
  const carbN = Number(energieRow.carb_n || 0);
  const carbN1 = Number(energieRow.carb_n1 || 0);

  const postesValuesAll = POSTES.map(p => {
    if (p.k === "carburant") return { ...p, mn: carbN, mn1: carbN1 };
    const row = byPoste[p.k] || {};
    return {
      ...p,
      mn: getSafeValue(row, ["montant_n"]),
      mn1: getSafeValue(row, ["montant_n1"]),
    };
  });

  // Si on est en mode mensuel (mois > 0), on masque les KPIs qui sont à 0 pour ne pas encombrer
  const postesValues = mois > 0 
    ? postesValuesAll.filter(p => p.mn > 0 || p.mn1 > 0)
    : postesValuesAll;
  // Exclure le carburant du total (déjà dans énergie) pour ne pas double-compter
  const somme = postesValues.filter(p => p.k !== 'carburant').reduce((s, p) => s + (p.mn || 0), 0);
  const isBalanced = totalN > 0 && Math.abs(totalN - somme) / totalN < 0.05;
  const mensuelN = mensuelAll.filter(r => r.annee === annee);
  const mensuelN1 = mensuelAll.filter(r => r.annee === anneeN1);

  const dataCompar = postesValues.map(p => ({
    poste: p.label.length > 20 ? p.label.slice(0, 20) + "…" : p.label,
    [annee]: p.mn,
    [anneeN1]: p.mn1,
    color: p.color
  }));
  const dataPie = postesValues.map(p => ({ name: p.label, value: p.mn, color: p.color, pct: totalN > 0 ? ((p.mn / totalN) * 100).toFixed(1) : 0 }));

  const dataMensuelTotal = MOIS_COURT.map((m, i) => {
    const rN = mensuelN.find(r => r.mois === i + 1) || {};
    const rN1 = mensuelN1.find(r => r.mois === i + 1) || {};
    return { mois: m, [annee]: Number(rN.total_charges || 0), [anneeN1]: Number(rN1.total_charges || 0) };
  }).filter(d => d[annee] > 0 || d[anneeN1] > 0);


  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", flexDirection: "column", gap: 20, maxWidth: 1600, margin: "0 auto", width: "96%", padding: "12px 0", paddingBottom: 24 }}>

      {/* ── Header: Executive Title ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 4, height: 24, background: "#8B5CF6", borderRadius: 4 }} />
            <EditableText
              textKey="charges_header_title"
              defaultText={`Analyse des Charges Opérationnelles ${mois > 0 ? MOIS_NOMS[mois-1] + " " : ""}${annee}`}
              style={{ fontSize: 22, fontWeight: 950, color: "#0F172A", letterSpacing: "-0.03em" }}
            />
          </div>
          <EditableText textKey="charges_header_subtitle" defaultText="Structure des coûts · Performance budgétaire · Comparatif N-1" style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginTop: 4, paddingLeft: 16 }} />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12,
            background: isBalanced ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${isBalanced ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
            color: isBalanced ? "#059669" : "#DC2626", fontWeight: 800, fontSize: 12,
          }}>
            {isBalanced ? <IconCheckCircle size={16} /> : <IconAlertCircle size={16} />}
            <span style={{ textTransform: "uppercase", letterSpacing: "0.02em" }}>{isBalanced ? "Équilibre Budgétaire" : "Alerte Écart"}</span>
          </div>
        </div>
      </div>

      {/* ── Executive KPI Row: High-Density ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
        <KpiCard 
          titleKey={`charges_kpi_total_${annee}_${mois}`} 
          title={`TOTAL CHARGES HT`} 
          value={fmtM(totalN)} 
          valN1={fmtM(totalN1)}
          subtitleKey={`charges_kpi_total_${annee}_${mois}_sub`} 
          subtitle="Volume global des dépenses" 
          delta={`${delta(pctTotal)}`} color="#8B5CF6" icon={<IconCrown />} 
        />
        {postesValues.slice(0, 4).map(p => {
          const d = pct(p.mn, p.mn1);
          return (
            <KpiCard 
              key={p.k}
              titleKey={`charges_kpi_${p.k}_${mois}`} 
              title={p.label} 
              value={fmtM(p.mn)}
              valN1={fmtM(p.mn1)}
              subtitleKey={`charges_kpi_${p.k}_${mois}_sub`} 
              subtitle="Performance mensuelle"
              delta={`${delta(d)}`} color={p.color} icon={p.icon} 
            />
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        <ChartCard height={480} titleKey={`charges_chart_poste_${mois}`} title="Analyse par Centre de Coût" subtitle={`${mois > 0 ? MOIS_NOMS[mois-1] + " " : ""}${annee} vs ${anneeN1} · Valeurs HT`} accent="#8B5CF6">
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={dataCompar} barSize={24} margin={{ top: 20, right: 20, bottom: 60, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="poste" tick={{ ...axTick, fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={80} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={axTick} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 20 }} iconType="circle" />
              <Bar dataKey={annee} name={String(annee)} fill="#8B5CF6" radius={[6, 6, 0, 0]} />
              <Bar dataKey={anneeN1} name={String(anneeN1)} fill="#E2E8F0" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard height={480} titleKey="charges_chart_structure" title="Structure Analytique" subtitle="Répartition relative par nature de dépense" accent="#F59E0B">
          {dataPie.length > 0 ? (() => {
            const total = dataPie.reduce((s, d) => s + d.value, 0);
            const segments = dataPie.map(d => ({ name: d.name, value: d.value, color: d.color }));
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 24, height: "100%", padding: "0 10px" }}>
                <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
                   <DonutChart
                      segments={segments}
                      total={total}
                      size={200}
                      thickness={32}
                      centerLabel={(total / 1000).toFixed(0) + "K"}
                      centerSub="TND TOT"
                      onHover={(idx) => setHoveredPie(idx)}
                    />
                </div>
                <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: 4 }}>
                  {segments.slice(0, 8).map((seg, i) => {
                    const pValue = total > 0 ? (seg.value / total * 100).toFixed(1) : 0;
                    const isHov = hoveredPie === i;
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "6px 12px", borderRadius: 12,
                        background: isHov ? `${seg.color}10` : "transparent",
                        border: `1px solid ${isHov ? seg.color + "33" : "transparent"}`,
                        transition: "all 0.2s ease",
                        transform: isHov ? "translateX(5px)" : "none",
                        cursor: "default"
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: seg.color }} />
                        <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "#475569" }}>{seg.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 900, color: seg.color }}>{pValue}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })() : <div style={{ textAlign: "center", color: "#94A3B8", padding: 60 }}>Aucune donnée disponible</div>}
        </ChartCard>
      </div>

      {/* Table + monthly evolution */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <ChartCard titleKey={`charges_table_detail_${mois}`} title={`Détail par centre de coût ${mois > 0 ? MOIS_NOMS[mois - 1] : "Annuel"}`} subtitle={`${annee} vs ${anneeN1}`} accent="#10B981">
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Poste", annee, anneeN1, "Évol."].map((h, i) => (
                  <th key={i} style={{ padding: "8px 10px", textAlign: i > 0 ? "right" : "left", color: "#475569", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {postesValues.map((p, i) => {
                const d = pct(p.mn, p.mn1);
                const dNum = d !== null ? parseFloat(d) : null;
                return (
                  <tr key={i} style={{ borderTop: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FAFBFC" : "#FFFFFF" }}>
                    <td style={{ padding: "8px 10px", color: "#334155", fontWeight: 600 }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: p.color, marginRight: 6 }} />
                      {p.label}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#0F172A", fontWeight: 700 }}>{fmtK(p.mn)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#94A3B8" }}>{fmtK(p.mn1)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, fontSize: 12, color: dNum === null ? "#64748B" : dNum > 0 ? "#DC2626" : "#059669" }}>
                      {dNum === null ? "—" : dNum > 0 ? `▲ +${d}%` : `▼ ${d}%`}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: "#F8FAFC", color: "#0F172A", fontWeight: 800 }}>
                <td style={{ padding: "10px", borderRadius: "0 0 0 10px" }}>TOTAL</td>
                <td style={{ padding: "10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtK(totalN)}</td>
                <td style={{ padding: "10px", textAlign: "right", fontVariantNumeric: "tabular-nums", opacity: 0.75 }}>{fmtK(totalN1)}</td>
                <td style={{
                  padding: "10px", textAlign: "right", borderRadius: "0 0 10px 0",
                  color: pctTotalNum === null ? "#64748B" : pctTotalNum > 0 ? "#DC2626" : "#059669"
                }}>
                  {pctTotalNum === null ? "—" : pctTotalNum > 0 ? `▲ +${pctTotal}%` : `▼ ${pctTotal}%`}
                </td>
              </tr>
            </tbody>
          </table>
        </ChartCard>

        <ChartCard height={360} titleKey="charges_chart_evolution" title="Évolution mensuelle des charges totales" subtitle={`${annee} vs ${anneeN1}`} accent="#8B5CF6">
          {dataMensuelTotal.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dataMensuelTotal} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                <defs>
                  <linearGradient id="gradN" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.20} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradN1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="mois" tick={axTick} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={axTick} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Area type="monotone" dataKey={annee} name={String(annee)} stroke="#6366F1" fill="url(#gradN)" strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: "#6366F1", strokeWidth: 2 }} />
                <Area type="monotone" dataKey={anneeN1} name={String(anneeN1)} stroke="#93c5fd" fill="url(#gradN1)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: "center", color: "#94A3B8", padding: 60 }}>Données mensuelles non disponibles</div>
          )}
        </ChartCard>
      </div>

      <EnergieDashboard kpiData={kpiData} mensuelN={mensuelN} mensuelN1={mensuelN1} annee={annee} anneeN1={anneeN1} repartition={repartition} mois={mois} />
    </div>
  );
}
