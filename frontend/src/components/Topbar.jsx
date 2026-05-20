import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useDashboard } from "./DashboardContext";

const titles = {
  "/ca": { label: "Chiffre d'Affaires", sub: "Revenus & performance" },
  "/stats": { label: "Statistiques", sub: "Indicateurs hôteliers" },
  "/charges": { label: "Charges", sub: "Analyse des coûts" },
  "/resultat": { label: "Résultat Net", sub: "CA vs charges" },
  "/users": { label: "Utilisateurs", sub: "Gestion des accès" },
};

const ANNEES = [2023, 2024, 2025, 2026];
const MOIS = [
  { id: 0, label: "Année Entière" },
  { id: 1, label: "Janvier" }, { id: 2, label: "Février" }, { id: 3, label: "Mars" },
  { id: 4, label: "Avril" }, { id: 5, label: "Mai" }, { id: 6, label: "Juin" },
  { id: 7, label: "Juillet" }, { id: 8, label: "Août" }, { id: 9, label: "Septembre" },
  { id: 10, label: "Octobre" }, { id: 11, label: "Novembre" }, { id: 12, label: "Décembre" }
];

const HOTELS_FIXES = [
  { id: 1, nom: "Royal Azur", categorie: "5*", color: "#7C3AED" },
  { id: 2, nom: "Bel Azur", categorie: "4*", color: "#0EA5E9" },
  { id: 3, nom: "Sol Azur", categorie: "4*", color: "#F59E0B" },
];

function useOutsideClick(ref, handler) {
  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) handler(); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
}

const Chevron = ({ color = "#64748B", open }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.5" strokeLinecap="round"
    style={{ transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export default function Topbar() {
  const loc = useLocation();
  const page = titles[loc.pathname] || { label: "Dashboard", sub: "" };
  const { hotelId, setHotelId, annee, setAnnee, mois, setMois, hotelsVisibles, user, editMode, setEditMode } = useDashboard();

  const [hotelOpen, setHotelOpen] = useState(false);
  const [anneeOpen, setAnneeOpen] = useState(false);
  const [moisOpen, setMoisOpen] = useState(false);
  const hotelRef = useRef(null);
  const anneeRef = useRef(null);
  const moisRef = useRef(null);

  useOutsideClick(hotelRef, () => setHotelOpen(false));
  useOutsideClick(anneeRef, () => setAnneeOpen(false));
  useOutsideClick(moisRef, () => setMoisOpen(false));

  const now = new Date();
  const time = now.toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("fr-TN", { weekday: "long", day: "numeric", month: "long" });

  const listeHotels = HOTELS_FIXES;

  const activeH = listeHotels.find(h => h.id === hotelId) || listeHotels[0];

  const initials = (user?.nom || user?.name || user?.username || "A")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const handleExport = () => {
    const els = document.querySelectorAll(".recharts-responsive-container");
    const orig = [];
    els.forEach((el, i) => {
      orig[i] = { w: el.style.width, h: el.style.height };
      el.style.width = "100%";
      el.style.height = (el.offsetHeight || 230) + "px";
    });
    setTimeout(() => {
      window.print();
      setTimeout(() => els.forEach((el, i) => {
        el.style.width = orig[i].w; el.style.height = orig[i].h;
      }), 1000);
    }, 300);
  };

  return (
    <div style={{
      height: 62,
      background: "linear-gradient(90deg, #0a1829 0%, #0d1f38 60%, #0f2040 100%)",
      borderBottom: "1px solid rgba(201,168,76,0.18)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px", flexShrink: 0, gap: 16,
      boxShadow: "0 2px 20px rgba(0,0,0,0.35), inset 0 -1px 0 rgba(201,168,76,0.12)",
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      position: "relative", zIndex: 100,
    }}>
      <style>{`
        @keyframes ddIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .dd-opt:hover { background:rgba(201,168,76,0.08) !important; }
        .tb-btn:hover { opacity:0.9; transform:translateY(-1px); }
      `}</style>

      {/* ── LEFT: page title ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "#c9a84c", boxShadow: "0 0 10px rgba(201,168,76,0.70)"
        }} />
        <span style={{
          fontSize: 14, fontWeight: 800, color: "#fff",
          letterSpacing: "-0.02em"
        }}>{page.label}</span>
        {page.sub && (
          <span style={{ fontSize: 11, color: "rgba(201,168,76,0.55)" }}>{page.sub}</span>
        )}
      </div>

      {/* ── CENTER: selectors ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

        {/* HOTEL DROPDOWN */}
        <div ref={hotelRef} style={{ position: "relative" }}>
          <button className="tb-btn" onClick={() => { setHotelOpen(p => !p); setAnneeOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(201,168,76,0.10)",
              border: "1.5px solid rgba(201,168,76,0.30)",
              borderRadius: 12, padding: "7px 14px", cursor: "pointer",
              fontFamily: "inherit", transition: "all .15s",
              maxWidth: 240,
            }}>
            <span style={{
              width: 9, height: 9, borderRadius: "50%",
              background: "#c9a84c", flexShrink: 0,
              boxShadow: "0 0 8px rgba(201,168,76,0.70)"
            }} />
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="#c9a84c" strokeWidth="2" strokeLinecap="round">
              <rect x="4" y="2" width="16" height="20" rx="1" />
              <path d="M9 22V12h6v10" />
              <line x1="9" y1="7" x2="9.01" y2="7" strokeWidth="3" />
              <line x1="15" y1="7" x2="15.01" y2="7" strokeWidth="3" />
            </svg>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: "#e8d5a0",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: 150
            }}>
              {activeH?.nom || "Sélectionner un hôtel"}
            </span>
            {activeH?.categorie && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: "#c9a84c", background: "rgba(201,168,76,0.12)",
                borderRadius: 6, padding: "2px 7px",
                border: "1px solid rgba(201,168,76,0.25)", flexShrink: 0
              }}>
                {activeH.categorie}
              </span>
            )}
            <Chevron color="#c9a84c" open={hotelOpen} />
          </button>

          {hotelOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 10px)", left: 0,
              background: "linear-gradient(160deg, #0a1829 0%, #0d1f38 100%)",
              borderRadius: 16, zIndex: 999, minWidth: 300,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.20)",
              padding: 8, animation: "ddIn .18s ease",
            }}>
              <div style={{
                padding: "8px 12px 10px",
                borderBottom: "1px solid rgba(201,168,76,0.12)", marginBottom: 6
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 800, color: "rgba(201,168,76,0.6)",
                  textTransform: "uppercase", letterSpacing: "0.14em"
                }}>
                  Établissement
                </div>
                <div style={{ fontSize: 11, color: "rgba(148,163,184,0.6)", marginTop: 2 }}>
                  {listeHotels.length} hôtel{listeHotels.length > 1 ? "s" : ""} disponible{listeHotels.length > 1 ? "s" : ""}
                </div>
              </div>

              {listeHotels.map(h => {
                const isActive = hotelId === h.id;
                return (
                  <div key={h.id} className="dd-opt"
                    onClick={() => { setHotelId(h.id); setHotelOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 11,
                      padding: "11px 12px", borderRadius: 11, cursor: "pointer",
                      background: isActive ? "rgba(201,168,76,0.10)" : "transparent",
                      border: isActive ? "1px solid rgba(201,168,76,0.22)" : "1px solid transparent",
                      transition: "all .1s", marginBottom: 3,
                    }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      background: isActive ? "#c9a84c" : "rgba(255,255,255,0.05)",
                      border: `2px solid ${isActive ? "#c9a84c" : "rgba(255,255,255,0.12)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isActive && (
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                          <polyline points="1.5 6 4.5 9 10.5 3"
                            stroke="#1a0f00" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                    <div style={{
                      width: 3, height: 38, borderRadius: 99,
                      background: isActive ? "#c9a84c" : "rgba(255,255,255,0.08)", flexShrink: 0
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: isActive ? 800 : 600,
                        color: isActive ? "#e8d5a0" : "rgba(226,232,240,0.85)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                      }}>
                        {h.nom}
                      </div>
                      <div style={{
                        fontSize: 10, color: "rgba(148,163,184,0.55)", marginTop: 1,
                        display: "flex", alignItems: "center", gap: 5
                      }}>
                        <span style={{ color: "#c9a84c" }}>{h.categorie}</span>
                        <span>·</span>
                        <span>Hammamet</span>
                      </div>
                    </div>
                    {isActive && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: "#c9a84c",
                        background: "rgba(201,168,76,0.12)", borderRadius: 99,
                        padding: "2px 8px", flexShrink: 0,
                        border: "1px solid rgba(201,168,76,0.25)"
                      }}>
                        Actif
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: "rgba(201,168,76,0.20)", flexShrink: 0 }} />

        {/* YEAR DROPDOWN */}
        <div ref={anneeRef} style={{ position: "relative" }}>
          <button className="tb-btn" onClick={() => { setAnneeOpen(p => !p); setHotelOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.14)",
              borderRadius: 12, padding: "7px 14px", cursor: "pointer",
              fontFamily: "inherit", transition: "all .15s",
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="rgba(201,168,76,0.85)" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#e8d5a0" }}>{annee}</span>
            <Chevron color="rgba(201,168,76,0.75)" open={anneeOpen} />
          </button>

          {anneeOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 10px)",
              left: "50%", transform: "translateX(-50%)",
              background: "linear-gradient(160deg, #0a1829 0%, #0d1f38 100%)",
              borderRadius: 14, zIndex: 999, minWidth: 150,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.20)",
              padding: 8, animation: "ddIn .18s ease",
            }}>
              <div style={{
                padding: "8px 12px 10px",
                borderBottom: "1px solid rgba(201,168,76,0.12)", marginBottom: 6
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 800, color: "rgba(201,168,76,0.6)",
                  textTransform: "uppercase", letterSpacing: "0.14em"
                }}>Année</div>
              </div>

              {ANNEES.map(y => {
                const isActive = annee === y;
                return (
                  <div key={y} className="dd-opt"
                    onClick={() => { setAnnee(y); setAnneeOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "11px 14px", borderRadius: 10, cursor: "pointer",
                      background: isActive ? "rgba(201,168,76,0.10)" : "transparent",
                      transition: "all .1s", marginBottom: 2,
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: isActive ? "#c9a84c" : "rgba(255,255,255,0.15)"
                      }} />
                      <span style={{
                        fontSize: 14, fontWeight: isActive ? 800 : 600,
                        color: isActive ? "#e8d5a0" : "rgba(226,232,240,0.7)"
                      }}>{y}</span>
                    </div>
                    {isActive && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="#c9a84c" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: "rgba(201,168,76,0.20)", flexShrink: 0 }} />

        {/* MONTH DROPDOWN */}
        <div ref={moisRef} style={{ position: "relative" }}>
          <button className="tb-btn" onClick={() => { setMoisOpen(p => !p); setHotelOpen(false); setAnneeOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.14)",
              borderRadius: 12, padding: "7px 14px", cursor: "pointer",
              fontFamily: "inherit", transition: "all .15s",
              minWidth: 140
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="rgba(201,168,76,0.85)" strokeWidth="2" strokeLinecap="round">
              <path d="M21 21H3V3h18v18zM3 10h18M10 3v18" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#e8d5a0" }}>
              {MOIS.find(m => m.id === mois)?.label || "Mois"}
            </span>
            <Chevron color="rgba(201,168,76,0.75)" open={moisOpen} />
          </button>

          {moisOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 10px)",
              left: "50%", transform: "translateX(-50%)",
              background: "linear-gradient(160deg, #0a1829 0%, #0d1f38 100%)",
              borderRadius: 14, zIndex: 999, minWidth: 180,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.20)",
              padding: 8, animation: "ddIn .18s ease",
              maxHeight: 400, overflowY: "auto"
            }}>
              <div style={{
                padding: "8px 12px 10px",
                borderBottom: "1px solid rgba(201,168,76,0.12)", marginBottom: 6
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 800, color: "rgba(201,168,76,0.6)",
                  textTransform: "uppercase", letterSpacing: "0.14em"
                }}>Période</div>
              </div>

              {MOIS.map(m => {
                const isActive = mois === m.id;
                return (
                  <div key={m.id} className="dd-opt"
                    onClick={() => { setMois(m.id); setMoisOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                      background: isActive ? "rgba(201,168,76,0.10)" : "transparent",
                      transition: "all .1s", marginBottom: 2,
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: isActive ? "#c9a84c" : "rgba(255,255,255,0.15)"
                      }} />
                      <span style={{
                        fontSize: 13, fontWeight: isActive ? 800 : 600,
                        color: isActive ? "#e8d5a0" : "rgba(226,232,240,0.7)"
                      }}>{m.label}</span>
                    </div>
                    {isActive && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="#c9a84c" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: "rgba(201,168,76,0.20)", flexShrink: 0 }} />

        {/* Export */}
        <button onClick={handleExport} className="tb-btn"
          style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "linear-gradient(135deg, #c9a84c, #a07828)",
            border: "none", borderRadius: 12, padding: "8px 18px",
            color: "#1a0f00", fontSize: 12, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 4px 14px rgba(201,168,76,0.40)",
            transition: "all .15s", whiteSpace: "nowrap",
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exporter
        </button>


      </div>

      {/* ── RIGHT: time + avatar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: "#e8d5a0",
            fontVariantNumeric: "tabular-nums"
          }}>{time}</div>
          <div style={{
            fontSize: 10, color: "rgba(201,168,76,0.50)",
            textTransform: "capitalize", whiteSpace: "nowrap"
          }}>{dateStr}</div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, #c9a84c, #a07828)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#1a0f00", fontSize: 13, fontWeight: 800,
          boxShadow: "0 0 0 2px rgba(201,168,76,0.25), 0 2px 10px rgba(0,0,0,0.4)",
        }}>
          {initials}
        </div>
      </div>
    </div>
  );
}