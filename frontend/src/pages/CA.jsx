import { useState, useEffect } from "react";
import {
  BarChart, Bar, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, ComposedChart,
  ReferenceLine, ReferenceArea
} from "recharts";
import {
  getCAMensuel, getCACompar, getCACateg,
  getCAKpi, getCATrim, getCASaisonnier, getCAYtd
} from "../services/api";
import KpiCard from "../components/KpiCard";
import { useDashboard } from "../components/DashboardContext";
import {
  IconRevenue, IconMonitor, IconTrendUp, IconCalendar, IconCalendarOld,
  IconBarChart, IconSun, IconCloudSun, IconSnowflake, IconTrendDown,
  IconCrown, IconGem, IconSparkles
} from "../components/KpiIcons";
import ChartCard from "../components/ChartCard";
import EditableText from "../components/EditableText";
import DonutChart from "../components/DonutChart";

const formatSpaces = v => {
  const num = Math.round(Number(v || 0));
  const s = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return <>{s} <span style={{ fontSize: '0.7em', opacity: 0.8, fontWeight: 700 }}>TND</span></>;
};
const fmtTNDSmall = v => {
  const num = Math.round(Number(v || 0));
  const s = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return <>{s} <span style={{ fontSize: '0.75em', opacity: 0.8, fontWeight: 700 }}>TND</span></>;
};
const fmtTND = v => formatSpaces(v);
const fmtM = v => formatSpaces(v);
const fmt = (v, dec = 0) => parseFloat(v || 0).toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const tooltipStyle = {
  background: "rgba(15,23,42,0.94)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)",
  padding: "8px 12px", color: "#F1F5F9", boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  fontSize: 11,
};
const tooltipLabelStyle = { marginBottom: 4, fontSize: 10, fontWeight: 700, color: "#60A5FA", textTransform: "uppercase" };
const axTick = { fontSize: 12, fill: "#64748B", fontFamily: "var(--font-heading)" };
const gridStroke = "rgba(148,163,184,0.15)";

const DESIGN = {
  colors: {
    primary: "#EC4899",
    secondary: "#8B5CF6",
    success: "#10B981",
    danger: "#EF4444",
    warning: "#F59E0B",
    info: "#06B6D4",
    neutral: "#64748B",
    bg: {
      card: "#FFFFFF",
      hover: "#F8FAFC",
    }
  },
  seasons: {
    haute: "#f1a4a4d3",
    moyenne: "rgb(230, 170, 66)",
    basse: "#7eadf8"
  },
  chart: {
    current: "#82aef6",
    previous: "#94A3B8",
    growth: "#10B981",
    decline: "#f1a4a4d3",
    line: "#06B6D4"
  }
};

const HeatmapCell = ({ value, format = "pct" }) => {
  const v = parseFloat(value);
  const isPos = v >= 0;
  const intensity = Math.min(Math.abs(v) / 50, 1);
  const bg = isPos
    ? `rgba(16, 185, 129, ${0.1 + intensity * 0.3})`
    : `rgba(239, 68, 68, ${0.1 + intensity * 0.3})`;
  const color = isPos ? "#059669" : "#DC2626";
  const display = format === "pct"
    ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`
    : `${(v / 1000000).toFixed(2)}M`;
  return (
    <span style={{
      background: bg,
      color,
      padding: "3px 8px",
      borderRadius: 6,
      fontWeight: 700,
      fontSize: 10,
      display: "inline-block"
    }}>
      {display}
    </span>
  );
};

const pctDelta = (n, n1) => {
  if (!n1 || n1 === 0) return 0;
  return ((n - n1) / Math.abs(n1)) * 100;
};
const fmtDelta = d => {
  if (d === null || d === undefined) return "—";
  const num = parseFloat(d);
  return num >= 0 ? `+${num.toFixed(1)}%` : `${num.toFixed(1)}%`;
};

function Badge({ value }) {
  const v = parseFloat(value);
  const isPos = v >= 0;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 999,
      background: isPos ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
      color: isPos ? "#059669" : "#DC2626",
    }}>
      {v > 0 ? "+" : ""}{v.toFixed(1)}%
    </span>
  );
}

const Spinner = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 180, gap: 10 }}>
    <div className="spinner" />
    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748B" }}>Chargement…</span>
  </div>
);

export default function CA() {
  const { hotelId, annee, mois } = useDashboard();
  const [mensuel, setMensuel] = useState([]);
  const [compar, setCompar] = useState([]);
  const [categ, setCateg] = useState([]);
  const [kpi, setKpi] = useState(null);
  const [trim, setTrim] = useState([]);
  const [saison, setSaison] = useState([]);
  const [ytd, setYtd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [hoveredCat, setHoveredCat] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const targetMois = mois > 0 ? mois : new Date().getMonth() + 1;
    Promise.all([
      getCAMensuel(annee, hotelId), getCACompar(annee, hotelId), getCACateg(annee, hotelId),
      getCAKpi(annee, hotelId), getCATrim(annee, hotelId), getCASaisonnier(annee, hotelId), getCAYtd(annee, hotelId, targetMois),
    ])
      .then(([m, c, catRes, kpRes, trRes, saRes, ytRes]) => {
        setMensuel(m.data.data); setCompar(c.data.data); setCateg(catRes.data.data);
        setKpi(kpRes.data.data); setTrim(trRes.data.data); setSaison(saRes.data.data); setYtd(ytRes.data.data);
      })
      .catch((e) => setError("Erreur: " + (e?.message || "backend inaccessible")))
      .finally(() => setLoading(false));
  }, [annee, hotelId, mois]);

  const MOIS_NOMS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const mensuelFull = MOIS_NOMS.map((nom, i) => {
    const found = mensuel.find(r => parseInt(r.mois) === i + 1);
    return found || { mois: i + 1, mois_nom: nom, ca_ht: 0, ca_cumul_ht: 0, saison: null, trimestre: null };
  });
  const cumulData = mensuelFull.map((r, i) => ({
    ...r, ca_cumul_calc: mensuelFull.slice(0, i + 1).reduce((s, x) => s + parseFloat(x.ca_ht), 0),
  }));

  if (loading) return <Spinner />;
  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 180, gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626" }}>Erreur</span>
      <span style={{ fontSize: 10, color: "#94A3B8" }}>{error}</span>
    </div>
  );

  /* ── Derived values (Filtered by Month) ── */
  const mData = mois > 0 ? (mensuel.find(r => parseInt(r.mois) === mois) || { ca_ht: 0 }) : null;
  const cData = mois > 0 ? (compar.find(r => parseInt(r.mois) === mois) || { ca_n1: 0, growth_pct: 0 }) : null;

  const n = mData ? parseFloat(mData.ca_ht || 0) : (kpi ? parseFloat(kpi.total_revenue_n || 0) : 0);
  const n1 = cData ? parseFloat(cData.ca_n1 || 0) : (kpi ? parseFloat(kpi.total_revenue_n1 || 0) : 0);
  const growth = cData ? parseFloat(cData.growth_pct || 0) : (kpi ? parseFloat(kpi.total_growth_percentage || 0) : 0);
  const growthDelta = pctDelta(n, n1);

  /* ── Derived values (YTD / Cumulative) ── */
  const lastDataMois = mensuel.length > 0 ? Math.max(...mensuel.map(r => parseInt(r.mois))) : 12;
  const currentMoisIdx = mois > 0 ? mois : lastDataMois;

  const ytdN = mensuel
    .filter(r => parseInt(r.mois) <= currentMoisIdx)
    .reduce((acc, r) => acc + parseFloat(r.ca_ht || 0), 0);

  const ytdN1 = compar
    .filter(r => parseInt(r.mois) <= currentMoisIdx)
    .reduce((acc, r) => acc + parseFloat(r.ca_n1 || 0), 0);

  const ytdGrowth = pctDelta(ytdN, ytdN1);
  const ytdDelta = ytdN - ytdN1;

  const MONTH_SEASON = { 1: "Basse", 2: "Basse", 3: "Basse", 4: "Moyenne", 5: "Moyenne", 6: "Haute", 7: "Haute", 8: "Haute", 9: "Haute", 10: "Moyenne", 11: "Basse", 12: "Basse" };
  const SEA_COLOR = { "Haute": "#F87171", "Moyenne": "#FBBF24", "Basse": "#60A5FA" };
  const TRIM_COLORS = ["#60A5FA", "#FBBF24", "#F87171", "#A78BFA"];
  const CAT_COLORS = ["#A855F7", "#F59E0B", "#EC4899", "#14B8A6"];
  const SEASON_ICONS = { "Haute": "", "Moyenne": "", "Basse": "" };
  const SunIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="5" fill="url(#sunGrad)" stroke="#F97316" strokeWidth="1" />
      <g stroke="#FBBF24" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="1" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="23" />
        <line x1="1" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
        <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
        <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
        <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
      </g>
    </svg>
  );

  const CloudSunIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="8" r="3" fill="#FDE68A" stroke="#F59E0B" strokeWidth="0.5" />
      <g stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round">
        <line x1="8" y1="3" x2="8" y2="5" />
        <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
        <line x1="3" y1="8" x2="5" y2="8" />
      </g>
      <path d="M18 17H7a4 4 0 1 1 .4-7.9A5 5 0 0 1 17 7h.5a3.5 3.5 0 0 1 0 7h-1" fill="#E0F2FE" stroke="#DB2777" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );

  const SnowflakeIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
      <circle cx="12" cy="12" r="2" fill="#CBD5E1" />
      <g stroke="#94A3B8" strokeWidth="1">
        <line x1="12" y1="5" x2="12" y2="7" />
        <line x1="12" y1="17" x2="12" y2="19" />
        <line x1="5" y1="12" x2="7" y2="12" />
        <line x1="17" y1="12" x2="19" y2="12" />
      </g>
    </svg>
  );

  const SAISON_CONFIG = {
    "Haute": { icon: <SunIcon />, color: "#F97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.20)", gradient: "linear-gradient(135deg, #FFF7ED, #FFEDD5)" },
    "Moyenne": { icon: <CloudSunIcon />, color: "#DB2777", bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.20)", gradient: "linear-gradient(135deg, #F0F9FF, #E0F2FE)" },
    "Basse": { icon: <SnowflakeIcon />, color: "#1E3A8A", bg: "rgba(30,58,138,0.15)", border: "rgba(30,58,138,0.30)", gradient: "linear-gradient(135deg, #DBEAFE, #3B82F6)" },
  };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", flexDirection: "column", gap: 20, paddingBottom: 24 }}>

      {/* ── Header: Executive Title ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 4, height: 24, background: "#8B5CF6", borderRadius: 4 }} />
            <EditableText
              textKey="ca_main_title"
              defaultText={`Analyse du Chiffre d'Affaires ${mois > 0 ? MOIS_NOMS[mois - 1] + " " : ""}${annee}`}
              style={{ fontSize: 22, fontWeight: 950, color: "#0F172A", letterSpacing: "-0.03em" }}
            />
          </div>
          <EditableText textKey="ca_header_subtitle" defaultText="Performance financière consolidée · Comparatif N-1 · Tendance YTD" style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginTop: 4, paddingLeft: 16 }} />
        </div>
        <div style={{ background: "rgba(255,255,255,0.6)", padding: "8px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.8)", backdropFilter: "blur(8px)", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
           <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Statut Dashboard</span>
           <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
             <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B98166" }} />
             <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>Données Réelles</span>
           </div>
        </div>
      </div>

      {/* ── Executive Summary Row ── */}
      {kpi && ytd && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${mois > 0 ? 4 : 3}, 1fr)`, gap: 16 }}>
          <KpiCard
            titleKey={`kpi_ca_title_${mois}`} 
            title={mois > 0 ? `CA HT ${MOIS_NOMS[mois - 1]}` : `CA TOTAL ANNUEL ${annee}`} 
            value={fmtM(n)} 
            valN1={fmtM(n1)}
            subtitleKey={`kpi_ca_sub_${mois}`} 
            subtitle="Volume d'activité mensuel"
            delta={fmtDelta(growthDelta)} color="#8B5CF6" icon={<IconCrown />}
          />
          <KpiCard
            titleKey={`kpi_ecart_title_${mois}`} 
            title={`Variation Net N vs N-1`} 
            value={fmtM(n - n1)}
            subtitleKey={`kpi_ecart_sub_${mois}`} 
            subtitle="Impact monétaire direct" color="#F59E0B" icon={<IconGem />}
          />
          <KpiCard
            titleKey={`kpi_croiss_title_${mois}`} 
            title={`Indice de Croissance`} 
            value={`${growthDelta >= 0 ? "+" : ""}${parseFloat(growthDelta || 0).toFixed(1)}%`}
            subtitleKey={`kpi_croiss_sub_${mois}`} 
            subtitle="Progression relative" color={growthDelta >= 0 ? "#10B981" : "#EF4444"}
            icon={growthDelta >= 0 ? <IconTrendUp /> : <IconTrendDown />}
          />
          {mois > 0 && (
            <KpiCard
              titleKey={`kpi_ytd_title_${mois}`} title={`Performance YTD`} value={fmtM(ytdN)} subtitleKey={`kpi_ytd_sub_${mois}`} subtitle={`Janv - ${MOIS_NOMS[currentMoisIdx - 1]} ${annee}`}
              valN1={fmtM(ytdN1)}
              delta={fmtDelta(ytdGrowth)} color="#EC4899" icon={<IconCalendar />}
            />
          )}
        </div>
      )}

      {/* ── Charts Row 1: CA Mensuel & Cumul | N vs N-1 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* CA Mensuel & Cumul - bars + line */}
        {(() => {
          const SEA_GRAD = { "Haute": "gradSH", "Moyenne": "gradSM", "Basse": "gradSB" };
          const seasoned = cumulData.map((r) => ({
            ...r, _saison: r.saison || MONTH_SEASON[parseInt(r.mois || 0)] || "Basse"
          }));
          const maxCA = Math.max(...seasoned.map(r => parseFloat(r.ca_ht || 0)), 100000);
          const maxCumul = Math.max(...seasoned.map(r => parseFloat(r.ca_cumul_calc || 0)), 100000);
          const totalCA = seasoned.reduce((s, r) => s + parseFloat(r.ca_ht || 0), 0);
          const maxBar = maxCA * 1.3;
          const maxLine = maxCumul * 1.15;
          return (
            <ChartCard titleKey="chart_ca_mensuel" title="Analyse Temporelle des Revenus" subtitle={<>Performance consolidée HT · Total Annuel: {fmtM(totalCA)}</>}>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={seasoned} margin={{ top: 20, right: 40, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradSH" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F43F5E" /><stop offset="100%" stopColor="#FB7185" /></linearGradient>
                    <linearGradient id="gradSM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D97706" /><stop offset="100%" stopColor="#FBBF24" /></linearGradient>
                    <linearGradient id="gradSB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" /><stop offset="100%" stopColor="#60A5FA" /></linearGradient>
                    <linearGradient id="cumulArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#94A3B8" stopOpacity={0.15} /><stop offset="100%" stopColor="#94A3B8" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="mois_nom" tick={{ fontSize: 10, fill: "#94A3B8", fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 10, fill: "#94A3B8", fontWeight: 600 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} domain={[0, maxBar]} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#94A3B8", fontWeight: 600 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} domain={[0, maxLine]} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "rgba(15,23,42,0.95)", border: "none", borderRadius: 12, padding: "12px 16px", boxShadow: "0 12px 24px rgba(0,0,0,0.25)" }}
                    labelStyle={{ color: "#CBD5E1", fontWeight: 800, fontSize: 12, marginBottom: 8, textTransform: "uppercase" }}
                    formatter={(v, name) => name === "Cumul" ? [`${(v / 1000000).toFixed(2)}M TND`, "Cumul Annuel"] : [`${(v / 1000).toFixed(0)}K TND`, "Revenu Mensuel"]}
                  />
                  <Area yAxisId="right" type="monotone" dataKey="ca_cumul_calc" fill="url(#cumulArea)" stroke="none" />
                  <Bar yAxisId="left" dataKey="ca_ht" radius={[6, 6, 0, 0]} barSize={24}>
                    {seasoned.map((r, i) => <Cell key={i} fill={`url(#${SEA_GRAD[r._saison] || "gradSB"})`} />)}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="ca_cumul_calc" stroke="#94A3B8" strokeWidth={3} strokeDasharray="6 4" dot={false} activeDot={{ r: 6, fill: "#0F172A", stroke: "#fff", strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "center", background: "#F8FAFC", padding: "8px 20px", borderRadius: 12, border: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}><div style={{ width: 10, height: 10, background: "#2563EB", borderRadius: 3 }} /><span style={{ fontSize: 9, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Basse</span></div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}><div style={{ width: 10, height: 10, background: "#D97706", borderRadius: 3 }} /><span style={{ fontSize: 9, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Moyenne</span></div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}><div style={{ width: 10, height: 10, background: "#F43F5E", borderRadius: 3 }} /><span style={{ fontSize: 9, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Haute</span></div>
                <div style={{ width: 1, height: 10, background: "#E2E8F0" }} />
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}><div style={{ width: 16, height: 3, background: "#94A3B8", borderRadius: 2 }} /><span style={{ fontSize: 9, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Tendance Cumulée</span></div>
              </div>
            </ChartCard>
          );
        })()}

        {/* N vs N-1 - simple grouped bars */}
        {(() => {
          const posGrowth = compar.filter(r => parseFloat(r.growth_rate) >= 0).length;
          const totalDiff = compar.reduce((s, r) => s + parseFloat(r.diff_absolue || 0), 0);
          const maxN = Math.max(...compar.map(r => parseFloat(r.ca_n || 0)), 50000);
          const maxN1 = Math.max(...compar.map(r => parseFloat(r.ca_n1 || 0)), 50000);
          const maxBar = Math.max(maxN, maxN1) * 1.3;
          return (
            <ChartCard titleKey="chart_vs_n1" title={`Analyse Comparative ${annee} vs ${annee - 1}`} subtitle={<>Hausse sur {posGrowth}/12 mois · Écart Total: {fmtM(Math.abs(totalDiff))}</>}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={compar} barCategoryGap="12%" margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="mois_nom" tick={{ fontSize: 10, fill: "#94A3B8", fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8", fontWeight: 600 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} domain={[0, maxBar]} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "rgba(15,23,42,0.95)", border: "none", borderRadius: 12, padding: "12px 16px", boxShadow: "0 12px 24px rgba(0,0,0,0.25)" }}
                    labelStyle={{ color: "#CBD5E1", fontWeight: 800, fontSize: 12, marginBottom: 8, textTransform: "uppercase" }}
                    formatter={v => [`${(v / 1000).toFixed(1)}K TND`, "Revenu"]}
                  />
                  <Bar dataKey="ca_n" name={String(annee)} fill="#8B5CF6" radius={[6, 6, 0, 0]} barSize={20} />
                  <Bar dataKey="ca_n1" name={String(annee - 1)} fill="#E2E8F0" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 20, marginTop: 12, justifyContent: "center", background: "#F8FAFC", padding: "8px 20px", borderRadius: 12, border: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ width: 14, height: 14, background: "#8B5CF6", borderRadius: 4 }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#475569" }}>ANNÉE {annee}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ width: 14, height: 14, background: "#E2E8F0", borderRadius: 4 }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#475569" }}>ANNÉE {annee - 1}</span>
                </div>
              </div>
            </ChartCard>
          );
        })()}
      </div>

      {/* ── Charts Row 2: Trimestre | Saisonnalité | Catégories ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, alignItems: "stretch" }}>

        {/* Trimestre - INTERACTIVE DONUT CHART */}
        <ChartCard titleKey="chart_trimestres" title="Trimestres" subtitle="Parts du CA annuel">
          {(() => {
            const total = trim.reduce((s, r) => s + parseFloat(r.ca_total || 0), 0);
            const icons = ["", "", "", ""];
            const segments = trim.map((r, i) => ({
              label: r.trimestre,
              value: parseFloat(r.ca_total || 0),
              color: TRIM_COLORS[i],
              icon: icons[i],
            }));
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "6px 0" }}>
                <DonutChart
                  segments={segments}
                  total={total}
                  size={148}
                  thickness={24}
                  centerLabel={(total / 1000000).toFixed(1) + "M"}
                  centerSub="TND TOT"
                  onHover={(idx) => setHovered(idx)}
                />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                  {segments.map((seg, i) => {
                    const pct = total > 0 ? (seg.value / total * 100) : 0;
                    const isHov = hovered === i;
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 9,
                        padding: "7px 10px", borderRadius: 12,
                        background: isHov ? `${seg.color}10` : "#FFFFFF",
                        border: `1px solid ${isHov ? seg.color + "55" : seg.color + "25"}`,
                        transition: "all 0.22s cubic-bezier(0.4,0,0.2,1)",
                        boxShadow: isHov ? `0 4px 14px ${seg.color}28` : "0 1px 4px rgba(0,0,0,0.04)",
                        transform: isHov ? "translateX(3px)" : "none",
                      }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 9,
                          background: `linear-gradient(135deg, ${seg.color}20, ${seg.color}08)`,
                          border: `1px solid ${seg.color}35`,
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
                        }}>{seg.icon}</div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#374151" }}>{seg.label}</span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: seg.color }}>{pct.toFixed(1)}%</span>
                          </div>
                          <div style={{ height: 5, background: "#F1F5F9", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: 0, background: `linear-gradient(90deg, ${seg.color}, ${seg.color}bb)`, borderRadius: 99, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }}
                              ref={el => { if (el) setTimeout(() => el.style.width = pct + "%", 120 + i * 130); }} />
                          </div>
                        </div>
                        <div style={{ fontSize: 9, color: "#64748B", fontWeight: 500, minWidth: 46, textAlign: "right" }}>
                          {fmtTNDSmall(seg.value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </ChartCard>
        {/* Saisonnalité - PREMIUM CARDS */}
        <ChartCard title="Saisonnalité" subtitle="Répartition par saison">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {(() => {
              const total = saison.reduce((s, r) => s + parseFloat(r.ca_total || 0), 0);
              const sorted = [...saison].sort((a, b) => parseFloat(b.ca_total) - parseFloat(a.ca_total));
              return sorted.map((r, i) => {
                const pct = total > 0 ? (parseFloat(r.ca_total) / total * 100).toFixed(3) : 0;
                const cfg = SAISON_CONFIG[r.saison] || { icon: "", color: "#64748B", bg: "#F8FAFC", gradient: "linear-gradient(135deg, #F8FAFC, #FFF)" };
                return (
                  <div key={i} style={{
                    background: cfg.gradient,
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    border: `1px solid ${cfg.border}`,
                    boxShadow: `0 4px 12px ${cfg.color}10`,
                    transition: "all 0.25s ease",
                    position: "relative",
                    overflow: "hidden"
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 20px ${cfg.color}20`; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 4px 12px ${cfg.color}10`; }}
                  >
                    <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: `linear-gradient(180deg, ${cfg.color}, ${cfg.color}60)`, borderRadius: "12px 0 0 12px" }} />
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: `linear-gradient(135deg, ${cfg.color}15, ${cfg.color}05)`,
                      border: `2px solid ${cfg.color}25`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: `0 4px 16px ${cfg.color}25`,
                      flexShrink: 0, marginLeft: 4
                    }}>
                      {cfg.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{r.saison}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: cfg.color }}>{pct}%</span>
                      </div>
                      <div style={{ height: 6, background: `${cfg.color}10`, borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}99)`, borderRadius: 99, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: "#64748B", minWidth: 50, textAlign: "right", fontWeight: 600 }}>{fmtTNDSmall(parseFloat(r.ca_total))}</span>
                  </div>
                );
              });
            })()}
          </div>
        </ChartCard>

        {/* Catégories - INTERACTIVE DONUT */}
        <ChartCard title="Catégories" subtitle="CA par type de chambre">
          {(() => {
            const total = categ.reduce((s, r) => s + parseFloat(r.ca_ht_total || 0), 0);
            const sorted = [...categ].sort((a, b) => parseFloat(b.ca_ht_total) - parseFloat(a.ca_ht_total));
            const catIcons = [
              <svg key="0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16" /><path d="M2 8h18a2 2 0 012 2v10" /><path d="M2 17h20" /><path d="M6 8v9" /></svg>,
              <svg key="1" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3 7h8l-6 5 2 9-7-5-7 5 2-9-6-5h8z" /></svg>,
              <svg key="2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" /></svg>,
              <svg key="3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1" /><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" /><path d="M6 1v3" /><path d="M10 1v3" /><path d="M14 1v3" /></svg>
            ];
            const segments = sorted.map((r, i) => ({
              label: r.categorie,
              value: parseFloat(r.ca_ht_total || 0),
              color: CAT_COLORS[i % 4],
            }));
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
                <DonutChart
                  segments={segments}
                  total={total}
                  size={130}
                  thickness={22}
                  centerLabel={(total / 1000000).toFixed(2) + "M"}
                  centerSub="TND"
                  onHover={(idx) => setHoveredCat(idx)}
                />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                  {segments.map((seg, i) => {
                    const pct = total > 0 ? (seg.value / total * 100).toFixed(3) : 0;
                    const isHov = hoveredCat === i;
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "5px 8px", borderRadius: 10,
                        background: isHov ? `${seg.color}10` : "transparent",
                        border: `1px solid ${isHov ? seg.color + "40" : "transparent"}`,
                        transition: "all 0.2s ease",
                        transform: isHov ? "translateX(3px)" : "none",
                      }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 8,
                          background: `linear-gradient(135deg, ${seg.color}20, ${seg.color}08)`,
                          border: `1px solid ${seg.color}30`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: seg.color, flexShrink: 0
                        }}>{catIcons[i % 4]}</div>
                        <span style={{ fontSize: 10, color: "#334155", fontWeight: 600, flex: 1, textTransform: "capitalize" }}>{seg.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: seg.color }}>{pct}%</span>
                        <span style={{ fontSize: 9, color: "#94A3B8", minWidth: 46, textAlign: "right", fontWeight: 500 }}>{fmtTNDSmall(seg.value)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </ChartCard>
      </div>

      {/* ── Analytical Detail Grid: High-Density BI Cards ── */}
      <ChartCard titleKey="chart_detail_mensuel" title="Intelligence Opérationnelle Mensuelle" subtitle="Analyse comparative N vs N-1 · Seuils de performance · Alertes de croissance">
        <div style={{ display: "grid", gridTemplateColumns: mois > 0 ? "1fr" : "repeat(3, 1fr)", gap: 20 }}>
          {(() => {
            const dataToShow = compar.filter(r => mois === 0 || parseInt(r.mois) === mois);
            const maxCA = Math.max(...compar.map(r => parseFloat(r.ca_n || 0)), 1);
            const maxGrowth = Math.max(...compar.map(r => parseFloat(r.growth_rate || 0)), -100);
            
            return dataToShow.map((r, i) => {
              const caN = parseFloat(r.ca_n || 0);
              const caN1 = parseFloat(r.ca_n1 || 0);
              const diff = caN - caN1;
              const growth = parseFloat(r.growth_rate || 0);
              const isBestCA = caN === maxCA && mois === 0;
              const isBestGrowth = growth === maxGrowth && growth > 0 && mois === 0;

              const theme = (SAISON_CONFIG[r.saison] || SAISON_CONFIG["Basse"]);

              return (
                <div key={i} style={{
                  background: "#FFFFFF",
                  borderRadius: 24,
                  border: "1px solid #E2E8F0",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)",
                  overflow: "hidden"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-6px)";
                  e.currentTarget.style.boxShadow = "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)";
                  e.currentTarget.style.borderColor = theme.color + "44";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.02)";
                  e.currentTarget.style.borderColor = "#E2E8F0";
                }}
                >
                  {/* Visual Seasonal Background Element */}
                  <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: theme.color + "08", filter: "blur(20px)" }} />

                  {/* Header: Month & Season Badge */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ 
                        width: 48, height: 48, borderRadius: 14, 
                        background: theme.bg, color: theme.color, 
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, border: `1px solid ${theme.color}22`,
                        boxShadow: `0 4px 12px ${theme.color}15`
                      }}>
                        {theme.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 950, color: "#0F172A", letterSpacing: "-0.02em" }}>{r.mois_nom}</div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: theme.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>Saison {r.saison}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                       {isBestCA && <span style={{ fontSize: 9, fontWeight: 900, color: "#fff", background: "#8B5CF6", padding: "3px 8px", borderRadius: 6, textTransform: "uppercase" }}>Performance Record</span>}
                       {isBestGrowth && <span style={{ fontSize: 9, fontWeight: 900, color: "#fff", background: "#10B981", padding: "3px 8px", borderRadius: 6, textTransform: "uppercase" }}>Croissance Max</span>}
                    </div>
                  </div>

                  {/* Main Metric: CA HT */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Chiffre d'Affaires HT</span>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 28, fontWeight: 950, color: "#0F172A", letterSpacing: "-0.04em", fontFamily: "monospace" }}>{fmt(caN)}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#64748B" }}>TND</span>
                      </div>
                      <div style={{ 
                        padding: "6px 12px", borderRadius: 10,
                        background: growth >= 0 ? "#ECFDF5" : "#FEF2F2",
                        color: growth >= 0 ? "#059669" : "#DC2626",
                        border: `1px solid ${growth >= 0 ? "#D1FAE5" : "#FEE2E2"}`,
                        display: "flex", alignItems: "center", gap: 4
                      }}>
                        <span style={{ fontSize: 16, fontWeight: 950 }}>{growth >= 0 ? "+" : ""}{growth.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Comparative Metrics Grid */}
                  <div style={{ 
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
                    background: "#F8FAFC", borderRadius: 16, padding: "16px",
                    border: "1px solid #F1F5F9"
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Objectif N-1</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: "#334155", fontFamily: "monospace" }}>{fmt(caN1)} <span style={{ fontSize: 9, color: "#94A3B8" }}>TND</span></span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, borderLeft: "2px solid #E2E8F0", paddingLeft: 12 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: diff >= 0 ? "#059669" : "#DC2626", textTransform: "uppercase" }}>Variation Net</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: diff >= 0 ? "#059669" : "#DC2626", fontFamily: "monospace" }}>{diff >= 0 ? "+" : ""}{fmt(diff)}</span>
                    </div>
                  </div>

                  {/* Contribution Visual (Progress Bar) */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 900, color: "#64748B", textTransform: "uppercase" }}>Poids CA Annuel</span>
                      <span style={{ fontSize: 12, fontWeight: 950, color: "#0F172A" }}>{((caN / maxCA) * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, background: "#F1F5F9", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ 
                        width: `${(caN / maxCA) * 100}%`, 
                        height: "100%", 
                        background: growth >= 0 ? `linear-gradient(90deg, ${theme.color}, ${theme.color}CC)` : `linear-gradient(90deg, #EF4444, #F87171)`,
                        borderRadius: 99 
                      }} />
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </ChartCard>

      {/* ── Department Breakdown: Premium Master BI Rows ── */}
      <ChartCard titleKey="chart_detail_categorie" title="Performance par Département" subtitle="Vue analytique consolidée · Ventilation TTC vs HT · Poids relatif">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {categ.map((r, i) => {
            const ttc = parseFloat(r.ca_ttc_total || 0), ht = parseFloat(r.ca_ht_total || 0);
            const tva = ttc > 0 ? ((ttc - ht) / ttc * 100).toFixed(1) : 0;
            const part = parseFloat(r.part_pct || 0);
            const color = CAT_COLORS[i % 4];

            return (
              <div key={i} style={{
                background: "#FFFFFF",
                borderRadius: 20,
                border: "1px solid #E2E8F0",
                padding: "20px 28px",
                display: "grid",
                gridTemplateColumns: "1.4fr 1.2fr 1fr 140px",
                alignItems: "center",
                gap: 32,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                overflow: "hidden"
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateX(6px)";
                  e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0,0,0,0.05)";
                  e.currentTarget.style.borderColor = `${color}44`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateX(0)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.borderColor = "#E2E8F0";
                }}
              >

                {/* Department Info */}
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: `${color}10`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: color, border: `1px solid ${color}15`,
                    boxShadow: `0 4px 12px ${color}08`
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {i === 0 && <><path d="M2 4v16" /><path d="M2 8h18a2 2 0 012 2v10" /><path d="M2 17h20" /><path d="M6 8v9" /></>}
                      {i === 1 && <><path d="M12 2l3 7h8l-6 5 2 9-7-5-7 5 2-9-6-5h8z" /><path d="M2 22h20" /></>}
                      {i === 2 && <><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" /></>}
                      {i === 3 && <><path d="M18 8h1a4 4 0 010 8h-1" /><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" /><path d="M6 1v3" /><path d="M10 1v3" /><path d="M14 1v3" /></>}
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 950, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.02em" }}>{r.categorie}</div>
                    <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, marginTop: 1 }}>Impact: <span style={{ color: color }}>{part.toFixed(1)}%</span> du CA</div>
                  </div>
                </div>

                {/* Main Value Center Group */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Chiffre d'Affaires TTC</div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 4 }}>
                    <span style={{ fontSize: 24, fontWeight: 950, color: "#0F172A", letterSpacing: "-0.03em", fontFamily: "monospace" }}>{fmt(ttc)}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#94A3B8" }}>TND</span>
                  </div>
                </div>

                {/* Detailed Financial Metrics */}
                <div style={{ display: "flex", gap: 24, justifyContent: "flex-end", borderLeft: "1px solid #F1F5F9", paddingLeft: 24 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>Hors Taxes</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#475569", fontFamily: "monospace", marginTop: 2 }}>{fmt(ht)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>TVA Estimée</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#D97706", fontFamily: "monospace", marginTop: 2 }}>{tva}%</div>
                  </div>
                </div>

                {/* Progress Visual */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginLeft: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <span style={{ fontSize: 20, fontWeight: 950, color: color }}>{Math.round(part)}<span style={{ fontSize: 10, opacity: 0.7 }}>%</span></span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" }}>Contribution</span>
                  </div>
                  <div style={{ height: 6, width: "100%", background: "#F1F5F9", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${part}%`, background: `linear-gradient(90deg, ${color}, ${color}CC)`, borderRadius: 99 }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>

    </div>
  );
}
