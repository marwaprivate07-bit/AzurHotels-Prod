import React, { useState, useEffect } from "react";
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup,
} from "@vnedyalk0v/react19-simple-maps";

const GEO_URLS = [
  "https://cdn.jsdelivr.net/gh/datasets/geo-countries/data/countries.geojson",
  "https://raw.githubusercontent.com/deldersveld/topojson/master/world-countries.json",
];

const ISO_TO_COORDS = {
  "FR": [2.35, 46.23], "GB": [-3.44, 55.38], "DE": [10.45, 51.17],
  "IT": [12.57, 41.87], "ES": [-3.75, 40.46], "PT": [-8.22, 39.40],
  "NL": [5.29, 52.13], "BE": [4.47, 50.50], "CH": [8.23, 46.82],
  "AT": [14.55, 47.52], "PL": [19.15, 51.92], "SE": [18.64, 60.13],
  "NO": [8.47, 60.47], "DK": [9.50, 56.26], "FI": [25.75, 61.92],
  "CZ": [15.47, 49.82], "GR": [21.82, 39.07], "TN": [9.54, 33.89],
  "MA": [-7.09, 31.79], "IE": [-8.24, 53.41], "RU": [37.62, 55.75],
  "DZ": [3.04, 36.74], "US": [-95.71, 37.09], "CA": [-96.81, 56.13],
  "JP": [138.25, 36.20], "CN": [104.20, 35.86], "RO": [24.97, 45.94],
  "HU": [19.50, 47.16], "HR": [15.20, 45.10], "SK": [19.70, 48.67],
  "BG": [25.49, 42.73], "LY": [17.22, 26.33], "EG": [30.80, 26.82],
  "SA": [45.07, 23.88], "AE": [53.84, 23.42], "QA": [51.18, 25.35],
  "KW": [47.48, 29.31], "OM": [55.92, 21.47], "JO": [36.23, 30.58],
  "LB": [35.86, 33.85], "UA": [31.16, 48.37], "LU": [6.13, 49.61],
};

const ISO_TO_COUNTRY = {
  "FR": "France", "GB": "United Kingdom", "DE": "Germany", "IT": "Italy", "ES": "Spain",
  "PT": "Portugal", "NL": "Netherlands", "BE": "Belgium", "CH": "Switzerland", "AT": "Austria",
  "PL": "Poland", "SE": "Sweden", "NO": "Norway", "DK": "Denmark", "FI": "Finland",
  "CZ": "Czech Republic", "GR": "Greece", "TN": "Tunisia", "MA": "Morocco", "IE": "Ireland",
  "RU": "Russia", "DZ": "Algeria", "US": "United States of America", "CA": "Canada",
  "JP": "Japan", "CN": "China", "RO": "Romania", "HU": "Hungary", "HR": "Croatia",
  "SK": "Slovakia", "BG": "Bulgaria", "LY": "Libya", "EG": "Egypt", "SA": "Saudi Arabia",
  "AE": "United Arab Emirates", "QA": "Qatar", "KW": "Kuwait", "OM": "Oman", "JO": "Jordan",
  "LB": "Lebanon", "UA": "Ukraine", "LU": "Luxembourg",
};

const RANK_COLORS = [
  "#F6C16D", "#9B9EF0", "#6DD4B8", "#F0A0C4", "#7EB8F0",
  "#EF8E8E", "#B49CF6", "#6DD0DE", "#F6A86D", "#6DC8B8",
];

function getGeoName(geo) {
  const p = geo.properties || {};
  return p.ADMIN || p.name || p.NAME || "";
}

async function fetchWithFallback(urls) {
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: "force-cache" });
      if (r.ok) return await r.json();
    } catch { }
  }
  throw new Error("Failed");
}

export default function MapNationalites({ natData = [], nationalityIso = {} }) {
  const [hovered, setHovered] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── initial view locked on Europe ──────────────────────────────────────────
  // zoom=1 → one unit of ZoomableGroup zoom (the projection scale already zooms in)
const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState([0, 15]);

  const mapRef = React.useRef(null);
  const dragRef = React.useRef(null);              // { startX, startY, startCenter }

  // drag to pan
  const handleMouseDown = (e) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, startCenter: [...center] };
  };
  const handleMouseMove = (e) => {
    if (!dragRef.current) return;
    // scale sensitivity by zoom so panning feels consistent at every zoom level
    const sensitivity = 60 * zoom;
    const dx = (e.clientX - dragRef.current.startX) / sensitivity;
    const dy = (e.clientY - dragRef.current.startY) / sensitivity;
    setCenter([
      dragRef.current.startCenter[0] - dx,
      dragRef.current.startCenter[1] + dy,
    ]);
  };
  const handleMouseUp = () => { dragRef.current = null; };

  // scroll to zoom only (no pan on scroll)
  const handleWheel = (e) => {
    e.preventDefault();
    setZoom(z => Math.min(12, Math.max(0.8, z * (e.deltaY < 0 ? 1.18 : 0.85))));
  };

  useEffect(() => {
    let cancelled = false;
    fetchWithFallback(GEO_URLS)
      .then(d => { if (!cancelled) { setGeoData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Auto-zoom to fit all selected countries whenever the data changes
  useEffect(() => {
    const activeRanked = [...natData]
      .filter(r => r.nom_nat && parseFloat(r.total_arrivees) > 0)
      .sort((a, b) => parseFloat(b.total_arrivees) - parseFloat(a.total_arrivees))
      .slice(0, 10)
      .map(r => ({ iso: nationalityIso[r.nom_nat] || null }))
      .filter(r => r.iso && ISO_TO_COORDS[r.iso]);

    if (activeRanked.length === 0) return;

    const lngs = activeRanked.map(r => ISO_TO_COORDS[r.iso][0]);
    const lats = activeRanked.map(r => ISO_TO_COORDS[r.iso][1]);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);

    const cLng = (minLng + maxLng) / 2;
    const cLat = (minLat + maxLat) / 2;

    // Larger spread → smaller zoom; cap between 0.8 and 4
    const spread = Math.max(maxLng - minLng, (maxLat - minLat) * 1.5, 30);
    const newZoom = Math.min(2.5, Math.max(0.8, 85 / spread));

    setCenter([cLng, cLat]);
    setZoom(newZoom);
  }, [natData, nationalityIso]);

  const ranked = [...natData]
    .filter(r => r.nom_nat && parseFloat(r.total_arrivees) > 0)
    .sort((a, b) => parseFloat(b.total_arrivees) - parseFloat(a.total_arrivees))
    .slice(0, 10)
    .map((r, i) => ({
      ...r,
      iso: nationalityIso[r.nom_nat] || null,
      color: RANK_COLORS[i],
      rank: i,
      value: parseFloat(r.total_arrivees) || 0,
    }));

  const maxVal = ranked[0]?.value || 1;
  const totalArrivees = ranked.reduce((s, r) => s + r.value, 0);

  const isoMap = {};
  ranked.forEach(r => { if (r.iso) isoMap[r.iso] = r; });

  const nameToIso = {};
  ranked.forEach(r => {
    if (r.iso && ISO_TO_COUNTRY[r.iso]) nameToIso[ISO_TO_COUNTRY[r.iso]] = r.iso;
  });

  const getBubbleR = val => 4 + Math.sqrt(val / maxVal) * 9;
  const hoveredEntry = hovered ? isoMap[hovered] : null;

  const CSS = `
    @keyframes pulse  { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(2.8);opacity:0} }
    @keyframes orbit  { to{transform:rotate(360deg)} }
    @keyframes popIn  { from{opacity:0;transform:translateY(10px) scale(.9)} to{opacity:1;transform:none} }
    @keyframes fadeUp { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:translateX(0)} }
    @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
    .rankRow { animation: fadeUp .4s cubic-bezier(.22,1,.36,1) both; }
    .tipBox  { animation: popIn  .25s cubic-bezier(.34,1.56,.64,1) both; }
    ::-webkit-scrollbar { width:4px; }
    ::-webkit-scrollbar-track { background: rgba(255,255,255,.03); }
    ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15); border-radius:9px; }
    ::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,.28); }
  `;

  if (loading) return (
    <div style={{
      height: 150, display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 16,
      background: "linear-gradient(135deg,#EEF4FF,#DBEAFE,#EEF4FF)",
      borderRadius: 20, border: "1px solid rgba(99,102,241,.15)",
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        border: "2px solid rgba(255,255,255,.08)",
        borderTop: "2px solid #4CB8A8",
        animation: "spin .9s linear infinite",
      }} />
      <span style={{ color: "rgba(30,58,138,.55)", fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase" }}>
        Chargement de la carte…
      </span>
    </div>
  );

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 240px",
      borderRadius: 20,
      overflow: "hidden",
      border: "1px solid rgba(99,102,241,0.2)",
      width: "100%",
      background: "linear-gradient(135deg,#EEF4FF,#DBEAFE,#EEF4FF)",
      boxShadow: "0 8px 32px rgba(99,102,241,.15)",
      minHeight: 400,
    }}>
      <style>{CSS}</style>

      {/* ══════ MAP ══════ */}
      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(145deg,#F0F7FF 0%,#DBEAFE 50%,#EEF4FF 100%)" }}>

        {/* Clean background (Water) */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
          background: "#DBEAFE"
        }} />

        {/* badges */}
        <div style={{ position: "absolute", top: 12, left: 12, zIndex: 8, display: "flex", gap: 6 }}>
          {[
            ["MONDE", "rgba(99,102,241,.18)", "rgba(99,102,241,.4)", "#a5b4fc"],
            [`TOP ${ranked.length}`, "rgba(245,158,11,.14)", "rgba(245,158,11,.35)", "#fcd34d"],
            ["SOURCE: HOTIX", "rgba(16,185,129,.12)", "rgba(16,185,129,.3)", "#34D399"],
          ].map(([label, bg, bd, col]) => (
            <div key={label} style={{
              background: bg, border: `1px solid ${bd}`, borderRadius: 999,
              padding: "4px 11px", fontSize: 9, fontWeight: 800, color: col,
              letterSpacing: ".1em", backdropFilter: "blur(12px)",
              boxShadow: `0 0 18px ${bd}`,
            }}>{label}</div>
          ))}
        </div>

        {/* stat chips */}
        <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 8, display: "flex", gap: 8 }}>
          {[
            ["NATIONALITÉS", ranked.length.toString(), "#6366F1", "rgba(99,102,241,.15)"],
            ["ARRIVÉES", totalArrivees.toLocaleString("fr-TN"), "#10B981", "rgba(16,185,129,.15)"],
          ].map(([lbl, val, col, bg]) => (
            <div key={lbl} style={{
              background: bg, borderRadius: 10,
              border: `1px solid ${col}44`, padding: "7px 12px",
              backdropFilter: "blur(16px)",
              boxShadow: `0 0 20px ${col}22`,
            }}>
              <div style={{ fontSize: 8, color: `${col}bb`, fontWeight: 700, letterSpacing: ".12em", marginBottom: 2 }}>{lbl}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: col, lineHeight: 1 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* hover tooltip */}
        {hoveredEntry && (
          <div className="tipBox" key={hoveredEntry.iso} style={{
            position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
            zIndex: 20, background: "rgba(255,255,255,.97)",
            borderRadius: 16, padding: "14px 18px", minWidth: 230,
            border: `1px solid ${hoveredEntry.color}44`,
            backdropFilter: "blur(24px)",
            boxShadow: `0 12px 40px rgba(99,102,241,.18),0 0 20px ${hoveredEntry.color}18`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
              <div style={{
                width: 42, height: 28, borderRadius: 6, overflow: "hidden", flexShrink: 0,
                border: `1.5px solid ${hoveredEntry.color}66`,
                boxShadow: `0 0 14px ${hoveredEntry.color}44`,
              }}>
                <img src={`https://flagcdn.com/w80/${hoveredEntry.iso.toLowerCase()}.png`}
                  width={42} height={28}
                  style={{ objectFit: "cover", display: "block", width: "100%", height: "100%" }}
                  alt="" onError={e => e.target.style.display = "none"} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{hoveredEntry.nom_nat}</div>
                <div style={{ fontSize: 9, color: "rgba(30,58,138,.45)", marginTop: 1 }}>
                  Rang #{hoveredEntry.rank + 1} · {hoveredEntry.iso}
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: hoveredEntry.color, textShadow: `0 0 18px ${hoveredEntry.color}88` }}>
                {parseFloat(hoveredEntry.part_pct || 0).toFixed(1)}%
              </div>
            </div>
            <div style={{ height: 1, background: "rgba(99,102,241,.12)", marginBottom: 10 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 9, color: "rgba(30,58,138,.5)", marginBottom: 2 }}>Arrivées</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#1e3a8a" }}>{hoveredEntry.value.toLocaleString("fr-TN")}</div>
              </div>
              <div style={{ width: 90, height: 5, background: "rgba(255,255,255,.06)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${(hoveredEntry.value / maxVal) * 100}%`,
                  background: `linear-gradient(90deg,${hoveredEntry.color}77,${hoveredEntry.color})`,
                  borderRadius: 99, boxShadow: `0 0 8px ${hoveredEntry.color}`,
                }} />
              </div>
            </div>
          </div>
        )}

        {/*
          KEY PROJECTION SETTINGS
          ─────────────────────────────────────────────────────────
          projectionConfig.scale = 900   → zoom level of d3 projection
          projectionConfig.center= [9,46]→ [lng, lat] of viewport centre
                                           9°E, 46°N ≈ central Switzerland
                                           keeps France left, Italy below,
                                           Tunisia/Morocco visible at bottom,
                                           UK/Scandinavia at top

          ZoomableGroup zoom=1 means NO extra zoom on top of the projection.
          width=820 / height=460 are the internal SVG units (aspect ratio).
          The component stretches to fill the container via style width/height.
          ─────────────────────────────────────────────────────────
        */}
        <ComposableMap
          projectionConfig={{ scale: 550, center: [11, 36] }}
          width={800}
          height={420}
          style={{ width: "100%", height: "100%", display: "block", position: "relative", zIndex: 2, minHeight: 60, cursor: dragRef.current ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          // wheel zoom disabled to keep view fixed
        >
          <ZoomableGroup center={center} zoom={zoom} minZoom={0.5} maxZoom={8} enablePan={false} filterZoomEvent={() => false}>

            <Geographies geography={geoData}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const name = getGeoName(geo);
                  const iso = nameToIso[name];
                  const entry = iso ? isoMap[iso] : null;
                  const isHov = iso && hovered === iso;
                  return (
                    <Geography
                      key={geo.rsmKey || name}
                      geography={geo}
                      fill={entry ? entry.color : "#E7E5E4"}
                      stroke={entry ? "rgba(255,255,255,0.95)" : "#D6D3D1"}
                      strokeWidth={entry ? (isHov ? 1.6 : 1.0) : 0.6}
                      style={{
                        default: { outline: "none", transition: "fill .2s" },
                        hover: { outline: "none", fill: entry ? `${entry.color}BB` : "#E0ECF8", cursor: entry ? "pointer" : "default" },
                        pressed: { outline: "none" },
                      }}
                      onMouseEnter={() => iso && setHovered(iso)}
                      onMouseLeave={() => setHovered(null)}
                    />
                  );
                })
              }
            </Geographies>

            {/* Bubble markers */}
            {[...ranked].reverse().map(r => {
              if (!r.iso || !ISO_TO_COORDS[r.iso]) return null;
              const [lng, lat] = ISO_TO_COORDS[r.iso];
              const isHov = hovered === r.iso;
              const rad = getBubbleR(r.value);
              const dispR = isHov ? rad * 1.15 : rad;
              return (
                <Marker key={r.iso} coordinates={[lng, lat]}>
                  {/* pulse */}
                  <circle r={rad} fill={r.color} opacity={0} style={{
                    transformOrigin: "center",
                    animation: `pulse ${2 + (r.rank % 3) * .5}s ease-out infinite`,
                  }} />
                  {/* orbit */}
                  {isHov && (
                    <circle r={rad + 9} fill="none" stroke={r.color}
                      strokeWidth={1.5} opacity={.5} strokeDasharray="3 4"
                      style={{ animation: "orbit 5s linear infinite", transformOrigin: "center" }} />
                  )}
                  {/* glow */}
                  <circle r={dispR + 5} fill={r.color} opacity={.12} />
                  {/* main */}
                  <circle r={dispR} fill={r.color} opacity={isHov ? 1 : .92}
                    stroke="rgba(255,255,255,.85)" strokeWidth={isHov ? 2.5 : 1.5}
                    style={{ cursor: "pointer", filter: `drop-shadow(0 3px 10px ${r.color}99)`, transition: "r .25s" }}
                    onMouseEnter={() => setHovered(r.iso)}
                    onMouseLeave={() => setHovered(null)} />
                  {/* gloss */}
                  <circle r={rad * .36} cx={-rad * .22} cy={-rad * .28} fill="white" opacity={.35} style={{ pointerEvents: "none" }} />
                  {/* rank number */}
                  <text textAnchor="middle" dy=".38em"
                    style={{ fontSize: rad > 18 ? 11 : rad > 12 ? 9 : 8, fontWeight: 900, fill: "#fff", pointerEvents: "none" }}>
                    {r.rank + 1}
                  </text>
                  {/* country name label below bubble */}
                  <text
                    textAnchor="middle"
                    dy={dispR + 9}
                    style={{
                      fontSize: 6.5,
                      fontWeight: 800,
                      fill: "#fff",
                      paintOrder: "stroke",
                      stroke: "rgba(0,0,0,0.55)",
                      strokeWidth: 2.5,
                      strokeLinejoin: "round",
                      pointerEvents: "none",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {(() => {
                      const n = ISO_TO_COUNTRY[r.iso] || r.nom_nat || "";
                      return n.length > 9 ? n.slice(0, 8) + "." : n;
                    })()}
                  </text>
                </Marker>
              );
            })}

          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* ══════ SIDEBAR ══════ */}
      <div style={{
        background: "linear-gradient(180deg,rgba(15,12,41,.97),rgba(26,26,62,.97))",
        borderLeft: "1px solid rgba(99,102,241,.20)",
        display: "flex", flexDirection: "column",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{
          padding: "14px 14px 10px",
          borderBottom: "1px solid rgba(99,102,241,.18)",
          background: "linear-gradient(135deg,rgba(99,102,241,.12),rgba(99,102,241,.04))",
        }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#a5b4fc", letterSpacing: ".14em", textTransform: "uppercase" }}>
            Top Marchés
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,.4)", marginTop: 3 }}>Volume d'Arrivées Physiques</div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "5px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {ranked.map((r, idx) => {
            const isHov = hovered === r.iso;
            const pct = parseFloat(r.part_pct || 0).toFixed(1);
            const barW = (r.value / maxVal) * 100;
            return (
              <div key={r.iso || idx} className="rankRow"
                onMouseEnter={() => r.iso && setHovered(r.iso)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  padding: "7px 10px", borderRadius: 10, cursor: "pointer",
                  background: isHov ? `linear-gradient(135deg,${r.color}1A,${r.color}0A)` : "rgba(255,255,255,.025)",
                  border: `1px solid ${isHov ? r.color + "44" : "rgba(255,255,255,.05)"}`,
                  transition: "all .15s",
                  animationDelay: `${idx * .04}s`,
                  boxShadow: isHov ? `0 0 22px ${r.color}14` : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    background: isHov ? r.color : `${r.color}18`,
                    border: `1.5px solid ${isHov ? "rgba(255,255,255,.4)" : r.color + "55"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 900, color: isHov ? "#fff" : r.color,
                    boxShadow: isHov ? `0 0 14px ${r.color}99` : "none",
                    transition: "all .2s",
                  }}>{r.rank + 1}</div>

                  {r.iso && (
                    <div style={{
                      width: 26, height: 18, borderRadius: 4, overflow: "hidden", flexShrink: 0,
                      border: `1px solid ${isHov ? r.color + "66" : "rgba(255,255,255,.12)"}`,
                      transition: "all .2s",
                    }}>
                      <img src={`https://flagcdn.com/w40/${r.iso.toLowerCase()}.png`}
                        width={26} height={18}
                        style={{ objectFit: "cover", display: "block", width: "100%", height: "100%" }}
                        alt="" onError={e => e.target.style.display = "none"} />
                    </div>
                  )}

                  <span style={{
                    fontSize: 11, fontWeight: 700, flex: 1,
                    color: isHov ? "#fff" : "rgba(255,255,255,.68)",
                    transition: "color .15s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{r.nom_nat}</span>

                  <span style={{
                    fontSize: 12, fontWeight: 900, color: r.color, flexShrink: 0,
                    textShadow: isHov ? `0 0 10px ${r.color}` : "none",
                  }}>{pct}%</span>
                </div>

                <div style={{ marginTop: 8, height: 3, background: "rgba(255,255,255,.06)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${barW}%`,
                    background: `linear-gradient(90deg,${r.color}66,${r.color})`,
                    borderRadius: 99, boxShadow: isHov ? `0 0 8px ${r.color}` : "none",
                    transition: "width .6s cubic-bezier(.4,0,.2,1)",
                  }} />
                </div>

                <div style={{
                  marginTop: 5, fontSize: 9,
                  color: isHov ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.27)",
                  fontWeight: 600,
                }}>{r.value.toLocaleString("fr-TN")} arrivées</div>
              </div>
            );
          })}
        </div>

        <div style={{
          padding: "9px 18px", borderTop: "1px solid rgba(255,255,255,.05)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#4CB8A8", opacity: .5 }} />
          <span style={{ fontSize: 9, color: "rgba(255,255,255,.22)", letterSpacing: ".1em", textTransform: "uppercase" }}>
            Survol pour highlight
          </span>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#4CB8A8", opacity: .5 }} />
        </div>

        {/* Audit Note */}
        <div style={{
          padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,.05)",
          fontSize: 8, color: "rgba(255,255,255,.3)", fontStyle: "italic",
          lineHeight: 1.3, background: "rgba(0,0,0,.05)"
        }}>
          * Données extraites des rapports de mouvement HotiX. Ce volume reflète la pénétration de marché (Arrivées).
        </div>
      </div>
    </div>
  );
}
