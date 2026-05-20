import { NavLink } from "react-router-dom";
import { useDashboard, DASHBOARDS_ALL } from "./DashboardContext";
import royalAzurLogo from "../assets/royal_azur_logo.png";
import belAzurLogo   from "../assets/bel_azur_logo.png";
import solAzurLogo   from "../assets/sol_azur_logo.png";
// import bioAzurLogo   from "../assets/bel_azur_logo.png";

const HOTEL_LOGOS = { 
  1: import.meta.env.VITE_LOGO_HOTEL_1 || royalAzurLogo, 
  2: import.meta.env.VITE_LOGO_HOTEL_2 || belAzurLogo, 
  3: import.meta.env.VITE_LOGO_HOTEL_3 || solAzurLogo 
};

// ── Icônes (inchangées) ──
const IconCA = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="6" rx="8" ry="3"/>
    <ellipse cx="12" cy="12" rx="8" ry="3"/>
    <ellipse cx="12" cy="18" rx="8" ry="3"/>
  </svg>
);
const IconStats = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const IconCharges = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
  </svg>
);
const IconResultat = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
  </svg>
);
const IconUsers = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

// ── Mapping dashboard id → icône ──
const DASH_ICONS = {
  ca:        <IconCA />,
  stats:     <IconStats />,
  charges:   <IconCharges />,
  resultats: <IconResultat />,
};

const ADMIN_LINKS = [
  { to: "/users", icon: <IconUsers />, label: "Utilisateurs" },
];

export default function Sidebar({ onLogout }) {
  const { hotelId, user, isAdmin, dashboardsVisibles } = useDashboard();

  const logo = HOTEL_LOGOS[hotelId];

  // ── Liens visibles = dashboards autorisés pour cet utilisateur ──
  const visibleBaseLinks = dashboardsVisibles.map(d => ({
    to:    d.route,
    icon:  DASH_ICONS[d.id] || <IconCA />,
    label: d.label,
  }));

  const NavItem = ({ to, icon, label }) => (
    <NavLink to={to} style={{ textDecoration: "none" }}>
      {({ isActive }) => (
        <div
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "9px 13px", borderRadius: "10px", marginBottom: "3px",
            background: isActive ? "linear-gradient(90deg, rgba(201,168,76,0.18), rgba(201,168,76,0.06))" : "transparent",
            color:      isActive ? "#fff8e8" : "rgba(148,163,184,0.9)",
            fontWeight: isActive ? "600" : "400",
            fontSize:   "12px",
            borderLeft: isActive ? "3px solid #c9a84c" : "3px solid transparent",
            boxShadow:  isActive ? "inset 0 0 12px rgba(201,168,76,0.04)" : "none",
            transition: "all 0.15s", cursor: "pointer",
          }}
          onMouseEnter={e => {
            if (!isActive) {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.color      = "#e5f2ff";
              e.currentTarget.style.borderLeft = "3px solid rgba(201,168,76,0.3)";
            }
          }}
          onMouseLeave={e => {
            if (!isActive) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color      = "rgba(148,163,184,0.9)";
              e.currentTarget.style.borderLeft = "3px solid transparent";
            }
          }}
        >
          <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.75, display: "flex", alignItems: "center" }}>
            {icon}
          </span>
          <span style={{ whiteSpace: "nowrap" }}>{label}</span>
        </div>
      )}
    </NavLink>
  );

  return (
    <aside style={{
      width: "240px", minHeight: "100vh", flexShrink: 0,
      background: "linear-gradient(160deg, #060f20 0%, #0a1829 35%, #0d1f38 65%, #0f1f35 100%)",
      display: "flex", flexDirection: "column",
      boxShadow: "6px 0 40px rgba(0,0,0,0.50), inset -1px 0 0 rgba(201,168,76,0.10)",
      position: "relative",
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>

      {/* Filet doré */}
      <div style={{
        position: "absolute", top: 0, right: 0, width: "1px", height: "100%",
        background: "linear-gradient(180deg, transparent 0%, rgba(201,168,76,0.35) 30%, rgba(201,168,76,0.15) 70%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* Logo hôtel */}
      <div style={{ borderBottom: "1px solid rgba(201,168,76,0.12)", flexShrink: 0, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 80%, rgba(201,168,76,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
{logo
  ? <img src={logo} alt="Hotel" style={{ 
    width: "100%", height: "130px", 
    objectFit: (hotelId === 2 || hotelId === 3) ? "contain" : "cover", 
    display: "block", 
    filter: hotelId === 2 ? "none" : (hotelId === 3 ? "invert(1) hue-rotate(180deg) brightness(1.3) contrast(1.1)" : "brightness(0.92) contrast(1.05)"),
    margin: (hotelId === 2 || hotelId === 3) ? "0 auto" : "none",
    padding: "0",
    transform: hotelId === 3 ? "scale(1.4)" : "none",
    mixBlendMode: hotelId === 3 ? "screen" : "normal"
  }} />
          : <div style={{ width: "100%", height: "130px", background: "linear-gradient(135deg, #c9a84c 0%, #a07828 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: "28px", fontWeight: "800" }}>AZ</span>
            </div>
        }
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px 0 9px" }}>
          <div style={{ height: "1px", width: "20px", background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.5))" }} />
          <span style={{ fontSize: "8px", fontWeight: "700", color: "#c9a84c", letterSpacing: "0.22em", textTransform: "uppercase" }}>BI Dashboard</span>
          <div style={{ height: "1px", width: "20px", background: "linear-gradient(90deg, rgba(201,168,76,0.5), transparent)" }} />
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "16px 10px 10px" }}>

        {/* Section Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 12px 12px" }}>
          <div style={{ height: "1px", flex: 1, background: "rgba(148,163,184,0.12)" }} />
          <span style={{ fontSize: "8.5px", fontWeight: "700", color: "rgba(148,163,184,0.5)", letterSpacing: "0.18em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Navigation</span>
          <div style={{ height: "1px", flex: 1, background: "rgba(148,163,184,0.12)" }} />
        </div>

        {/* Dashboards filtrés selon l'utilisateur */}
        {visibleBaseLinks.map(l => <NavItem key={l.to} {...l} />)}

        {/* Section Administration — admins uniquement */}
        {isAdmin && (
          <>
            <div style={{ margin: "14px 12px 10px", display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ height: "1px", flex: 1, background: "rgba(201,168,76,0.15)" }} />
              <span style={{ fontSize: "8.5px", fontWeight: "700", color: "rgba(201,168,76,0.5)", letterSpacing: "0.18em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Administration</span>
              <div style={{ height: "1px", flex: 1, background: "rgba(201,168,76,0.15)" }} />
            </div>
            {ADMIN_LINKS.map(l => <NavItem key={l.to} {...l} />)}
          </>
        )}

        {/* Section Prévisions — isolée en bas */}
        <div style={{ marginTop: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 12px 12px" }}>
            <div style={{ height: "1px", flex: 1, background: "rgba(148,163,184,0.12)" }} />
            <span style={{ fontSize: "8.5px", fontWeight: "700", color: "rgba(148,163,184,0.5)", letterSpacing: "0.18em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Analyse prédictive</span>
            <div style={{ height: "1px", flex: 1, background: "rgba(148,163,184,0.12)" }} />
          </div>
          <NavItem to="/previsions" icon={<span style={{ fontSize: "15px" }}>📉</span>} label="Prévisions" />
        </div>
      </nav>

      {/* Footer utilisateur */}
      <div style={{ padding: "14px 14px 18px", borderTop: "1px solid rgba(201,168,76,0.1)", background: "rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #c9a84c, #a07828)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 2px rgba(201,168,76,0.2), 0 2px 8px rgba(0,0,0,0.3)" }}>
            <span style={{ color: "#5a2e00", fontSize: "13px", fontWeight: "800" }}>
              {(user?.nom || user?.username || "A")[0].toUpperCase()}
            </span>
          </div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.nom || user?.username || "Utilisateur"}
            </div>
            <div style={{ fontSize: "10px", color: "rgba(201,168,76,0.5)", letterSpacing: "0.06em", fontWeight: "600" }}>
              {isAdmin ? "Administrateur" : user?.role || "Utilisateur"}
            </div>
          </div>
        </div>

        <button onClick={onLogout}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,80,80,0.12)"; e.currentTarget.style.color = "#ff6b6b"; e.currentTarget.style.borderColor = "rgba(255,80,80,0.25)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)", fontSize: "11px", fontWeight: "600", cursor: "pointer", letterSpacing: "0.06em", transition: "all 0.15s" }}>
          <IconLogout /> Déconnexion
        </button>
      </div>
    </aside>
  );
}