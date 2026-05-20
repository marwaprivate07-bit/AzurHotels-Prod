import { useState } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import CA from "./pages/CA";
import Stats from "./pages/Stats";
import Charges from "./pages/Charges";
import Resultat from "./pages/Resultat";
import Previsions from "./pages/Previsions";
import UserManagement from "./pages/UserManagement";
import Topbar from "./components/Topbar";
import Sidebar from "./components/Sidebar";
import DashboardProvider from "./components/DashboardContext";

// ── Helper : parse les permissions JSON stockées dans le user ─────────────────
function parseJson(val) {
  if (!val) return null;
  try { return typeof val === "string" ? JSON.parse(val) : val; } catch { return null; }
}

// ── Route protégée par dashboard ─────────────────────────────────────────────
function ProtectedRoute({ user, dashboardId, children }) {
  if (user.role === "admin") return children; // admin = accès total
  const allowed = parseJson(user.allowed_dashboards);
  if (!allowed || !allowed.includes(dashboardId))
    return <Navigate to="/acces-refuse" replace />;
  return children;
}

// ── Page accès refusé ─────────────────────────────────────────────────────────
function AccesRefuse() {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"60vh", gap:"16px" }}>
      <div style={{ width:64, height:64, borderRadius:"50%", background:"rgba(59,130,246,0.08)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <div style={{ fontSize:"20px", fontWeight:"700", color:"#0F172A" }}>Accès non autorisé</div>
      <div style={{ fontSize:"13px", color:"#64748B" }}>Vous n'avez pas accès à ce dashboard.</div>
      <div style={{ fontSize:"12px", color:"#94A3B8" }}>Contactez votre administrateur.</div>
    </div>
  );
}

function AppShell({ user, handleLogout, firstAllowed }) {
  return (
    <DashboardProvider>
      <div className="flex h-screen" style={{ background: "linear-gradient(135deg, #DBEAFE 0%, #E0F2FE 50%, #D6EAFA 100%)" }}>
        <Sidebar user={user} onLogout={handleLogout} />
        <div className="flex flex-col flex-1">
          <Topbar user={user} />
          <main className="flex-1 overflow-auto" style={{ padding: "20px 24px 24px", background: "transparent", overflowX: "hidden" }}>
            <div className="mx-auto" style={{ maxWidth: "1400px", minHeight: "100%" }}>
              <Routes>
                <Route path="/" element={<Navigate to={firstAllowed()} />} />
                <Route path="/ca"       element={<ProtectedRoute user={user} dashboardId="ca"><CA /></ProtectedRoute>} />
                <Route path="/stats"    element={<ProtectedRoute user={user} dashboardId="stats"><Stats /></ProtectedRoute>} />
                <Route path="/charges"  element={<ProtectedRoute user={user} dashboardId="charges"><Charges /></ProtectedRoute>} />
                <Route path="/resultat" element={<ProtectedRoute user={user} dashboardId="resultat"><Resultat /></ProtectedRoute>} />
                <Route path="/previsions" element={<ProtectedRoute user={user} dashboardId="previsions"><Previsions /></ProtectedRoute>} />
                <Route path="/users"    element={user.role === "admin" ? <UserManagement currentUser={user} /> : <Navigate to="/acces-refuse" replace />} />
                <Route path="/acces-refuse" element={<AccesRefuse />} />
                <Route path="*" element={<Navigate to={firstAllowed()} replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </DashboardProvider>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem("bi_user");
    if (!u) return null;
    try {
      return JSON.parse(u);
    } catch {
      localStorage.removeItem("bi_user");
      return null;
    }
  });

  const handleLogin = (userData) => {
    localStorage.setItem("bi_user", JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("bi_token");
    localStorage.removeItem("bi_user");
    setUser(null);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  // Première route accessible pour ce user
  const firstAllowed = () => {
    if (user.role === "admin") return "/ca";
    const allowed = parseJson(user.allowed_dashboards);
    if (!allowed || allowed.length === 0) return "/acces-refuse";
    const map = ["ca","stats","charges","resultat"];
    const first = map.find(d => allowed.includes(d));
    return first ? `/${first}` : "/acces-refuse";
  };

  return (
    <BrowserRouter>
      <AppShell user={user} handleLogout={handleLogout} firstAllowed={firstAllowed} />
    </BrowserRouter>
  );
}
