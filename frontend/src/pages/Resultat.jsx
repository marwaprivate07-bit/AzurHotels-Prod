// frontend/src/pages/Resultat.jsx — PREMIUM LIGHT THEME (Reference Design)
import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Line, Area, AreaChart, LineChart,
  ReferenceLine, Cell, PieChart, Pie
} from "recharts";
import axios from "axios";
import API, { getResultatAnnuel, getResultatMensuel, getCAYtd } from "../services/api";
import { useDashboard } from "../components/DashboardContext";
import KpiCard from "../components/KpiCard";
import ChartCard from "../components/ChartCard";
import EditableText from "../components/EditableText";
import { IconRevenue, IconTrendDown, IconAward, IconBarChart, IconCheckCircle, IconAlertCircle, IconReceipt, IconScale, IconCrown, IconGem, IconSparkles, IconRocket, IconLeaf, IconTarget, IconCoins, IconUsers, IconZap, IconShoppingCart, IconTrendUp } from "../components/KpiIcons";

const formatSpaces = v => {
  const num = Math.round(Number(v || 0));
  const s = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return <>{s} <span style={{ fontSize: '0.7em', opacity: 0.8, fontWeight: 700 }}>TND</span></>;
};
const fmtM = v => formatSpaces(v);
const fmtK = v => formatSpaces(v);
const fmtPct = v => `${Number(v || 0).toFixed(1)}%`;
const pct = (a, b) => (b > 0 ? (((a - b) / b) * 100).toFixed(1) : null);
const delta = d => { if (d === null) return "—"; const num = parseFloat(d); return num >= 0 ? `+${d}%` : `${d}%`; };

const C = { ca: "#A855F7", charges: "#E11D48", rbe: "#059669", resultat: "#7C3AED", marge: "#D97706" };
const axTick = { fontSize: 12, fill: "#64748B", fontFamily: "var(--font-heading)", fontWeight: 600 };
const gridStroke = "rgba(148,163,184,0.18)";

const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(15,23,42,0.92)", borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.12)", color: "#F1F5F9", fontSize: 12, boxShadow: "0 16px 40px rgba(0,0,0,0.25)", backdropFilter:"blur(12px)" }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#60A5FA", fontSize: 11 }}>{label}</div>
      {payload.map((p, i) => (<div key={i} style={{ color: p.color || "#f1f5f9", marginBottom: 2 }}>{p.name}: <strong>{p.value?.toLocaleString ? formatSpaces(p.value) : p.value}</strong></div>))}
    </div>
  );
};

const Spinner = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 180, flexDirection: "column", gap: 10 }}>
    <div className="spinner" />
    <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>Chargement des données…</span>
  </div>
);

function WaterfallRow({ label, value, color, bold, sub, indent = false, ratio }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: bold ? "12px 16px" : "9px 16px",
      background: bold ? "#F8FAFC" : "transparent",
      borderBottom: "1px solid #F1F5F9",
      borderLeft: indent ? `3px solid ${color}60` : "3px solid transparent",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {indent && <div style={{ width: 16 }} />}
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: bold ? 15 : 14, fontWeight: bold ? 800 : 600, color: bold ? "#0F172A" : "#334155", fontFamily: "var(--font-heading)" }}>{label}</span>
        {sub && <span style={{ fontSize: 12, color: "#94A3B8", marginLeft: 4 }}>({sub})</span>}
        {ratio !== undefined && ratio !== null && !isNaN(ratio) && (
          <div style={{ 
            fontSize: 10, 
            fontWeight: 800, 
            color: color, 
            background: `${color}15`, 
            padding: "2px 8px", 
            borderRadius: 6, 
            marginLeft: 8,
            border: `1px solid ${color}30`,
            textTransform: "uppercase",
            letterSpacing: "0.02em"
          }}>
            {Number(ratio).toFixed(1)}% du CA
          </div>
        )}
      </div>
      <span style={{ fontSize: bold ? 16 : 15, fontWeight: bold ? 700 : 600, color: color, fontFamily: "var(--font-heading)", fontVariantNumeric: "tabular-nums" }}>
        {value >= 0 ? "" : "− "}{fmtK(Math.abs(value))}
      </span>
    </div>
  );
}

export default function Resultat() {
  const { hotelId, annee, mois } = useDashboard();
  const anneeN1 = annee - 1;
  const [data, setData] = useState([]);
  const [mensuelCa, setMensuelCa] = useState([]);
  const [mensuelCh, setMensuelCh] = useState([]);
  const [caYtd, setCaYtd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const MOIS_NOMS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const [dataN, setDataN] = useState(null);
  const [dataN1, setDataN1] = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    const promises = [
      getResultatAnnuel(null, hotelId),
      getResultatMensuel(annee, mois, hotelId)
    ];

    Promise.all(promises)
      .then(([resAnn, resMois]) => {
        setData(resAnn.data.data || []);
        setDataN(resMois.data.data);
        setDataN1(resMois.data.dataN1);
      })
      .catch(e => setError("Erreur de chargement : " + (e?.message || "backend inaccessible")))
      .finally(() => setLoading(false));
  }, [hotelId, annee, mois]);

  if (loading) return <Spinner />;
  if (error) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 320, flexDirection: "column", gap: 10 }}>
      <IconAlertCircle /><span style={{ fontWeight: 700, color: "#DC2626" }}>{error}</span>
    </div>
  );

  const rowN = dataN;
  const rowN1 = dataN1;

  if (!rowN) return (<div style={{ textAlign: "center", padding: 80, color: "#94A3B8", fontSize: 14 }}>Aucune donnée disponible pour {mois > 0 ? MOIS_NOMS[mois-1] : annee}</div>);

  const caTtc = rowN.ca_ttc || 0, caHt = rowN.ca_ht || 0, personnel = rowN.personnel || 0;
  const energie = rowN.energie || 0, achats = rowN.achats_consommation || 0, autresExpl = rowN.autres_exploit || 0;
  const chgFin = rowN.charges_financieres || 0, impots = rowN.impots_taxes || 0, dotations = rowN.dotations_amort || 0;
  const totalChgExp = rowN.total_charges_exploit || 0, totalChg = rowN.total_charges || 0;
  const rbe = rowN.rbe || 0, resultatNet = rowN.resultat_net || 0;
  const ratios = rowN.ratios || {};

  const margeRbe = ratios.rbe || 0, margeNette = ratios.net || 0, txCharges = ratios.total || 0;

  const pctCa = pct(caHt, rowN1?.ca_ht || 0), pctRbe = pct(rbe, rowN1?.rbe || 0);
  const pctRes = pct(resultatNet, rowN1?.resultat_net || 0), pctChg = pct(totalChg, rowN1?.total_charges || 0);

  const dataGraph = (data || []).map(r => {
    const cht = r.ca_ht || 1;
    return {
      annee: String(r.annee),
      "CA HT": r.ca_ht || 0,
      "Charges": r.total_charges || 0,
      "RBE": r.rbe || 0,
      "Résultat": r.resultat_net || 0,
      "Marge RBE (%)": r.marge_rbe || 0,
      "Marge Nette (%)": r.marge_nette || 0,
      "Personnel (%)": ((r.personnel || 0) / cht) * 100,
      "Énergie (%)": ((r.energie || 0) / cht) * 100,
      "Achats (%)": ((r.achats_consommation || 0) / cht) * 100
    };
  });

  const structureCharges = [
    { label: "Charges Personnel (HT)", value: personnel, color: "#3b82f6" },
    { label: "Énergie (HT)", value: energie, color: "#f59e0b" },
    { label: "Achats & Consommation (HT)", value: achats, color: "#10b981" },
    { label: "Autres Exploit. (HT)", value: autresExpl, color: "#8b5cf6" },
    { label: "Charges Financières (HT)", value: chgFin, color: "#ef4444" },
    { label: "Impôts & Taxes (HT)", value: impots, color: "#64748b" },
    { label: "Dotations Amort. (HT)", value: dotations, color: "#94a3b8" },
  ].filter(r => r.value > 0);

  return (

    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1600, margin: "0 auto", width: "96%", padding: "12px 0" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <EditableText textKey="resultat_header" defaultText={`Compte de Résultat ${mois > 0 ? MOIS_NOMS[mois-1] + " " : ""}${annee}`} style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
        <KpiCard titleKey="resultat_kpi_charges" title="Total Charges (HT)" value={fmtM(totalChg)} valN1={rowN1 ? fmtM(rowN1.total_charges) : null} subtitle="Coût d'exploitation" delta={`${delta(pctChg)}`} color={C.charges} icon={<IconTrendDown />} />
        <KpiCard titleKey="resultat_kpi_rbe" title="RBE (HT)" value={fmtM(rbe)} valN1={rowN1 ? fmtM(rowN1.rbe) : null} subtitle="Excédent Brut d'Exploit." delta={`${delta(pctRbe)}`} color={C.rbe} icon={<IconGem />} />
        <KpiCard titleKey="resultat_kpi_rn" title="Résultat Net (HT)" value={fmtM(resultatNet)} valN1={rowN1 ? fmtM(rowN1.resultat_net) : null} subtitle="Résultat Net Final" delta={`${delta(pctRes)}`} color={C.resultat} icon={<IconAward />} />
        <KpiCard titleKey="resultat_kpi_tx" title="Taux de Charges" value={fmtPct(txCharges)} valN1={rowN1 ? fmtPct(rowN1.ratios?.total) : null} subtitle="Charges / CA HT" color={C.marge} icon={<IconScale />} gauge={txCharges} />
        <KpiCard titleKey="resultat_kpi_caht" title="Chiffre d'Affaires (HT)" value={fmtM(caHt)} valN1={rowN1 ? fmtM(rowN1.ca_ht) : null} subtitle="Valeur nette (Hors Taxes)" color="#A855F7" icon={<IconSparkles />} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
        <KpiCard title="Ratio Personnel" value={fmtPct(ratios.personnel)} valN1={rowN1 ? fmtPct(rowN1.ratios?.personnel) : null} subtitle="Poids MS / CA HT" delta={delta(pct(ratios.personnel, rowN1?.ratios?.personnel))} color="#3b82f6" icon={<IconUsers />} negativeIsGood />
        <KpiCard title="Ratio Énergie" value={fmtPct(ratios.energie)} valN1={rowN1 ? fmtPct(rowN1.ratios?.energie) : null} subtitle="Énergie / CA HT" delta={delta(pct(ratios.energie, rowN1?.ratios?.energie))} color="#f59e0b" icon={<IconZap />} negativeIsGood />
        <KpiCard title="Ratio Achats" value={fmtPct(ratios.achats)} valN1={rowN1 ? fmtPct(rowN1.ratios?.achats) : null} subtitle="Achats / CA HT" delta={delta(pct(ratios.achats, rowN1?.ratios?.achats))} color="#10b981" icon={<IconShoppingCart />} negativeIsGood />
        <KpiCard title="Marge RBE" value={fmtPct(margeRbe)} valN1={rowN1 ? fmtPct(rowN1.ratios?.rbe) : null} subtitle="RBE / CA HT" delta={delta(pct(margeRbe, rowN1?.ratios?.rbe))} color={C.rbe} icon={<IconTrendUp />} />
        <KpiCard title="Marge Nette" value={fmtPct(margeNette)} valN1={rowN1 ? fmtPct(rowN1.ratios?.net) : null} subtitle="Net / CA HT" delta={delta(pct(margeNette, rowN1?.ratios?.net))} color={C.resultat} icon={<IconCoins />} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ChartCard titleKey="resultat_chart_detail" title="Analyse Cascade du Résultat" subtitle={`Performance ${annee} vs N-1`} accent={C.ca}>
          <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #E2E8F0", background:"#FFFFFF", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <div style={{ background: "linear-gradient(135deg, #A855F7 0%, #1D4ED8 100%)", color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <IconRocket />
                <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "0.02em" }}>CHIFFRE D'AFFAIRES TTC</span>
              </div>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 18 }}>{fmtK(caTtc)}</span>
            </div>
            <WaterfallRow label="CA HT (Net de Taxes)" value={caHt} color="#F97316" sub="Hors Taxes" indent />

            <div style={{ background: "#F8FAFC", padding: "10px 16px", borderBottom: "1px solid #EEF2F7", display:"flex", alignItems:"center", gap:8 }}>
              <IconSparkles color="#DC2626" />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.05em" }}>Charges d'Exploitation</span>
            </div>
            <WaterfallRow label="Charges Personnel (HT)" value={-personnel} color="#3b82f6" indent ratio={ratios.personnel} />
            <WaterfallRow label="Énergie & Fluides (HT)" value={-energie} color="#f59e0b" indent ratio={ratios.energie} />
            <WaterfallRow label="Achats & Consommables (HT)" value={-achats} color="#10b981" indent ratio={ratios.achats} />
            <WaterfallRow label="Autres Frais Exploit. (HT)" value={-autresExpl} color="#8b5cf6" indent ratio={ratios.autres} />
            <WaterfallRow label="Frais Financiers Exploit. (HT)" value={-chgFin} color="#ef4444" indent ratio={ratios.fin} />
            <WaterfallRow label="Total Charges d'Exploit." value={-totalChgExp} color="#DC2626" bold />

            <div style={{ background: rbe >= 0 ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.04)", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #F1F5F9", margin: "4px 8px", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.rbe, boxShadow: `0 0 10px ${C.rbe}44` }} />
                <span style={{ fontWeight: 800, fontSize: 14, color: "#1E293B" }}>RBE</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 16, color: rbe >= 0 ? C.rbe : "#DC2626" }}>
                  {rbe >= 0 ? "" : "− "}{fmtK(Math.abs(rbe))}
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.rbe, background: `${C.rbe}15`, padding: "2px 6px", borderRadius: 4, display: "inline-block" }}>
                  Ratio RBE/CA (HT) : {fmtPct(margeRbe)}
                </div>
              </div>
            </div>

            <div style={{ background: "#F8FAFC", padding: "10px 16px", borderBottom: "1px solid #EEF2F7", display:"flex", alignItems:"center", gap:8 }}>
              <IconScale color="#A855F7" />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#A855F7", textTransform: "uppercase", letterSpacing: "0.05em" }}>Post-Exploitation</span>
            </div>
            {dotations > 0 && <WaterfallRow label="Amortissements & Prov." value={-dotations} color="#94a3b8" indent />}
            {impots > 0 && <WaterfallRow label="Impôts & Taxes" value={-impots} color="#64748b" indent />}

            <div style={{ background: resultatNet >= 0 ? "linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)" : "#991B1B", color: "#fff", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <IconGem />
                <span style={{ fontWeight: 800, fontSize: 15 }}>RÉSULTAT NET FINAL</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 20, color: resultatNet >= 0 ? "#4ADE80" : "#FCA5A5" }}>
                  {resultatNet >= 0 ? "" : "− "}{fmtK(Math.abs(resultatNet))}
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: "rgba(255,255,255,0.2)", padding: "2px 6px", borderRadius: 4, display: "inline-block" }}>
                  Ratio Net/CA (HT) : {fmtPct(margeNette)}
                </div>
              </div>
            </div>
          </div>
        </ChartCard>

        {/* ── Right Column: Charts ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ChartCard titleKey="resultat_chart_annual" title="Historique de Performance" subtitle="CA HT · Charges · RBE par année" accent={C.ca}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dataGraph} margin={{ top: 10, right: 10, bottom: 0, left: 0 }} barSize={32}>
                <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="annee" tick={axTick} />
                <YAxis tickFormatter={v => `${(v / 1_000_000).toFixed(1)}M`} tick={axTick} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar dataKey="CA HT" fill={C.ca} radius={[6, 6, 0, 0]} />
                <Bar dataKey="Charges" fill={C.charges} radius={[6, 6, 0, 0]} />
                <Bar dataKey="RBE" fill={C.rbe} radius={[6, 6, 0, 0]} />
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.5)" strokeDasharray="4 2" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard titleKey="resultat_chart_efficiency" title="Efficacité Opérationnelle" subtitle="Poids des charges clés en % du CA HT" accent="#8B5CF6">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dataGraph} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="annee" tick={axTick} />
                <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={axTick} />
                <Tooltip 
                  contentStyle={{ background: "rgba(15,23,42,0.9)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }}
                  formatter={(v) => [`${v.toFixed(1)}%`]}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Line type="monotone" dataKey="Personnel (%)" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Achats (%)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Énergie (%)" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Marge RBE (%)" stroke={C.rbe} strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard titleKey="resultat_chart_postes" title="Structure des Charges" subtitle={`Répartition relative pour ${annee}`} accent={C.charges}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {structureCharges.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "#F8FAFC", borderRadius: 8, padding: "6px 12px", border:"1px solid #E2E8F0", flex: "1 1 140px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.color }} />
                  <div style={{ display:"flex", flexDirection:"column" }}>
                    <span style={{ fontSize: 9, color: "#64748B", fontWeight: 700, textTransform:"uppercase" }}>{r.label}</span>
                    <span style={{ fontSize: 12, color: r.color, fontWeight: 800 }}>{totalChg > 0 ? `${((r.value / totalChg) * 100).toFixed(1)}%` : "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      </div>

      <ChartCard titleKey="resultat_table_comparatif" title={`Tableau Comparatif de Performance ${annee} vs ${anneeN1}`} subtitle="Analyse détaillée des indicateurs financiers" accent={C.resultat}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "separate", borderSpacing: "0 4px" }}>
            <thead>
              <tr>
                {["Indicateur", anneeN1, annee, "Évolution (%)"].map((h, i) => (
                  <th key={i} style={{ padding: "10px 14px", textAlign: i > 0 ? "right" : "left", color: "#64748B", fontWeight: 800, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Chiffre d'Affaires TTC", n: caTtc, n1: rowN1?.ca_ttc, fmt: fmtM, color: C.ca, bold: true },
                { label: "Chiffre d'Affaires HT", n: caHt, n1: rowN1?.ca_ht, fmt: fmtM, color: "#475569" },
                { label: "Total des Charges", n: totalChg, n1: rowN1?.total_charges, fmt: fmtM, color: C.charges, bold: true },
                { label: "Masse Salariale", n: personnel, n1: rowN1?.personnel, fmt: fmtM, color: "#3b82f6" },
                { label: "Énergie & Fluides", n: energie, n1: rowN1?.energie, fmt: fmtM, color: "#f59e0b" },
                { label: "RBE", n: rbe, n1: rowN1?.rbe, fmt: fmtM, color: C.rbe, bold: true },
                { label: "Marge RBE (%)", n: margeRbe, n1: rowN1?.ratios?.rbe, fmt: fmtPct, color: C.rbe },
                { label: "Taux de Charges (%)", n: txCharges, n1: rowN1?.ratios?.total, fmt: fmtPct, color: C.marge },
                { label: "Résultat Net Final", n: resultatNet, n1: rowN1?.resultat_net, fmt: fmtM, color: C.resultat, bold: true },
                { label: "Marge Nette (%)", n: margeNette, n1: rowN1?.ratios?.net, fmt: fmtPct, color: C.resultat },
              ].map((row, i) => {
                const d = pct(row.n, row.n1 || 0);
                const dNum = d !== null ? parseFloat(d) : null;
                const isPos = dNum !== null && dNum > 0;
                const isGood = (row.label.includes("Charges")) ? !isPos : isPos;
                return (
                  <tr key={i} style={{ transition: "all 0.2s" }}>
                    <td style={{ padding: "10px 14px", fontWeight: row.bold ? 800 : 600, color: "#1E293B", fontSize: row.bold ? 12 : 11, background: row.bold ? "#F8FAFC" : "transparent", borderRadius: "10px 0 0 10px", borderLeft: row.bold ? `3px solid ${row.color}` : "3px solid transparent" }}>
                      {row.label}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#94A3B8", fontSize: 11, background: row.bold ? "#F8FAFC" : "transparent" }}>
                      {row.n1 != null ? row.fmt(row.n1) : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: row.color, fontWeight: 700, background: row.bold ? "#F8FAFC" : "transparent" }}>
                      {row.fmt(row.n)}
                    </td>
                    <td style={{
                      padding: "10px 14px", textAlign: "right", fontWeight: 700, fontSize: 11,
                      background: row.bold ? "#F8FAFC" : "transparent", borderRadius: "0 10px 10px 0",
                      color: dNum === null ? "#64748B" : isGood ? "#059669" : "#DC2626",
                    }}>
                      {dNum === null ? "—" : (isPos ? "↑ " : "↓ ") + Math.abs(dNum) + "%"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
