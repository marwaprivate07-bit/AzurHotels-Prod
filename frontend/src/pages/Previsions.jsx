import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useDashboard } from "../components/DashboardContext";
import KpiCard from "../components/KpiCard";
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  TrendingUp, TrendingDown, Coins, Users, Target,
  Zap, AlertTriangle, CheckCircle, Calendar,
  Activity, Info
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const h   = () => ({ Authorization: `Bearer ${localStorage.getItem("bi_token")}` });

const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const C = { ca:"#6366F1", to:"#10B981", adr:"#F59E0B", rev:"#EC4899", neu:"#64748B" };

const mapeQ = v => {
  if (v==null) return {label:"—",color:"#94A3B8"};
  if (v<10)   return {label:"Très haute précision",color:"#10B981"};
  if (v<20)   return {label:"Bonne précision",color:"#3B82F6"};
  if (v<50)   return {label:"Précision raisonnable",color:"#F59E0B"};
  return           {label:"Précision insuffisante",color:"#EF4444"};
};

const fmt  = v => Math.round(v||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");

// [FIX-2] fmtM retourne une STRING pour que KpiCard puisse détecter " TND" correctement
const fmtM = v => `${fmt(v)} TND`;

// fmtMJsx pour affichage inline stylé (tooltip, tableau)
const fmtMJsx = v => (
  <>{fmt(v)} <span style={{fontSize:"0.7em",opacity:0.8,fontWeight:800}}>TND</span></>
);

const COULEUR = {
  rouge: {bg:"#FEF2F2",text:"#DC2626",border:"#FCA5A5"},
  orange:{bg:"#FFF7ED",text:"#EA580C",border:"#FDBA74"},
  jaune: {bg:"#FEFCE8",text:"#CA8A04",border:"#FDE047"},
  bleu:  {bg:"#EFF6FF",text:"#2563EB",border:"#93C5FD"},
  vert:  {bg:"#F0FDF4",text:"#16A34A",border:"#86EFAC"},
};

// [FIX-4] DarkTip reçoit tabKey pour formatter correctement CA / TO / ADR
const DarkTip = ({ active, payload, label, tabKey }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:"rgba(15,23,42,0.95)",borderRadius:10,padding:"10px 14px",border:"1px solid rgba(255,255,255,0.1)",color:"#F1F5F9",fontSize:12}}>
      <div style={{fontWeight:700,color:"#818CF8",marginBottom:6}}>{label}</div>
      {payload.map((p,i) => {
        let valStr;
        if (tabKey === "to") {
          valStr = `${p.value}%`;
        } else {
          // CA et ADR — affichage avec TND
          valStr = `${fmt(p.value)} TND`;
        }
        return (
          <div key={i} style={{color:p.color,marginBottom:2}}>
            {p.name}: <strong>{valStr}</strong>
          </div>
        );
      })}
    </div>
  );
};

const STitle = ({children, sub, accent="#6366F1"}) => (
  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
    <div style={{width:4,height:32,borderRadius:4,background:accent}}/>
    <div>
      <h2 style={{fontSize:15,fontWeight:800,color:"#1E293B",margin:0}}>{children}</h2>
      {sub && <p style={{fontSize:12,color:"#94A3B8",margin:0}}>{sub}</p>}
    </div>
  </div>
);

const Insight = ({icon:Icon, color, text, bold}) => (
  <div style={{display:"flex",gap:10,alignItems:"flex-start",background:`${color}08`,border:`1px solid ${color}25`,borderRadius:12,padding:"12px 14px"}}>
    <div style={{width:28,height:28,borderRadius:8,background:`${color}18`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      <Icon size={14} color={color}/>
    </div>
    <span style={{fontSize:13,color:"#334155",lineHeight:1.5}}>
      <strong style={{color}}>{bold} </strong>{text}
    </span>
  </div>
);

// [AMÉLIORATION] Skeleton loading
const SkeletonCard = () => (
  <div style={{background:"#F1F5F9",borderRadius:16,height:120,animation:"skpulse 1.5s ease-in-out infinite"}}>
    <style>{`@keyframes skpulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
  </div>
);

// [FIX-5] Empty state pour sections sans données
const EmptyState = ({message}) => (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px",gap:10,color:"#94A3B8",background:"#F8FAFC",borderRadius:12,border:"1px dashed #CBD5E1"}}>
    <Info size={28} color="#CBD5E1"/>
    <p style={{fontSize:13,fontWeight:600,margin:0}}>{message}</p>
  </div>
);

/* ═══════════════════════════════════════════════════════ */
export default function Previsions() {
  const { hotelId } = useDashboard();
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);
  // [FIX-3] États cohérents — null pour objets, [] pour listes
  const [kpi,  setKpi]  = useState(null);
  const [met,  setMet]  = useState(null);
  const [comp, setComp] = useState([]);
  const [reco, setReco] = useState([]);
  const [prev, setPrev] = useState([]);
  const [tab,  setTab]  = useState("ca");

  const load = useCallback(async id => {
    setLoading(true); setErr(null);
    try {
      const p = {hotel_id:id}, hd = h();
      const [rK,rM,rC,rR,rP] = await Promise.all([
        axios.get(`${API}/previsions/kpi`,            {params:p, headers:hd}),
        axios.get(`${API}/previsions/metriques`,       {params:p, headers:hd}),
        axios.get(`${API}/previsions/comparaison`,     {params:p, headers:hd}),
        axios.get(`${API}/previsions/recommandations`, {params:p, headers:hd}),
        axios.get(`${API}/previsions/annuel`,          {params:p, headers:hd}),
      ]);
      setKpi(rK.data.data   ?? null);
      setMet(rM.data.data   ?? null);
      setComp(rC.data.data  ?? []);
      setReco(rR.data.data?.detail ?? []);
      setPrev(rP.data.data  ?? []);
    } catch(e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(hotelId); }, [hotelId, load]);

  // [AMÉLIORATION] Skeleton au lieu d'un simple spinner
  if (loading) return (
    <div style={{maxWidth:1600,margin:"0 auto",width:"96%",padding:"12px 0",display:"flex",flexDirection:"column",gap:24}}>
      <div style={{background:"linear-gradient(135deg,#1E1B4B,#312E81)",borderRadius:20,height:120,opacity:0.25,animation:"skpulse 1.5s ease-in-out infinite"}}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14}}>
        <SkeletonCard/><SkeletonCard/><SkeletonCard/>
      </div>
      <div style={{background:"#F1F5F9",borderRadius:16,height:200,animation:"skpulse 1.5s ease-in-out infinite"}}/>
      <p style={{textAlign:"center",color:"#64748B",fontSize:13,fontWeight:600,margin:0}}>Chargement du modèle prédictif…</p>
    </div>
  );

  if (err) return (
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:400,flexDirection:"column",gap:12}}>
      <AlertTriangle color="#EF4444" size={32}/>
      <span style={{color:"#EF4444",fontWeight:700,fontSize:14,textAlign:"center",maxWidth:400}}>{err}</span>
      <button
        onClick={() => load(hotelId)}
        style={{marginTop:8,padding:"8px 20px",borderRadius:8,border:"1px solid #EF4444",background:"transparent",color:"#EF4444",fontWeight:700,cursor:"pointer",fontSize:13}}
      >
        Réessayer
      </button>
    </div>
  );

  const yr  = kpi?.annee || 2026;
  const yr1 = yr - 1;

  /* Calculs dérivés */
  const mapeVals   = [met?.mape_ca, met?.mape_to, met?.mape_adr].map(v => parseFloat(v)).filter(v => !isNaN(v));
  const mapeGlobal = mapeVals.length ? mapeVals.reduce((a,b) => a+b, 0) / mapeVals.length : null;
  const qG         = mapeQ(mapeGlobal);

  /* Tabs graphique */
  const TABS = [
    {key:"ca",  r:"CA Réel",  p:"CA Prévu",  color:C.ca,  label:"CA (HT)"},
    {key:"to",  r:"TO Réel",  p:"TO Prévu",  color:C.to,  label:"Taux d'Occupation"},
    {key:"adr", r:"ADR Réel", p:"ADR Prévu", color:C.adr, label:"ADR"},
  ];
  const tabCfg = TABS.find(t => t.key === tab);

  const graph = comp.map(r => ({
    mois:        r.mois_nom || MOIS[(r.mois||1)-1] || `M${r.mois}`,
    "CA Réel":   r.ca_reel   != null ? parseFloat(r.ca_reel)   : null,
    "CA Prévu":  r.ca_prevu  != null ? parseFloat(r.ca_prevu)  : null,
    "TO Réel":   r.to_reel   != null ? parseFloat(r.to_reel)   : null,
    "TO Prévu":  r.to_prevu  != null ? parseFloat(r.to_prevu)  : null,
    "ADR Réel":  r.adr_reel  != null ? parseFloat(r.adr_reel)  : null,
    "ADR Prévu": r.adr_prevu != null ? parseFloat(r.adr_prevu) : null,
  }));

  /* [FIX-6] Insights — gardes solides sur prev vide */
  const croiss   = kpi?.croissance_prevue_pct;
  const peakMois = prev.length > 0 ? prev.reduce((a,b) => b.ca_prevu_ht > a.ca_prevu_ht ? b : a) : null;
  const lowMois  = prev.length > 0 ? prev.reduce((a,b) => b.ca_prevu_ht < a.ca_prevu_ht ? b : a) : null;

  /* Totaux tableau */
  const totalReelCA = comp.reduce((s,r) => s + (parseFloat(r.ca_reel)  || 0), 0);
  const totalPrevCA = comp.reduce((s,r) => s + (parseFloat(r.ca_prevu) || 0), 0);
  const avgToPrev   = comp.length > 0 ? comp.reduce((s,r) => s + (parseFloat(r.to_prevu)||0), 0) / comp.length : 0;
  const totalVarPct = totalReelCA > 0 ? ((totalPrevCA - totalReelCA) / totalReelCA) * 100 : null;

  const axTick = {fontSize:11, fill:"#94A3B8", fontWeight:600};
  const gridS  = "rgba(148,163,184,0.12)";

  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",maxWidth:1600,margin:"0 auto",width:"96%",padding:"12px 0",display:"flex",flexDirection:"column",gap:24}}>

      {/* ══ 1. EXECUTIVE HEADER ══ */}
      <div style={{background:"linear-gradient(135deg,#1E1B4B 0%,#312E81 50%,#1E3A5F 100%)",borderRadius:20,padding:"28px 36px",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 20px 60px rgba(99,102,241,0.25)",position:"relative",overflow:"hidden",flexWrap:"wrap",gap:16}}>
        <div style={{position:"absolute",right:"-5%",top:"-60%",width:500,height:500,background:"radial-gradient(circle,rgba(129,140,248,0.2) 0%,transparent 65%)",borderRadius:"50%",pointerEvents:"none"}}/>

        <div style={{zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
            <div style={{width:42,height:42,borderRadius:12,background:"rgba(255,255,255,0.1)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid rgba(255,255,255,0.2)"}}>
              <Activity size={20} color="#A5B4FC"/>
            </div>
            <div>
              <h1 style={{fontSize:22,fontWeight:800,color:"#FFFFFF",margin:0,letterSpacing:"-0.02em"}}>Prévisions d'Activité · {yr}</h1>
              <p style={{fontSize:12,color:"#A5B4FC",margin:0,marginTop:2}}>Modèle IA prédictif · {met?.modele || "VAR"}</p>
            </div>
          </div>
          {(kpi?.alerte_fiabilite || met?.alerte_fiabilite) && (
            <div style={{marginTop:10,background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"6px 14px",display:"inline-flex",alignItems:"center",gap:8}}>
              <AlertTriangle size={13} color="#FCA5A5"/>
              <span style={{fontSize:12,color:"#FCA5A5",fontWeight:600}}>{kpi?.alerte_fiabilite || met?.alerte_fiabilite}</span>
            </div>
          )}
        </div>

        {/* MAPE Summary */}
        <div style={{display:"flex",gap:10,zIndex:1,flexWrap:"wrap"}}>
          {[
            {label:"MAPE CA",  val:met?.mape_ca},
            {label:"MAPE TO",  val:met?.mape_to},
            {label:"MAPE ADR", val:met?.mape_adr},
            {label:"Global",   val:mapeGlobal, highlight:true},
          ].map(({label,val,highlight}) => {
            const q = mapeQ(parseFloat(val));
            return (
              <div key={label} style={{background:highlight?`${q.color}22`:"rgba(255,255,255,0.07)",border:`1px solid ${highlight?q.color+"50":"rgba(255,255,255,0.12)"}`,borderRadius:12,padding:"10px 14px",textAlign:"center",minWidth:90,backdropFilter:"blur(10px)"}}>
                <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",fontWeight:700,letterSpacing:"0.06em"}}>{label}</div>
                <div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"center",marginTop:5}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:q.color,boxShadow:`0 0 8px ${q.color}`}}/>
                  <span style={{fontSize:highlight?20:16,fontWeight:highlight?900:800,color:"#FFF"}}>
                    {val!=null ? `${parseFloat(val).toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div style={{fontSize:9,color:q.color,fontWeight:700,marginTop:3}}>{q.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ 2. KPI EXECUTIVE SUMMARY ══ */}
      <div>
        <STitle accent={C.ca}>Synthèse des Prévisions {yr}</STitle>
        {/* [FIX-1] Responsive avec auto-fit */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14}}>
          {/* [FIX-2] fmtM retourne string "X TND" → KpiCard peut faire .includes("TND") */}
          <KpiCard
            icon={<Coins size={20}/>}
            title="Chiffre d'Affaires (HT)"
            value={fmtM(kpi?.ca_total_prevu_ht)}
            subtitle={`Total prévu pour ${yr}`}
            delta={kpi?.croissance_prevue_pct != null ? `${kpi.croissance_prevue_pct}%` : null}
            color={C.ca}
          />
          <KpiCard
            icon={<Users size={20}/>}
            title="Taux d'occupation (%)"
            value={`${kpi?.to_moyen_prevu||0}%`}
            subtitle="Prévision moyenne sur 12 mois"
            color={C.to}
          />
          <KpiCard
            icon={<Target size={20}/>}
            title="Prix moyen chambre (ADR)"
            value={fmtM(kpi?.adr_moyen_prevu)}
            subtitle="Prévision HT par chambre"
            color={C.adr}
          />
        </div>
      </div>

      {/* ══ 3. FORECAST COMPARISON CHART ══ */}
      <div style={{background:"#FFFFFF",borderRadius:16,padding:"24px",border:"1px solid #E2E8F0",boxShadow:"0 4px 20px rgba(0,0,0,0.04)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
          <div>
            <h3 style={{fontSize:14,fontWeight:800,color:"#1E293B",margin:0}}>Analyse Comparative · Réel {yr1} vs Prévisions {yr}</h3>
            <p style={{fontSize:12,color:"#94A3B8",margin:0,marginTop:2}}>Superposition des valeurs réelles et prévisionnelles par indicateur</p>
          </div>
          {/* [AMÉLIORATION] aria-selected pour l'accessibilité */}
          <div style={{display:"flex",gap:6,background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,padding:4}}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-selected={tab===t.key}
                style={{padding:"5px 14px",borderRadius:7,fontSize:12,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.2s",background:tab===t.key?"#FFF":"transparent",color:tab===t.key?t.color:"#94A3B8",boxShadow:tab===t.key?"0 1px 6px rgba(0,0,0,0.08)":"none"}}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {comp.length === 0 ? (
          <EmptyState message="Aucune donnée comparative disponible pour cet hôtel."/>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={graph} margin={{top:10,right:10,left:10,bottom:0}}>
              <CartesianGrid strokeDasharray="4 4" stroke={gridS} vertical={false}/>
              <XAxis dataKey="mois" tick={axTick} axisLine={false} tickLine={false}/>
              <YAxis
                tick={axTick}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => {
                  if (tab==="to")  return `${v}%`;
                  if (tab==="adr") return `${v}`;
                  return `${(v/1000).toFixed(0)}k`;
                }}
              />
              {/* [AMÉLIORATION] ReferenceLine à y=0 */}
              <ReferenceLine y={0} stroke="#CBD5E1" strokeWidth={1}/>
              {/* [FIX-4] On passe tabKey au tooltip via content */}
              <Tooltip content={<DarkTip tabKey={tab}/>} cursor={{fill:"#F8FAFC"}}/>
              <Legend wrapperStyle={{fontSize:12,paddingTop:12}} iconType="circle"/>
              <Bar dataKey={tabCfg.r} name={`Réel ${yr1}`}  fill="#64748B"      radius={[6,6,0,0]} barSize={14}/>
              <Bar dataKey={tabCfg.p} name={`Prévu ${yr}`}  fill={tabCfg.color} radius={[6,6,0,0]} barSize={14}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ══ 4. INSIGHTS AUTOMATIQUES ══ */}
      <div>
        <STitle accent="#8B5CF6">Intelligence Analytique · Insights Automatiques</STitle>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12}}>
          {croiss!=null && (
            <Insight
              icon={croiss>=0 ? TrendingUp : TrendingDown}
              color={croiss>=0 ? "#10B981" : "#EF4444"}
              bold={`Croissance prévue : ${croiss>0?"+":""}${croiss}%`}
              text={`par rapport à l'exercice ${yr1}.`}
            />
          )}
          {/* [FIX-6] Optional chaining — null safe */}
          {peakMois?.mois_nom && (
            <Insight
              icon={Zap}
              color="#F59E0B"
              bold={`Pic de revenus : ${peakMois.mois_nom}`}
              text={`CA prévu de ${fmtMJsx(peakMois.ca_prevu_ht)} — priorité tarifaire haute.`}
            />
          )}
          {lowMois?.mois_nom && (
            <Insight
              icon={AlertTriangle}
              color="#6366F1"
              bold={`Creux saisonnier : ${lowMois.mois_nom}`}
              text={`CA prévu de ${fmtMJsx(lowMois.ca_prevu_ht)} — stratégie de stimulation recommandée.`}
            />
          )}

        </div>
      </div>

      {/* ══ 5. PLAN D'ACTION & RECOMMANDATIONS ══ */}
      <div>
        <STitle accent={C.to}>Recommandations Commerciales · Revenue Management</STitle>
        {reco.length === 0 ? (
          <EmptyState message="Aucune recommandation tarifaire disponible pour cet hôtel."/>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            {reco.map((r, i) => {
              const c = COULEUR[r.couleur_alerte] || COULEUR.vert;
              const priorityLabel = r.couleur_alerte==="rouge"?"Critique":r.couleur_alerte==="orange"?"Haute":r.couleur_alerte==="jaune"?"Normale":r.couleur_alerte==="bleu"?"Faible":"Basse";
              const Icon = r.couleur_alerte==="rouge"||r.couleur_alerte==="orange"?TrendingUp:r.couleur_alerte==="jaune"?Target:r.couleur_alerte==="bleu"?Zap:Coins;
              return (
                <div
                  key={i}
                  style={{display:"flex",alignItems:"center",gap:18,padding:"22px 24px",borderRadius:16,background:"#1E293B",transition:"background 0.2s",cursor:"default"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#263548"}
                  onMouseLeave={e=>e.currentTarget.style.background="#1E293B"}
                >
                  <div style={{width:52,height:52,borderRadius:14,background:c.text,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <Icon size={24} color="#FFFFFF"/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:900,fontSize:17,color:"#F1F5F9",marginBottom:3}}>{r.mois_nom}</div>
                    <div style={{fontSize:12,color:"#94A3B8",marginBottom:4}}>TO prévu : <strong style={{color:"#F1F5F9"}}>{r.to_prevu_pct}%</strong></div>
                    <div style={{fontSize:12,color:"#64748B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.action}</div>
                  </div>
                  <span style={{background:c.text,color:"#FFFFFF",fontSize:13,fontWeight:800,padding:"6px 16px",borderRadius:20,flexShrink:0,whiteSpace:"nowrap"}}>{priorityLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ 6. MATRICE MENSUELLE ══ */}
      <div style={{background:"#FFFFFF",borderRadius:16,border:"1px solid #E2E8F0",overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,0.04)"}}>
        <div style={{padding:"20px 24px",borderBottom:"1px solid #F1F5F9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <Calendar size={18} color="#6366F1"/>
            <div>
              <h3 style={{fontSize:14,fontWeight:800,color:"#1E293B",margin:0}}>Comparatif Mensuel Détaillé · Réel {yr1} vs Prévu {yr}</h3>
              <p style={{fontSize:12,color:"#94A3B8",margin:0}}>Écarts financiers (CA HT) et indicateurs d'exploitation projetés</p>
            </div>
          </div>
        </div>

        {comp.length === 0 ? (
          <EmptyState message="Aucune donnée mensuelle disponible pour cet hôtel."/>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#0F172A"}}>
                  <th style={{padding:"16px 20px",textAlign:"left",  color:"#FFFFFF",fontWeight:800,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em"}}>Mois</th>
                  <th style={{padding:"16px 20px",textAlign:"right", color:"#94A3B8",fontWeight:800,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em"}}>CA Réel {yr1}</th>
                  <th style={{padding:"16px 20px",textAlign:"right", color:"#FFFFFF",fontWeight:800,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",background:"#1E293B"}}>CA Prévu {yr}</th>
                  <th style={{padding:"16px 20px",textAlign:"right", color:"#FFFFFF",fontWeight:800,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",background:"#1E293B"}}>Écart (%)</th>
                  <th style={{padding:"16px 20px",textAlign:"right", color:"#FFFFFF",fontWeight:800,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",background:"#1E293B"}}>TO Prévu {yr}</th>
                  <th style={{padding:"16px 20px",textAlign:"right", color:"#FFFFFF",fontWeight:800,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",background:"#1E293B"}}>ADR Prévu {yr}</th>
                </tr>
              </thead>
              <tbody>
                {comp.map((p,i) => {
                  const caR    = parseFloat(p.ca_reel)  || 0;
                  const caP    = parseFloat(p.ca_prevu) || 0;
                  // [FIX-3] varPct est null si caR=0 (pas de données réelles) — pas d'affichage trompeur
                  const varPct = caR > 0 ? ((caP - caR) / caR) * 100 : null;
                  const isPos  = varPct != null ? varPct >= 0 : null;
                  return (
                    <tr
                      key={i}
                      style={{borderBottom:"1px solid #E2E8F0",background:i%2===0?"#FFFFFF":"#F8FAFC",transition:"all 0.2s"}}
                      onMouseEnter={e => e.currentTarget.style.background="#F1F5F9"}
                      onMouseLeave={e => e.currentTarget.style.background=i%2===0?"#FFFFFF":"#F8FAFC"}
                    >
                      <td style={{padding:"16px 20px",fontWeight:800,fontSize:13,color:"#0F172A"}}>{p.mois_nom}</td>
                      <td style={{padding:"16px 20px",textAlign:"right",fontSize:14,fontWeight:800,color:"#0F172A",fontVariantNumeric:"tabular-nums"}}>
                        {caR ? fmtMJsx(caR) : "—"}
                      </td>
                      <td style={{padding:"16px 20px",textAlign:"right",fontSize:14,fontWeight:900,color:"#0F172A",background:"rgba(99,102,241,0.03)",fontVariantNumeric:"tabular-nums"}}>
                        {caP ? fmtMJsx(caP) : "—"}
                      </td>
                      <td style={{padding:"16px 20px",textAlign:"right",background:"rgba(99,102,241,0.03)"}}>
                        {varPct != null && (
                          <span style={{background:isPos?"#DCFCE7":"#FEE2E2",color:isPos?"#16A34A":"#DC2626",padding:"4px 10px",borderRadius:8,fontWeight:800,fontSize:12,border:`1px solid ${isPos?"#BBF7D0":"#FECACA"}`}}>
                            {isPos?"+":""}{varPct.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td style={{padding:"16px 20px",textAlign:"right",fontSize:14,fontWeight:800,color:"#0F172A",background:"rgba(99,102,241,0.03)"}}>
                        {p.to_prevu != null ? `${parseFloat(p.to_prevu).toFixed(1)}%` : "—"}
                      </td>
                      <td style={{padding:"16px 20px",textAlign:"right",fontSize:14,fontWeight:800,color:"#0F172A",fontVariantNumeric:"tabular-nums",background:"rgba(99,102,241,0.03)"}}>
                        {p.adr_prevu != null ? fmtMJsx(parseFloat(p.adr_prevu).toFixed(0)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* [AMÉLIORATION] Ligne Total en pied de tableau */}
              <tfoot>
                <tr style={{background:"#0F172A",borderTop:"2px solid #334155"}}>
                  <td style={{padding:"14px 20px",fontWeight:800,fontSize:12,color:"#FFFFFF",textTransform:"uppercase",letterSpacing:"0.06em"}}>Total / Moy.</td>
                  <td style={{padding:"14px 20px",textAlign:"right",fontWeight:800,fontSize:13,color:"#94A3B8",fontVariantNumeric:"tabular-nums"}}>
                    {totalReelCA > 0 ? fmtMJsx(totalReelCA) : "—"}
                  </td>
                  <td style={{padding:"14px 20px",textAlign:"right",fontWeight:900,fontSize:13,color:"#A5B4FC",fontVariantNumeric:"tabular-nums",background:"rgba(99,102,241,0.08)"}}>
                    {totalPrevCA > 0 ? fmtMJsx(totalPrevCA) : "—"}
                  </td>
                  <td style={{padding:"14px 20px",textAlign:"right",background:"rgba(99,102,241,0.08)"}}>
                    {totalVarPct != null && (
                      <span style={{background:totalVarPct>=0?"#DCFCE7":"#FEE2E2",color:totalVarPct>=0?"#16A34A":"#DC2626",padding:"4px 10px",borderRadius:8,fontWeight:800,fontSize:12,border:`1px solid ${totalVarPct>=0?"#BBF7D0":"#FECACA"}`}}>
                        {totalVarPct>=0?"+":""}{totalVarPct.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td style={{padding:"14px 20px",textAlign:"right",fontWeight:800,fontSize:13,color:"#A5B4FC",background:"rgba(99,102,241,0.08)"}}>
                    {avgToPrev > 0 ? `${avgToPrev.toFixed(1)}%` : "—"}
                  </td>
                  <td style={{padding:"14px 20px",textAlign:"right",color:"#64748B",background:"rgba(99,102,241,0.08)"}}>—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
